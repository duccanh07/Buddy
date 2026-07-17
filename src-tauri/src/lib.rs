mod commands;
mod setup;
mod tray;

use commands::config_commands::*;
use commands::window_commands::*;
use commands::pets_commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            setup::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Config commands
            load_config,
            save_config,
            load_reminders,
            save_reminders,
            load_pet_position,
            save_pet_position,
            get_config_dir_path,
            // Window commands
            get_all_monitors,
            get_all_pets,
            import_pet,
            delete_pet,
            update_pet_profile,
            move_pet_window,
            move_pet_window_x,
            refresh_pet_anchor_from_outer,
            get_cursor_position,
            get_pet_window_position,
            get_pet_position_epoch,
            is_pet_anchor_initialized,
            set_pet_window_size,
            set_pet_always_on_top,
            show_pet_window,
            hide_pet_window,
            show_settings_window,
            hide_settings_window,
            get_pet_window_outer_size,
            set_pet_dragging,
            set_pet_bubble_layout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Buddy application");
}
