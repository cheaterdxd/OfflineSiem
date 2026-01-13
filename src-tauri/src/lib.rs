//! Offline SIEM - Main library entry point.
//!
//! This module registers all Tauri commands and initializes the application.

#![allow(non_snake_case)]

mod config;
mod db_engine;
mod log_manager;
mod models;
mod rule_manager;
mod test_rule;

use models::{
    AlertEvent, BulkScanResponse, FailedFileScan, FileScanResult, ImportSummary, LogFileInfo,
    QueryResult, RuleYaml, ScanResponse, SiemError,
};
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
async fn get_rule(app_handle: tauri::AppHandle, ruleId: String) -> Result<RuleYaml, SiemError> {
    rule_manager::get_rule(&app_handle, &ruleId)
}

/// Save a rule (create or update).
#[tauri::command]
async fn save_rule(app_handle: tauri::AppHandle, rule: RuleYaml) -> Result<RuleYaml, SiemError> {
    rule_manager::save_rule(&app_handle, rule)
}

/// Delete a rule by ID.
#[tauri::command]
async fn delete_rule(app_handle: tauri::AppHandle, ruleId: String) -> Result<(), SiemError> {
    rule_manager::delete_rule(&app_handle, &ruleId)
}

/// Export a single rule to a YAML file.
#[tauri::command]
async fn export_rule(
    app_handle: tauri::AppHandle,
    ruleId: String,
    destPath: String,
) -> Result<(), SiemError> {
    rule_manager::export_rule(&app_handle, &ruleId, &destPath)
}

/// Export all rules to a ZIP archive.
#[tauri::command]
async fn export_all_rules(
    app_handle: tauri::AppHandle,
    destPath: String,
) -> Result<usize, SiemError> {
    rule_manager::export_all_rules(&app_handle, &destPath)
}

/// Import a single rule from a YAML file.
#[tauri::command]
async fn import_rule(
    app_handle: tauri::AppHandle,
    sourcePath: String,
    overwrite: bool,
) -> Result<RuleYaml, SiemError> {
    rule_manager::import_rule(&app_handle, &sourcePath, overwrite)
}

/// Import multiple rules from a ZIP archive.
#[tauri::command]
async fn import_rules_zip(
    app_handle: tauri::AppHandle,
    zipPath: String,
    overwrite: bool,
) -> Result<rule_manager::ImportSummary, SiemError> {
    rule_manager::import_rules_zip(&app_handle, &zipPath, overwrite)
}

