import React, { useState } from "react";
import { AlertEvent } from "../services/scan";
import { Card } from "./Card";
import { Button } from "./Button";

interface AlertsTabProps {
    alerts: AlertEvent[];
    onViewEvents: (alert: AlertEvent) => void;
}

export const AlertsTab: React.FC<AlertsTabProps> = ({ alerts, onViewEvents }) => {
    const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

    // Group alerts by severity
    const groupedAlerts = {
        critical: alerts.filter(a => a.severity === "critical"),
        high: alerts.filter(a => a.severity === "high"),
        medium: alerts.filter(a => a.severity === "medium"),
        low: alerts.filter(a => a.severity === "low"),
        info: alerts.filter(a => a.severity === "info"),
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "critical":
            case "high":
                return "var(--danger)";
            case "medium":
                return "var(--warning)";
            case "low":
                return "var(--info)";
            default:
                return "var(--text-secondary)";
        }
    };

    const renderAlertGroup = (severity: string, alertList: AlertEvent[]) => {
        if (alertList.length === 0) return null;

        return (
            <div key={severity} style={{ marginBottom: "1.5rem" }}>
                <h3 style={{
                    textTransform: "uppercase",
                    fontSize: "0.9rem",
                    color: getSeverityColor(severity),
                    marginBottom: "0.75rem"
                }}>
                    {severity} ({alertList.length})
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {alertList.map((alert) => (
                        <Card
                            key={alert.rule_id}
                            style={{
                                borderLeft: `4px solid ${getSeverityColor(alert.severity)}`
                            }}
                        >
                            <div>
                                {/* Alert Header */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                                    <div>
                                        <h4 style={{ margin: "0 0 0.25rem 0" }}>{alert.rule_title}</h4>
                                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                            Matched: {alert.match_count} events • {new Date(alert.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => onViewEvents(alert)}
                                    >
                                        View Events
                                    </Button>
                                </div>

                                {/* Toggle Details */}
                                <button
                                    onClick={() => setExpandedAlert(expandedAlert === alert.rule_id ? null : alert.rule_id)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--primary)",
                                        cursor: "pointer",
                                        fontSize: "0.85rem",
                                        padding: "0.25rem 0",
                                        textDecoration: "underline"
                                    }}
                                >
                                    {expandedAlert === alert.rule_id ? "Hide Details" : "Show Details"}
                                </button>

                                {/* Expanded Details */}
                                {expandedAlert === alert.rule_id && (
                                    <div style={{
                                        marginTop: "1rem",
                                        padding: "1rem",
                                        backgroundColor: "var(--bg-dark)",
                                        borderRadius: "var(--radius-sm)"
                                    }}>
                                        <div style={{ marginBottom: "1rem" }}>
                                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                                                Rule ID:
                                            </div>
                                            <code style={{ fontSize: "0.85rem" }}>{alert.rule_id}</code>
                                        </div>

                                        <div>
                                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                                                Sample Evidence ({Math.min(3, alert.evidence.length)} of {alert.evidence.length}):
                                            </div>
                                            {alert.evidence.slice(0, 3).map((ev, idx) => (
                                                <pre key={idx} style={{
                                                    fontSize: "0.75rem",
                                                    backgroundColor: "var(--bg-input)",
                                                    padding: "0.5rem",
                                                    borderRadius: "var(--radius-sm)",
                                                    marginBottom: "0.5rem",
                                                    overflowX: "auto"
                                                }}>
                                                    {JSON.stringify(ev, null, 2)}
                                                </pre>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div>
            {alerts.length === 0 ? (
                <Card>
                    <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                        No alerts detected. All events passed security rules.
                    </p>
                </Card>
            ) : (
                <div>
                    <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "var(--bg-card)", borderRadius: "var(--radius-md)" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Alert Summary</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
                            {Object.entries(groupedAlerts).map(([severity, list]) => (
                                <div key={severity}>
                                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                        {severity}
                                    </div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: getSeverityColor(severity) }}>
                                        {list.length}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {renderAlertGroup("critical", groupedAlerts.critical)}
                    {renderAlertGroup("high", groupedAlerts.high)}
                    {renderAlertGroup("medium", groupedAlerts.medium)}
                    {renderAlertGroup("low", groupedAlerts.low)}
                    {renderAlertGroup("info", groupedAlerts.info)}
                </div>
            )}
        </div>
    );
};
