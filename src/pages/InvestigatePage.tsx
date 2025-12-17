import React, { useState } from "react";
import { queryService, QueryResult } from "../services/query";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export const InvestigatePage: React.FC = () => {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<QueryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const exampleQueries = [
        {
            name: "List all events",
            sql: "SELECT * FROM read_json_auto('path/to/logs.json') LIMIT 100"
        },
        {
            name: "Failed logins",
            sql: "SELECT * FROM read_json_auto('path/to/logs.json') WHERE event_id = 4625"
        },
        {
            name: "Count by event type",
            sql: "SELECT event_id, COUNT(*) as count FROM read_json_auto('path/to/logs.json') GROUP BY event_id ORDER BY count DESC"
        }
    ];

    async function handleRunQuery() {
        if (!query.trim()) return;

        try {
            setLoading(true);
            setError(null);
            const data = await queryService.runQuery(query);
            setResult(data);
        } catch (err: any) {
            setError(err.toString());
            setResult(null);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h1>Ad-hoc Investigation</h1>

            <Card title="SQL Query Editor">
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                            DuckDB SQL Query
                        </label>
                        <textarea
                            className="input"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="SELECT * FROM read_json_auto('path/to/logs.json') WHERE ..."
                            rows={8}
                            style={{ fontFamily: "monospace", fontSize: "0.9rem", resize: "vertical" }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {exampleQueries.map((ex, idx) => (
                                <Button
                                    key={idx}
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setQuery(ex.sql)}
                                >
                                    {ex.name}
                                </Button>
                            ))}
                        </div>
                        <Button onClick={handleRunQuery} disabled={loading || !query.trim()}>
                            {loading ? "Running..." : "Run Query"}
                        </Button>
                    </div>

                    {error && (
                        <div style={{ padding: "0.75rem", backgroundColor: "var(--danger)33", border: "1px solid var(--danger)", borderRadius: "var(--radius-md)", color: "var(--danger)" }}>
                            {error}
                        </div>
                    )}
                </div>
            </Card>

            {result && (
                <Card title={`Results (${result.row_count} rows in ${result.execution_time_ms}ms)`}>
                    {result.row_count === 0 ? (
                        <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>No results found.</p>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
                                        {result.columns.map((col) => (
                                            <th key={col} style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600 }}>
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                                            {result.columns.map((col) => (
                                                <td key={col} style={{ padding: "0.75rem", color: "var(--text-secondary)" }}>
                                                    {typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col] ?? "")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};
