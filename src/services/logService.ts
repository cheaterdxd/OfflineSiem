import { invoke } from "@tauri-apps/api/core";

export interface LogFileInfo {
    filename: string;
    path: string;
    size_bytes: number;
    modified: string;
    event_count: number | null;
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
    importLogFile: async (sourcePath: string): Promise<LogFileInfo> => {
        return await invoke("import_log_file", { sourcePath });
    },

    /**
     * Delete a log file from the monitored folder.
     */
    deleteLogFile: async (filename: string): Promise<void> => {
        return await invoke("delete_log_file", { filename });
    },
};
