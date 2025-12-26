use duckdb::Connection;
use serde_json;
use std::collections::HashMap;

use crate::models::{LogType, SiemError};

/// Create a new in-memory DuckDB connection.
pub fn create_connection() -> Result<Connection, SiemError> {
    Connection::open_in_memory()
        .map_err(|e| SiemError::Query(format!("Failed to create database connection: {}", e)))
}

/// Execute a scan query against a log file using a rule's condition.
pub fn execute_scan_query(
    conn: &Connection,
    log_path: &str,
    condition: &str,
    limit: usize,
    log_type: LogType,
) -> Result<Vec<serde_json::Value>, SiemError> {
    match log_type {
        LogType::CloudTrail => {
            // For CloudTrail, load all events and filter in Rust
            let all_events = load_all_events(conn, log_path, log_type)?;

            // Simple filtering - check if condition matches
            // For now, we'll use a basic approach: convert to SQL-like matching
            let filtered: Vec<serde_json::Value> = all_events
                .into_iter()
                .filter(|event| matches_condition(event, condition))
                .take(limit)
                .collect();

            Ok(filtered)
        }
        LogType::FlatJson => {
            // For flat JSON, use DuckDB as before
            let escaped_path = log_path.replace("'", "''");
            let query = format!(
                "SELECT * FROM read_json_auto('{}') WHERE {} LIMIT {}",
                escaped_path, condition, limit
            );
            execute_and_collect(conn, &query)
        }
    }
}

/// Get the count of matching rows for a rule condition.
pub fn get_match_count(
    conn: &Connection,
    log_path: &str,
    condition: &str,
    log_type: LogType,
) -> Result<usize, SiemError> {
    match log_type {
        LogType::CloudTrail => {
            // For CloudTrail, load all events and count matches
            let all_events = load_all_events(conn, log_path, log_type)?;
            let count = all_events
                .iter()
                .filter(|event| matches_condition(event, condition))
                .count();
            Ok(count)
        }
        LogType::FlatJson => {
            // For flat JSON, use DuckDB
            let escaped_path = log_path.replace("'", "''");
            let query = format!(
                "SELECT COUNT(*) as cnt FROM read_json_auto('{}') WHERE {}",
                escaped_path, condition
            );

            let mut stmt = conn
                .prepare(&query)
                .map_err(|e| SiemError::Query(format!("Failed to prepare query: {}", e)))?;

            let count: i64 = stmt
                .query_row([], |row| row.get(0))
                .map_err(|e| SiemError::Query(format!("Failed to get count: {}", e)))?;

            Ok(count as usize)
        }
    }
}

/// Execute an ad-hoc SQL query against log files.
pub fn execute_adhoc_query(
    conn: &Connection,
    query: &str,
) -> Result<Vec<serde_json::Value>, SiemError> {
    execute_and_collect(conn, query)
}

/// Helper to execute a query and collect results as JSON.
fn execute_and_collect(
    conn: &Connection,
    query: &str,
) -> Result<Vec<serde_json::Value>, SiemError> {
    let mut stmt = conn
        .prepare(query)
        .map_err(|e| SiemError::Query(format!("Failed to prepare query: {}", e)))?;

    let mut rows = stmt
        .query([])
        .map_err(|e| SiemError::Query(format!("Failed to execute query: {}", e)))?;

    let mut results = Vec::new();

    while let Some(row) = rows
        .next()
        .map_err(|e| SiemError::Query(format!("Failed to fetch row: {}", e)))?
    {
        let column_count = row.as_ref().column_count();
        let mut map = HashMap::new();

        for i in 0..column_count {
            let column_name = row
                .as_ref()
                .column_name(i)
                .ok()
                .cloned()
                .unwrap_or_else(|| format!("column_{}", i));

            // Get value as string first, then parse to JSON
            let value: serde_json::Value = row
                .get::<_, String>(i)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or(serde_json::Value::Null);

            map.insert(column_name, value);
        }

        results.push(serde_json::to_value(map).unwrap());
    }

    Ok(results)
}

/// Load all events from a log file.
pub fn load_all_events(
    conn: &Connection,
    log_path: &str,
    log_type: LogType,
) -> Result<Vec<serde_json::Value>, SiemError> {
    match log_type {
        LogType::CloudTrail => {
            // For CloudTrail, we need to parse the JSON file and extract the Records array
            // DuckDB's UNNEST doesn't work well with nested JSON
            let file_content = std::fs::read_to_string(log_path)
                .map_err(|e| SiemError::Query(format!("Failed to read log file: {}", e)))?;

            let json: serde_json::Value = serde_json::from_str(&file_content)
                .map_err(|e| SiemError::Query(format!("Failed to parse JSON: {}", e)))?;

            // Extract Records array
            if let Some(records) = json.get("Records").and_then(|r| r.as_array()) {
                Ok(records.clone())
            } else {
                Err(SiemError::Query(
                    "CloudTrail file must have 'Records' array".to_string(),
                ))
            }
        }
        LogType::FlatJson => {
            // For flat JSON, use DuckDB as before
            let escaped_path = log_path.replace("'", "''");
            let query = format!("SELECT * FROM read_json_auto('{}')", escaped_path);
            execute_and_collect(conn, &query)
        }
    }
}

