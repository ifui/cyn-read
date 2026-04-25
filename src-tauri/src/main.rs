#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub size: u64,
    pub is_dir: bool,
    pub is_file: bool,
    pub modified: Option<u64>,
    pub created: Option<u64>,
}

#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let path = Path::new(&path);
    
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    
    let modified = metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    
    let created = metadata.created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    
    Ok(FileMetadata {
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        is_file: metadata.is_file(),
        modified,
        created,
    })
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_file_metadata])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
