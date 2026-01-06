//! Rule Manager for CRUD operations on detection rules.
//!
//! Rules are stored as individual YAML files in the application's data directory.
//! Each rule file is named after its UUID: `{rule_id}.yaml`

use std::fs;
use std::path::PathBuf;

use crate::models::{RuleYaml, SiemError};

/// Get the directory path where rules are stored.
/// Uses custom directory from config if set, otherwise uses default app data dir.
pub fn get_rules_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, SiemError> {
    // Use config module to get the effective rules directory
    crate::config::get_rules_directory(app_handle)
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

/// Export a single rule to a YAML file.
pub fn export_rule(
    app_handle: &tauri::AppHandle,
    rule_id: &str,
    dest_path: &str,
) -> Result<(), SiemError> {
    let rule = get_rule(app_handle, rule_id)?;

    let yaml_content = serde_yaml::to_string(&rule)
        .map_err(|e| SiemError::Serialization(format!("Cannot serialize rule: {}", e)))?;

    fs::write(dest_path, yaml_content)
        .map_err(|e| SiemError::FileIO(format!("Cannot write export file: {}", e)))?;

    Ok(())
}

/// Export all rules to a ZIP archive.
pub fn export_all_rules(
    app_handle: &tauri::AppHandle,
    dest_path: &str,
) -> Result<usize, SiemError> {
    use std::io::Write;
    use zip::write::FileOptions;

    let rules = list_rules(app_handle)?;
    let file = fs::File::create(dest_path)
        .map_err(|e| SiemError::FileIO(format!("Cannot create ZIP file: {}", e)))?;

    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    for rule in &rules {
        let filename = format!("{}.yaml", rule.id);
        let yaml_content = serde_yaml::to_string(rule)
            .map_err(|e| SiemError::Serialization(format!("Cannot serialize rule: {}", e)))?;

        zip.start_file(filename, options)
            .map_err(|e| SiemError::FileIO(format!("Cannot add file to ZIP: {}", e)))?;

        zip.write_all(yaml_content.as_bytes())
            .map_err(|e| SiemError::FileIO(format!("Cannot write to ZIP: {}", e)))?;
    }

    zip.finish()
        .map_err(|e| SiemError::FileIO(format!("Cannot finalize ZIP: {}", e)))?;

    Ok(rules.len())
}

/// Import a single rule from a YAML file.
pub fn import_rule(
    app_handle: &tauri::AppHandle,
    source_path: &str,
    overwrite: bool,
) -> Result<RuleYaml, SiemError> {
    let content = fs::read_to_string(source_path)
        .map_err(|e| SiemError::FileIO(format!("Cannot read import file: {}", e)))?;

    let rule: RuleYaml = serde_yaml::from_str(&content)
        .map_err(|e| SiemError::Serialization(format!("Cannot parse YAML: {}", e)))?;

    // Check if rule already exists
    let rules_dir = get_rules_dir(app_handle)?;
    let existing_path = rules_dir.join(format!("{}.yaml", rule.id));

    if existing_path.exists() && !overwrite {
        return Err(SiemError::Rule(format!(
            "Rule with ID {} already exists. Use overwrite=true to replace it.",
            rule.id
        )));
    }

    // Save the rule
    save_rule(app_handle, rule)
}

/// Import summary result
#[derive(serde::Serialize)]
pub struct ImportSummary {
    pub success_count: usize,
    pub skipped: Vec<String>,
    pub errors: Vec<String>,
}

/// Import multiple rules from a ZIP archive.
pub fn import_rules_zip(
    app_handle: &tauri::AppHandle,
    zip_path: &str,
    overwrite: bool,
) -> Result<ImportSummary, SiemError> {
    use std::io::Read;

    let file = fs::File::open(zip_path)
        .map_err(|e| SiemError::FileIO(format!("Cannot open ZIP file: {}", e)))?;

    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| SiemError::FileIO(format!("Cannot read ZIP archive: {}", e)))?;

    let mut summary = ImportSummary {
        success_count: 0,
        skipped: Vec::new(),
        errors: Vec::new(),
    };

    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| SiemError::FileIO(format!("Cannot read ZIP entry: {}", e)))?;

        // Skip directories and non-YAML files
        if file.is_dir() {
            continue;
        }

        let filename = file.name().to_string();
        if !filename.ends_with(".yaml") && !filename.ends_with(".yml") {
            continue;
        }

        // Read file content
        let mut content = String::new();
        if let Err(e) = file.read_to_string(&mut content) {
            summary.errors.push(format!("{}: {}", filename, e));
            continue;
        }

        // Parse rule
        let rule: RuleYaml = match serde_yaml::from_str(&content) {
            Ok(r) => r,
            Err(e) => {
                summary
                    .errors
                    .push(format!("{}: Invalid YAML - {}", filename, e));
                continue;
            }
        };

        // Check if rule already exists
        let rules_dir = get_rules_dir(app_handle)?;
        let existing_path = rules_dir.join(format!("{}.yaml", rule.id));

        if existing_path.exists() && !overwrite {
            summary.skipped.push(rule.id.clone());
            continue;
        }

        // Save rule
        match save_rule(app_handle, rule) {
            Ok(_) => summary.success_count += 1,
            Err(e) => summary.errors.push(format!("{}: {}", filename, e)),
        }
    }

    Ok(summary)
}

/// Import multiple rules from a list of YAML file paths.
pub fn import_multiple_rules(
    app_handle: &tauri::AppHandle,
    file_paths: Vec<String>,
    overwrite: bool,
) -> Result<ImportSummary, SiemError> {
    let mut summary = ImportSummary {
        success_count: 0,
        skipped: Vec::new(),
        errors: Vec::new(),
    };

    for file_path in file_paths {
        // Extract filename for error reporting
        let filename = std::path::Path::new(&file_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&file_path)
            .to_string();

        // Skip non-YAML files
        if !file_path.ends_with(".yaml") && !file_path.ends_with(".yml") {
            summary
                .errors
                .push(format!("{}: Not a YAML file", filename));
            continue;
        }

        // Read file content
        let content = match fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(e) => {
                summary
                    .errors
                    .push(format!("{}: Cannot read file - {}", filename, e));
                continue;
            }
        };

        // Parse rule
        let rule: RuleYaml = match serde_yaml::from_str(&content) {
            Ok(r) => r,
            Err(e) => {
                summary
                    .errors
                    .push(format!("{}: Invalid YAML - {}", filename, e));
                continue;
            }
        };

        // Check if rule already exists
        let rules_dir = get_rules_dir(app_handle)?;
        let existing_path = rules_dir.join(format!("{}.yaml", rule.id));

        if existing_path.exists() && !overwrite {
            summary.skipped.push(rule.id.clone());
            continue;
        }

        // Save rule
        match save_rule(app_handle, rule) {
            Ok(_) => summary.success_count += 1,
            Err(e) => summary.errors.push(format!("{}: {}", filename, e)),
        }
    }

    Ok(summary)
}

/// Helper function to load a rule from a file path.
fn load_rule_from_path(path: &PathBuf) -> Result<RuleYaml, SiemError> {
    let content = fs::read_to_string(path)
        .map_err(|e| SiemError::FileIO(format!("Cannot read file: {}", e)))?;

    serde_yaml::from_str(&content)
        .map_err(|e| SiemError::Serialization(format!("Cannot parse YAML: {}", e)))
}
