use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    LazyLock, Mutex,
};
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition};

static PET_IS_DRAGGING: AtomicBool = AtomicBool::new(false);
// Every native drag starts a new position epoch. Auto-move commands created
// before that drag keep the old epoch and can never overwrite the drop point,
// even when an IPC request finishes after the mouse has been released.
static PET_POSITION_EPOCH: AtomicU64 = AtomicU64::new(0);

/// Sole authority for pet desktop placement. The native pet window is always
/// pet-sized (`offset = 0`); speech-bubble chrome must not resize or shift it.
#[derive(Debug, Clone, Copy)]
struct PetAnchor {
    x: i32,
    y: i32,
    initialized: bool,
    bubble_visible: bool,
}

impl Default for PetAnchor {
    fn default() -> Self {
        Self {
            x: 0,
            y: 0,
            initialized: false,
            bubble_visible: false,
        }
    }
}

static PET_ANCHOR: LazyLock<Mutex<PetAnchor>> = LazyLock::new(|| Mutex::new(PetAnchor::default()));
static PET_WINDOW_OPERATION: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

fn should_place_bubble_above(
    anchor_y: i32,
    pet_height: i32,
    message_height: i32,
    monitor_y: i32,
    monitor_height: i32,
) -> bool {
    let space_above = anchor_y - monitor_y;
    let space_below = monitor_y + monitor_height - (anchor_y + pet_height);
    space_above >= message_height || space_above >= space_below
}

fn read_anchor(app: &AppHandle) -> Result<(i32, i32), String> {
    let snapshot = *PET_ANCHOR
        .lock()
        .map_err(|_| "Pet anchor lock was poisoned".to_string())?;
    if snapshot.initialized {
        return Ok((snapshot.x, snapshot.y));
    }

    // Read-only fallback before the first authoritative placement. Do NOT
    // flip `initialized` here — startup must own the real spawn point.
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;
    let position = window
        .outer_position()
        .map_err(|e| format!("Failed to read pet position: {e}"))?;
    Ok((position.x, position.y))
}

fn apply_pet_window_geometry(
    app: &AppHandle,
    pet_width: u32,
    pet_height: u32,
) -> Result<(), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    let snapshot = *PET_ANCHOR
        .lock()
        .map_err(|_| "Pet anchor lock was poisoned".to_string())?;

    window
        .set_size(LogicalSize::new(pet_width as f64, pet_height as f64))
        .map_err(|e| format!("Failed to resize pet window: {e}"))?;

    // CRITICAL: Never call set_position while the OS native-drag loop owns the
    // window. During drag, any set_position can race with the OS and corrupt
    // the outer_position that set_pet_dragging(false) captures as the drop
    // anchor — causing the pet to jump back to the pre-drag position when
    // auto-move resumes.
    if snapshot.initialized && !PET_IS_DRAGGING.load(Ordering::Acquire) {
        window
            .set_position(PhysicalPosition::new(snapshot.x, snapshot.y))
            .map_err(|e| format!("Failed to place pet window: {e}"))?;
    }
    Ok(())
}

fn resolve_bubble_placement(
    app: &AppHandle,
    pet_height: u32,
    scale_percent: u32,
) -> Result<String, String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;
    let (_anchor_x, anchor_y) = read_anchor(app)?;
    let scale_factor = window
        .scale_factor()
        .map_err(|e| format!("Failed to read pet scale factor: {e}"))?;
    let scale_percent = scale_percent.clamp(75, 150);
    let message_scale = scale_percent as f64 / 100.0;
    let gap_logical = 6.0;
    let message_height = 88.0 * message_scale;
    let pet_height_physical = (pet_height as f64 * scale_factor).round() as i32;
    let message_height_physical = ((message_height + gap_logical) * scale_factor).round() as i32;

    let show_above = if let Ok(Some(monitor)) = window.current_monitor() {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        should_place_bubble_above(
            anchor_y - monitor_position.y,
            pet_height_physical,
            message_height_physical,
            0,
            monitor_size.height as i32,
        )
    } else {
        true
    };

    Ok(if show_above { "above" } else { "below" }.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    #[serde(rename = "scaleFactor")]
    pub scale_factor: f64,
    #[serde(rename = "workX")]
    pub work_x: i32,
    #[serde(rename = "workY")]
    pub work_y: i32,
    #[serde(rename = "workWidth")]
    pub work_width: u32,
    #[serde(rename = "workHeight")]
    pub work_height: u32,
    #[serde(rename = "isPrimary")]
    pub is_primary: bool,
}

