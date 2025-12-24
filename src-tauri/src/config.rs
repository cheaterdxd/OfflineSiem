//! Configuration management for the Offline SIEM application.
//!
//! Handles persistent user settings including custom directories for rules and logs.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use crate::models::SiemError;

/// Application configuration stored as JSON.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    /// Custom directory for storing rules (if None, uses default app data dir)
    pub rules_directory: Option<String>,

    /// Default directory for log files (used as initial path in file picker)
    pub default_logs_directory: Option<String>,

    /// Recent log files (for quick access)
    #[serde(default)]
    pub recent_log_files: Vec<String>,

    /// Maximum number of recent files to keep
    #[serde(default = "default_max_recent")]
    pub max_recent_files: usize,

    /// UI preferences
    #[serde(default)]
    pub ui_preferences: UiPreferences,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UiPreferences {
    /// Dark mode enabled
    #[serde(default = "default_true")]
    pub dark_mode: bool,

    /// Auto-refresh interval in seconds (0 = disabled)
    #[serde(default)]
    pub auto_refresh_interval: u32,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            rules_directory: None,
            default_logs_directory: None,
            recent_log_files: Vec::new(),
            max_recent_files: default_max_recent(),
            ui_preferences: UiPreferences::default(),
        }
    }
}

impl Default for UiPreferences {
    fn default() -> Self {
        Self {
            dark_mode: true,
            auto_refresh_interval: 0,
        }
    }
}

fn default_max_recent() -> usize {
    10
}

fn default_true() -> bool {
    true
}

/// Get the path to the config file.
fn get_config_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, SiemError> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| SiemError::FileIO(format!("Cannot get app data dir: {}", e)))?;

    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| SiemError::FileIO(format!("Cannot create app data dir: {}", e)))?;
    }

    Ok(app_data_dir.join("config.json"))
}

/// Load configuration from disk.
pub fn load_config(app_handle: &tauri::AppHandle) -> Result<AppConfig, SiemError> {
    let config_path = get_config_path(app_handle)?;

    if !config_path.exists() {
        // Return default config if file doesn't exist
        return Ok(AppConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| SiemError::FileIO(format!("Cannot read config file: {}", e)))?;

    serde_json::from_str(&content)
        .map_err(|e| SiemError::Serialization(format!("Cannot parse config: {}", e)))
}

/// Save configuration to disk.
pub fn save_config(app_handle: &tauri::AppHandle, config: &AppConfig) -> Result<(), SiemError> {
    let config_path = get_config_path(app_handle)?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| SiemError::Serialization(format!("Cannot serialize config: {}", e)))?;

    fs::write(&config_path, content)
        .map_err(|e| SiemError::FileIO(format!("Cannot write config file: {}", e)))?;

    Ok(())
}

/// Update the rules directory in config.
pub fn set_rules_directory(
    app_handle: &tauri::AppHandle,
    directory: Option<String>,
) -> Result<AppConfig, SiemError> {
    let mut config = load_config(app_handle)?;
    config.rules_directory = directory;
    save_config(app_handle, &config)?;
    Ok(config)
}

/// Update the default logs directory in config.
pub fn set_logs_directory(
    app_handle: &tauri::AppHandle,
    directory: Option<String>,
) -> Result<AppConfig, SiemError> {
    let mut config = load_config(app_handle)?;
    config.default_logs_directory = directory;
    save_config(app_handle, &config)?;
    Ok(config)
}

/// Add a log file to recent files list.
pub fn add_recent_log_file(
    app_handle: &tauri::AppHandle,
    file_path: String,
) -> Result<AppConfig, SiemError> {
    let mut config = load_config(app_handle)?;

    // Remove if already exists (to move to front)
    config.recent_log_files.retain(|f| f != &file_path);

    // Add to front
    config.recent_log_files.insert(0, file_path);

    // Trim to max size
    if config.recent_log_files.len() > config.max_recent_files {
        config.recent_log_files.truncate(config.max_recent_files);
    }

    save_config(app_handle, &config)?;
    Ok(config)
}

/// Clear recent log files.
pub fn clear_recent_files(app_handle: &tauri::AppHandle) -> Result<AppConfig, SiemError> {
    let mut config = load_config(app_handle)?;
    config.recent_log_files.clear();
    save_config(app_handle, &config)?;
    Ok(config)
}

/// Get the effective rules directory (custom or default).
pub fn get_rules_directory(app_handle: &tauri::AppHandle) -> Result<PathBuf, SiemError> {
    let config = load_config(app_handle)?;

    if let Some(custom_dir) = config.rules_directory {
        let path = PathBuf::from(custom_dir);

        // Create if doesn't exist
        if !path.exists() {
            fs::create_dir_all(&path)
                .map_err(|e| SiemError::FileIO(format!("Cannot create rules directory: {}", e)))?;
        }

        Ok(path)
    } else {
        // Use default app data directory
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| SiemError::FileIO(format!("Cannot get app data dir: {}", e)))?;

        let rules_dir = app_data_dir.join("rules");

        if !rules_dir.exists() {
            fs::create_dir_all(&rules_dir)
                .map_err(|e| SiemError::FileIO(format!("Cannot create rules dir: {}", e)))?;
        }

        Ok(rules_dir)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default();
        assert!(config.rules_directory.is_none());
        assert_eq!(config.max_recent_files, 10);
        assert!(config.ui_preferences.dark_mode);
    }
}
