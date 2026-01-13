import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { scanService, AlertEvent, BulkScanResponse } from "../services/scan";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

type ScanMode = 'single' | 'bulk';

export const ScanPage: React.FC = () => {
    const [scanMode, setScanMode] = useState<ScanMode>('single');

    // Single file scan state
    const [logPath, setLogPath] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [alerts, setAlerts] = useState<AlertEvent[]>([]);
    const [stats, setStats] = useState<{ rules: number; time: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Bulk scan state
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResults, setBulkResults] = useState<BulkScanResponse | null>(null);
    const [bulkError, setBulkError] = useState<string | null>(null);

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

    async function handleBulkScan() {
        try {
            setBulkLoading(true);
            setBulkError(null);
            setBulkResults(null);

            const response = await scanService.scanAllLogs();
            setBulkResults(response);
        } catch (err: any) {
            setBulkError(err.toString());
        } finally {
            setBulkLoading(false);
        }
    }

    function handleModeChange(mode: ScanMode) {
        setScanMode(mode);
        // Clear errors when switching modes
        setError(null);
        setBulkError(null);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h1>Log Scanner</h1>

            {/* Mode Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid var(--border)" }}>
                <button
                    onClick={() => handleModeChange('single')}
                    style={{
                        padding: "0.75rem 1.5rem",
                        background: scanMode === 'single' ? 'var(--primary)' : 'transparent',
                        color: scanMode === 'single' ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        borderBottom: scanMode === 'single' ? '2px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: scanMode === 'single' ? 'bold' : 'normal',
                        transition: 'all 0.2s',
                    }}
                >
                    Single File Scan
                </button>
                <button
                    onClick={() => handleModeChange('bulk')}
                    style={{
                        padding: "0.75rem 1.5rem",
                        background: scanMode === 'bulk' ? 'var(--primary)' : 'transparent',
                        color: scanMode === 'bulk' ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        borderBottom: scanMode === 'bulk' ? '2px solid var(--primary)' : 'none',
                        cursor: 'pointer',
                        fontWeight: scanMode === 'bulk' ? 'bold' : 'normal',
                        transition: 'all 0.2s',
                    }}
                >
                    Scan All Logs in Library
                </button>
            </div>

            {/* Single File Scan Mode */}
            {scanMode === 'single' && (
                <>
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
                                                Rule ID: {alert.rule_id} • Matches: {alert.match_count} event(s)
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                            {new Date(alert.timestamp).toLocaleString()}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: "1rem" }}>
                                        <div style={{ fontSize: "0.9rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
                                            Matched Events ({alert.evidence.length})
                                        </div>
                                        {alert.evidence.slice(0, 3).map((evidence, evidenceIdx) => (
                                            <details key={evidenceIdx} style={{ marginBottom: "0.5rem" }}>
                                                <summary style={{ cursor: "pointer", padding: "0.5rem", backgroundColor: "var(--bg-dark)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem" }}>
                                                    Event {evidenceIdx + 1}
                                                </summary>
                                                <div style={{ marginTop: "0.5rem", backgroundColor: "var(--bg-dark)", padding: "0.5rem", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", overflowX: "auto" }}>
                                                    <pre style={{ margin: 0 }}>{JSON.stringify(evidence, null, 2)}</pre>
                                                </div>
                                            </details>
                                        ))}
                                        {alert.evidence.length > 3 && (
                                            <div style={{ padding: "0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem", textAlign: "center" }}>
                                                ...and {alert.evidence.length - 3} more event(s)
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Bulk Scan Mode */}
            {scanMode === 'bulk' && (
                <>
                    <Card>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h3 style={{ margin: "0 0 0.5rem 0" }}>Scan All Logs in Library</h3>
                                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                                    This will scan all log files in your library with all active rules.
                                </p>
                            </div>
                            <Button
                                onClick={handleBulkScan}
                                disabled={bulkLoading}
                                style={{ minWidth: "150px" }}
                            >
                                {bulkLoading ? "Scanning..." : "Start Bulk Scan"}
                            </Button>
                        </div>
                        {bulkError && <p style={{ color: "var(--danger)", marginTop: "1rem" }}>{bulkError}</p>}
                    </Card>

                    {bulkResults && (
                        <>
                            {/* Bulk Scan Statistics */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                                <Card>
                                    <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Total Alerts</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: bulkResults.total_alerts > 0 ? "var(--danger)" : "var(--success)" }}>
                                        {bulkResults.total_alerts}
                                    </div>
                                </Card>
                                <Card>
                                    <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Files Scanned</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{bulkResults.total_files_scanned}</div>
                                </Card>
                                <Card>
                                    <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Rules Evaluated</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{bulkResults.rules_evaluated}</div>
                                </Card>
                                <Card>
                                    <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Total Scan Time</div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{bulkResults.total_scan_time_ms}ms</div>
                                </Card>
                            </div>

                            {/* Failed Files */}
                            {bulkResults.failed_files.length > 0 && (
                                <Card style={{ borderLeft: "4px solid var(--warning)" }}>
                                    <h3 style={{ margin: "0 0 1rem 0" }}>⚠️ Failed Files ({bulkResults.failed_files.length})</h3>
                                    {bulkResults.failed_files.map((failed, idx) => (
                                        <div key={idx} style={{ marginBottom: "0.5rem", padding: "0.5rem", backgroundColor: "var(--bg-dark)", borderRadius: "var(--radius-sm)" }}>
                                            <div style={{ fontWeight: "bold" }}>{failed.file_name}</div>
                                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{failed.error}</div>
                                        </div>
                                    ))}
                                </Card>
                            )}

                            {/* Results by File */}
                            {bulkResults.file_results.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    <h3>Results by File</h3>
                                    {bulkResults.file_results.map((fileResult, fileIdx) => (
                                        <Card key={fileIdx} style={{ borderLeft: fileResult.alerts.length > 0 ? "4px solid var(--danger)" : "4px solid var(--success)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                                                <div>
                                                    <h4 style={{ margin: "0 0 0.25rem 0" }}>{fileResult.file_name}</h4>
                                                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                                        {fileResult.alerts.length} alert(s) • Scan time: {fileResult.scan_time_ms}ms
                                                    </div>
                                                </div>
                                            </div>

                                            {fileResult.alerts.length > 0 && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                                    {fileResult.alerts.map((alert, alertIdx) => (
                                                        <div key={alertIdx} style={{ padding: "0.75rem", backgroundColor: "var(--bg-dark)", borderRadius: "var(--radius-sm)" }}>
                                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                                                <div>
                                                                    <div style={{ fontWeight: "bold" }}>{alert.rule_title}</div>
                                                                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                                                                        Severity: {alert.severity} • Rule ID: {alert.rule_id}
                                                                    </div>
                                                                </div>
                                                                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                                                    {new Date(alert.timestamp).toLocaleString()}
                                                                </div>
                                                            </div>
                                                            <details style={{ fontSize: "0.8rem" }}>
                                                                <summary style={{ cursor: "pointer", color: "var(--primary)" }}>View Evidence</summary>
                                                                <pre style={{ margin: "0.5rem 0 0 0", padding: "0.5rem", backgroundColor: "var(--bg)", borderRadius: "var(--radius-sm)", overflowX: "auto" }}>
                                                                    {JSON.stringify(alert.evidence[0], null, 2)}
                                                                </pre>
                                                            </details>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {fileResult.alerts.length === 0 && (
                                                <div style={{ color: "var(--success)", fontSize: "0.9rem" }}>
                                                    ✓ No threats detected in this file
                                                </div>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};
