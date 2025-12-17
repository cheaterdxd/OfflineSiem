import React, { useEffect, useState } from "react";
import { RuleYaml, ruleService } from "../services/rules";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { RuleEditor } from "../components/RuleEditor";

export const RulesPage: React.FC = () => {
    const [rules, setRules] = useState<RuleYaml[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<RuleYaml | null>(null);
    const [showEditor, setShowEditor] = useState(false);

    useEffect(() => {
        loadRules();
    }, []);

    async function loadRules() {
        try {
            setLoading(true);
            const data = await ruleService.listRules();
            setRules(data);
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveRule(rule: RuleYaml) {
        try {
            await ruleService.saveRule(rule);
            await loadRules();
            setShowEditor(false);
            setEditingRule(null);
        } catch (err: any) {
            setError(err.toString());
        }
    }

    async function handleDeleteRule(ruleId: string) {
        if (!confirm("Are you sure you want to delete this rule?")) return;

        try {
            await ruleService.deleteRule(ruleId);
            await loadRules();
        } catch (err: any) {
            setError(err.toString());
        }
    }

    function handleEditRule(rule: RuleYaml) {
        setEditingRule(rule);
        setShowEditor(true);
    }

    function handleNewRule() {
        setEditingRule(null);
        setShowEditor(true);
    }

    if (showEditor) {
        // Get current log context from localStorage (set by DashboardPage)
        const logPath = localStorage.getItem("currentLogPath") || "";
        const logType = localStorage.getItem("currentLogType") || "cloudtrail";

        return (
            <RuleEditor
                rule={editingRule || undefined}
                onSave={handleSaveRule}
                onCancel={() => {
                    setShowEditor(false);
                    setEditingRule(null);
                }}
                logPath={logPath}
                logType={logType}
            />
        );
    }

    if (loading) return <div>Loading rules...</div>;
    if (error) return <div style={{ color: "var(--danger)" }}>Error loading rules: {error}</div>;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 style={{ margin: 0 }}>Detection Rules</h1>
                <Button onClick={handleNewRule}>+ New Rule</Button>
            </div>

            {rules.length === 0 ? (
                <Card>
                    <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>
                        No rules found. Create one to get started.
                    </p>
                </Card>
            ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                    {rules.map((rule) => (
                        <Card key={rule.id} className="rule-card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                                <div>
                                    <h3 style={{ margin: "0 0 0.5rem 0", color: "var(--text-primary)" }}>
                                        {rule.title}
                                    </h3>
                                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                        {rule.description}
                                    </p>
                                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                                        <Badge variant={rule.detection.severity}>{rule.detection.severity}</Badge>
                                        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", alignSelf: "center" }}>
                                            Author: {rule.author}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <Button variant="secondary" size="sm" onClick={() => handleEditRule(rule)}>
                                        Edit
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// Simple internal Badge component
const Badge: React.FC<{ children: React.ReactNode; variant: string }> = ({ children, variant }) => {
    let color = "var(--info)";
    if (variant === "critical" || variant === "high") color = "var(--danger)";
    if (variant === "medium") color = "var(--warning)";

    return (
        <span style={{
            backgroundColor: `${color}33`, // 33 = 20% opacity
            color: color,
            padding: "0.1rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            fontWeight: 600,
            border: `1px solid ${color}66`
        }}>
            {children}
        </span>
    );
};
