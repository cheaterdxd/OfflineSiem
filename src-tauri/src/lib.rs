//! Offline SIEM - Main library entry point.
//!
//! This module registers all Tauri commands and initializes the application.

mod config;
mod db_engine;
mod log_manager;
mod models;
mod rule_manager;
mod test_rule;

use models::{AlertEvent, LogFileInfo, QueryResult, RuleYaml, ScanResponse, SiemError};
use std::time::Instant;

// ============================================================================
// Rule Management Commands
// ============================================================================

/// List all rules from the rules directory.
#[tauri::command]
async fn list_rules(app_handle: tauri::AppHandle) -> Result<Vec<RuleYaml>, SiemError> {
    rule_manager::list_rules(&app_handle)
}

/// Get a single rule by ID.
#[tauri::command]
async fn get_rule(app_handle: tauri::AppHandle, rule_id: String) -> Result<RuleYaml, SiemError> {
    rule_manager::get_rule(&app_handle, &rule_id)
}

/// Save a rule (create or update).
#[tauri::command]
async fn save_rule(app_handle: tauri::AppHandle, rule: RuleYaml) -> Result<RuleYaml, SiemError> {
    rule_manager::save_rule(&app_handle, rule)
}

/// Delete a rule by ID.
#[tauri::command]
async fn delete_rule(app_handle: tauri::AppHandle, rule_id: String) -> Result<(), SiemError> {
    rule_manager::delete_rule(&app_handle, &rule_id)
}

// ============================================================================
// Scanning Commands
// ============================================================================

