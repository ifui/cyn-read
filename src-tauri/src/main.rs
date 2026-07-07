#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

static SPLASHSCREEN_CLOSED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
async fn close_splashscreen(window: tauri::Window) {
    if SPLASHSCREEN_CLOSED.load(Ordering::SeqCst) {
        return;
    }

    SPLASHSCREEN_CLOSED.store(true, Ordering::SeqCst);

    if let Some(splashscreen) = window.get_window("splashscreen") {
        let _ = splashscreen.close();
    }
    if let Some(main) = window.get_window("main") {
        let _ = main.show();
    }
}

fn main() {
    let splashscreen_closed = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .setup(move |app| {
            let splashscreen = app.get_window("splashscreen").unwrap();
            let main = app.get_window("main").unwrap();
            let closed = splashscreen_closed.clone();

            tauri::async_runtime::spawn(async move {
                std::thread::sleep(std::time::Duration::from_secs(10));

                if !closed.load(Ordering::SeqCst) {
                    closed.store(true, Ordering::SeqCst);
                    let _ = splashscreen.close();
                    let _ = main.show();
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::file::get_file_metadata,
            commands::file::read_file_as_bytes,
            commands::file::read_file_as_text,
            commands::file::open_file_with_system,
            close_splashscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
