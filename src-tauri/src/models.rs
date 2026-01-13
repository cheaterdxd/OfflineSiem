//! Data models for the Offline SIEM application.
//!
//! These structs define the core data structures used throughout the application
//! for rule management, alert generation, and query results.

use serde::{Deserialize, Serialize};

/// Log file format type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogType {
    CloudTrail,
    FlatJson,
}

// ============================================================================
// Rule Definition Structures
// ============================================================================

/// Main rule structure stored as YAML files.
/// Each rule defines detection logic to match against log entries.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuleYaml {
    /// Unique identifier (UUID v4)
    pub id: String,
    /// Human-readable rule title
    pub title: String,
    /// Detailed description of what the rule detects
    pub description: String,
    /// Rule author name
    pub author: String,
    /// Rule status: "active", "disabled", "experimental", "deprecated"
    pub status: String,
    /// Creation/last modified date (ISO 8601)
    pub date: String,
    /// Tags for filtering and categorization
    #[serde(default)]
    pub tags: Vec<String>,
    /// Core detection logic
    pub detection: DetectionLogic,
    /// Optional output configuration
    #[serde(default)]
    pub output: Option<OutputConfig>,
}

/// Detection logic containing the SQL condition.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectionLogic {
    /// Severity level: "info", "low", "medium", "high", "critical"
    pub severity: String,
    /// SQL WHERE clause compatible with DuckDB
    /// Example: "event_id = 4625 AND username = 'admin'"
    pub condition: String,
}

/// Output configuration for alert formatting.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OutputConfig {
    /// Template for alert title with variable substitution (e.g., "Alert: {{username}}")
    #[serde(default)]
    pub alert_title: String,
}

// ============================================================================
// Alert / Match Event Structures
// ============================================================================

/// Alert generated when a rule matches log entries.
#[derive(Debug, Serialize, Clone)]
pub struct AlertEvent {
    /// ID of the rule that triggered this alert
    pub rule_id: String,
    /// Title of the rule that triggered this alert
    pub rule_title: String,
    /// Severity level from the rule
    pub severity: String,
    /// Timestamp when the scan was performed (ISO 8601)
    pub timestamp: String,
    /// Total number of log entries that matched
    pub match_count: usize,
    /// Sample of matched log entries (limited to avoid memory overflow)
    /// Uses serde_json::Value to handle arbitrary JSON schemas
    pub evidence: Vec<serde_json::Value>,
    /// Source log file that generated this alert (optional, used in bulk scans)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
}

// ============================================================================
// Query Results Structures
// ============================================================================

/// Result from an ad-hoc query execution.
#[derive(Debug, Serialize, Clone)]
pub struct QueryResult {
    /// The query that was executed
    pub query: String,
    /// Column names from the result set
    pub columns: Vec<String>,
    /// Rows as JSON values (each row is an object)
    pub rows: Vec<serde_json::Value>,
    /// Total row count returned
    pub row_count: usize,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
}

// ============================================================================
// Error Types
// ============================================================================

/// Custom error types for the application.
#[derive(Debug, thiserror::Error)]
pub enum SiemError {
    #[error("Rule error: {0}")]
    Rule(String),

    #[error("File I/O error: {0}")]
    FileIO(String),

    #[error("Query error: {0}")]
    Query(String),

    #[error("Serialization error: {0}")]
    Serialization(String),
}

// Implement conversion for Tauri IPC
impl serde::Serialize for SiemError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

// ============================================================================
// Log File Management Structures
// ============================================================================

/// Information about a log file in the monitored logs folder.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogFileInfo {
    /// Filename without path
    pub filename: String,
    /// Full path to the file
    pub path: String,
    /// File size in bytes
    pub size_bytes: u64,
    /// Last modified timestamp (ISO 8601)
    pub modified: String,
    /// Log format type (CloudTrail or FlatJson)
    #[serde(default)]
    pub log_type: Option<LogType>,
}

/// Summary of batch import operation.
#[derive(Debug, Serialize, Clone)]
pub struct ImportSummary {
    /// Total number of files attempted
    pub total: usize,
    /// Number of files successfully imported
    pub succeeded: usize,
    /// Number of files that failed to import
    pub failed: usize,
    /// List of successfully imported files
    pub imported_files: Vec<LogFileInfo>,
    /// List of error messages for failed imports
    pub errors: Vec<String>,
}

// ============================================================================
// Scan Response Structures
// ============================================================================

/// Response from a scan operation.
#[derive(Debug, Serialize)]
pub struct ScanResponse {
    /// List of alerts generated
    pub alerts: Vec<AlertEvent>,
    /// Total number of rules evaluated
    pub rules_evaluated: usize,
    /// Total scan time in milliseconds
    pub scan_time_ms: u64,
}

/// Response from a bulk scan operation (scanning all logs in library).
#[derive(Debug, Serialize)]
pub struct BulkScanResponse {
    /// Total number of alerts across all files
    pub total_alerts: usize,
    /// Total number of files scanned
    pub total_files_scanned: usize,
    /// Total scan time in milliseconds
    pub total_scan_time_ms: u64,
    /// Number of rules evaluated
    pub rules_evaluated: usize,
    /// Results grouped by file
    pub file_results: Vec<FileScanResult>,
    /// Files that failed to scan
    pub failed_files: Vec<FailedFileScan>,
}

/// Scan result for a single file in a bulk scan.
#[derive(Debug, Serialize, Clone)]
pub struct FileScanResult {
    /// Filename without path
    pub file_name: String,
    /// Full path to the file
    pub file_path: String,
    /// Alerts generated from this file
    pub alerts: Vec<AlertEvent>,
    /// Scan time for this file in milliseconds
    pub scan_time_ms: u64,
}

/// Information about a file that failed to scan.
#[derive(Debug, Serialize, Clone)]
pub struct FailedFileScan {
    /// Filename without path
    pub file_name: String,
    /// Full path to the file
    pub file_path: String,
    /// Error message
    pub error: String,
}

// ============================================================================
// Rule Testing Structures
// ============================================================================

/// Result of testing a rule
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestRuleResult {
    pub matched_count: usize,
    pub total_count: usize,
    pub matched_events: Vec<serde_json::Value>,
    pub sample_non_matched: Vec<serde_json::Value>,
    pub syntax_valid: bool,
    pub syntax_error: Option<String>,
    pub execution_time_ms: u64,
}

/// Field suggestion for autocomplete
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FieldSuggestion {
    pub field_path: String,
    pub field_type: String,
    pub sample_value: String,
    pub frequency: usize,
}

/// Syntax validation result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub error_message: Option<String>,
    pub error_position: Option<usize>,
    pub suggestions: Vec<String>,
}