/// Import multiple rules from a list of YAML file paths.
#[tauri::command]
async fn import_multiple_rules(
    app_handle: tauri::AppHandle,
    filePaths: Vec<String>,
    overwrite: bool,
) -> Result<rule_manager::ImportSummary, SiemError> {
    rule_manager::import_multiple_rules(&app_handle, filePaths, overwrite)
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
    logPath: String,
    logType: models::LogType,
) -> Result<ScanResponse, SiemError> {
    let start = Instant::now();

    // Create in-memory DuckDB connection
    let conn = db_engine::create_connection()?;

    // Validate log file first
    db_engine::validate_log_file(&conn, &logPath)?;

    // Load all active rules
    let active_rules = rule_manager::list_active_rules(&app_handle)?;
    let rules_count = active_rules.len();

    let mut alerts: Vec<AlertEvent> = Vec::new();

    // Execute each rule
    for rule in active_rules {
        // Get all matching events for this rule
        let matching_events = db_engine::execute_scan_query(
            &conn,
            &logPath,
            &rule.detection.condition,
            1000, // Get up to 1000 matches
            logType.clone(),
        );

        match matching_events {
            Ok(events) => {
                // Only create alert if there are matching events
                if !events.is_empty() {
                    let match_count = events.len();
                    let alert = AlertEvent {
                        rule_id: rule.id.clone(),
                        rule_title: rule.title.clone(),
                        severity: rule.detection.severity.clone(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        match_count,       // Total number of matched events
                        evidence: events,  // All matched events as evidence
                        source_file: None, // Single file scan doesn't need source tracking
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

/// Scan all log files in the library with all active rules.
///
/// This is the bulk scanning functionality:
/// 1. List all log files in the monitored logs folder
/// 2. For each log file, run the same scan logic as scan_logs
/// 3. Aggregate results and track failures
/// 4. Return comprehensive bulk scan response
#[tauri::command]
async fn scan_all_logs(app_handle: tauri::AppHandle) -> Result<BulkScanResponse, SiemError> {
    let start = Instant::now();

    // Get all log files from the library
    let log_files = log_manager::list_log_files(&app_handle)?;

    if log_files.is_empty() {
        return Ok(BulkScanResponse {
            total_alerts: 0,
            total_files_scanned: 0,
            total_scan_time_ms: start.elapsed().as_millis() as u64,
            rules_evaluated: 0,
            file_results: vec![],
            failed_files: vec![],
        });
    }

    // Load all active rules once (shared across all file scans)
    let active_rules = rule_manager::list_active_rules(&app_handle)?;
    let rules_count = active_rules.len();

    let mut file_results: Vec<FileScanResult> = Vec::new();
    let mut failed_files: Vec<FailedFileScan> = Vec::new();
    let mut total_alerts = 0;

    // Scan each log file
    for log_file in log_files {
        let file_start = Instant::now();

        // Determine log type: use metadata if available, otherwise auto-detect
        let log_type = match log_file.log_type.clone() {
            Some(lt) => lt,
            None => {
                // Auto-detect log type from file content
                match db_engine::detect_log_type(&log_file.path) {
                    Ok(detected_type) => detected_type,
                    Err(e) => {
                        // If detection fails, add to failed files and continue
                        eprintln!(
                            "Failed to detect log type for '{}': {}",
                            log_file.filename, e
                        );
                        failed_files.push(FailedFileScan {
                            file_name: log_file.filename.clone(),
                            file_path: log_file.path.clone(),
                            error: format!("Failed to detect log type: {}", e),
                        });
                        continue; // Skip this file
                    }
                }
            }
        };

        // Try to scan this file
        match scan_single_file_internal(
            &log_file.path,
            log_type,
            &active_rules,
            Some(&log_file.filename),
        ) {
            Ok(alerts) => {
                let file_scan_time = file_start.elapsed().as_millis() as u64;
                total_alerts += alerts.len();

                file_results.push(FileScanResult {
                    file_name: log_file.filename.clone(),
                    file_path: log_file.path.clone(),
                    alerts,
                    scan_time_ms: file_scan_time,
                });
            }
            Err(e) => {
                // Log the error but continue with other files
                eprintln!("Failed to scan file '{}': {}", log_file.filename, e);
                failed_files.push(FailedFileScan {
                    file_name: log_file.filename.clone(),
                    file_path: log_file.path.clone(),
                    error: e.to_string(),
                });
            }
        }
    }

    let total_scan_time = start.elapsed().as_millis() as u64;

    Ok(BulkScanResponse {
        total_alerts,
        total_files_scanned: file_results.len(),
        total_scan_time_ms: total_scan_time,
        rules_evaluated: rules_count,
        file_results,
        failed_files,
    })
}

/// Internal helper function to scan a single file.
/// Used by both scan_logs and scan_all_logs to avoid code duplication.
fn scan_single_file_internal(
    log_path: &str,
    log_type: models::LogType,
    active_rules: &[models::RuleYaml],
    source_filename: Option<&str>,
) -> Result<Vec<AlertEvent>, SiemError> {
    // Create in-memory DuckDB connection
    let conn = db_engine::create_connection()?;

    // Validate log file first
    db_engine::validate_log_file(&conn, log_path)?;

    let mut alerts: Vec<AlertEvent> = Vec::new();

    // Execute each rule
    for rule in active_rules {
        // Get all matching events for this rule
        let matching_events = db_engine::execute_scan_query(
            &conn,
            log_path,
            &rule.detection.condition,
            1000, // Get up to 1000 matches
            log_type.clone(),
        );

        match matching_events {
            Ok(events) => {
                // Only create alert if there are matching events
                if !events.is_empty() {
                    let match_count = events.len();
                    let alert = AlertEvent {
                        rule_id: rule.id.clone(),
                        rule_title: rule.title.clone(),
                        severity: rule.detection.severity.clone(),
                        timestamp: chrono::Utc::now().to_rfc3339(),
                        match_count,      // Total number of matched events
                        evidence: events, // All matched events as evidence
                        source_file: source_filename.map(|s| s.to_string()),
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

    Ok(alerts)
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
    logPath: String,
    logType: models::LogType,
) -> Result<Vec<serde_json::Value>, SiemError> {
    let conn = db_engine::create_connection()?;
    db_engine::load_all_events(&conn, &logPath, logType)
}

/// Validate that a log file can be read by DuckDB.
#[tauri::command]
async fn validate_log_file(logPath: String) -> Result<bool, SiemError> {
    let conn = db_engine::create_connection()?;
    db_engine::validate_log_file(&conn, &logPath)
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
    sourcePath: String,
    logType: models::LogType,
) -> Result<LogFileInfo, SiemError> {
    log_manager::import_log_file(&app_handle, &sourcePath, logType)
}

/// Delete a log file from the monitored folder.
#[tauri::command]
async fn delete_log_file(app_handle: tauri::AppHandle, filename: String) -> Result<(), SiemError> {
    log_manager::delete_log_file(&app_handle, &filename)
}

/// Update the log type for a specific log file.
#[tauri::command]
async fn update_log_type(
    app_handle: tauri::AppHandle,
    filename: String,
    logType: models::LogType,
) -> Result<(), SiemError> {
    log_manager::set_log_type(&app_handle, &filename, logType)
}

/// Import multiple log files at once with the same log type.
#[tauri::command]
async fn import_multiple_log_files(
    app_handle: tauri::AppHandle,
    sourcePaths: Vec<String>,
    logType: models::LogType,
) -> Result<ImportSummary, SiemError> {
    log_manager::import_multiple_log_files(&app_handle, sourcePaths, logType)
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
            export_rule,
            export_all_rules,
            import_rule,
            import_rules_zip,
            import_multiple_rules,
            // Scanning
            scan_logs,
            scan_all_logs,
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
            import_multiple_log_files,
            delete_log_file,
            update_log_type,
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
