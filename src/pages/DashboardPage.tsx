import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { scanService, AlertEvent } from "../services/scan";
import { LogFileSelector } from "../components/LogFileSelector";
import { LogFileInfo } from "../services/logService";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { EventsTab } from "../components/EventsTab";
import { AlertsTab } from "../components/AlertsTab";

type TabType = "events" | "alerts";
type LogType = "cloudtrail" | "flatjson";

export const DashboardPage: React.FC = () => {
    const [selectedLogFile, setSelectedLogFile] = useState<LogFileInfo | null>(null);
    const [logFile, setLogFile] = useState<string | null>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<AlertEvent[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("events");
    const [logType, setLogType] = useState<LogType>("cloudtrail");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSelectLogFile(logFileInfo: LogFileInfo | null) {
        if (!logFileInfo) {
            setSelectedLogFile(null);
            setLogFile(null);
            setEvents([]);
            setAlerts([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setSelectedLogFile(logFileInfo);
            setLogFile(logFileInfo.path);

            // Load all events with log type
            const allEvents = await invoke<any[]>("load_log_events", {
                logPath: logFileInfo.path,
                logType: logType
            });
            setEvents(allEvents);

            // Save log context to localStorage for Rule Testing
            localStorage.setItem("currentLogPath", logFileInfo.path);
            localStorage.setItem("currentLogType", logType);

            // Auto-scan with active rules
            const scanResult = await scanService.scanLogs(logFileInfo.path, logType);
            setAlerts(scanResult.alerts);

            setLoading(false);
            setActiveTab("events");
        } catch (err: any) {
            setError(err.toString());
            setLoading(false);
        }
    }

    async function handleImportLog() {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Log Files',
                    extensions: ['json', 'log', 'txt']
                }]
            });

            if (typeof selected === "string") {
                setLoading(true);
                setError(null);
                setLogFile(selected);

                // Load all events with log type
                const allEvents = await invoke<any[]>("load_log_events", {
                    logPath: selected,
                    logType: logType
                });
                setEvents(allEvents);

                // Save log context to localStorage for Rule Testing
                localStorage.setItem("currentLogPath", selected);
                localStorage.setItem("currentLogType", logType);

                // Auto-scan with active rules
                const scanResult = await scanService.scanLogs(selected, logType);
                setAlerts(scanResult.alerts);

                setLoading(false);
                setActiveTab("events");
            }
        } catch (err: any) {
            setError(err.toString());
            setLoading(false);
        }
    }

    function handleViewAlertEvents(alert: AlertEvent) {
        setActiveTab("events");
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <h1 style={{ margin: 0 }}>Log Analysis Dashboard</h1>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Log Format:</label>
                        <select
                            className="input"
                            value={logType}
                            onChange={(e) => setLogType(e.target.value as LogType)}
                            style={{ padding: "0.5rem", minWidth: "150px" }}
                        >
                            <option value="cloudtrail">AWS CloudTrail</option>
                            <option value="flatjson">Flat JSON</option>
                        </select>
                    </div>
                    <Button onClick={handleImportLog} disabled={loading} style={{ marginTop: "1.25rem" }}>
                        {loading ? "Loading..." : "Browse External File"}
                    </Button>
                </div>
            </div>

            {/* Log File Selector */}
            <Card>
                <LogFileSelector
                    onSelectFile={handleSelectLogFile}
                    selectedFile={selectedLogFile}
                />
            </Card>

            {/* Stats */}
            {logFile && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                    <Card>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Log File</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 500, marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {logFile.split(/[/\\]/).pop()}
                        </div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total Events</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "0.25rem" }}>
                            {events.length}
                        </div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Alerts</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginTop: "0.25rem", color: alerts.length > 0 ? "var(--danger)" : "var(--success)" }}>
                            {alerts.length}
                        </div>
                    </Card>
                </div>
            )}

            {/* Error */}
            {error && (
                <Card style={{ backgroundColor: "var(--danger)22", borderLeft: "4px solid var(--danger)" }}>
                    <div style={{ color: "var(--danger)" }}>{error}</div>
                </Card>
            )}

            {/* Tabs */}
            {logFile ? (
                <div>
                    {/* Tab Headers */}
                    <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid var(--border-color)", marginBottom: "1rem" }}>
                        <button
                            onClick={() => setActiveTab("events")}
                            style={{
                                background: "none",
                                border: "none",
                                padding: "0.75rem 1.5rem",
                                cursor: "pointer",
                                fontSize: "1rem",
                                fontWeight: 500,
                                color: activeTab === "events" ? "var(--primary)" : "var(--text-secondary)",
                                borderBottom: activeTab === "events" ? "2px solid var(--primary)" : "2px solid transparent",
                                marginBottom: "-2px",
                                transition: "all 0.2s"
                            }}
                        >
                            Events ({events.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("alerts")}
                            style={{
                                background: "none",
                                border: "none",
                                padding: "0.75rem 1.5rem",
                                cursor: "pointer",
                                fontSize: "1rem",
                                fontWeight: 500,
                                color: activeTab === "alerts" ? "var(--primary)" : "var(--text-secondary)",
                                borderBottom: activeTab === "alerts" ? "2px solid var(--primary)" : "2px solid transparent",
                                marginBottom: "-2px",
                                transition: "all 0.2s"
                            }}
                        >
                            Alerts ({alerts.length})
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === "events" && <EventsTab events={events} alerts={alerts} />}
                    {activeTab === "alerts" && <AlertsTab alerts={alerts} onViewEvents={handleViewAlertEvents} />}
                </div>
            ) : (
                <Card>
                    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>No Log File Loaded</h3>
                        <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                            Import a JSON log file to begin analysis
                        </p>
                        <Button onClick={handleImportLog}>Import Log File</Button>
                    </div>
                </Card>
            )}
        </div>
    );
};