#[tauri::command]
pub fn get_all_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    let monitors = window
        .available_monitors()
        .map_err(|e| format!("Failed to get monitors: {e}"))?;

    let primary = window.primary_monitor().ok().flatten();
    let primary_name = primary.as_ref().and_then(|m| m.name().map(|s| s.to_string()));

    let result = monitors
        .into_iter()
        .map(|m| {
            let pos = m.position();
            let size = m.size();
            let sf = m.scale_factor();
            // work area: approximate by reducing height for taskbar
            // Tauri 2 doesn't expose work area directly on all platforms;
            // we use full monitor size and subtract a standard taskbar estimate.
            // For precise values, use platform-specific APIs.
            let taskbar_height = (40.0 * sf) as u32;
            MonitorInfo {
                name: m.name().map(|s| s.to_string()),
                x: pos.x,
                y: pos.y,
                width: size.width,
                height: size.height,
                scale_factor: sf,
                work_x: pos.x,
                work_y: pos.y,
                work_width: size.width,
                work_height: size.height.saturating_sub(taskbar_height),
                is_primary: m.name().map(|n| n.to_string()) == primary_name,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub fn move_pet_window(app: AppHandle, x: i32, y: i32, epoch: u64) -> Result<(), String> {
    // Native dragging owns the pet position. Dropping stale auto-move IPC
    // requests here prevents an old RAF command from snapping the pet back
    // underneath the cursor while the OS drag loop is active.
    if PET_IS_DRAGGING.load(Ordering::Acquire)
        || epoch != PET_POSITION_EPOCH.load(Ordering::Acquire)
    {
        return Ok(());
    }
    let _operation = PET_WINDOW_OPERATION
        .lock()
        .map_err(|_| "Pet window operation lock was poisoned".to_string())?;
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    let mut anchor = PET_ANCHOR
        .lock()
        .map_err(|_| "Pet anchor lock was poisoned".to_string())?;

    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| format!("Failed to set position: {e}"))?;
    anchor.x = x;
    anchor.y = y;
    anchor.initialized = true;
    Ok(())
}

/// Move only the pet's horizontal anchor while preserving the stored Y.
/// Never re-reads `outer_position` — macOS rounding would accumulate drift.
#[tauri::command]
pub fn move_pet_window_x(app: AppHandle, x: i32, epoch: u64) -> Result<(), String> {
    if PET_IS_DRAGGING.load(Ordering::Acquire)
        || epoch != PET_POSITION_EPOCH.load(Ordering::Acquire)
    {
        return Ok(());
    }
    let _operation = PET_WINDOW_OPERATION
        .lock()
        .map_err(|_| "Pet window operation lock was poisoned".to_string())?;
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    let mut anchor = PET_ANCHOR
        .lock()
        .map_err(|_| "Pet anchor lock was poisoned".to_string())?;
    if !anchor.initialized {
        return Ok(());
    }

    if anchor.x == x {
        return Ok(());
    }

    window
        .set_position(PhysicalPosition::new(x, anchor.y))
        .map_err(|e| format!("Failed to set horizontal position: {e}"))?;
    anchor.x = x;
    Ok(())
}

/// Re-read the OS window outer position into the pet anchor.
/// Only safe after a true user-driven move (drag end). Not for auto-move.
#[tauri::command]
pub fn refresh_pet_anchor_from_outer(app: AppHandle) -> Result<(i32, i32), String> {
    if PET_IS_DRAGGING.load(Ordering::Acquire) {
        return read_anchor(&app);
    }
    let _operation = PET_WINDOW_OPERATION
        .lock()
        .map_err(|_| "Pet window operation lock was poisoned".to_string())?;
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;
    let position = window
        .outer_position()
        .map_err(|e| format!("Failed to read pet outer position: {e}"))?;
    let mut anchor = PET_ANCHOR
        .lock()
        .map_err(|_| "Pet anchor lock was poisoned".to_string())?;
    anchor.x = position.x;
    anchor.y = position.y;
    anchor.initialized = true;
    Ok((anchor.x, anchor.y))
}

/// Global cursor position in physical pixels (desktop coordinate space).
#[tauri::command]
pub fn get_cursor_position(app: AppHandle) -> Result<(i32, i32), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;
    let position = window
        .cursor_position()
        .map_err(|e| format!("Failed to read cursor position: {e}"))?;
    Ok((position.x.round() as i32, position.y.round() as i32))
}

/// Read the current position epoch without mutating drag/anchor state.
#[tauri::command]
pub fn get_pet_position_epoch() -> Result<u64, String> {
    Ok(PET_POSITION_EPOCH.load(Ordering::Acquire))
}

#[tauri::command]
pub fn set_pet_dragging(app: AppHandle, dragging: bool) -> Result<u64, String> {
    if dragging {
        // Bump the epoch so in-flight auto-move IPC is dropped. Do not resize
        // or move the window — the OS drag loop must capture the real offset.
        PET_IS_DRAGGING.store(true, Ordering::Release);
        let epoch = PET_POSITION_EPOCH.fetch_add(1, Ordering::AcqRel) + 1;
        return Ok(epoch);
    }

    // Only capture a drop anchor when we were actually dragging.
    let was_dragging = PET_IS_DRAGGING.swap(false, Ordering::AcqRel);
    if was_dragging {
        let window = app
            .get_webview_window("pet")
            .ok_or_else(|| "Pet window not found".to_string())?;
        let position = window
            .outer_position()
            .map_err(|e| format!("Failed to capture dropped pet position: {e}"))?;
        let mut anchor = PET_ANCHOR
            .lock()
            .map_err(|_| "Pet anchor lock was poisoned".to_string())?;
        // Window is always pet-sized, so outer_position IS the pet anchor.
        anchor.x = position.x;
        anchor.y = position.y;
        anchor.initialized = true;

        // Bump the epoch after writing the drop anchor so any in-flight
        // move_pet_window_x calls (carrying the pre-drag epoch) are rejected.
        // This prevents stale RAF auto-move IPC from overwriting the drop point.
        PET_POSITION_EPOCH.fetch_add(1, Ordering::AcqRel);
    }
    Ok(PET_POSITION_EPOCH.load(Ordering::Acquire))
}

/// Expand or collapse the pet window to show/hide the speech bubble.
///
/// When `visible` is true, the native window grows to include both the pet
/// and the bubble (placed above or below).  The window is then repositioned
/// so the pet sprite sits at the same screen location as the stored anchor.
///
/// When `visible` is false, the window collapses back to pure pet size and
/// is repositioned so the pet is at the anchor again.
///
/// The pet anchor always refers to the top-left corner of the **pet area**,
/// never to the top-left corner of the expanded window.
#[tauri::command]
pub fn set_pet_bubble_layout(
    app: AppHandle,
    visible: bool,
    pet_width: u32,
    pet_height: u32,
    scale_percent: u32,
) -> Result<String, String> {
    let _operation = PET_WINDOW_OPERATION
        .lock()
        .map_err(|_| "Pet window operation lock was poisoned".to_string())?;

    {
        let mut anchor = PET_ANCHOR
            .lock()
            .map_err(|_| "Pet anchor lock was poisoned".to_string())?;
        anchor.bubble_visible = visible;
    }

    if !visible || PET_IS_DRAGGING.load(Ordering::Acquire) {
        // Collapse: window = pet size, positioned at anchor.
        apply_pet_window_geometry(&app, pet_width, pet_height)?;
        return Ok("hidden".to_string());
    }

    // Determine bubble placement and the logical height of the bubble area.
    let placement = resolve_bubble_placement(&app, pet_height, scale_percent)?;

    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    let scale_factor = window
        .scale_factor()
        .map_err(|e| format!("Failed to read scale factor: {e}"))?;

    let scale_percent_clamped = scale_percent.clamp(75, 150);
    let message_scale = scale_percent_clamped as f64 / 100.0;
    let gap_logical = 6.0_f64;
    let bubble_height_logical = (88.0 * message_scale + gap_logical).ceil() as u32;

    // Total window height includes both pet and bubble areas.
    let total_height = pet_height + bubble_height_logical;

    let (anchor_x, anchor_y) = read_anchor(&app)?;

    // Compute the window origin so the PET area aligns with the anchor.
    let (win_x, win_y) = if placement == "above" {
        // Bubble is above the pet → window top starts at (anchor_y - bubble_height_physical)
        let bubble_height_physical = (bubble_height_logical as f64 * scale_factor).round() as i32;
        (anchor_x, anchor_y - bubble_height_physical)
    } else {
        // Bubble is below the pet → window top is at anchor_y (pet is at top of window)
        (anchor_x, anchor_y)
    };

    window
        .set_size(LogicalSize::new(pet_width as f64, total_height as f64))
        .map_err(|e| format!("Failed to resize pet window for bubble: {e}"))?;

    if !PET_IS_DRAGGING.load(Ordering::Acquire) {
        window
            .set_position(PhysicalPosition::new(win_x, win_y))
            .map_err(|e| format!("Failed to reposition pet window for bubble: {e}"))?;
    }

    Ok(placement)
}

#[tauri::command]
pub fn get_pet_window_position(app: AppHandle) -> Result<(i32, i32), String> {
    read_anchor(&app)
}

/// True once any command has written a pet anchor this process lifetime.
#[tauri::command]
pub fn is_pet_anchor_initialized() -> Result<bool, String> {
    Ok(PET_ANCHOR
        .lock()
        .map_err(|_| "Pet anchor lock was poisoned".to_string())?
        .initialized)
}

#[tauri::command]
pub fn set_pet_window_size(
    app: AppHandle,
    width: u32,
    height: u32,
    scale_percent: u32,
) -> Result<(), String> {
    let _ = scale_percent;
    let _operation = PET_WINDOW_OPERATION
        .lock()
        .map_err(|_| "Pet window operation lock was poisoned".to_string())?;
    apply_pet_window_geometry(&app, width, height)?;
    Ok(())
}

#[tauri::command]
pub fn set_pet_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    window
        .set_always_on_top(enabled)
        .map_err(|e| format!("Failed to set always on top: {e}"))
}

