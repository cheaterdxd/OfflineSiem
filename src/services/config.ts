/**
 * Configuration Service
 * Handles app settings, custom directories, and recent files
 */

import { invoke } from "@tauri-apps/api/core";

export interface UiPreferences {
    dark_mode: boolean;
    auto_refresh_interval: number;
}

export interface AppConfig {
    rules_directory: string | null;
    default_logs_directory: string | null;
    recent_log_files: string[];
    max_recent_files: number;
    ui_preferences: UiPreferences;
}

/**
 * Load application configuration
 */
export async function getConfig(): Promise<AppConfig> {
    return await invoke<AppConfig>("get_config");
}

/**
 * Save application configuration
 */
export async function saveConfig(config: AppConfig): Promise<void> {
    await invoke("save_config", { configData: config });
}

/**
 * Set custom rules directory
 */
export async function setRulesDirectory(
    directory: string | null
): Promise<AppConfig> {
    return await invoke<AppConfig>("set_rules_directory", { directory });
}

/**
 * Set default logs directory
 */
export async function setLogsDirectory(
    directory: string | null
): Promise<AppConfig> {
    return await invoke<AppConfig>("set_logs_directory", { directory });
}

/**
 * Add a log file to recent files list
 */
export async function addRecentLogFile(filePath: string): Promise<AppConfig> {
    return await invoke<AppConfig>("add_recent_log_file", { filePath });
}

/**
 * Clear recent log files
 */
export async function clearRecentFiles(): Promise<AppConfig> {
    return await invoke<AppConfig>("clear_recent_files");
}

/**
 * Get the current rules directory path
 */
export async function getRulesDirectory(): Promise<string> {
    return await invoke<string>("get_rules_directory");
}
