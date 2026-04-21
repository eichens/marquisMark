use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct FileContents {
    pub content: String,
    pub path: String,
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<FileContents, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File not found: {path}"));
    }
    let content = fs::read_to_string(p)
        .map_err(|e| format!("Failed to read file: {e}"))?;
    Ok(FileContents {
        content,
        path,
    })
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {e}"))?;
        }
    }
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file: {e}"))?;
    Ok(())
}
