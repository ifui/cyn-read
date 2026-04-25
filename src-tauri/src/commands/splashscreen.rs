use tauri::Manager;

#[tauri::command]
pub async fn close_splashscreen(window: tauri::Window) {
    if let Some(splashscreen) = window.get_window("splashscreen") {
        let _ = splashscreen.close();
    }
    if let Some(main) = window.get_window("main") {
        let _ = main.show();
    }
}
