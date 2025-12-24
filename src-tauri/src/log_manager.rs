//! Log File Manager for managing JSON log files in the monitored folder.
//!
//! This module provides functionality to:
//! - List all JSON log files in the monitored logs directory
//! - Import external log files by copying them to the monitored folder
//! - Delete log files from the monitored folder
//! - Get metadata about log files (size, modified date, event count)

use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

use crate::models::{LogFileInfo, SiemError};
use tauri::Manager;

/// Get the directory path where log files are stored.
/// Creates the directory if it doesn't exist.
pub fn get_logs_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, SiemError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| SiemError::FileIO(format!("Cannot get app data dir: {}", e)))?;

    let logs_dir = app_data_dir.join("logs");

    if !logs_dir.exists() {
        fs::create_dir_all(&logs_dir)
            .map_err(|e| SiemError::FileIO(format!("Cannot create logs dir: {}", e)))?;
    }

    Ok(logs_dir)
}

/// List all JSON log files in the monitored folder.
pub fn list_log_files(app_handle: &tauri::AppHandle) -> Result<Vec<LogFileInfo>, SiemError> {
    let logs_dir = get_logs_dir(app_handle)?;
    let mut log_files = Vec::new();

    if !logs_dir.exists() {
        return Ok(log_files);
    }

    let entries = fs::read_dir(&logs_dir)
        .map_err(|e| SiemError::FileIO(format!("Cannot read logs dir: {}", e)))?;

    for entry in entries {
        let entry = entry.map_err(|e| SiemError::FileIO(format!("Cannot read entry: {}", e)))?;
        let path = entry.path();

        // Only include .json files
        if path.extension().map_or(false, |ext| ext == "json") {
            match get_log_file_info(&path) {
                Ok(info) => log_files.push(info),
                Err(e) => {
                    // Log error but continue loading other files
                    eprintln!("Warning: Failed to get info for {:?}: {}", path, e);
                }
            }
        }
    }

    // Sort by filename for consistent ordering
    log_files.sort_by(|a, b| a.filename.cmp(&b.filename));

    Ok(log_files)
}

/// Import an external log file by copying it to the monitored folder.
/// Returns the new LogFileInfo for the imported file.
pub fn import_log_file(
    app_handle: &tauri::AppHandle,
    source_path: &str,
) -> Result<LogFileInfo, SiemError> {
    let source = PathBuf::from(source_path);

    // Validate source file exists
    if !source.exists() {
        return Err(SiemError::FileIO(format!(
            "Source file does not exist: {}",
            source_path
        )));
    }

    // Validate it's a JSON file
    if !source.extension().map_or(false, |ext| ext == "json") {
        return Err(SiemError::FileIO(
            "Only JSON files can be imported".to_string(),
        ));
    }

    let logs_dir = get_logs_dir(app_handle)?;

    // Get filename from source
    let filename = source
        .file_name()
        .ok_or_else(|| SiemError::FileIO("Invalid filename".to_string()))?
        .to_string_lossy()
        .to_string();

    let dest_path = logs_dir.join(&filename);

    // Check if file already exists
    if dest_path.exists() {
        return Err(SiemError::FileIO(format!(
            "File already exists in logs folder: {}",
            filename
        )));
    }

    // Copy the file
    fs::copy(&source, &dest_path)
        .map_err(|e| SiemError::FileIO(format!("Cannot copy file: {}", e)))?;

    // Return info about the newly imported file
    get_log_file_info(&dest_path)
}

/// Delete a log file from the monitored folder.
pub fn delete_log_file(app_handle: &tauri::AppHandle, filename: &str) -> Result<(), SiemError> {
    let logs_dir = get_logs_dir(app_handle)?;
    let file_path = logs_dir.join(filename);

    if !file_path.exists() {
        return Err(SiemError::FileIO(format!("File not found: {}", filename)));
    }

    // Ensure the file is within the logs directory (security check)
    if !file_path.starts_with(&logs_dir) {
        return Err(SiemError::FileIO(
            "Invalid file path - security violation".to_string(),
        ));
    }

    fs::remove_file(&file_path)
        .map_err(|e| SiemError::FileIO(format!("Cannot delete file: {}", e)))?;

    Ok(())
}

/// Get detailed information about a specific log file.
fn get_log_file_info(path: &PathBuf) -> Result<LogFileInfo, SiemError> {
    let metadata = fs::metadata(path)
        .map_err(|e| SiemError::FileIO(format!("Cannot read file metadata: {}", e)))?;

    let filename = path
        .file_name()
        .ok_or_else(|| SiemError::FileIO("Invalid filename".to_string()))?
        .to_string_lossy()
        .to_string();

    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);

    let modified_str = chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339();

    // Try to estimate event count by reading the file
    let event_count = estimate_event_count(path);

    Ok(LogFileInfo {
        filename,
        path: path.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        modified: modified_str,
        event_count,
    })
}

/// Estimate the number of events in a JSON log file.
/// This is a best-effort estimation by counting newlines or array elements.
fn estimate_event_count(path: &PathBuf) -> Option<usize> {
    // Try to read the file and count events
    match fs::read_to_string(path) {
        Ok(content) => {
            // Try to parse as JSON array first
            if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(array) = json_value.as_array() {
                    return Some(array.len());
                }
            }

            // If not an array, count newlines (for NDJSON format)
            let line_count = content.lines().count();
            if line_count > 0 {
                return Some(line_count);
            }

            None
        }
        Err(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_estimate_event_count_array() {
        // Test with JSON array
        let json_content = r#"[{"event": 1}, {"event": 2}, {"event": 3}]"#;
        let temp_file = std::env::temp_dir().join("test_array.json");
        fs::write(&temp_file, json_content).unwrap();

        let count = estimate_event_count(&temp_file);
        assert_eq!(count, Some(3));

        fs::remove_file(&temp_file).unwrap();
    }

    #[test]
    fn test_estimate_event_count_ndjson() {
        // Test with NDJSON format
        let ndjson_content = "{\"event\": 1}\n{\"event\": 2}\n{\"event\": 3}";
        let temp_file = std::env::temp_dir().join("test_ndjson.json");
        fs::write(&temp_file, ndjson_content).unwrap();

        let count = estimate_event_count(&temp_file);
        assert_eq!(count, Some(3));

        fs::remove_file(&temp_file).unwrap();
    }
}
