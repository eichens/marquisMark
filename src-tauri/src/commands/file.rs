use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct FileContents {
    pub content: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
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
pub async fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
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

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let p = Path::new(&path);
    if !p.is_dir() {
        return Err(format!("Not a directory: {path}"));
    }
    let read_dir = fs::read_dir(p)
        .map_err(|e| format!("Failed to read directory: {e}"))?;
    let mut entries = Vec::new();
    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let meta = entry.metadata()
            .map_err(|e| format!("Failed to read metadata: {e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: meta.is_dir(),
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}