/// Validate that a log file exists and can be read by DuckDB.
pub fn validate_log_file(conn: &Connection, log_path: &str) -> Result<bool, SiemError> {
    let escaped_path = log_path.replace("'", "''");
    let query = format!(
        "SELECT COUNT(*) FROM read_json_auto('{}') LIMIT 1",
        escaped_path
    );

    match conn.prepare(&query) {
        Ok(mut stmt) => stmt
            .query_row([], |_| Ok(()))
            .map(|_| true)
            .map_err(|e| SiemError::Query(format!("Cannot read log file: {}", e))),
        Err(e) => Err(SiemError::Query(format!("Invalid log file: {}", e))),
    }
}

/// Helper function to check if a JSON event matches a SQL-like condition.
/// Supports:
/// - Operators: =, !=, <>, IN, NOT IN, CONTAINS, NOT CONTAINS
/// - Logic: AND, OR
/// - Nested fields: userIdentity.type
///
/// Examples:
/// - eventName = 'AssumeRole'
/// - eventName != 'ConsoleLogin'
/// - requestParameters.url <> 'https://hdbank.vn'
/// - eventName IN ('AssumeRole', 'CreateAccessKey', 'DeleteBucket')
/// - awsRegion NOT IN ('us-east-1', 'us-west-2')
/// - eventName CONTAINS 'Assume'
/// - eventName NOT CONTAINS 'Console'
/// - eventName = 'AssumeRole' AND userIdentity.type = 'AWSService'
/// - eventName = 'AssumeRole' OR eventName = 'CreateAccessKey'
/// - eventName CONTAINS 'Assume' AND awsRegion = 'ap-southeast-1'
/// - eventName = 'CreateOpenIDConnectProvider' AND requestParameters.url != 'https://hdbank.vn'
/// - userIdentity.type IN ('Root', 'IAMUser') AND eventName NOT IN ('ConsoleLogin', 'GetConsoleScreenshot')
pub fn matches_condition(event: &serde_json::Value, condition: &str) -> bool {
    let condition = condition.trim();

    // Handle OR logic (lower precedence than AND)
    // Split by OR first, then check if ANY condition matches
    if condition.to_uppercase().contains(" OR ") {
        let or_parts: Vec<&str> = split_by_keyword(condition, "OR");
        return or_parts
            .iter()
            .any(|part| matches_and_condition(part.trim(), event));
    }

    // No OR, check AND logic
    matches_and_condition(condition, event)
}

/// Handle AND logic - all conditions must match
fn matches_and_condition(condition: &str, event: &serde_json::Value) -> bool {
    if condition.to_uppercase().contains(" AND ") {
        let and_parts: Vec<&str> = split_by_keyword(condition, "AND");
        return and_parts
            .iter()
            .all(|part| matches_single_condition(event, part.trim()));
    }

    // Single condition
    matches_single_condition(event, condition)
}

/// Split a condition by a keyword (case-insensitive)
fn split_by_keyword<'a>(condition: &'a str, keyword: &str) -> Vec<&'a str> {
    let upper = condition.to_uppercase();
    let keyword_upper = format!(" {} ", keyword);

    let mut parts = Vec::new();
    let mut last_pos = 0;

    while let Some(pos) = upper[last_pos..].find(&keyword_upper) {
        let actual_pos = last_pos + pos;
        parts.push(&condition[last_pos..actual_pos]);
        last_pos = actual_pos + keyword_upper.len();
    }
    parts.push(&condition[last_pos..]);

    parts
}

