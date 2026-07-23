use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetProfile {
    pub id: String,
    pub name: String,
    pub image_path: String,
    pub width: u32,
    pub height: u32,
    pub preserve_aspect_ratio: bool,
    pub spritesheet_enabled: bool,
    pub spritesheet_cols: u32,
    pub spritesheet_rows: u32,
    pub spritesheet_fps: u32,
    pub spritesheet_idle_frame: u32,
    pub spritesheet_walk_frame: u32,
    pub spritesheet_drag_frame: u32,
    pub spritesheet_sleep_frame: u32,
    #[serde(default)]
    pub sprite_version_number: Option<u32>,
    #[serde(default)]
    pub animation_manifest: Option<Value>,
}

fn frame_sequence(row: u32, columns: u32) -> Vec<u32> {
    (0..columns).map(|column| row * columns + column).collect()
}

fn build_codex_manifest(frame_width: u32, frame_height: u32, rows: u32, fps: u32) -> Value {
    let columns = 8;
    let mut animations = Map::new();
    let standard_rows = [
        ("idle", 0),
        ("running-right", 1),
        ("running-left", 2),
        ("waving", 3),
        ("jumping", 4),
        ("failed", 5),
        ("waiting", 6),
        ("running", 7),
        ("review", 8),
    ];
    for (name, row) in standard_rows {
        animations.insert(name.to_string(), json!({
            "frames": frame_sequence(row, columns),
            "loop": true
        }));
    }

    if rows == 11 {
        let degrees = [
            "000", "022.5", "045", "067.5", "090", "112.5", "135", "157.5",
            "180", "202.5", "225", "247.5", "270", "292.5", "315", "337.5",
        ];
        for (index, degree) in degrees.iter().enumerate() {
            animations.insert(format!("look-{degree}"), json!({
                "frames": [9 * columns + index as u32],
                "loop": false
            }));
        }
        let look_frames: Vec<u32> = (9 * columns..11 * columns).collect();
        animations.insert("look-around".to_string(), json!({
            "frames": look_frames,
            "loop": true
        }));
    }

    json!({
        "version": if rows == 11 { 2 } else { 1 },
        "frameWidth": frame_width,
        "frameHeight": frame_height,
        "columns": columns,
        "rows": rows,
        "defaultFps": fps,
        "animations": animations
    })
}

fn get_pets_file_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("pets.json")
}

fn get_pets_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("pets")
}

#[tauri::command]
pub fn get_all_pets(app: AppHandle) -> Result<Vec<PetProfile>, String> {
    let path = get_pets_file_path(&app);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let pets: Vec<PetProfile> = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(pets)
}

use std::io::Read;

fn get_image_dimensions(path: &std::path::Path) -> Option<(u32, u32)> {
    let mut file = fs::File::open(path).ok()?;
    let mut header = [0u8; 30];
    file.read_exact(&mut header).ok()?;

    // PNG format check
    if header.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]) {
        let w = u32::from_be_bytes([header[16], header[17], header[18], header[19]]);
        let h = u32::from_be_bytes([header[20], header[21], header[22], header[23]]);
        return Some((w, h));
    }

    // WebP/RIFF format check
    if header.starts_with(b"RIFF") && header[8..12] == *b"WEBP" {
        let fmt = &header[12..16];
        if fmt == b"VP8X" {
            let w = u32::from_le_bytes([header[24], header[25], header[26], 0]) + 1;
            let h = u32::from_le_bytes([header[27], header[28], header[29], 0]) + 1;
            return Some((w, h));
        } else if fmt == b"VP8L" {
            let val = u32::from_le_bytes([header[21], header[22], header[23], header[24]]);
            let w = (val & 0x3FFF) + 1;
            let h = ((val >> 14) & 0x3FFF) + 1;
            return Some((w, h));
        } else if fmt == b"VP8 " {
            let w = (u16::from_le_bytes([header[26], header[27]]) & 0x3FFF) as u32;
            let h = (u16::from_le_bytes([header[28], header[29]]) & 0x3FFF) as u32;
            return Some((w, h));
        }
    }
    None
}

