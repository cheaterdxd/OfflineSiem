import React, { useState } from "react";
import { RuleYaml } from "../services/rules";
import { Card } from "./Card";
import { Button } from "./Button";
import { RuleTestPanel } from "./RuleTestPanel";

interface RuleEditorProps {
    rule?: RuleYaml;
    onSave: (rule: RuleYaml) => void;
    onCancel: () => void;
    logPath?: string;
    logType?: string;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({ rule, onSave, onCancel, logPath, logType }) => {
    const [showTest, setShowTest] = useState(false);
    const [formData, setFormData] = useState<RuleYaml>({
        id: rule?.id || "",
        title: rule?.title || "",
        description: rule?.description || "",
        author: rule?.author || "",
        status: rule?.status || "active",
        date: rule?.date || "",
        tags: rule?.tags || [],
        detection: {
            severity: rule?.detection.severity || "medium",
            condition: rule?.detection.condition || "",
        },
        output: rule?.output,
    });

    const [tagInput, setTagInput] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const addTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            setFormData({
                ...formData,
                tags: [...formData.tags, tagInput.trim()],
            });
            setTagInput("");
        }
    };

    const removeTag = (tag: string) => {
        setFormData({
            ...formData,
            tags: formData.tags.filter((t) => t !== tag),
        });
    };

    return (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <Card>
                <h2 style={{ marginTop: 0 }}>{rule ? "Edit Rule" : "Create New Rule"}</h2>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Title */}
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                            Title <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <input
                            className="input"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., SSH Brute Force Detection"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                            Description <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <textarea
                            className="input"
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Describe what this rule detects..."
                            rows={3}
                            style={{ resize: "vertical" }}
                        />
                    </div>

                    {/* Author & Status Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Author</label>
                            <input
                                className="input"
                                value={formData.author}
                                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                placeholder="Your name"
                            />
                        </div>
                        <div>
                            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Status</label>
                            <select
                                className="input"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                                <option value="experimental">Experimental</option>
                                <option value="deprecated">Deprecated</option>
                            </select>
                        </div>
                    </div>

                    {/* Severity */}
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                            Severity <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <select
                            className="input"
                            required
                            value={formData.detection.severity}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    detection: { ...formData.detection, severity: e.target.value },
                                })
                            }
                        >
                            <option value="info">Info</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>

                    {/* SQL Condition */}
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                            SQL Condition (WHERE clause) <span style={{ color: "var(--danger)" }}>*</span>
                        </label>
                        <textarea
                            className="input"
                            required
                            value={formData.detection.condition}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    detection: { ...formData.detection, condition: e.target.value },
                                })
                            }
                            placeholder="e.g., event_id = 4625 AND logon_type = 10"
                            rows={4}
                            style={{ fontFamily: "monospace", fontSize: "0.9rem", resize: "vertical" }}
                        />
                        <small style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                            DuckDB SQL WHERE clause to match log entries
                        </small>
                    </div>

                    {/* Tags */}
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Tags</label>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <input
                                className="input"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                                placeholder="Add tag and press Enter"
                            />
                            <Button type="button" onClick={addTag} variant="secondary">
                                Add
                            </Button>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {formData.tags.map((tag) => (
                                <span
                                    key={tag}
                                    style={{
                                        backgroundColor: "var(--bg-input)",
                                        padding: "0.25rem 0.5rem",
                                        borderRadius: "var(--radius-sm)",
                                        fontSize: "0.85rem",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "var(--text-secondary)",
                                            cursor: "pointer",
                                            padding: 0,
                                            fontSize: "1rem",
                                        }}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-color)" }}>
                        <Button type="submit" style={{ flex: 1 }}>
                            {rule ? "Update Rule" : "Create Rule"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Test Rule Section - Outside form */}
            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0 }}>🧪 Test Rule</h3>
                    <button
                        onClick={() => setShowTest(!showTest)}
                        style={{
                            background: "var(--bg-secondary)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border-color)",
                            padding: "0.5rem 1rem",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            fontSize: "0.9rem"
                        }}
                    >
                        {showTest ? "Hide Test Panel" : "Show Test Panel"}
                    </button>
                </div>

                {showTest && logPath && (
                    <RuleTestPanel
                        condition={formData.detection.condition}
                        logPath={logPath}
                        logType={logType || "cloudtrail"}
                        onConditionChange={(newCondition) =>
                            setFormData({
                                ...formData,
                                detection: { ...formData.detection, condition: newCondition }
                            })
                        }
                    />
                )}

                {!logPath && (
                    <div style={{
                        padding: "1.5rem",
                        backgroundColor: "var(--bg-dark)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text-secondary)",
                        fontSize: "0.9rem",
                        textAlign: "center"
                    }}>
                        💡 Import a log file from the Dashboard to test this rule
                    </div>
                )}
            </Card>
        </div>
    );
};
