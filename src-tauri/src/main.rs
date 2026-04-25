#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::file::get_file_metadata,
            commands::splashscreen::close_splashscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
