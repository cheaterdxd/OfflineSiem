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

/// Detection logic containing the SQL condition and optional aggregation.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetectionLogic {
    /// Severity level: "info", "low", "medium", "high", "critical"
    pub severity: String,
    /// SQL WHERE clause compatible with DuckDB
    /// Example: "event_id = 4625 AND username = 'admin'"
    pub condition: String,
    /// Optional aggregation settings for time-window based detection
    #[serde(default)]
    pub aggregation: Option<Aggregation>,
}

/// Aggregation configuration for threshold-based detection.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Aggregation {
    /// Whether aggregation is enabled
    pub enabled: bool,
    /// Time window (e.g., "5m", "1h")
    pub window: String,
    /// Threshold expression (e.g., "> 5", ">= 10")
    pub threshold: String,
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
    #[error("Database error: {0}")]
    Database(String),

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
    /// Estimated number of events (if available)
    pub event_count: Option<usize>,
}

// ============================================================================
// Scan Request/Response Structures
// ============================================================================

/// Request to scan log files with all active rules.
#[derive(Debug, Deserialize)]
pub struct ScanRequest {
    /// Path to the log file or directory to scan
    pub log_path: String,
}

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

// ============================================================================
// Rule Testing Structures
// ============================================================================

/// Request to test a rule condition against loaded events
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestRuleRequest {
    pub condition: String,
    pub log_path: String,
    pub log_type: LogType,
}

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
