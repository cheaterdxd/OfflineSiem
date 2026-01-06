import React, { useEffect, useState, useMemo } from "react";
import { RuleYaml, ruleService, ImportSummary } from "../services/rules";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { RuleEditor } from "../components/RuleEditor";
import { Tooltip } from "../components/Tooltip";
import { save, open } from "@tauri-apps/plugin-dialog";

type SortBy = "name" | "severity" | "status" | "date";
type SortOrder = "asc" | "desc";

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export const RulesPage: React.FC = () => {
    const [rules, setRules] = useState<RuleYaml[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<RuleYaml | null>(null);
    const [showEditor, setShowEditor] = useState(false);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterSeverity, setFilterSeverity] = useState<string>("all");
    const [sortBy, setSortBy] = useState<SortBy>("name");
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

    // Bulk actions
    const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
    const [previewRule, setPreviewRule] = useState<RuleYaml | null>(null);

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

    // Filter and sort rules
    const filteredAndSortedRules = useMemo(() => {
        let filtered = rules.filter(rule => {
            // Search filter
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                rule.title.toLowerCase().includes(searchLower) ||
                rule.description.toLowerCase().includes(searchLower) ||
                rule.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
                rule.author.toLowerCase().includes(searchLower);

            // Status filter
            const matchesStatus = filterStatus === "all" || rule.status === filterStatus;

            // Severity filter
            const matchesSeverity = filterSeverity === "all" || rule.detection.severity === filterSeverity;

            return matchesSearch && matchesStatus && matchesSeverity;
        });

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case "name":
                    comparison = a.title.localeCompare(b.title);
                    break;
                case "severity":
                    const severityA = SEVERITY_ORDER[a.detection.severity.toLowerCase() as keyof typeof SEVERITY_ORDER] || 0;
                    const severityB = SEVERITY_ORDER[b.detection.severity.toLowerCase() as keyof typeof SEVERITY_ORDER] || 0;
                    comparison = severityB - severityA; // Higher severity first by default
                    break;
                case "status":
                    comparison = a.status.localeCompare(b.status);
                    break;
                case "date":
                    comparison = new Date(b.date).getTime() - new Date(a.date).getTime(); // Newer first
                    break;
            }

            return sortOrder === "asc" ? comparison : -comparison;
        });

        return filtered;
    }, [rules, searchQuery, filterStatus, filterSeverity, sortBy, sortOrder]);

    // Statistics
    const stats = useMemo(() => {
        const total = rules.length;
        const active = rules.filter(r => r.status === "active").length;
        const inactive = total - active;
        const bySeverity = {
            critical: rules.filter(r => r.detection.severity === "critical").length,
            high: rules.filter(r => r.detection.severity === "high").length,
            medium: rules.filter(r => r.detection.severity === "medium").length,
            low: rules.filter(r => r.detection.severity === "low").length,
        };
        return { total, active, inactive, bySeverity };
    }, [rules]);

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
            setSelectedRules(prev => {
                const next = new Set(prev);
                next.delete(ruleId);
                return next;
            });
        } catch (err: any) {
            setError(err.toString());
        }
    }

    async function handleToggleStatus(rule: RuleYaml) {
        const newStatus = rule.status === "active" ? "disabled" : "active";
        const updated = { ...rule, status: newStatus };
        await handleSaveRule(updated);
    }

    function handleEditRule(rule: RuleYaml) {
        setEditingRule(rule);
        setShowEditor(true);
    }

    function handleNewRule() {
        setEditingRule(null);
        setShowEditor(true);
    }

    function handleDuplicateRule(rule: RuleYaml) {
        const duplicated: RuleYaml = {
            ...rule,
            id: crypto.randomUUID(),
            title: `${rule.title} (Copy)`,
            date: new Date().toISOString(),
        };
        setEditingRule(duplicated);
        setShowEditor(true);
    }

    async function handleExportRule(ruleId: string, ruleTitle: string) {
        try {
            const filePath = await save({
                defaultPath: `${ruleTitle.replace(/[^a-z0-9]/gi, '_')}.yaml`,
                filters: [{ name: 'YAML Files', extensions: ['yaml', 'yml'] }]
            });

            if (filePath) {
                await ruleService.exportRule(ruleId, filePath);
                alert('Rule exported successfully!');
            }
        } catch (err: any) {
            setError(err.toString());
        }
    }

    async function handleExportAll() {
        try {
            const filePath = await save({
                defaultPath: 'all_rules.zip',
                filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
            });

            if (filePath) {
                const count = await ruleService.exportAllRules(filePath);
                alert(`Successfully exported ${count} rules to ZIP archive!`);
            }
        } catch (err: any) {
            setError(err.toString());
        }
    }

    async function handleImportRules() {
        try {
            const selected = await open({
                multiple: true, // Enable multiple file selection
                filters: [
                    { name: 'Rule Files', extensions: ['yaml', 'yml', 'zip'] }
                ]
            });

            if (!selected) return;

            // Handle both single and multiple file selection
            const files = Array.isArray(selected) ? selected : [selected];

            // Separate ZIP files from YAML files
            const zipFiles = files.filter(f => f.toLowerCase().endsWith('.zip'));
            const yamlFiles = files.filter(f => f.toLowerCase().endsWith('.yaml') || f.toLowerCase().endsWith('.yml'));

            // Always overwrite existing rules (no confirmation needed)
            const overwrite = true;
            let totalSummary: ImportSummary = {
                success_count: 0,
                skipped: [],
                errors: []
            };

            // Import ZIP files sequentially (await ensures each completes before next)
            for (const zipFile of zipFiles) {
                const summary: ImportSummary = await ruleService.importRulesZip(zipFile, overwrite);
                totalSummary.success_count += summary.success_count;
                totalSummary.skipped.push(...summary.skipped);
                totalSummary.errors.push(...summary.errors);
            }

            // Import YAML files in batch (await ensures this runs after ZIP imports)
            if (yamlFiles.length > 0) {
                const summary: ImportSummary = await ruleService.importMultipleRules(yamlFiles, overwrite);
                totalSummary.success_count += summary.success_count;
                totalSummary.skipped.push(...summary.skipped);
                totalSummary.errors.push(...summary.errors);
            }

            // Show detailed summary
            let message = `✅ Import Complete!\n\n`;
            message += `📊 Summary:\n`;
            message += `  • Successfully imported: ${totalSummary.success_count} rules\n`;

            if (totalSummary.skipped.length > 0) {
                message += `  • Skipped (already exist): ${totalSummary.skipped.length} rules\n`;
            }

            if (totalSummary.errors.length > 0) {
                message += `  • Errors: ${totalSummary.errors.length} rules\n\n`;
                message += `❌ Error Details:\n`;
                totalSummary.errors.slice(0, 5).forEach(err => {
                    message += `  • ${err}\n`;
                });
                if (totalSummary.errors.length > 5) {
                    message += `  ... and ${totalSummary.errors.length - 5} more errors\n`;
                }
            }

            alert(message);
            await loadRules();
        } catch (err: any) {
            if (err.toString().includes('already exists')) {
                alert('Rule already exists. Choose "Overwrite" to replace it.');
            } else {
                setError(err.toString());
            }
        }
    }

    // Bulk actions
    function toggleSelectAll() {
        if (selectedRules.size === filteredAndSortedRules.length) {
            setSelectedRules(new Set());
        } else {
            setSelectedRules(new Set(filteredAndSortedRules.map(r => r.id)));
        }
    }

    function toggleSelectRule(ruleId: string) {
        setSelectedRules(prev => {
            const next = new Set(prev);
            if (next.has(ruleId)) {
                next.delete(ruleId);
            } else {
                next.add(ruleId);
            }
            return next;
        });
    }

    async function handleBulkEnable() {
        if (selectedRules.size === 0) return;

        for (const ruleId of selectedRules) {
            const rule = rules.find(r => r.id === ruleId);
            if (rule && rule.status !== "active") {
                await handleSaveRule({ ...rule, status: "active" });
            }
        }
        setSelectedRules(new Set());
    }

    async function handleBulkDisable() {
        if (selectedRules.size === 0) return;

        for (const ruleId of selectedRules) {
            const rule = rules.find(r => r.id === ruleId);
            if (rule && rule.status === "active") {
                await handleSaveRule({ ...rule, status: "disabled" });
            }
        }
        setSelectedRules(new Set());
    }

    async function handleBulkDelete() {
        if (selectedRules.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedRules.size} rules?`)) return;

        for (const ruleId of selectedRules) {
            await ruleService.deleteRule(ruleId);
        }
        await loadRules();
        setSelectedRules(new Set());
    }

    if (showEditor) {
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
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 style={{ margin: 0 }}>Detection Rules</h1>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Tooltip content="Import rules from YAML files (supports multiple selection) or ZIP archive" position="bottom">
                        <Button variant="secondary" onClick={handleImportRules}>📥 Import</Button>
                    </Tooltip>
                    <Tooltip content="Export all rules as ZIP archive" position="bottom">
                        <Button variant="secondary" onClick={handleExportAll}>📦 Export All</Button>
                    </Tooltip>
                    <Button onClick={handleNewRule}>+ New Rule</Button>
                </div>
            </div>

            {/* Statistics */}
            {rules.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem" }}>
                    <StatCard label="Total Rules" value={stats.total} color="var(--primary)" />
                    <StatCard label="Active" value={stats.active} color="var(--success)" />
                    <StatCard label="Inactive" value={stats.inactive} color="var(--text-secondary)" />
                    <StatCard label="Critical" value={stats.bySeverity.critical} color="var(--danger)" />
                    <StatCard label="High" value={stats.bySeverity.high} color="var(--warning)" />
                </div>
            )}

            {/* Search & Filters */}
            <Card>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Search */}
                    <input
                        className="input"
                        type="text"
                        placeholder="🔍 Search rules by name, description, tags, or author..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: "100%" }}
                    />

                    {/* Filters & Sort */}
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Status:</label>
                            <select
                                className="input"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                style={{ padding: "0.4rem 0.6rem", fontSize: "0.9rem" }}
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                                <option value="experimental">Experimental</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Severity:</label>
                            <select
                                className="input"
                                value={filterSeverity}
                                onChange={(e) => setFilterSeverity(e.target.value)}
                                style={{ padding: "0.4rem 0.6rem", fontSize: "0.9rem" }}
                            >
                                <option value="all">All</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>Sort by:</label>
                            <select
                                className="input"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortBy)}
                                style={{ padding: "0.4rem 0.6rem", fontSize: "0.9rem" }}
                            >
                                <option value="name">Name</option>
                                <option value="severity">Severity</option>
                                <option value="status">Status</option>
                                <option value="date">Date Modified</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                                style={{
                                    background: "transparent",
                                    border: "1px solid var(--border-color)",
                                    padding: "0.4rem 0.6rem",
                                    borderRadius: "var(--radius-sm)",
                                    cursor: "pointer",
                                    fontSize: "0.9rem"
                                }}
                                title={sortOrder === "asc" ? "Ascending" : "Descending"}
                            >
                                {sortOrder === "asc" ? "↑" : "↓"}
                            </button>
                        </div>

                        <div style={{ marginLeft: "auto", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                            Showing {filteredAndSortedRules.length} of {rules.length} rules
                        </div>
                    </div>
                </div>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedRules.size > 0 && (
                <Card style={{ backgroundColor: "var(--primary)22", borderLeft: "4px solid var(--primary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 600, color: "var(--primary)" }}>
                            {selectedRules.size} rule{selectedRules.size > 1 ? 's' : ''} selected
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Button size="sm" variant="secondary" onClick={toggleSelectAll}>
                                {selectedRules.size === filteredAndSortedRules.length ? "Deselect All" : "Select All"}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={handleBulkEnable}>✓ Enable</Button>
                            <Button size="sm" variant="secondary" onClick={handleBulkDisable}>✗ Disable</Button>
                            <Button size="sm" variant="danger" onClick={handleBulkDelete}>🗑️ Delete</Button>
                        </div>
                    </div>
                </Card>
            )}

            {/* Rules List */}
            {filteredAndSortedRules.length === 0 ? (
                <Card>
                    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                        <h3 style={{ margin: "0 0 1rem 0", color: "var(--text-primary)" }}>
                            {rules.length === 0 ? "📋 No Rules Yet" : "🔍 No Rules Match Your Filters"}
                        </h3>
                        {rules.length === 0 ? (
                            <>
                                <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
                                    Get started by creating a new rule or importing existing ones
                                </p>
                                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                                    <Button onClick={handleNewRule}>+ Create Rule</Button>
                                    <Button variant="secondary" onClick={handleImportRules}>📥 Import Rules</Button>
                                </div>
                            </>
                        ) : (
                            <p style={{ color: "var(--text-secondary)" }}>
                                Try adjusting your search or filters
                            </p>
                        )}
                    </div>
                </Card>
            ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                    {filteredAndSortedRules.map((rule) => (
                        <Card key={rule.id} className="rule-card">
                            <div style={{ display: "flex", gap: "1rem" }}>
                                {/* Checkbox */}
                                <input
                                    type="checkbox"
                                    checked={selectedRules.has(rule.id)}
                                    onChange={() => toggleSelectRule(rule.id)}
                                    style={{ cursor: "pointer", width: "18px", height: "18px", marginTop: "0.25rem" }}
                                />

                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                                                <Badge variant={rule.detection.severity}>{rule.detection.severity}</Badge>
                                                <StatusBadge status={rule.status} />
                                                <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.1rem" }}>
                                                    {rule.title}
                                                </h3>
                                            </div>
                                            <p style={{ margin: "0.5rem 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                                {rule.description}
                                            </p>
                                            <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                                {rule.tags.length > 0 && (
                                                    <span>🏷️ {rule.tags.join(", ")}</span>
                                                )}
                                                <span>👤 {rule.author}</span>
                                                <span>📅 {new Date(rule.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                            <Tooltip content={rule.status === "active" ? "Disable rule" : "Enable rule"} position="left">
                                                <button
                                                    onClick={() => handleToggleStatus(rule)}
                                                    style={{
                                                        background: rule.status === "active" ? "var(--success)33" : "var(--text-secondary)33",
                                                        color: rule.status === "active" ? "var(--success)" : "var(--text-secondary)",
                                                        border: "none",
                                                        padding: "0.4rem 0.6rem",
                                                        borderRadius: "var(--radius-sm)",
                                                        cursor: "pointer",
                                                        fontSize: "0.85rem",
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {rule.status === "active" ? "✓" : "○"}
                                                </button>
                                            </Tooltip>
                                            <Tooltip content="Preview rule details" position="left">
                                                <Button size="sm" variant="secondary" onClick={() => setPreviewRule(rule)}>▶</Button>
                                            </Tooltip>
                                            <Tooltip content="Duplicate this rule" position="left">
                                                <Button size="sm" variant="secondary" onClick={() => handleDuplicateRule(rule)}>📋</Button>
                                            </Tooltip>
                                            <Tooltip content="Edit rule" position="left">
                                                <Button size="sm" variant="secondary" onClick={() => handleEditRule(rule)}>✏️</Button>
                                            </Tooltip>
                                            <Tooltip content="Export rule" position="left">
                                                <Button size="sm" variant="secondary" onClick={() => handleExportRule(rule.id, rule.title)}>📤</Button>
                                            </Tooltip>
                                            <Tooltip content="Delete rule" position="left">
                                                <Button size="sm" variant="danger" onClick={() => handleDeleteRule(rule.id)}>🗑️</Button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Preview Modal */}
            {previewRule && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "2rem"
                    }}
                    onClick={() => setPreviewRule(null)}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <Card style={{ maxWidth: "800px", width: "100%", maxHeight: "80vh", overflow: "auto" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                                <h2 style={{ margin: 0 }}>{previewRule.title}</h2>
                                <button
                                    onClick={() => setPreviewRule(null)}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        fontSize: "1.5rem",
                                        cursor: "pointer",
                                        color: "var(--text-secondary)"
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div>
                                    <strong>Description:</strong>
                                    <p style={{ margin: "0.5rem 0", color: "var(--text-secondary)" }}>{previewRule.description}</p>
                                </div>

                                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                    <div><strong>Severity:</strong> <Badge variant={previewRule.detection.severity}>{previewRule.detection.severity}</Badge></div>
                                    <div><strong>Status:</strong> <StatusBadge status={previewRule.status} /></div>
                                    <div><strong>Author:</strong> {previewRule.author}</div>
                                    <div><strong>Date:</strong> {new Date(previewRule.date).toLocaleDateString()}</div>
                                </div>

                                {previewRule.tags.length > 0 && (
                                    <div>
                                        <strong>Tags:</strong>
                                        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                            {previewRule.tags.map(tag => (
                                                <span key={tag} style={{
                                                    backgroundColor: "var(--bg-secondary)",
                                                    padding: "0.25rem 0.5rem",
                                                    borderRadius: "var(--radius-sm)",
                                                    fontSize: "0.85rem"
                                                }}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <strong>Detection Logic:</strong>
                                    <pre style={{
                                        marginTop: "0.5rem",
                                        padding: "1rem",
                                        backgroundColor: "var(--bg-dark)",
                                        borderRadius: "var(--radius-sm)",
                                        overflow: "auto",
                                        fontSize: "0.85rem"
                                    }}>
                                        {previewRule.detection.condition}
                                    </pre>
                                </div>

                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                                    <Button onClick={() => { handleEditRule(previewRule); setPreviewRule(null); }}>✏️ Edit</Button>
                                    <Button variant="secondary" onClick={() => { handleDuplicateRule(previewRule); setPreviewRule(null); }}>📋 Duplicate</Button>
                                    <Button variant="secondary" onClick={() => handleExportRule(previewRule.id, previewRule.title)}>📤 Export</Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

// Stat Card Component
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <Card style={{ textAlign: "center", padding: "1rem" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>{label}</div>
        <div style={{ fontSize: "1.75rem", fontWeight: "bold", color }}>{value}</div>
    </Card>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    let color = "var(--success)";
    if (status === "disabled") color = "var(--text-secondary)";
    if (status === "experimental") color = "var(--warning)";
    if (status === "deprecated") color = "var(--danger)";

    return (
        <span style={{
            backgroundColor: `${color}22`,
            color: color,
            padding: "0.1rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            fontWeight: 600,
            border: `1px solid ${color}66`
        }}>
            {status}
        </span>
    );
};

// Severity Badge Component
const Badge: React.FC<{ children: React.ReactNode; variant: string }> = ({ children, variant }) => {
    let color = "var(--info)";
    if (variant === "critical" || variant === "high") color = "var(--danger)";
    if (variant === "medium") color = "var(--warning)";

    return (
        <span style={{
            backgroundColor: `${color}33`,
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
