/**
 * Settings Page
 * Configure application settings including custom directories
 */

import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
    getConfig,
    setRulesDirectory,
    setLogsDirectory,
    clearRecentFiles,
    getRulesDirectory,
    type AppConfig,
} from "../services/config";
import { Button } from "../components/Button";

export default function SettingsPage() {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [rulesDir, setRulesDir] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const cfg = await getConfig();
            setConfig(cfg);

            // Get actual rules directory path
            const dir = await getRulesDirectory();
            setRulesDir(dir);
        } catch (error) {
            console.error("Failed to load config:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectRulesDirectory = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select Rules Directory",
            });

            if (selected) {
                setSaving(true);
                const newConfig = await setRulesDirectory(selected as string);
                setConfig(newConfig);

                // Update displayed path
                const dir = await getRulesDirectory();
                setRulesDir(dir);
            }
        } catch (error) {
            console.error("Failed to set rules directory:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleResetRulesDirectory = async () => {
        try {
            setSaving(true);
            const newConfig = await setRulesDirectory(null);
            setConfig(newConfig);

            // Update displayed path
            const dir = await getRulesDirectory();
            setRulesDir(dir);
        } catch (error) {
            console.error("Failed to reset rules directory:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleSelectLogsDirectory = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: "Select Default Logs Directory",
            });

            if (selected) {
                setSaving(true);
                const newConfig = await setLogsDirectory(selected as string);
                setConfig(newConfig);
            }
        } catch (error) {
            console.error("Failed to set logs directory:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleResetLogsDirectory = async () => {
        try {
            setSaving(true);
            const newConfig = await setLogsDirectory(null);
            setConfig(newConfig);
        } catch (error) {
            console.error("Failed to reset logs directory:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleClearRecentFiles = async () => {
        if (!confirm("Clear all recent log files?")) return;

        try {
            setSaving(true);
            const newConfig = await clearRecentFiles();
            setConfig(newConfig);
        } catch (error) {
            console.error("Failed to clear recent files:", error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-400">Loading settings...</div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-red-400">Failed to load configuration</div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-white">Settings</h1>

            {/* Rules Directory Section */}
            <section className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-white">
                    Rules Directory
                </h2>
                <p className="text-gray-400 mb-4 text-sm">
                    Customize where detection rules are stored. By default, rules are
                    saved in the application data directory.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Current Rules Directory
                        </label>
                        <div className="bg-gray-900 p-3 rounded border border-gray-700 font-mono text-sm text-gray-300 break-all">
                            {rulesDir || "Using default location"}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={handleSelectRulesDirectory} disabled={saving}>
                            {saving ? "Saving..." : "Change Directory"}
                        </Button>
                        {config.rules_directory && (
                            <Button
                                onClick={handleResetRulesDirectory}
                                disabled={saving}
                                variant="secondary"
                            >
                                Reset to Default
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            {/* Default Logs Directory Section */}
            <section className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-white">
                    Default Logs Directory
                </h2>
                <p className="text-gray-400 mb-4 text-sm">
                    Set a default directory for log files. This will be used as the
                    initial location when opening log files.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Current Default Directory
                        </label>
                        <div className="bg-gray-900 p-3 rounded border border-gray-700 font-mono text-sm text-gray-300 break-all">
                            {config.default_logs_directory || "Not set"}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={handleSelectLogsDirectory} disabled={saving}>
                            {saving ? "Saving..." : "Set Directory"}
                        </Button>
                        {config.default_logs_directory && (
                            <Button
                                onClick={handleResetLogsDirectory}
                                disabled={saving}
                                variant="secondary"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            {/* Recent Files Section */}
            <section className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4 text-white">Recent Files</h2>
                <p className="text-gray-400 mb-4 text-sm">
                    Manage your recent log files history.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Recent Log Files ({config.recent_log_files.length})
                        </label>
                        {config.recent_log_files.length > 0 ? (
                            <div className="bg-gray-900 p-3 rounded border border-gray-700 max-h-48 overflow-y-auto">
                                {config.recent_log_files.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="font-mono text-xs text-gray-400 py-1 border-b border-gray-800 last:border-0"
                                    >
                                        {file}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-900 p-3 rounded border border-gray-700 text-gray-500 text-sm">
                                No recent files
                            </div>
                        )}
                    </div>

                    {config.recent_log_files.length > 0 && (
                        <Button
                            onClick={handleClearRecentFiles}
                            disabled={saving}
                            variant="secondary"
                        >
                            Clear Recent Files
                        </Button>
                    )}
                </div>
            </section>

            {/* Info Section */}
            <section className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-300 mb-2">
                    💡 Configuration Info
                </h3>
                <ul className="text-xs text-blue-200 space-y-1">
                    <li>
                        • Settings are saved automatically when you make changes
                    </li>
                    <li>
                        • Custom directories allow you to organize rules and logs your way
                    </li>
                    <li>
                        • Recent files help you quickly access previously scanned logs
                    </li>
                </ul>
            </section>
        </div>
    );
}