#[tauri::command]
pub fn show_pet_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    window
        .show()
        .map_err(|e| format!("Failed to show pet window: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus pet window: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn hide_pet_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    window
        .hide()
        .map_err(|e| format!("Failed to hide pet window: {e}"))
}

#[tauri::command]
pub fn show_settings_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "Settings window not found".to_string())?;

    window
        .show()
        .map_err(|e| format!("Failed to show settings window: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus settings window: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn hide_settings_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "Settings window not found".to_string())?;

    window
        .hide()
        .map_err(|e| format!("Failed to hide settings window: {e}"))
}

#[tauri::command]
pub fn get_pet_window_outer_size(app: AppHandle) -> Result<(u32, u32), String> {
    let window = app
        .get_webview_window("pet")
        .ok_or_else(|| "Pet window not found".to_string())?;

    let size = window
        .outer_size()
        .map_err(|e| format!("Failed to get outer size: {e}"))?;

    Ok((size.width, size.height))
}

#[cfg(test)]
mod tests {
    use super::{is_pet_anchor_initialized, should_place_bubble_above};

    #[test]
    fn anchor_starts_uninitialized() {
        assert!(!is_pet_anchor_initialized().unwrap());
    }

    #[test]
    fn bubble_prefers_above_when_there_is_room() {
        assert!(should_place_bubble_above(500, 150, 100, 0, 1080));
    }

    #[test]
    fn bubble_moves_below_near_the_top_edge() {
        assert!(!should_place_bubble_above(20, 150, 100, 0, 1080));
    }

    #[test]
    fn bubble_uses_roomier_side_when_neither_side_fits() {
        assert!(should_place_bubble_above(70, 80, 100, 0, 180));
    }
}
