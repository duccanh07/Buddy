use tauri::{App, Manager};
use crate::tray;

pub fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    // Setup system tray
    tray::setup_tray(handle)?;

    // Configure settings window close behavior: hide instead of close
    if let Some(settings_win) = app.get_webview_window("settings") {
        let settings_win_clone = settings_win.clone();
        settings_win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = settings_win_clone.hide();
            }
        });
    }

    // Configure pet window: prevent accidental close
    if let Some(pet_win) = app.get_webview_window("pet") {
        let pet_win_clone = pet_win.clone();
        pet_win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = pet_win_clone.hide();
            }
        });
    }

    log::info!("Buddy setup complete");
    Ok(())
}