/// Check if a single condition matches (field = 'value' or field CONTAINS 'value')
fn matches_single_condition(event: &serde_json::Value, condition: &str) -> bool {
    let condition = condition.trim();

    // Check for NOT IN operator (must check before IN to avoid false match)
    if condition.to_uppercase().contains(" NOT IN ") {
        if let Some(not_in_pos) = condition.to_uppercase().find(" NOT IN ") {
            let field = condition[..not_in_pos].trim();
            let value_part = condition[not_in_pos + 8..].trim(); // " NOT IN " is 8 chars

            // Parse list: (value1, value2, value3)
            if let Some(values) = parse_in_list(value_part) {
                if let Some(actual_value) = get_field_value(event, field) {
                    // Check if actual value is NOT in the list
                    return !values.iter().any(|v| v == &actual_value);
                }
                return true; // If field doesn't exist, it's not in the list
            }
        }
    }

    // Check for IN operator
    if condition.to_uppercase().contains(" IN ") {
        if let Some(in_pos) = condition.to_uppercase().find(" IN ") {
            let field = condition[..in_pos].trim();
            let value_part = condition[in_pos + 4..].trim(); // " IN " is 4 chars

            // Parse list: (value1, value2, value3)
            if let Some(values) = parse_in_list(value_part) {
                if let Some(actual_value) = get_field_value(event, field) {
                    // Check if actual value is in the list
                    return values.iter().any(|v| v == &actual_value);
                }
                return false; // If field doesn't exist, it's not in the list
            }
        }
    }

    // Check for NOT CONTAINS operator
    if condition.to_uppercase().contains(" NOT CONTAINS ") {
        if let Some(not_contains_pos) = condition.to_uppercase().find(" NOT CONTAINS ") {
            let field = condition[..not_contains_pos].trim();
            let value_part = condition[not_contains_pos + 14..].trim(); // " NOT CONTAINS " is 14 chars

            // Remove quotes from value
            let search_value = value_part.trim_matches('\'').trim_matches('"');

            // Get field value and check if it does NOT contain the search value
            if let Some(actual_value) = get_field_value(event, field) {
                return !actual_value
                    .to_lowercase()
                    .contains(&search_value.to_lowercase());
            }
            return true; // If field doesn't exist, it doesn't contain the value
        }
    }

    // Check for CONTAINS operator
    if condition.to_uppercase().contains(" CONTAINS ") {
        if let Some(contains_pos) = condition.to_uppercase().find(" CONTAINS ") {
            let field = condition[..contains_pos].trim();
            let value_part = condition[contains_pos + 10..].trim(); // " CONTAINS " is 10 chars

            // Remove quotes from value
            let search_value = value_part.trim_matches('\'').trim_matches('"');

            // Get field value and check if it contains the search value
            if let Some(actual_value) = get_field_value(event, field) {
                return actual_value
                    .to_lowercase()
                    .contains(&search_value.to_lowercase());
            }
            return false;
        }
    }

    // Check for != operator (must check before = to avoid false match)
    if condition.contains("!=") {
        if let Some(neq_pos) = condition.find("!=") {
            let field = condition[..neq_pos].trim();
            let value_part = condition[neq_pos + 2..].trim();

            // Remove quotes from value
            let expected_value = value_part.trim_matches('\'').trim_matches('"');

            // Get field value from event
            if let Some(actual_value) = get_field_value(event, field) {
                return actual_value != expected_value;
            }
            return true; // If field doesn't exist, it's not equal to the value
        }
    }

    // Check for <> operator (SQL not equal)
    if condition.contains("<>") {
        if let Some(neq_pos) = condition.find("<>") {
            let field = condition[..neq_pos].trim();
            let value_part = condition[neq_pos + 2..].trim();

            // Remove quotes from value
            let expected_value = value_part.trim_matches('\'').trim_matches('"');

            // Get field value from event
            if let Some(actual_value) = get_field_value(event, field) {
                return actual_value != expected_value;
            }
            return true; // If field doesn't exist, it's not equal to the value
        }
    }

    // Check for = operator
    if let Some(eq_pos) = condition.find('=') {
        let field = condition[..eq_pos].trim();
        let value_part = condition[eq_pos + 1..].trim();

        // Remove quotes from value
        let expected_value = value_part.trim_matches('\'').trim_matches('"');

        // Get field value from event (supports nested fields with dot notation)
        if let Some(actual_value) = get_field_value(event, field) {
            return actual_value == expected_value;
        }
    }

    false
}

/// Get a field value from JSON, supporting dot notation for nested fields.
/// e.g., "eventName" or "userIdentity.type"
fn get_field_value(event: &serde_json::Value, field_path: &str) -> Option<String> {
    let parts: Vec<&str> = field_path.split('.').collect();
    let mut current = event;

    for part in parts {
        current = current.get(part)?;
    }

    // Convert to string
    match current {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

/// Parse an IN clause list: ('value1', 'value2', 'value3')
/// Returns a vector of values without quotes
fn parse_in_list(list_str: &str) -> Option<Vec<String>> {
    let list_str = list_str.trim();

    // Check if it starts with ( and ends with )
    if !list_str.starts_with('(') || !list_str.ends_with(')') {
        return None;
    }

    // Remove parentheses
    let inner = &list_str[1..list_str.len() - 1];

    // Split by comma and clean up each value
    let values: Vec<String> = inner
        .split(',')
        .map(|s| s.trim().trim_matches('\'').trim_matches('"').to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if values.is_empty() {
        None
    } else {
        Some(values)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_log_file() {
        // This is a placeholder test
        // In a real scenario, you'd create a test database and log file
        assert!(true);
    }
}
