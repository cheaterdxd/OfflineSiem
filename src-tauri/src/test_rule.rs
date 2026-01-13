use crate::db_engine;
use crate::models::{FieldSuggestion, LogType, SiemError, TestRuleResult, ValidationResult};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;

/// Test a rule condition against loaded events
pub fn test_rule(
    log_path: &str,
    condition: &str,
    log_type: LogType,
) -> Result<TestRuleResult, SiemError> {
    let start = Instant::now();

    // First validate syntax
    let validation = validate_condition(condition);
    if !validation.valid {
        return Ok(TestRuleResult {
            matched_count: 0,
            total_count: 0,
            matched_events: vec![],
            sample_non_matched: vec![],
            syntax_valid: false,
            syntax_error: validation.error_message,
            execution_time_ms: start.elapsed().as_millis() as u64,
        });
    }

    // Load events
    let conn = db_engine::create_connection()?;
    let all_events = db_engine::load_all_events(&conn, log_path, log_type)?;

    // Test condition against each event
    let mut matched = Vec::new();
    let mut non_matched = Vec::new();

    for event in all_events.iter() {
        if db_engine::matches_condition(event, condition) {
            matched.push(event.clone());
        } else {
            // Keep sample of non-matched (max 5)
            if non_matched.len() < 5 {
                non_matched.push(event.clone());
            }
        }
    }

    let execution_time = start.elapsed().as_millis() as u64;

    Ok(TestRuleResult {
        matched_count: matched.len(),
        total_count: all_events.len(),
        matched_events: matched,
        sample_non_matched: non_matched,
        syntax_valid: true,
        syntax_error: None,
        execution_time_ms: execution_time,
    })
}

/// Validate rule condition syntax
pub fn validate_condition(condition: &str) -> ValidationResult {
    let condition = condition.trim();

    if condition.is_empty() {
        return ValidationResult {
            valid: false,
            error_message: Some("Condition cannot be empty".to_string()),
            error_position: Some(0),
            suggestions: vec!["Example: eventName = 'AssumeRole'".to_string()],
        };
    }

    // Check for basic syntax errors

    // 1. Unmatched quotes
    let single_quotes = condition.matches('\'').count();
    let double_quotes = condition.matches('"').count();

    if single_quotes % 2 != 0 {
        return ValidationResult {
            valid: false,
            error_message: Some("Unmatched single quote (')".to_string()),
            error_position: condition.rfind('\''),
            suggestions: vec!["Add closing single quote".to_string()],
        };
    }

    if double_quotes % 2 != 0 {
        return ValidationResult {
            valid: false,
            error_message: Some("Unmatched double quote (\")".to_string()),
            error_position: condition.rfind('"'),
            suggestions: vec!["Add closing double quote".to_string()],
        };
    }

    // 2. Check for supported operators
    let upper_cond = condition.to_uppercase();
    let has_operator = condition.contains('=')
        || condition.contains("!=")
        || condition.contains("<>")
        || upper_cond.contains(" CONTAINS ")
        || upper_cond.contains(" IN ")
        || upper_cond.contains(" STARTSWITH ")
        || upper_cond.contains(" ENDSWITH ")
        || upper_cond.contains(" MATCH ");

    if !has_operator {
        return ValidationResult {
            valid: false,
            error_message: Some(
                "No operator found. Use =, IN, CONTAINS, STARTSWITH, etc.".to_string(),
            ),
            error_position: None,
            suggestions: vec![
                "Example: field = 'value'".to_string(),
                "Example: field CONTAINS 'text'".to_string(),
                "Example: field IN ('a', 'b')".to_string(),
            ],
        };
    }

    // 3. Check for balanced AND/OR
    let upper = condition.to_uppercase();
    if upper.contains(" AND ") || upper.contains(" OR ") {
        // Basic check - make sure there's something before and after
        let parts: Vec<&str> = if upper.contains(" AND ") {
            condition.split(" AND ").collect()
        } else {
            condition.split(" OR ").collect()
        };

        for part in parts {
            if part.trim().is_empty() {
                return ValidationResult {
                    valid: false,
                    error_message: Some("Empty condition part in AND/OR".to_string()),
                    error_position: None,
                    suggestions: vec!["Each part of AND/OR must have a condition".to_string()],
                };
            }
        }
    }

    // Syntax looks good
    ValidationResult {
        valid: true,
        error_message: None,
        error_position: None,
        suggestions: vec![],
    }
}

