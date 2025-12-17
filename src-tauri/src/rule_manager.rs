//! Rule Manager for CRUD operations on detection rules.
//!
//! Rules are stored as individual YAML files in the application's data directory.
//! Each rule file is named after its UUID: `{rule_id}.yaml`

use std::fs;
use std::path::PathBuf;

use crate::models::{RuleYaml, SiemError};
use tauri::Manager;

/// Get the directory path where rules are stored.
/// Creates the directory if it doesn't exist.
pub fn get_rules_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, SiemError> {
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

/// Save a rule to a YAML file.
/// If the rule has no ID, a new UUID is generated.
pub fn save_rule(app_handle: &tauri::AppHandle, mut rule: RuleYaml) -> Result<RuleYaml, SiemError> {
    // Generate ID if empty
    if rule.id.is_empty() {
        rule.id = uuid::Uuid::new_v4().to_string();
    }

    // Update date to current time
    rule.date = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let rules_dir = get_rules_dir(app_handle)?;
    let file_path = rules_dir.join(format!("{}.yaml", rule.id));

    let yaml_content = serde_yaml::to_string(&rule)
        .map_err(|e| SiemError::Serialization(format!("Cannot serialize rule: {}", e)))?;

    fs::write(&file_path, yaml_content)
        .map_err(|e| SiemError::FileIO(format!("Cannot write rule file: {}", e)))?;

    Ok(rule)
}

/// List all rules from the rules directory.
pub fn list_rules(app_handle: &tauri::AppHandle) -> Result<Vec<RuleYaml>, SiemError> {
    let rules_dir = get_rules_dir(app_handle)?;
    let mut rules = Vec::new();

    if !rules_dir.exists() {
        return Ok(rules);
    }

    let entries = fs::read_dir(&rules_dir)
        .map_err(|e| SiemError::FileIO(format!("Cannot read rules dir: {}", e)))?;

    for entry in entries {
        let entry = entry.map_err(|e| SiemError::FileIO(format!("Cannot read entry: {}", e)))?;
        let path = entry.path();

        if path
            .extension()
            .map_or(false, |ext| ext == "yaml" || ext == "yml")
        {
            match load_rule_from_path(&path) {
                Ok(rule) => rules.push(rule),
                Err(e) => {
                    // Log error but continue loading other rules
                    eprintln!("Warning: Failed to load rule {:?}: {}", path, e);
                }
            }
        }
    }

    // Sort by title for consistent ordering
    rules.sort_by(|a, b| a.title.cmp(&b.title));

    Ok(rules)
}

/// Get a single rule by ID.
pub fn get_rule(app_handle: &tauri::AppHandle, rule_id: &str) -> Result<RuleYaml, SiemError> {
    let rules_dir = get_rules_dir(app_handle)?;
    let file_path = rules_dir.join(format!("{}.yaml", rule_id));

    if !file_path.exists() {
        return Err(SiemError::Rule(format!("Rule not found: {}", rule_id)));
    }

    load_rule_from_path(&file_path)
}

/// Delete a rule by ID.
pub fn delete_rule(app_handle: &tauri::AppHandle, rule_id: &str) -> Result<(), SiemError> {
    let rules_dir = get_rules_dir(app_handle)?;
    let file_path = rules_dir.join(format!("{}.yaml", rule_id));

    if !file_path.exists() {
        return Err(SiemError::Rule(format!("Rule not found: {}", rule_id)));
    }

    fs::remove_file(&file_path)
        .map_err(|e| SiemError::FileIO(format!("Cannot delete rule: {}", e)))?;

    Ok(())
}

/// Load only active rules (status == "active").
pub fn list_active_rules(app_handle: &tauri::AppHandle) -> Result<Vec<RuleYaml>, SiemError> {
    let all_rules = list_rules(app_handle)?;
    Ok(all_rules
        .into_iter()
        .filter(|r| r.status == "active")
        .collect())
}

/// Helper function to load a rule from a file path.
fn load_rule_from_path(path: &PathBuf) -> Result<RuleYaml, SiemError> {
    let content = fs::read_to_string(path)
        .map_err(|e| SiemError::FileIO(format!("Cannot read file: {}", e)))?;

    serde_yaml::from_str(&content)
        .map_err(|e| SiemError::Serialization(format!("Cannot parse YAML: {}", e)))
}

/// Create a sample rule for testing purposes.
pub fn create_sample_rule() -> RuleYaml {
    RuleYaml {
        id: String::new(), // Will be generated on save
        title: "SSH Brute Force Detection".to_string(),
        description: "Detects multiple failed SSH login attempts".to_string(),
        author: "Security Team".to_string(),
        status: "active".to_string(),
        date: String::new(), // Will be set on save
        tags: vec![
            "ssh".to_string(),
            "brute-force".to_string(),
            "authentication".to_string(),
        ],
        detection: crate::models::DetectionLogic {
            severity: "high".to_string(),
            condition: "event_id = 4625 AND logon_type = 10".to_string(),
            aggregation: None,
        },
        output: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_sample_rule() {
        let rule = create_sample_rule();
        assert!(!rule.title.is_empty());
        assert_eq!(rule.status, "active");
    }
}
