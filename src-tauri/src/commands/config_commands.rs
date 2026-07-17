use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

// ---------- Data Structures ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetConfigJson {
    pub theme: String,
    pub active_pet_id: Option<String>,
    pub image_path: String,
    pub width: u32,
    pub height: u32,
    pub preserve_aspect_ratio: bool,
    pub always_on_top: bool,
    pub auto_move_enabled: bool,
    pub react_on_hover: bool,
    pub movement_speed: f64,
    pub movement_duration_ms: u64,
    pub movement_interval_ms: u64,
    pub reminder_bubble_scale: Option<u32>,
    pub initial_x: Option<f64>,
    pub initial_y: Option<f64>,
    pub startup_enabled: bool,
    pub idle_image_path: Option<String>,
    pub walking_image_path: Option<String>,
    pub hover_image_path: Option<String>,
    pub sleeping_image_path: Option<String>,
    pub spritesheet_enabled: Option<bool>,
    pub spritesheet_cols: Option<u32>,
    pub spritesheet_rows: Option<u32>,
    pub spritesheet_fps: Option<u32>,
    pub spritesheet_idle_frame: Option<u32>,
    pub spritesheet_walk_frame: Option<u32>,
    pub spritesheet_drag_frame: Option<u32>,
    pub spritesheet_sleep_frame: Option<u32>,
    pub sprite_version_number: Option<u32>,
    pub animation_manifest: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderJson {
    pub id: String,
    pub title: String,
    pub content: String,
    pub enabled: bool,
    pub schedule_type: String,
    pub scheduled_at: Option<String>,
    pub interval_minutes: Option<u64>,
    pub interval_seconds: Option<u64>,
    pub last_triggered_at: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetPositionJson {
    pub x: i32,
    pub y: i32,
}

impl Default for PetConfigJson {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            active_pet_id: None,
            image_path: String::new(),
            width: 150,
            height: 150,
            preserve_aspect_ratio: true,
            always_on_top: true,
            auto_move_enabled: true,
            react_on_hover: true,
            movement_speed: 80.0,
            movement_duration_ms: 3000,
            movement_interval_ms: 2000,
            reminder_bubble_scale: Some(100),
            initial_x: None,
            initial_y: None,
            startup_enabled: false,
            idle_image_path: None,
            walking_image_path: None,
            hover_image_path: None,
            sleeping_image_path: None,
            spritesheet_enabled: Some(false),
            spritesheet_cols: Some(4),
            spritesheet_rows: Some(4),
            spritesheet_fps: Some(8),
            spritesheet_idle_frame: Some(0),
            spritesheet_walk_frame: Some(1),
            spritesheet_drag_frame: Some(2),
            spritesheet_sleep_frame: Some(3),
            sprite_version_number: None,
            animation_manifest: None,
        }
    }
}

// ---------- Config File Paths ----------

fn get_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to get config dir: {e}"))?;
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(path)
}

fn get_pet_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_config_dir(app)?.join("pet_config.json"))
}

fn get_reminders_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_config_dir(app)?.join("reminders.json"))
}

fn get_pet_position_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_config_dir(app)?.join("pet_position.json"))
}

// ---------- Safe Write (write to temp then rename) ----------

fn safe_write_json<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), String> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("JSON serialization error: {e}"))?;

    let tmp_path = path.with_extension("tmp");
    fs::write(&tmp_path, &json)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;

    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Failed to rename temp file: {e}"))?;

    Ok(())
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub fn load_config(app: AppHandle) -> Result<PetConfigJson, String> {
    let path = get_pet_config_path(&app)?;

    if !path.exists() {
        log::info!("Config file not found, returning default config");
        return Ok(PetConfigJson::default());
    }

    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {e}"))?;

    match serde_json::from_str::<PetConfigJson>(&raw) {
        Ok(config) => Ok(config),
        Err(e) => {
            log::error!("Config parse error, backing up and using default: {e}");
            // Backup the corrupt file
            let backup_path = path.with_extension("json.bak");
            let _ = fs::copy(&path, &backup_path);
            Ok(PetConfigJson::default())
        }
    }
}

#[tauri::command]
pub fn save_config(app: AppHandle, config: PetConfigJson) -> Result<(), String> {
    let path = get_pet_config_path(&app)?;
    safe_write_json(&path, &config)
}

#[tauri::command]
pub fn load_reminders(app: AppHandle) -> Result<Vec<ReminderJson>, String> {
    let path = get_reminders_path(&app)?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read reminders: {e}"))?;

    match serde_json::from_str::<Vec<ReminderJson>>(&raw) {
        Ok(reminders) => Ok(reminders),
        Err(e) => {
            log::error!("Reminders parse error, backing up and returning empty: {e}");
            let backup_path = path.with_extension("json.bak");
            let _ = fs::copy(&path, &backup_path);
            Ok(Vec::new())
        }
    }
}

#[tauri::command]
pub fn save_reminders(app: AppHandle, reminders: Vec<ReminderJson>) -> Result<(), String> {
    let path = get_reminders_path(&app)?;
    safe_write_json(&path, &reminders)
}

#[tauri::command]
pub fn load_pet_position(app: AppHandle) -> Result<Option<PetPositionJson>, String> {
    let path = get_pet_position_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read pet position: {e}"))?;
    serde_json::from_str::<PetPositionJson>(&raw)
        .map(Some)
        .map_err(|e| format!("Failed to parse pet position: {e}"))
}

#[tauri::command]
pub fn save_pet_position(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    let path = get_pet_position_path(&app)?;
    safe_write_json(&path, &PetPositionJson { x, y })
}

#[tauri::command]
pub fn get_config_dir_path(app: AppHandle) -> Result<String, String> {
    let dir = get_config_dir(&app)?;
    dir.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Invalid config dir path encoding".to_string())
}
