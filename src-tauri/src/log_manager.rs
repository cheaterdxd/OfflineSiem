//! Log File Manager for managing JSON log files in the monitored folder.
//!
//! This module provides functionality to:
//! - List all JSON log files in the monitored logs directory
//! - Import external log files by copying them to the monitored folder
//! - Delete log files from the monitored folder
//! - Get metadata about log files (size, modified date, event count)

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::SystemTime;

use crate::models::{ImportSummary, LogFileInfo, LogType, SiemError};
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

/// Get the path to the metadata file.
fn get_metadata_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, SiemError> {
    let logs_dir = get_logs_dir(app_handle)?;
    Ok(logs_dir.join("metadata.json"))
}

/// Load metadata from file.
fn load_metadata(app_handle: &tauri::AppHandle) -> HashMap<String, LogType> {
    let metadata_path = match get_metadata_path(app_handle) {
        Ok(path) => path,
        Err(_) => return HashMap::new(),
    };

    if !metadata_path.exists() {
        return HashMap::new();
    }

    match fs::read_to_string(&metadata_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

/// Save metadata to file.
fn save_metadata(
    app_handle: &tauri::AppHandle,
    metadata: &HashMap<String, LogType>,
) -> Result<(), SiemError> {
    let metadata_path = get_metadata_path(app_handle)?;
    let content = serde_json::to_string_pretty(metadata)
        .map_err(|e| SiemError::Serialization(format!("Cannot serialize metadata: {}", e)))?;

    fs::write(&metadata_path, content)
        .map_err(|e| SiemError::FileIO(format!("Cannot write metadata: {}", e)))?;

    Ok(())
}

/// Set log type for a specific file.
pub fn set_log_type(
    app_handle: &tauri::AppHandle,
    filename: &str,
    log_type: LogType,
) -> Result<(), SiemError> {
    let mut metadata = load_metadata(app_handle);
    metadata.insert(filename.to_string(), log_type);
    save_metadata(app_handle, &metadata)?;
    Ok(())
}

/// Get log type for a specific file.
pub fn get_log_type(app_handle: &tauri::AppHandle, filename: &str) -> Option<LogType> {
    let metadata = load_metadata(app_handle);
    metadata.get(filename).cloned()
}

/// List all JSON log files in the monitored folder.
pub fn list_log_files(app_handle: &tauri::AppHandle) -> Result<Vec<LogFileInfo>, SiemError> {
    let logs_dir = get_logs_dir(app_handle)?;
    let mut log_files = Vec::new();

    if !logs_dir.exists() {
        return Ok(log_files);
    }

    // Load metadata once for all files
    let metadata = load_metadata(app_handle);

    let entries = fs::read_dir(&logs_dir)
        .map_err(|e| SiemError::FileIO(format!("Cannot read logs dir: {}", e)))?;

    for entry in entries {
        let entry = entry.map_err(|e| SiemError::FileIO(format!("Cannot read entry: {}", e)))?;
        let path = entry.path();

        // Get filename for checking
        let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        // Only include .json files, but exclude metadata.json (system file)
        if path.extension().map_or(false, |ext| ext == "json") && filename != "metadata.json" {
            match get_log_file_info_with_metadata(&path, &metadata) {
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
    log_type: LogType,
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

    // Save log type to metadata
    set_log_type(app_handle, &filename, log_type.clone())?;

    // Return info about the newly imported file with log type
    let mut info = get_log_file_info(&dest_path)?;
    info.log_type = Some(log_type);
    Ok(info)
}

/// Import multiple log files at once with the same log type.
/// Returns a summary of the import operation.
pub fn import_multiple_log_files(
    app_handle: &tauri::AppHandle,
    source_paths: Vec<String>,
    log_type: LogType,
) -> Result<ImportSummary, SiemError> {
    let total = source_paths.len();
    let mut succeeded = 0;
    let mut failed = 0;
    let mut imported_files = Vec::new();
    let mut errors = Vec::new();

    for source_path in source_paths {
        match import_log_file(app_handle, &source_path, log_type.clone()) {
            Ok(file_info) => {
                succeeded += 1;
                imported_files.push(file_info);
            }
            Err(e) => {
                failed += 1;
                let filename = std::path::Path::new(&source_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&source_path);
                errors.push(format!("{}: {}", filename, e));
            }
        }
    }

    Ok(ImportSummary {
        total,
        succeeded,
        failed,
        imported_files,
        errors,
    })
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

/// Get detailed information about a specific log file with metadata.
fn get_log_file_info_with_metadata(
    path: &PathBuf,
    metadata_map: &HashMap<String, LogType>,
) -> Result<LogFileInfo, SiemError> {
    let metadata = fs::metadata(path)
        .map_err(|e| SiemError::FileIO(format!("Cannot read file metadata: {}", e)))?;

    let filename = path
        .file_name()
        .ok_or_else(|| SiemError::FileIO("Invalid filename".to_string()))?
        .to_string_lossy()
        .to_string();

    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);

    let modified_str = chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339();

    // Get log type from metadata
    let log_type = metadata_map.get(&filename).cloned();

    Ok(LogFileInfo {
        filename,
        path: path.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        modified: modified_str,
        log_type,
    })
}

/// Get detailed information about a specific log file (without app_handle).
/// Used by import_log_file which doesn't have access to metadata yet.
fn get_log_file_info(path: &PathBuf) -> Result<LogFileInfo, SiemError> {
    get_log_file_info_with_metadata(path, &HashMap::new())
}
