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
            // For flat JSON, load all events and filter in Rust (same as CloudTrail)
            let all_events = load_all_events(conn, log_path, log_type)?;

            // Filter events using the condition
            let filtered: Vec<serde_json::Value> = all_events
                .into_iter()
                .filter(|event| matches_condition(event, condition))
                .take(limit)
                .collect();

            Ok(filtered)
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

/// Auto-detect log type based on file content.
/// Returns CloudTrail if file has "Records" array at root level,
/// otherwise returns FlatJson.
pub fn detect_log_type(log_path: &str) -> Result<LogType, SiemError> {
    let file_content = std::fs::read_to_string(log_path)
        .map_err(|e| SiemError::Query(format!("Failed to read log file: {}", e)))?;

    // Try to parse as JSON
    let json: serde_json::Value = serde_json::from_str(&file_content)
        .map_err(|e| SiemError::Query(format!("Failed to parse JSON: {}", e)))?;

    // Check if it has "Records" array at root level (CloudTrail format)
    if json.get("Records").and_then(|r| r.as_array()).is_some() {
        Ok(LogType::CloudTrail)
    } else {
        // Otherwise treat as FlatJson
        Ok(LogType::FlatJson)
    }
}

/// Load all events from a log file.
pub fn load_all_events(
    _conn: &Connection, // Not used for CloudTrail/FlatJson, kept for API compatibility
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
            // For flat JSON, support both formats:
            // 1. NDJSON (newline-delimited JSON): each line is a separate JSON object
            // 2. Single JSON object: entire file is one event
            let file_content = std::fs::read_to_string(log_path)
                .map_err(|e| SiemError::Query(format!("Failed to read log file: {}", e)))?;

            // Try to parse as single JSON object first
            if let Ok(single_event) = serde_json::from_str::<serde_json::Value>(&file_content) {
                // Check if it's an object (not array)
                if single_event.is_object() {
                    // Single JSON object - return as single event
                    return Ok(vec![single_event]);
                }
            }

            // If not a single object, try parsing as NDJSON
            let events: Vec<serde_json::Value> = file_content
                .lines()
                .filter(|line| !line.trim().is_empty())
                .filter_map(|line| {
                    serde_json::from_str(line)
                        .map_err(|e| eprintln!("Warning: Failed to parse line: {}", e))
                        .ok()
                })
                .collect();

            if events.is_empty() {
                return Err(SiemError::Query(
                    "No valid JSON objects found in file".to_string(),
                ));
            }

            Ok(events)
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
/// - eventName STARTSWITH 'Assume'
/// - eventName ENDSWITH 'Role'
/// - eventName MATCH 'Assume*'
pub fn matches_condition(event: &serde_json::Value, condition: &str) -> bool {
    let condition = condition.trim();

    // Check for IN/NOT IN operators FIRST before evaluating parentheses
    // This prevents the () in "IN ('value1', 'value2')" from being treated as logic grouping
    let upper = condition.to_uppercase();
    if upper.contains(" IN (") || upper.contains(" NOT IN (") {
        // This is an IN/NOT IN operator, handle it directly
        return matches_single_condition(event, condition);
    }

    // Handle parentheses for logic grouping - evaluate expressions inside () before AND/OR
    if let Some(result) = evaluate_with_parentheses(event, condition) {
        return result;
    }

    // Handle OR logic (lower precedence than AND)
    // Split by OR first, then check if ANY condition matches
    if condition.to_uppercase().contains(" OR ") {
        let or_parts: Vec<&str> = split_by_keyword_safe(condition, "OR");
        return or_parts
            .iter()
            .any(|part| matches_and_condition(part.trim(), event));
    }

    // No OR, check AND logic
    matches_and_condition(condition, event)
}

/// Evaluate expressions with parentheses
/// Returns Some(bool) if parentheses found, None otherwise
fn evaluate_with_parentheses(event: &serde_json::Value, condition: &str) -> Option<bool> {
    // Find matching parentheses
    if !condition.contains('(') {
        return None;
    }

    let mut result = condition.to_string();

    // Process innermost parentheses first
    while result.contains('(') {
        // Find innermost parentheses
        let mut depth = 0;
        let mut start = 0;
        let mut end = 0;

        for (i, c) in result.chars().enumerate() {
            if c == '(' {
                if depth == 0 {
                    start = i;
                }
                depth += 1;
            } else if c == ')' {
                depth -= 1;
                if depth == 0 {
                    end = i;
                    break;
                }
            }
        }

        if start < end {
            // Extract expression inside parentheses
            let inner = &result[start + 1..end];
            // Evaluate it
            let inner_result = matches_condition(event, inner);
            // Replace with result
            let replacement = if inner_result { "true" } else { "false" };
            result = format!("{}{}{}", &result[..start], replacement, &result[end + 1..]);
        } else {
            break;
        }
    }

    // Now evaluate the simplified expression
    Some(evaluate_boolean_expression(event, &result))
}

/// Evaluate a boolean expression (may contain 'true'/'false' literals)
fn evaluate_boolean_expression(event: &serde_json::Value, expr: &str) -> bool {
    let expr = expr.trim();

    // Handle boolean literals
    if expr == "true" {
        return true;
    }
    if expr == "false" {
        return false;
    }

    // Handle OR
    if expr.to_uppercase().contains(" OR ") {
        let or_parts: Vec<&str> = split_by_keyword_safe(expr, "OR");
        return or_parts.iter().any(|part| {
            let p = part.trim();
            if p == "true" {
                true
            } else if p == "false" {
                false
            } else {
                matches_and_condition(p, event)
            }
        });
    }

    // Handle AND
    if expr.to_uppercase().contains(" AND ") {
        let and_parts: Vec<&str> = split_by_keyword_safe(expr, "AND");
        return and_parts.iter().all(|part| {
            let p = part.trim();
            if p == "true" {
                true
            } else if p == "false" {
                false
            } else {
                matches_single_condition(event, p)
            }
        });
    }

    // Single condition
    matches_single_condition(event, expr)
}

/// Split by keyword, but only outside of parentheses
fn split_by_keyword_safe<'a>(condition: &'a str, keyword: &str) -> Vec<&'a str> {
    let upper = condition.to_uppercase();
    let keyword_upper = format!(" {} ", keyword);

    let mut parts = Vec::new();
    let mut last_pos = 0;
    let mut depth = 0;

    let chars: Vec<char> = condition.chars().collect();

    for i in 0..chars.len() {
        if chars[i] == '(' {
            depth += 1;
        } else if chars[i] == ')' {
            depth -= 1;
        } else if depth == 0 {
            // Only split when outside parentheses
            if i + keyword_upper.len() <= upper.len() {
                if &upper[i..i + keyword_upper.len()] == keyword_upper {
                    parts.push(&condition[last_pos..i]);
                    last_pos = i + keyword_upper.len();
                }
            }
        }
    }

    parts.push(&condition[last_pos..]);
    parts
}

