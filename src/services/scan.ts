import { invoke } from "@tauri-apps/api/core";

export interface AlertEvent {
    rule_id: string;
    rule_title: string;
    severity: string;
    timestamp: string;
    match_count: number;
    evidence: any[];
}

export interface ScanResponse {
    alerts: AlertEvent[];
    rules_evaluated: number;
    scan_time_ms: number;
}

export const scanService = {
    scanLogs: async (logPath: string, logType: string): Promise<ScanResponse> => {
        return await invoke("scan_logs", { logPath, logType });
    },

    validateLogFile: async (logPath: string): Promise<boolean> => {
        return await invoke("validate_log_file", { logPath });
    },
};
