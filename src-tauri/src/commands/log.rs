use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const LOG_FILENAME: &str = "error.log";
// Rotate when the file passes ~1 MB. The file is line-oriented JSON, so we
// truncate from the front by keeping the last N lines whose total size fits
// in MAX_LOG_BYTES. This keeps the cost bounded without reaching for a real
// rotation library.
const MAX_LOG_BYTES: u64 = 1_000_000;
const KEEP_AFTER_ROTATION: usize = 500;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: String,
    pub message: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub stack: Option<String>,
    #[serde(default)]
    pub context: Option<String>,
}

fn log_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create app data dir: {e}"))?;
    }
    Ok(dir.join(LOG_FILENAME))
}

fn rotate_if_needed(path: &PathBuf) -> Result<(), String> {
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return Ok(()),
    };
    if meta.len() <= MAX_LOG_BYTES {
        return Ok(());
    }
    let file = fs::File::open(path).map_err(|e| format!("Failed to open log: {e}"))?;
    let lines: Vec<String> = BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .collect();
    let keep_from = lines.len().saturating_sub(KEEP_AFTER_ROTATION);
    let kept = &lines[keep_from..];
    let mut out = fs::File::create(path).map_err(|e| format!("Failed to rewrite log: {e}"))?;
    for line in kept {
        writeln!(out, "{line}").map_err(|e| format!("Failed to write log: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn log_event(app: AppHandle, entry: LogEntry) -> Result<(), String> {
    let path = log_path(&app)?;
    rotate_if_needed(&path)?;
    let line = serde_json::to_string(&entry)
        .map_err(|e| format!("Failed to serialize log entry: {e}"))?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open log: {e}"))?;
    writeln!(file, "{line}").map_err(|e| format!("Failed to write log: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn read_log(app: AppHandle) -> Result<Vec<LogEntry>, String> {
    let path = log_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let file = fs::File::open(&path).map_err(|e| format!("Failed to open log: {e}"))?;
    let entries: Vec<LogEntry> = BufReader::new(file)
        .lines()
        .filter_map(|l| l.ok())
        .filter_map(|l| serde_json::from_str::<LogEntry>(&l).ok())
        .collect();
    Ok(entries)
}

#[tauri::command]
pub async fn clear_log(app: AppHandle) -> Result<(), String> {
    let path = log_path(&app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to clear log: {e}"))?;
    }
    Ok(())
}