/// Get field suggestions from loaded events for autocomplete
pub fn get_field_suggestions(
    log_path: &str,
    log_type: LogType,
    prefix: &str,
) -> Result<Vec<FieldSuggestion>, SiemError> {
    let conn = db_engine::create_connection()?;
    let events = db_engine::load_all_events(&conn, log_path, log_type)?;

    // Collect all field paths from events
    let mut field_map: HashMap<String, (String, String, usize)> = HashMap::new();

    for event in events.iter().take(100) {
        // Sample first 100 events
        collect_fields(event, "", &mut field_map);
    }

    // Filter by prefix and convert to suggestions
    let mut suggestions: Vec<FieldSuggestion> = field_map
        .into_iter()
        .filter(|(path, _)| path.to_lowercase().starts_with(&prefix.to_lowercase()))
        .map(
            |(path, (field_type, sample_value, frequency))| FieldSuggestion {
                field_path: path,
                field_type,
                sample_value,
                frequency,
            },
        )
        .collect();

    // Sort by frequency (most common first)
    suggestions.sort_by(|a, b| b.frequency.cmp(&a.frequency));

    // Limit to top 20
    suggestions.truncate(20);

    Ok(suggestions)
}

/// Recursively collect field paths from JSON
fn collect_fields(
    value: &Value,
    prefix: &str,
    field_map: &mut HashMap<String, (String, String, usize)>,
) {
    match value {
        Value::Object(map) => {
            for (key, val) in map {
                let field_path = if prefix.is_empty() {
                    key.clone()
                } else {
                    format!("{}.{}", prefix, key)
                };

                match val {
                    Value::String(s) => {
                        let entry = field_map.entry(field_path).or_insert((
                            "string".to_string(),
                            s.chars().take(50).collect::<String>(),
                            0,
                        ));
                        entry.2 += 1;
                    }
                    Value::Number(n) => {
                        let entry = field_map.entry(field_path.clone()).or_insert((
                            "number".to_string(),
                            n.to_string(),
                            0,
                        ));
                        entry.2 += 1;
                    }
                    Value::Bool(b) => {
                        let entry = field_map.entry(field_path.clone()).or_insert((
                            "boolean".to_string(),
                            b.to_string(),
                            0,
                        ));
                        entry.2 += 1;
                    }
                    Value::Object(_) => {
                        // Recurse into nested object
                        collect_fields(val, &field_path, field_map);
                    }
                    Value::Array(arr) => {
                        if let Some(first) = arr.first() {
                            collect_fields(first, &field_path, field_map);
                        }
                    }
                    Value::Null => {}
                }
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_condition_valid() {
        let result = validate_condition("eventName = 'AssumeRole'");
        assert!(result.valid);
    }

    #[test]
    fn test_validate_condition_unmatched_quote() {
        let result = validate_condition("eventName = 'AssumeRole");
        assert!(!result.valid);
        assert!(result.error_message.unwrap().contains("quote"));
    }

    #[test]
    fn test_validate_condition_no_operator() {
        let result = validate_condition("eventName AssumeRole");
        assert!(!result.valid);
    }

    #[test]
    fn test_validate_condition_in() {
        let result = validate_condition("eventName IN ('A', 'B')");
        assert!(result.valid);
    }

    #[test]
    fn test_validate_condition_startswith() {
        let result = validate_condition("eventName STARTSWITH 'Assume'");
        assert!(result.valid);
    }

    #[test]
    fn test_validate_condition_match() {
        let result = validate_condition("eventName MATCH 'Assume*'");
        assert!(result.valid);
    }
}