/// Scan a log file with all active rules.
///
/// This is the core SIEM functionality:
/// 1. Create in-memory DuckDB connection
/// 2. Load all active rules
/// 3. Execute each rule's condition against the log file
/// 4. Collect and return matching alerts
#[tauri::command]
async fn scan_logs(
    app_handle: tauri::AppHandle,
    log_path: String,
    log_type: models::LogType,
) -> Result<ScanResponse, SiemError> {
    let start = Instant::now();

    // Create in-memory DuckDB connection
    let conn = db_engine::create_connection()?;

    // Validate log file first
    db_engine::validate_log_file(&conn, &log_path)?;

    // Load all active rules
    let active_rules = rule_manager::list_active_rules(&app_handle)?;
    let rules_count = active_rules.len();

    let mut alerts: Vec<AlertEvent> = Vec::new();

    // Execute each rule
    for rule in active_rules {
        // Get all matching events for this rule
        let matching_events = db_engine::execute_scan_query(
            &conn,
            &log_path,
            &rule.detection.condition,
            1000, // Get up to 1000 matches
            log_type.clone(),
        );

        match matching_events {
            Ok(events) => {
                // Create one alert per matched event
                for event in events {
                    let alert = AlertEvent {
                        rule_id: rule.id.clone(),
                        rule_title: rule.title.clone(),
                        severity: rule.detection.severity.clone(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        match_count: 1,        // Each alert represents 1 event
                        evidence: vec![event], // Single event as evidence
                    };
                    alerts.push(alert);
                }
            }
            Err(e) => {
                // Log error but continue with other rules
                eprintln!("Warning: Rule '{}' failed: {}", rule.title, e);
            }
        }
    }

    // Sort alerts by severity (critical first)
    alerts.sort_by(|a, b| severity_order(&b.severity).cmp(&severity_order(&a.severity)));

    let scan_time = start.elapsed().as_millis() as u64;

    Ok(ScanResponse {
        alerts,
        rules_evaluated: rules_count,
        scan_time_ms: scan_time,
    })
}

/// Convert severity string to numeric order for sorting.
fn severity_order(severity: &str) -> u8 {
    match severity.to_lowercase().as_str() {
        "critical" => 5,
        "high" => 4,
        "medium" => 3,
        "low" => 2,
        "info" => 1,
        _ => 0,
    }
}

// ============================================================================
// Ad-hoc Query Commands
// ============================================================================

/// Execute an ad-hoc SQL query for investigation.
///
/// This allows security analysts to run custom queries like:
/// ```sql
/// SELECT * FROM read_json_auto('path/to/logs.json')
/// WHERE username = 'admin'
/// ORDER BY timestamp DESC
/// LIMIT 100
/// ```
#[tauri::command]
async fn run_query(query: String) -> Result<QueryResult, SiemError> {
    let conn = db_engine::create_connection()?;
    let start = std::time::Instant::now();
    let results = db_engine::execute_adhoc_query(&conn, &query)?;
    let execution_time = start.elapsed().as_millis() as u64;

    Ok(QueryResult {
        query: query.clone(),
        columns: vec![], // DuckDB doesn't easily expose column names
        rows: results.clone(),
        row_count: results.len(),
        execution_time_ms: execution_time,
    })
}

/// Load all events from a log file for viewing.
#[tauri::command]
async fn load_log_events(
    log_path: String,
    log_type: models::LogType,
) -> Result<Vec<serde_json::Value>, SiemError> {
    let conn = db_engine::create_connection()?;
    db_engine::load_all_events(&conn, &log_path, log_type)
}

/// Validate that a log file can be read by DuckDB.
#[tauri::command]
async fn validate_log_file(log_path: String) -> Result<bool, SiemError> {
    let conn = db_engine::create_connection()?;
    db_engine::validate_log_file(&conn, &log_path)
}

// ============================================================================
// Rule Testing Commands
// ============================================================================

/// Test a rule condition against loaded events
#[tauri::command]
async fn test_rule(
    condition: String,
    log_path: String,
    log_type: models::LogType,
) -> Result<models::TestRuleResult, SiemError> {
    test_rule::test_rule(&log_path, &condition, log_type)
}

/// Validate rule condition syntax
#[tauri::command]
async fn validate_condition(condition: String) -> Result<models::ValidationResult, SiemError> {
    Ok(test_rule::validate_condition(&condition))
}

/// Get field suggestions for autocomplete
#[tauri::command]
async fn get_field_suggestions(
    log_path: String,
    log_type: models::LogType,
    prefix: String,
) -> Result<Vec<models::FieldSuggestion>, SiemError> {
    test_rule::get_field_suggestions(&log_path, log_type, &prefix)
}

// ============================================================================
// Log File Management Commands
// ============================================================================

/// List all JSON log files in the monitored logs folder.
#[tauri::command]
async fn list_log_files(app_handle: tauri::AppHandle) -> Result<Vec<LogFileInfo>, SiemError> {
    log_manager::list_log_files(&app_handle)
}

/// Import an external log file by copying it to the monitored folder.
#[tauri::command]
async fn import_log_file(
    app_handle: tauri::AppHandle,
    source_path: String,
) -> Result<LogFileInfo, SiemError> {
    log_manager::import_log_file(&app_handle, &source_path)
}

/// Delete a log file from the monitored folder.
#[tauri::command]
async fn delete_log_file(app_handle: tauri::AppHandle, filename: String) -> Result<(), SiemError> {
    log_manager::delete_log_file(&app_handle, &filename)
}

// ============================================================================
// Configuration Management Commands
// ============================================================================

/// Load application configuration.
#[tauri::command]
async fn get_config(app_handle: tauri::AppHandle) -> Result<config::AppConfig, SiemError> {
    config::load_config(&app_handle)
}

/// Save application configuration.
#[tauri::command]
async fn save_config(
    app_handle: tauri::AppHandle,
    config_data: config::AppConfig,
) -> Result<(), SiemError> {
    config::save_config(&app_handle, &config_data)
}

/// Set custom rules directory.
#[tauri::command]
async fn set_rules_directory(
    app_handle: tauri::AppHandle,
    directory: Option<String>,
) -> Result<config::AppConfig, SiemError> {
    config::set_rules_directory(&app_handle, directory)
}

/// Set default logs directory.
#[tauri::command]
async fn set_logs_directory(
    app_handle: tauri::AppHandle,
    directory: Option<String>,
) -> Result<config::AppConfig, SiemError> {
    config::set_logs_directory(&app_handle, directory)
}

/// Add a log file to recent files list.
#[tauri::command]
async fn add_recent_log_file(
    app_handle: tauri::AppHandle,
    file_path: String,
) -> Result<config::AppConfig, SiemError> {
    config::add_recent_log_file(&app_handle, file_path)
}

/// Clear recent log files.
#[tauri::command]
async fn clear_recent_files(app_handle: tauri::AppHandle) -> Result<config::AppConfig, SiemError> {
    config::clear_recent_files(&app_handle)
}

/// Get the current rules directory path.
#[tauri::command]
async fn get_rules_directory(app_handle: tauri::AppHandle) -> Result<String, SiemError> {
    let path = config::get_rules_directory(&app_handle)?;
    Ok(path.to_string_lossy().to_string())
}

// ============================================================================
// Tauri Application Builder
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Rule management
            list_rules,
            get_rule,
            save_rule, // Kept original save_rule
            delete_rule,
            // Scanning
            scan_logs,
            // Ad-hoc queries
            run_query,
            load_log_events,
            validate_log_file,
            // Rule Testing
            test_rule,
            validate_condition,
            get_field_suggestions,
            // Log File Management
            list_log_files,
            import_log_file,
            delete_log_file,
            // Configuration Management
            get_config,
            save_config,
            set_rules_directory,
            set_logs_directory,
            add_recent_log_file,
            clear_recent_files,
            get_rules_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