#[tauri::command]
pub fn import_pet(
    app: AppHandle,
    name: String,
    source_path: String,
    width: u32,
    height: u32,
    preserve_aspect_ratio: bool,
) -> Result<PetProfile, String> {
    let pets_dir = get_pets_dir(&app);
    if !pets_dir.exists() {
        fs::create_dir_all(&pets_dir).map_err(|e| e.to_string())?;
    }

    let source = std::path::PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file does not exist: {}", source_path));
    }

    let ext = source.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    
    let mut actual_source_image = source.clone();
    let mut pet_name = name.clone();
    let mut is_codex = false;
    let mut sprite_version_number: Option<u32> = None;
    let mut animation_manifest: Option<Value> = None;

    // Handle Codex pet.json
    if ext == "json" {
        let json_content = fs::read_to_string(&source).map_err(|e| format!("Failed to read pet.json: {e}"))?;
        let json: serde_json::Value = serde_json::from_str(&json_content).map_err(|e| format!("Failed to parse pet.json: {e}"))?;
        sprite_version_number = json.get("spriteVersionNumber")
            .or_else(|| json.get("sprite_version_number"))
            .and_then(|value| value.as_u64())
            .map(|value| value as u32);
        animation_manifest = json.get("animationManifest")
            .or_else(|| json.get("animation_manifest"))
            .cloned();
        
        if let Some(display_name) = json.get("displayName").and_then(|v| v.as_str()) {
            pet_name = display_name.to_string();
        } else if let Some(display_name) = json.get("display_name").and_then(|v| v.as_str()) {
            pet_name = display_name.to_string();
        }

        let spritesheet_filename = json.get("spritesheetPath")
            .and_then(|v| v.as_str())
            .or_else(|| json.get("spritesheet_path").and_then(|v| v.as_str()))
            .unwrap_or("spritesheet.webp");

        let parent_dir = source.parent().ok_or_else(|| "Failed to get parent directory of pet.json".to_string())?;
        actual_source_image = parent_dir.join(spritesheet_filename);
        if !actual_source_image.exists() {
            return Err(format!("Spritesheet file not found in same directory: {}", spritesheet_filename));
        }
        is_codex = true;
    }

    let img_ext = actual_source_image.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("webp")
        .to_lowercase();

    let id = format!("pet_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let new_filename = format!("{}.{}", id, img_ext);
    let dest_path = pets_dir.join(&new_filename);

    fs::copy(&actual_source_image, &dest_path).map_err(|e| e.to_string())?;

    // Read actual dimensions
    let (img_w, img_h) = get_image_dimensions(&dest_path).unwrap_or((150, 150));

    // A WebP/PNG may provide semantic animation names through a sibling
    // `<name>.animation.json` file. Raw pixels alone cannot encode state names.
    if animation_manifest.is_none() && ext != "json" {
        let sidecar_path = source.with_extension("animation.json");
        if sidecar_path.exists() {
            let content = fs::read_to_string(&sidecar_path)
                .map_err(|e| format!("Failed to read animation sidecar: {e}"))?;
            let sidecar: Value = serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse animation sidecar: {e}"))?;
            animation_manifest = sidecar.get("animationManifest")
                .or_else(|| sidecar.get("animation_manifest"))
                .cloned()
                .or(Some(sidecar));
        }
    }

    let mut spritesheet_enabled = is_codex || img_ext == "webp" || img_ext == "png";
    let mut spritesheet_cols = 4;
    let mut spritesheet_rows = 8;
    let mut render_w = width;
    let mut render_h = height;

    if spritesheet_enabled {
        if img_w == 1536 && img_h == 2288 {
            // Codex V2 standard
            spritesheet_cols = 8;
            spritesheet_rows = 11;
            render_w = 192;
            render_h = 208;
            sprite_version_number = Some(2);
        } else if img_w == 1536 && img_h == 1872 {
            // Codex V1 standard
            spritesheet_cols = 8;
            spritesheet_rows = 9;
            render_w = 192;
            render_h = 208;
            sprite_version_number = Some(1);
        } else if img_w >= 500 && img_h >= 500 {
            // Other large spritesheets - detect grid by aspect ratio
            let ratio = img_h as f32 / img_w as f32;
            if (ratio - (2288.0 / 1536.0)).abs() < 0.05 {
                spritesheet_cols = 8;
                spritesheet_rows = 11;
                render_w = img_w / 8;
                render_h = img_h / 11;
                sprite_version_number = Some(2);
            } else if (ratio - (1872.0 / 1536.0)).abs() < 0.05 {
                spritesheet_cols = 8;
                spritesheet_rows = 9;
                render_w = img_w / 8;
                render_h = img_h / 9;
                sprite_version_number = Some(1);
            } else if (ratio - 2.0).abs() < 0.05 {
                // Shimeji/Standard 4x8
                spritesheet_cols = 4;
                spritesheet_rows = 8;
                render_w = img_w / 4;
                render_h = img_h / 8;
            } else {
                // Default fallback for general large sheets
                spritesheet_cols = 8;
                spritesheet_rows = 9;
                render_w = img_w / 8;
                render_h = img_h / 9;
            }
        } else {
            // Very small images or single frame profiles
            spritesheet_enabled = false;
            render_w = img_w;
            render_h = img_h;
        }
    }

    let spritesheet_fps = 6;

    if animation_manifest.is_none() && spritesheet_cols == 8 && (spritesheet_rows == 9 || spritesheet_rows == 11) {
        animation_manifest = Some(build_codex_manifest(
            img_w / spritesheet_cols,
            img_h / spritesheet_rows,
            spritesheet_rows,
            spritesheet_fps,
        ));
    }
    let spritesheet_idle_frame = 0;
    let spritesheet_walk_frame = if spritesheet_cols == 8 { 8 } else { 4 };
    let spritesheet_drag_frame = if spritesheet_cols == 8 { 32 } else { 20 };
    let spritesheet_sleep_frame = if spritesheet_cols == 8 { 56 } else { 28 };

    let profile = PetProfile {
        id,
        name: pet_name,
        image_path: dest_path.to_string_lossy().to_string(),
        width: render_w,
        height: render_h,
        preserve_aspect_ratio,
        spritesheet_enabled,
        spritesheet_cols,
        spritesheet_rows,
        spritesheet_fps,
        spritesheet_idle_frame,
        spritesheet_walk_frame,
        spritesheet_drag_frame,
        spritesheet_sleep_frame,
        sprite_version_number,
        animation_manifest,
    };

    let mut pets = get_all_pets(app.clone()).unwrap_or_default();
    pets.push(profile.clone());

    let pets_file = get_pets_file_path(&app);
    let json = serde_json::to_string_pretty(&pets).map_err(|e| e.to_string())?;
    fs::write(pets_file, json).map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub fn delete_pet(app: AppHandle, id: String) -> Result<(), String> {
    let mut pets = get_all_pets(app.clone())?;
    
    // Find the pet to delete its file
    if let Some(pet) = pets.iter().find(|p| p.id == id) {
        let path = PathBuf::from(&pet.image_path);
        if path.exists() {
            let _ = fs::remove_file(path); // Ignore error if file is already deleted or locked
        }
    }

    pets.retain(|p| p.id != id);

    let pets_file = get_pets_file_path(&app);
    let json = serde_json::to_string_pretty(&pets).map_err(|e| e.to_string())?;
    fs::write(pets_file, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn update_pet_profile(
    app: AppHandle,
    id: String,
    width: u32,
    height: u32,
    preserve_aspect_ratio: bool,
    spritesheet_enabled: bool,
    spritesheet_cols: u32,
    spritesheet_rows: u32,
    spritesheet_fps: u32,
    spritesheet_idle_frame: u32,
    spritesheet_walk_frame: u32,
    spritesheet_drag_frame: u32,
    spritesheet_sleep_frame: u32,
    sprite_version_number: Option<u32>,
    animation_manifest: Option<Value>,
) -> Result<(), String> {
    let mut pets = get_all_pets(app.clone())?;
    if let Some(pet) = pets.iter_mut().find(|p| p.id == id) {
        pet.width = width;
        pet.height = height;
        pet.preserve_aspect_ratio = preserve_aspect_ratio;
        pet.spritesheet_enabled = spritesheet_enabled;
        pet.spritesheet_cols = spritesheet_cols;
        pet.spritesheet_rows = spritesheet_rows;
        pet.spritesheet_fps = spritesheet_fps;
        pet.spritesheet_idle_frame = spritesheet_idle_frame;
        pet.spritesheet_walk_frame = spritesheet_walk_frame;
        pet.spritesheet_drag_frame = spritesheet_drag_frame;
        pet.spritesheet_sleep_frame = spritesheet_sleep_frame;
        pet.sprite_version_number = sprite_version_number;
        pet.animation_manifest = animation_manifest;
    }

    let pets_file = get_pets_file_path(&app);
    let json = serde_json::to_string_pretty(&pets).map_err(|e| e.to_string())?;
    fs::write(pets_file, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::build_codex_manifest;

    #[test]
    fn v2_manifest_contains_all_standard_and_direction_states() {
        let manifest = build_codex_manifest(192, 208, 11, 6);
        let animations = manifest["animations"].as_object().unwrap();

        assert_eq!(manifest["version"], 2);
        assert_eq!(animations.len(), 26);
        assert_eq!(animations["idle"]["frames"][0], 0);
        assert_eq!(animations["review"]["frames"][7], 71);
        assert_eq!(animations["look-000"]["frames"][0], 72);
        assert_eq!(animations["look-337.5"]["frames"][0], 87);
    }

    #[test]
    fn v1_manifest_stops_after_standard_rows() {
        let manifest = build_codex_manifest(192, 208, 9, 6);
        let animations = manifest["animations"].as_object().unwrap();

        assert_eq!(manifest["version"], 1);
        assert_eq!(animations.len(), 9);
        assert!(!animations.contains_key("look-around"));
    }
}
