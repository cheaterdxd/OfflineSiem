import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "./Card";

interface TestRuleResult {
    matched_count: number;
    total_count: number;
    matched_events: any[];
    sample_non_matched: any[];
    syntax_valid: boolean;
    syntax_error: string | null;
    execution_time_ms: number;
}

interface ValidationResult {
    valid: boolean;
    error_message: string | null;
    error_position: number | null;
    suggestions: string[];
}

interface RuleTestPanelProps {
    condition: string;
    logPath: string;
    logType: string;
    onConditionChange?: (condition: string) => void;
}

export const RuleTestPanel: React.FC<RuleTestPanelProps> = ({
    condition,
    logPath,
    logType,
    onConditionChange
}) => {
    const [testResult, setTestResult] = useState<TestRuleResult | null>(null);
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [testing, setTesting] = useState(false);
    const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

    // Auto-validate on condition change
    useEffect(() => {
        if (condition.trim()) {
            validateSyntax();
        }
    }, [condition]);

    const validateSyntax = async () => {
        try {
            const result = await invoke<ValidationResult>("validate_condition", {
                condition
            });
            setValidation(result);
        } catch (error) {
            console.error("Validation error:", error);
        }
    };

    const testRule = async () => {
        if (!logPath) {
            alert("Please import a log file first");
            return;
        }

        setTesting(true);
        try {
            const result = await invoke<TestRuleResult>("test_rule", {
                condition,
                logPath,
                logType
            });
            setTestResult(result);
        } catch (error) {
            console.error("Test error:", error);
            alert(`Test failed: ${error}`);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Syntax Validation */}
            {validation && !validation.valid && (
                <Card style={{ borderLeft: "4px solid var(--danger)", backgroundColor: "var(--danger)11" }}>
                    <div style={{ display: "flex", alignItems: "start", gap: "1rem" }}>
                        <span style={{ fontSize: "1.5rem" }}>❌</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: "var(--danger)", marginBottom: "0.5rem" }}>
                                Syntax Error
                            </div>
                            <div style={{ marginBottom: "0.5rem" }}>
                                {validation.error_message}
                            </div>
                            {validation.suggestions.length > 0 && (
                                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                    <strong>Suggestions:</strong>
                                    <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
                                        {validation.suggestions.map((s, i) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Test Button */}
            <div>
                <button
                    onClick={testRule}
                    disabled={testing || !validation?.valid || !logPath}
                    style={{
                        background: validation?.valid ? "var(--primary)" : "var(--bg-secondary)",
                        color: validation?.valid ? "white" : "var(--text-secondary)",
                        border: "none",
                        padding: "0.75rem 1.5rem",
                        borderRadius: "var(--radius-sm)",
                        cursor: validation?.valid && logPath ? "pointer" : "not-allowed",
                        fontSize: "1rem",
                        fontWeight: 600,
                        opacity: testing ? 0.6 : 1
                    }}
                >
                    {testing ? "Testing..." : "🧪 Test Rule"}
                </button>
                {!logPath && (
                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.5rem" }}>
                        Import a log file to test this rule
                    </div>
                )}
            </div>

            {/* Test Results */}
            {testResult && (
                <Card>
                    <h3 style={{ margin: "0 0 1rem 0" }}>Test Results</h3>

                    {/* Summary */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "1rem",
                        marginBottom: "1.5rem"
                    }}>
                        <div style={{
                            padding: "1rem",
                            backgroundColor: "var(--bg-dark)",
                            borderRadius: "var(--radius-sm)",
                            textAlign: "center"
                        }}>
                            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>
                                {testResult.matched_count}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                Matched Events
                            </div>
                        </div>

                        <div style={{
                            padding: "1rem",
                            backgroundColor: "var(--bg-dark)",
                            borderRadius: "var(--radius-sm)",
                            textAlign: "center"
                        }}>
                            <div style={{ fontSize: "2rem", fontWeight: 700 }}>
                                {testResult.total_count}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                Total Events
                            </div>
                        </div>

                        <div style={{
                            padding: "1rem",
                            backgroundColor: "var(--bg-dark)",
                            borderRadius: "var(--radius-sm)",
                            textAlign: "center"
                        }}>
                            <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--success)" }}>
                                {testResult.execution_time_ms}ms
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                Execution Time
                            </div>
                        </div>
                    </div>

                    {/* Matched Events */}
                    {testResult.matched_count > 0 && (
                        <div>
                            <h4 style={{ margin: "0 0 0.75rem 0" }}>
                                Matched Events ({testResult.matched_count})
                            </h4>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {testResult.matched_events.slice(0, 5).map((event, idx) => (
                                    <Card
                                        key={idx}
                                        style={{
                                            borderLeft: "4px solid var(--success)",
                                            backgroundColor: "var(--success)11",
                                            cursor: "pointer"
                                        }}
                                        onClick={() => setExpandedEvent(expandedEvent === idx ? null : idx)}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontWeight: 600, color: "var(--success)" }}>
                                                    ✓ Event #{idx + 1}
                                                </div>
                                                {event.eventName && (
                                                    <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                                                        {event.eventName}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                                {expandedEvent === idx ? "▼ Collapse" : "▶ Expand"}
                                            </div>
                                        </div>

                                        {expandedEvent === idx && (
                                            <pre style={{
                                                marginTop: "1rem",
                                                backgroundColor: "var(--bg-dark)",
                                                padding: "1rem",
                                                borderRadius: "var(--radius-sm)",
                                                fontSize: "0.85rem",
                                                overflowX: "auto",
                                                maxHeight: "300px",
                                                overflowY: "auto"
                                            }}>
                                                {JSON.stringify(event, null, 2)}
                                            </pre>
                                        )}
                                    </Card>
                                ))}

                                {testResult.matched_count > 5 && (
                                    <div style={{
                                        textAlign: "center",
                                        padding: "0.5rem",
                                        color: "var(--text-secondary)",
                                        fontSize: "0.85rem"
                                    }}>
                                        ... and {testResult.matched_count - 5} more events
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* No Matches */}
                    {testResult.matched_count === 0 && (
                        <div style={{
                            textAlign: "center",
                            padding: "2rem",
                            color: "var(--text-secondary)"
                        }}>
                            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                                No Events Matched
                            </div>
                            <div style={{ fontSize: "0.9rem" }}>
                                Try adjusting your condition or check if the log file contains relevant events
                            </div>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};
