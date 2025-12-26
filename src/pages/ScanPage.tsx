import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { scanService, AlertEvent } from "../services/scan";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export const ScanPage: React.FC = () => {
    const [logPath, setLogPath] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [alerts, setAlerts] = useState<AlertEvent[]>([]);
    const [stats, setStats] = useState<{ rules: number; time: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSelectFile() {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Log Files',
                    extensions: ['json', 'log', 'txt']
                }]
            });

            if (typeof selected === "string") {
                setLogPath(selected);
                // Clear previous results when selecting new file
                setAlerts([]);
                setStats(null);
                setError(null);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to open file dialog");
        }
    }

    async function handleScan() {
        if (!logPath) return;

        try {
            setLoading(true);
            setError(null);

            // Step 1: Validate file
            const isValid = await scanService.validateLogFile(logPath);
            if (!isValid) {
                throw new Error("Invalid log file format or cannot read file.");
            }

            // Step 2: Run scan
            const response = await scanService.scanLogs(logPath, 'cloudtrail');
            setAlerts(response.alerts);
            setStats({
                rules: response.rules_evaluated,
                time: response.scan_time_ms
            });
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h1>Log Scanner</h1>

            <Card>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                            Target Log File (JSON Format)
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <input
                                className="input"
                                value={logPath}
                                readOnly
                                placeholder="No file selected..."
                            />
                            <Button onClick={handleSelectFile} variant="secondary">Browse</Button>
                        </div>
                    </div>
                    <div style={{ alignSelf: "end" }}>
                        <Button
                            onClick={handleScan}
                            disabled={!logPath || loading}
                            style={{ minWidth: "120px" }}
                        >
                            {loading ? "Scanning..." : "Start Scan"}
                        </Button>
                    </div>
                </div>
                {error && <p style={{ color: "var(--danger)", marginTop: "1rem" }}>{error}</p>}
            </Card>

            {stats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                    <Card>
                        <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Alerts Found</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: alerts.length > 0 ? "var(--danger)" : "var(--success)" }}>
                            {alerts.length}
                        </div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Rules Evaluated</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{stats.rules}</div>
                    </Card>
                    <Card>
                        <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Scan Time</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{stats.time}ms</div>
                    </Card>
                </div>
            )}

            {alerts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <h3>Detected Threats</h3>
                    {alerts.map((alert, idx) => (
                        <Card key={idx} className="alert-card" style={{ borderLeft: `4px solid var(--danger)` }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <div>
                                    <h4 style={{ margin: "0 0 0.5rem 0" }}>{alert.rule_title}</h4>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                        Rule ID: {alert.rule_id} • Matches: {alert.match_count}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                    {new Date(alert.timestamp).toLocaleString()}
                                </div>
                            </div>

                            {/* Evidence Toggle could go here */}
                            <div style={{ marginTop: "1rem", backgroundColor: "var(--bg-dark)", padding: "0.5rem", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", overflowX: "auto" }}>
                                <pre style={{ margin: 0 }}>{JSON.stringify(alert.evidence[0], null, 2)}</pre>
                                {alert.evidence.length > 1 && <div style={{ marginTop: "0.5rem", color: "var(--text-secondary)" }}>...and {alert.evidence.length - 1} more</div>}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
