import React, { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { logService, LogFileInfo } from "../services/logService";
import { Button } from "./Button";

interface LogFileSelectorProps {
    onSelectFile: (logFile: LogFileInfo) => void;
    selectedFile: LogFileInfo | null;
}

export const LogFileSelector: React.FC<LogFileSelectorProps> = ({
    onSelectFile,
    selectedFile,
}) => {
    const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load log files on mount
    useEffect(() => {
        loadLogFiles();
    }, []);

    const loadLogFiles = async () => {
        try {
            setLoading(true);
            setError(null);
            const files = await logService.listLogFiles();
            setLogFiles(files);
        } catch (err) {
            setError(`Failed to load log files: ${err}`);
            console.error("Error loading log files:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleImportFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [
                    {
                        name: "JSON Log Files",
                        extensions: ["json"],
                    },
                ],
            });

            if (selected && typeof selected === "string") {
                setLoading(true);
                setError(null);
                const importedFile = await logService.importLogFile(selected);
                await loadLogFiles(); // Refresh the list
                onSelectFile(importedFile); // Auto-select the imported file
            }
        } catch (err) {
            setError(`Failed to import file: ${err}`);
            console.error("Error importing file:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFile = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await logService.deleteLogFile(filename);
            await loadLogFiles(); // Refresh the list

            // Clear selection if deleted file was selected
            if (selectedFile && selectedFile.filename === filename) {
                onSelectFile(null as any);
            }
        } catch (err) {
            setError(`Failed to delete file: ${err}`);
            console.error("Error deleting file:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (isoDate: string): string => {
        try {
            return new Date(isoDate).toLocaleString();
        } catch {
            return isoDate;
        }
    };

    return (
        <div style={{ marginBottom: "1.5rem" }}>
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem"
            }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                    Log Files
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button onClick={loadLogFiles} disabled={loading}>
                        Refresh
                    </Button>
                    <Button onClick={handleImportFile} disabled={loading}>
                        Import Log File
                    </Button>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: "0.75rem",
                    backgroundColor: "#FEE2E2",
                    color: "#991B1B",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "1rem",
                    fontSize: "0.9rem"
                }}>
                    {error}
                </div>
            )}

            {loading && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                    Loading...
                </div>
            )}

            {!loading && logFiles.length === 0 && (
                <div style={{
                    padding: "2rem",
                    textAlign: "center",
                    backgroundColor: "var(--bg-input)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-secondary)"
                }}>
                    <p style={{ margin: 0 }}>No log files found.</p>
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem" }}>
                        Click "Import Log File" to add JSON log files.
                    </p>
                </div>
            )}

            {!loading && logFiles.length > 0 && (
                <div style={{
                    display: "grid",
                    gap: "0.75rem",
                    maxHeight: "400px",
                    overflowY: "auto"
                }}>
                    {logFiles.map((file) => (
                        <div
                            key={file.filename}
                            onClick={() => onSelectFile(file)}
                            style={{
                                padding: "1rem",
                                backgroundColor: selectedFile?.filename === file.filename
                                    ? "var(--bg-input)"
                                    : "var(--bg-card)",
                                border: selectedFile?.filename === file.filename
                                    ? "2px solid var(--primary)"
                                    : "1px solid var(--border-color)",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                                if (selectedFile?.filename !== file.filename) {
                                    e.currentTarget.style.borderColor = "var(--primary)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedFile?.filename !== file.filename) {
                                    e.currentTarget.style.borderColor = "var(--border-color)";
                                }
                            }}
                        >
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start"
                            }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{
                                        fontWeight: 600,
                                        marginBottom: "0.5rem",
                                        wordBreak: "break-all",
                                        color: "var(--text-primary)"
                                    }}>
                                        {file.filename}
                                    </div>
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "auto 1fr",
                                        gap: "0.25rem 0.75rem",
                                        fontSize: "0.85rem",
                                        color: "var(--text-secondary)"
                                    }}>
                                        <span>Size:</span>
                                        <span>{formatFileSize(file.size_bytes)}</span>

                                        <span>Modified:</span>
                                        <span>{formatDate(file.modified)}</span>

                                        {file.event_count !== null && (
                                            <>
                                                <span>Events:</span>
                                                <span>{file.event_count.toLocaleString()}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFile(file.filename);
                                    }}
                                    style={{
                                        background: "transparent",
                                        border: "1px solid var(--border-color)",
                                        color: "var(--danger)",
                                        cursor: "pointer",
                                        padding: "0.375rem 0.75rem",
                                        fontSize: "0.875rem",
                                        marginLeft: "0.5rem",
                                        borderRadius: "var(--radius-md)",
                                        fontWeight: 500,
                                        transition: "all 0.15s"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = "var(--danger)";
                                        e.currentTarget.style.color = "white";
                                        e.currentTarget.style.borderColor = "var(--danger)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = "transparent";
                                        e.currentTarget.style.color = "var(--danger)";
                                        e.currentTarget.style.borderColor = "var(--border-color)";
                                    }}
                                    title="Delete file"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
