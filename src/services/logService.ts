import { invoke } from "@tauri-apps/api/core";

export type LogType = "cloudtrail" | "flatjson";

export interface LogFileInfo {
    filename: string;
    path: string;
    size_bytes: number;
    modified: string;
    log_type: LogType | null;
}

export interface ImportSummary {
    total: number;
    succeeded: number;
    failed: number;
    imported_files: LogFileInfo[];
    errors: string[];
}

export const logService = {
    /**
     * List all JSON log files in the monitored logs folder.
     */
    listLogFiles: async (): Promise<LogFileInfo[]> => {
        return await invoke("list_log_files");
    },

    /**
     * Import an external log file by copying it to the monitored folder.
     */
    importLogFile: async (sourcePath: string, logType: LogType): Promise<LogFileInfo> => {
        return await invoke("import_log_file", { sourcePath, logType });
    },

    /**
     * Import multiple log files at once with the same log type.
     */
    importMultipleLogFiles: async (sourcePaths: string[], logType: LogType): Promise<ImportSummary> => {
        return await invoke("import_multiple_log_files", { sourcePaths, logType });
    },

    /**
     * Delete a log file from the monitored folder.
     */
    deleteLogFile: async (filename: string): Promise<void> => {
        return await invoke("delete_log_file", { filename });
    },

    /**
     * Update the log type for a specific log file.
     */
    updateLogType: async (filename: string, logType: LogType): Promise<void> => {
        return await invoke("update_log_type", { filename, logType });
    },
};
