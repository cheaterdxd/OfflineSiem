import React, { useState } from "react";
import { Card } from "./Card";

interface Event {
    [key: string]: any;
}

interface EventsTabProps {
    events: Event[];
    alerts: any[];
}

export const EventsTab: React.FC<EventsTabProps> = ({ events, alerts }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedEvent, setExpandedEvent] = useState<number | null>(null);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

    // Get IDs of events that triggered alerts
    const alertEventIds = new Set(
        alerts.flatMap(alert =>
            alert.evidence.map((ev: any) => JSON.stringify(ev))
        )
    );

    // Filter events based on search
    const filteredEvents = events.filter(event =>
        JSON.stringify(event).toLowerCase().includes(searchQuery.toLowerCase())
    );

    const hasAlert = (event: Event) => {
        return alertEventIds.has(JSON.stringify(event));
    };

    // Copy field condition to clipboard
    const copyToQuery = async (fieldPath: string, value: any) => {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        const query = `${fieldPath} = '${valueStr}'`;

        try {
            await navigator.clipboard.writeText(query);
            setCopiedField(fieldPath);
            setTimeout(() => setCopiedField(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Toggle field expansion
    const toggleField = (fieldPath: string) => {
        const newExpanded = new Set(expandedFields);
        if (newExpanded.has(fieldPath)) {
            newExpanded.delete(fieldPath);
        } else {
            newExpanded.add(fieldPath);
        }
        setExpandedFields(newExpanded);
    };

    // Recursively render all fields with copy buttons
    const renderAllFields = (obj: any, parentPath: string = "", level: number = 0): React.ReactElement[] => {
        if (!obj || typeof obj !== 'object') return [];

        const elements: React.ReactElement[] = [];
        const indent = level * 20;

        Object.entries(obj).forEach(([key, val]) => {
            const value: any = val; // Cast to any to avoid strict type checking issues
            const fieldPath = parentPath ? `${parentPath}.${key}` : key;
            const isObject = value && typeof value === 'object' && !Array.isArray(value);
            const isArray = Array.isArray(value);
            const isExpanded = expandedFields.has(fieldPath);
            const isCopied = copiedField === fieldPath;

            elements.push(
                <div key={fieldPath} style={{ marginLeft: `${indent}px`, marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        {/* Expand/Collapse button for objects/arrays */}
                        {(isObject || isArray) && (
                            <button
                                onClick={() => toggleField(fieldPath)}
                                style={{
                                    background: "none",
                                    border: "1px solid var(--border-color)",
                                    padding: "0.15rem 0.4rem",
                                    borderRadius: "var(--radius-sm)",
                                    cursor: "pointer",
                                    fontSize: "0.7rem",
                                    color: "var(--text-secondary)"
                                }}
                            >
                                {isExpanded ? "▼" : "▶"}
                            </button>
                        )}

                        {/* Field name and value */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{
                                color: "var(--primary)",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                                fontFamily: "monospace"
                            }}>
                                {key}
                            </span>
                            <span style={{ color: "var(--text-secondary)", margin: "0 0.5rem" }}>:</span>
                            {!isObject && !isArray && (
                                <span style={{
                                    color: "var(--text-primary)",
                                    fontSize: "0.85rem",
                                    wordBreak: "break-word"
                                }}>
                                    {typeof value === 'string' ? `"${value}"` : String(value)}
                                </span>
                            )}
                            {isObject && <span style={{ color: "var(--text-secondary)" }}>{"{ ... }"}</span>}
                            {isArray && <span style={{ color: "var(--text-secondary)" }}>{`[ ${value.length} items ]`}</span>}
                        </div>

                        {/* Copy button */}
                        {!isObject && !isArray && (
                            <button
                                onClick={() => copyToQuery(fieldPath, value)}
                                style={{
                                    background: isCopied ? "var(--success)" : "var(--bg-secondary)",
                                    color: isCopied ? "white" : "var(--text-secondary)",
                                    border: "none",
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "var(--radius-sm)",
                                    cursor: "pointer",
                                    fontSize: "0.7rem",
                                    fontWeight: 500,
                                    whiteSpace: "nowrap",
                                    transition: "all 0.2s"
                                }}
                                title={`Copy: ${fieldPath} = '${value}'`}
                            >
                                {isCopied ? "✓" : "📋"}
                            </button>
                        )}
                    </div>

                    {/* Render nested fields if expanded */}
                    {isExpanded && isObject && <>{renderAllFields(value, fieldPath, level + 1)}</>}
                    {isExpanded && isArray && value.map((item: any, idx: number) => (
                        <div key={`${fieldPath}[${idx}]`} style={{ marginLeft: `${(level + 1) * 20}px`, marginTop: "0.25rem" }}>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>[{idx}]:</span>
                            {typeof item === 'object' ? (
                                <>{renderAllFields(item, `${fieldPath}[${idx}]`, level + 1)}</>
                            ) : (
                                <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>{String(item)}</span>
                            )}
                        </div>
                    ))}
                </div>
            );
        });

        return elements;
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Search Box */}
            <div>
                <input
                    className="input"
                    type="text"
                    placeholder="Search events... (e.g., username, event_id, ip)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: "100%" }}
                />
                <small style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "0.5rem", display: "block" }}>
                    Showing {filteredEvents.length} of {events.length} events
                </small>
            </div>

            {/* Events Table */}
            {filteredEvents.length === 0 ? (
                <Card>
                    <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                        {searchQuery ? "No events match your search" : "No events loaded"}
                    </p>
                </Card>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {filteredEvents.map((event, idx) => (
                        <Card
                            key={idx}
                            style={{
                                borderLeft: hasAlert(event) ? "4px solid var(--danger)" : undefined,
                                backgroundColor: hasAlert(event) ? "var(--danger)11" : undefined
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "1rem" }}>
                                <div style={{ flex: 1 }}>
                                    {/* Event Summary */}
                                    <div style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border-color)" }}>
                                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                                            Event #{idx + 1} • {Object.keys(event).length} fields
                                        </div>
                                        {event.eventName && (
                                            <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--primary)" }}>
                                                {event.eventName}
                                            </div>
                                        )}
                                    </div>

                                    {/* All Fields - Expandable Tree */}
                                    {expandedEvent === idx && (
                                        <div style={{
                                            backgroundColor: "var(--bg-dark)",
                                            padding: "1rem",
                                            borderRadius: "var(--radius-sm)",
                                            maxHeight: "500px",
                                            overflowY: "auto",
                                            fontSize: "0.85rem"
                                        }}>
                                            {renderAllFields(event)}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "start" }}>
                                    {/* Expand Button */}
                                    <button
                                        onClick={() => setExpandedEvent(expandedEvent === idx ? null : idx)}
                                        style={{
                                            background: "transparent",
                                            color: "var(--text-secondary)",
                                            border: "1px solid var(--border-color)",
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: "var(--radius-sm)",
                                            cursor: "pointer",
                                            fontSize: "1rem",
                                            fontWeight: 500,
                                            whiteSpace: "nowrap",
                                            transition: "all 0.2s",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.25rem"
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                                            e.currentTarget.style.borderColor = "var(--text-secondary)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = "transparent";
                                            e.currentTarget.style.borderColor = "var(--border-color)";
                                        }}
                                        title={expandedEvent === idx ? "Collapse details" : "Expand details"}
                                    >
                                        {expandedEvent === idx ? "▼" : "▶"}
                                    </button>

                                    {/* Alert Badge */}
                                    {hasAlert(event) && (
                                        <span style={{
                                            backgroundColor: "var(--danger)",
                                            color: "white",
                                            padding: "0.25rem 0.5rem",
                                            borderRadius: "var(--radius-sm)",
                                            fontSize: "0.75rem",
                                            fontWeight: 600
                                        }}>
                                            ALERT
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};