/// Handle AND logic - all conditions must match
fn matches_and_condition(condition: &str, event: &serde_json::Value) -> bool {
    if condition.to_uppercase().contains(" AND ") {
        let and_parts: Vec<&str> = split_by_keyword_safe(condition, "AND");
        return and_parts
            .iter()
            .all(|part| matches_single_condition(event, part.trim()));
    }

    // Single condition
    matches_single_condition(event, condition)
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
                // FIXED: If field doesn't exist, return false
                return false;
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
            // FIXED: If field doesn't exist, return false
            return false;
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
            // FIXED: If field doesn't exist, we can't compare it, return false
            // This prevents K8s rules from matching AWS logs (false positives)
            return false;
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
            // FIXED: If field doesn't exist, we can't compare it, return false
            return false;
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

    // Check for NOT STARTSWITH operator
    if condition.to_uppercase().contains(" NOT STARTSWITH ") {
        if let Some(pos) = condition.to_uppercase().find(" NOT STARTSWITH ") {
            let field = condition[..pos].trim();
            let value_part = condition[pos + 16..].trim(); // " NOT STARTSWITH " is 16 chars

            let search_value = value_part.trim_matches('\'').trim_matches('"');

            if let Some(actual_value) = get_field_value(event, field) {
                return !actual_value
                    .to_lowercase()
                    .starts_with(&search_value.to_lowercase());
            }
            // FIXED: If field doesn't exist, return false
            return false;
        }
    }

    // Check for STARTSWITH operator
    if condition.to_uppercase().contains(" STARTSWITH ") {
        if let Some(pos) = condition.to_uppercase().find(" STARTSWITH ") {
            let field = condition[..pos].trim();
            let value_part = condition[pos + 12..].trim(); // " STARTSWITH " is 12 chars

            let search_value = value_part.trim_matches('\'').trim_matches('"');

            if let Some(actual_value) = get_field_value(event, field) {
                return actual_value
                    .to_lowercase()
                    .starts_with(&search_value.to_lowercase());
            }
            return false;
        }
    }

    // Check for NOT ENDSWITH operator
    if condition.to_uppercase().contains(" NOT ENDSWITH ") {
        if let Some(pos) = condition.to_uppercase().find(" NOT ENDSWITH ") {
            let field = condition[..pos].trim();
            let value_part = condition[pos + 14..].trim(); // " NOT ENDSWITH " is 14 chars

            let search_value = value_part.trim_matches('\'').trim_matches('"');

            if let Some(actual_value) = get_field_value(event, field) {
                return !actual_value
                    .to_lowercase()
                    .ends_with(&search_value.to_lowercase());
            }
            // FIXED: If field doesn't exist, return false
            return false;
        }
    }

    // Check for ENDSWITH operator
    if condition.to_uppercase().contains(" ENDSWITH ") {
        if let Some(pos) = condition.to_uppercase().find(" ENDSWITH ") {
            let field = condition[..pos].trim();
            let value_part = condition[pos + 10..].trim(); // " ENDSWITH " is 10 chars

            let search_value = value_part.trim_matches('\'').trim_matches('"');

            if let Some(actual_value) = get_field_value(event, field) {
                return actual_value
                    .to_lowercase()
                    .ends_with(&search_value.to_lowercase());
            }
            return false;
        }
    }

    // Check for MATCH operator (simple wildcard)
    if condition.to_uppercase().contains(" MATCH ") {
        if let Some(pos) = condition.to_uppercase().find(" MATCH ") {
            let field = condition[..pos].trim();
            let value_part = condition[pos + 7..].trim(); // " MATCH " is 7 chars

            let search_value = value_part.trim_matches('\'').trim_matches('"');

            // Check if it's a list match: field MATCH ['a*', 'b*']
            if value_part.starts_with('[') && value_part.ends_with(']') {
                let inner = &value_part[1..value_part.len() - 1];
                let patterns: Vec<String> = inner
                    .split(',')
                    .map(|s| s.trim().trim_matches('\'').trim_matches('"').to_string())
                    .collect();

                if let Some(actual_value) = get_field_value(event, field) {
                    return patterns
                        .iter()
                        .any(|pattern| wildcard_match(&actual_value, pattern));
                }
                return false;
            }

            if let Some(actual_value) = get_field_value(event, field) {
                return wildcard_match(&actual_value, search_value);
            }
            return false;
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

    #[test]
    fn test_k8s_rule_should_not_match_aws_event() {
        // AWS CloudTrail event (no 'verb' field)
        let aws_event = serde_json::json!({
            "eventName": "AttachRolePolicy",
            "userAgent": "aws-cli/2.32.17 lang/python#3.13.11",
            "requestParameters": {
                "policyArn": "arn:aws:iam::aws:policy/AdministratorAccess"
            }
        });

        // K8s rule condition: verb != '' AND userAgent CONTAINS 'python'
        let condition = "verb != '' AND userAgent CONTAINS 'python'";

        // Should NOT match because 'verb' field doesn't exist in AWS event
        let result = matches_condition(&aws_event, condition);
        assert_eq!(
            result, false,
            "K8s rule should not match AWS event - verb field doesn't exist"
        );
    }

    #[test]
    fn test_field_not_exist_with_not_equal() {
        let event = serde_json::json!({
            "name": "test"
        });

        // Field 'verb' doesn't exist, so verb != '' should return false
        let result = matches_condition(&event, "verb != ''");
        assert_eq!(
            result, false,
            "Non-existent field with != should return false"
        );
    }

    #[test]
    fn test_in_operator_basic() {
        let event = serde_json::json!({
            "eventName": "DeleteTrail"
        });

        let condition =
            "eventName IN ('StopLogging', 'DeleteTrail', 'DeleteDetector', 'DeleteFlowLogs')";
        let result = matches_condition(&event, condition);
        assert_eq!(result, true, "DeleteTrail should be in the list");
    }

    #[test]
    fn test_in_operator_not_match() {
        let event = serde_json::json!({
            "eventName": "CreateUser"
        });

        let condition = "eventName IN ('StopLogging', 'DeleteTrail', 'DeleteDetector')";
        let result = matches_condition(&event, condition);
        assert_eq!(result, false, "CreateUser should not be in the list");
    }

    #[test]
    fn test_in_operator_first_item() {
        let event = serde_json::json!({
            "eventName": "StopLogging"
        });

        let condition = "eventName IN ('StopLogging', 'DeleteTrail')";
        let result = matches_condition(&event, condition);
        assert_eq!(result, true, "First item should match");
    }

    #[test]
    fn test_in_operator_last_item() {
        let event = serde_json::json!({
            "eventName": "DeleteFlowLogs"
        });

        let condition = "eventName IN ('StopLogging', 'DeleteTrail', 'DeleteFlowLogs')";
        let result = matches_condition(&event, condition);
        assert_eq!(result, true, "Last item should match");
    }

    #[test]
    fn test_in_operator_field_not_exist() {
        let event = serde_json::json!({
            "userName": "admin"
        });

        let condition = "eventName IN ('StopLogging', 'DeleteTrail')";
        let result = matches_condition(&event, condition);
        assert_eq!(result, false, "Non-existent field should return false");
    }

    #[test]
    fn test_parse_in_list_basic() {
        let list_str = "('value1', 'value2', 'value3')";
        let result = parse_in_list(list_str);
        assert_eq!(
            result,
            Some(vec![
                "value1".to_string(),
                "value2".to_string(),
                "value3".to_string()
            ])
        );
    }

    #[test]
    fn test_parse_in_list_with_spaces() {
        let list_str = "( 'value1' , 'value2' , 'value3' )";
        let result = parse_in_list(list_str);
        assert_eq!(
            result,
            Some(vec![
                "value1".to_string(),
                "value2".to_string(),
                "value3".to_string()
            ])
        );
    }

    #[test]
    fn test_parse_in_list_double_quotes() {
        let list_str = r#"("value1", "value2")"#;
        let result = parse_in_list(list_str);
        assert_eq!(
            result,
            Some(vec!["value1".to_string(), "value2".to_string()])
        );
    }

    #[test]
    fn test_parse_in_list_empty() {
        let list_str = "()";
        let result = parse_in_list(list_str);
        assert_eq!(result, None, "Empty list should return None");
    }

    #[test]
    fn test_parse_in_list_no_parentheses() {
        let list_str = "'value1', 'value2'";
        let result = parse_in_list(list_str);
        assert_eq!(result, None, "Missing parentheses should return None");
    }
}

/// Simple wildcard matching (supports * and ?)
fn wildcard_match(text: &str, pattern: &str) -> bool {
    let text_chars: Vec<char> = text.to_lowercase().chars().collect();
    let pattern_chars: Vec<char> = pattern.to_lowercase().chars().collect();
    let mut i = 0;
    let mut j = 0;
    let mut star_idx = None;
    let mut match_idx = 0;

    while i < text_chars.len() {
        if j < pattern_chars.len() && (pattern_chars[j] == '?' || pattern_chars[j] == text_chars[i])
        {
            i += 1;
            j += 1;
        } else if j < pattern_chars.len() && pattern_chars[j] == '*' {
            star_idx = Some(j);
            match_idx = i;
            j += 1;
        } else if let Some(si) = star_idx {
            j = si + 1;
            match_idx += 1;
            i = match_idx;
        } else {
            return false;
        }
    }

    while j < pattern_chars.len() && pattern_chars[j] == '*' {
        j += 1;
    }

    j == pattern_chars.len()
}
