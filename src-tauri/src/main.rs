#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            if let (Some(splashscreen), Some(main)) =
                (app.get_window("splashscreen"), app.get_window("main"))
            {
                tauri::async_runtime::spawn(async move {
                    std::thread::sleep(std::time::Duration::from_millis(2000));

                    let _ = splashscreen.close();
                    let _ = main.show();
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::file::get_file_metadata])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
