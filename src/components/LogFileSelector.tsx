import React, { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { logService, LogFileInfo, LogType } from "../services/logService";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

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

    // Refs for scroll position preservation
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const savedScrollPosition = useRef<number | null>(null);

    // Load log files on mount
    useEffect(() => {
        loadLogFiles();
    }, []);

    // Restore scroll position after logFiles update
    useEffect(() => {
        if (savedScrollPosition.current !== null && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedScrollPosition.current;
            savedScrollPosition.current = null; // Clear after restoring
        }
    }, [logFiles]);

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
                // Show dialog to select log type
                const logType = await showLogTypeDialog();
                if (!logType) return; // User cancelled

                setLoading(true);
                setError(null);
                const importedFile = await logService.importLogFile(selected, logType);
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

    const showLogTypeDialog = (): Promise<"cloudtrail" | "flatjson" | null> => {
        return new Promise((resolve) => {
            const dialog = document.createElement("div");
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;

            const content = document.createElement("div");
            content.style.cssText = `
                background: var(--bg-card);
                padding: 2rem;
                border-radius: var(--radius-lg);
                max-width: 400px;
                width: 90%;
            `;

            content.innerHTML = `
                <h3 style="margin: 0 0 1rem 0; color: var(--text-primary);">Select Log Format</h3>
                <p style="margin: 0 0 1.5rem 0; color: var(--text-secondary); font-size: 0.9rem;">
                    Choose the format of the log file you're importing:
                </p>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
                    <button id="cloudtrail-btn" style="
                        padding: 1rem;
                        background: var(--bg-input);
                        border: 2px solid var(--border-color);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.2s;
                    ">
                        <div style="font-weight: 600; margin-bottom: 0.25rem; color: var(--text-primary);">CloudTrail</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">AWS CloudTrail logs with Records array</div>
                    </button>
                    <button id="flatjson-btn" style="
                        padding: 1rem;
                        background: var(--bg-input);
                        border: 2px solid var(--border-color);
                        border-radius: var(--radius-md);
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.2s;
                    ">
                        <div style="font-weight: 600; margin-bottom: 0.25rem; color: var(--text-primary);">FlatJson</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Single JSON object or NDJSON format</div>
                    </button>
                </div>
                <button id="cancel-btn" style="
                    width: 100%;
                    padding: 0.75rem;
                    background: transparent;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    color: var(--text-secondary);
                ">Cancel</button>
            `;

            dialog.appendChild(content);
            document.body.appendChild(dialog);

            const cleanup = () => document.body.removeChild(dialog);

            content.querySelector("#cloudtrail-btn")?.addEventListener("click", () => {
                cleanup();
                resolve("cloudtrail");
            });

            content.querySelector("#flatjson-btn")?.addEventListener("click", () => {
                cleanup();
                resolve("flatjson");
            });

            content.querySelector("#cancel-btn")?.addEventListener("click", () => {
                cleanup();
                resolve(null);
            });

            // Add hover effects
            [content.querySelector("#cloudtrail-btn"), content.querySelector("#flatjson-btn")].forEach(btn => {
                btn?.addEventListener("mouseenter", (e) => {
                    (e.target as HTMLElement).style.borderColor = "var(--primary)";
                });
                btn?.addEventListener("mouseleave", (e) => {
                    (e.target as HTMLElement).style.borderColor = "var(--border-color)";
                });
            });
        });
    };

    const handleBatchImport = async () => {
        try {
            const selected = await open({
                multiple: true,  // Allow multiple selection
                filters: [
                    {
                        name: "JSON Log Files",
                        extensions: ["json"],
                    },
                ],
            });

            if (selected && Array.isArray(selected) && selected.length > 0) {
                // Show dialog to select log type
                const logType = await showLogTypeDialog();
                if (!logType) return; // User cancelled

                setLoading(true);
                setError(null);

                const summary = await logService.importMultipleLogFiles(selected, logType);

                await loadLogFiles(); // Refresh the list

                // Show summary
                if (summary.failed > 0) {
                    setError(`Imported ${summary.succeeded}/${summary.total} files. Errors: ${summary.errors.join(", ")}`);
                } else {
                    setError(null);
                }

                // Auto-select first imported file if any
                if (summary.imported_files.length > 0) {
                    onSelectFile(summary.imported_files[0]);
                }
            }
        } catch (err) {
            setError(`Failed to import files: ${err}`);
            console.error("Error importing files:", err);
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
                    <Tooltip content="Refresh the list of imported log files" position="left">
                        <Button onClick={loadLogFiles} disabled={loading}>
                            Refresh
                        </Button>
                    </Tooltip>
                    <Tooltip content="Import and save log file to library for repeated use" position="left">
                        <Button onClick={handleImportFile} disabled={loading}>
                            Import to Library
                        </Button>
                    </Tooltip>
                    <Tooltip content="Import multiple log files at once" position="left">
                        <Button onClick={handleBatchImport} disabled={loading}>
                            Batch Import
                        </Button>
                    </Tooltip>
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
                        Click "Import to Library" to add JSON log files.
                    </p>
                </div>
            )}

            {!loading && logFiles.length > 0 && (
                <div
                    ref={scrollContainerRef}
                    style={{
                        display: "grid",
                        gap: "0.75rem",
                        maxHeight: "400px",
                        overflowY: "auto"
                    }}
                >
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

                                        <span>Format:</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{
                                                padding: "0.125rem 0.5rem",
                                                borderRadius: "var(--radius-sm)",
                                                fontSize: "0.75rem",
                                                fontWeight: 600,
                                                backgroundColor: file.log_type === "cloudtrail" ? "#DBEAFE" : "#FEF3C7",
                                                color: file.log_type === "cloudtrail" ? "#1E40AF" : "#92400E"
                                            }}>
                                                {file.log_type === "cloudtrail" ? "CloudTrail" : file.log_type === "flatjson" ? "FlatJson" : "Unknown"}
                                            </span>
                                            <select
                                                value={file.log_type || "flatjson"}
                                                onChange={async (e) => {
                                                    e.stopPropagation();
                                                    const newType = e.target.value as "cloudtrail" | "flatjson";
                                                    try {
                                                        // Save scroll position before refresh
                                                        if (scrollContainerRef.current) {
                                                            savedScrollPosition.current = scrollContainerRef.current.scrollTop;
                                                        }
                                                        await logService.updateLogType(file.filename, newType);
                                                        await loadLogFiles();
                                                    } catch (err) {
                                                        setError(`Failed to update log type: ${err}`);
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    padding: "0.125rem 0.25rem",
                                                    fontSize: "0.75rem",
                                                    border: "1px solid var(--border-color)",
                                                    borderRadius: "var(--radius-sm)",
                                                    background: "var(--bg-input)",
                                                    color: "var(--text-primary)",
                                                    cursor: "pointer"
                                                }}
                                            >
                                                <option value="cloudtrail">CloudTrail</option>
                                                <option value="flatjson">FlatJson</option>
                                            </select>
                                        </div>
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
