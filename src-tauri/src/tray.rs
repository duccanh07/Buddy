use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_pet = MenuItem::with_id(app, "show_pet", "Show Pet", true, None::<&str>)?;
    let hide_pet = MenuItem::with_id(app, "hide_pet", "Hide Pet", true, None::<&str>)?;
    let open_settings =
        MenuItem::with_id(app, "open_settings", "Open Settings", true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let pause_movement = MenuItem::with_id(
        app,
        "pause_movement",
        "Pause Movement",
        true,
        None::<&str>,
    )?;
    let resume_movement = MenuItem::with_id(
        app,
        "resume_movement",
        "Resume Movement",
        true,
        None::<&str>,
    )?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let reset_position =
        MenuItem::with_id(app, "reset_position", "Reset Position", true, None::<&str>)?;
    let separator3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Exit Buddy", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_pet,
            &hide_pet,
            &open_settings,
            &separator1,
            &pause_movement,
            &resume_movement,
            &separator2,
            &reset_position,
            &separator3,
            &quit,
        ],
    )?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Buddy — Desktop Pet")
        .on_menu_event(|app, event| {
            handle_tray_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                // Left click opens settings
                if let Some(win) = app.get_webview_window("settings") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn handle_tray_menu_event(app: &AppHandle, id: &str) {
    match id {
        "show_pet" => {
            if let Some(win) = app.get_webview_window("pet") {
                let _ = win.show();
            }
        }
        "hide_pet" => {
            if let Some(win) = app.get_webview_window("pet") {
                let _ = win.hide();
            }
        }
        "open_settings" => {
            if let Some(win) = app.get_webview_window("settings") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
        "pause_movement" => {
            let _ = app.emit("pet-pause", ());
        }
        "resume_movement" => {
            let _ = app.emit("pet-resume", ());
        }
        "reset_position" => {
            // Delegate to the JS handler so the reset goes through the
            // anchor/offset-aware `move_pet_window` command. Calling
            // `win.set_position` directly here bypasses the composite layout
            // math and caused the pet to visibly jump (once to the raw center,
            // then again to the JS-computed default) before landing.
            let _ = app.emit("pet-reset-position", ());
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
