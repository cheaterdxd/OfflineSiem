import { invoke } from "@tauri-apps/api/core";

export interface AlertEvent {
    rule_id: string;
    rule_title: string;
    severity: string;
    timestamp: string;
    match_count: number;
    evidence: any[];
    source_file?: string; // Optional field for bulk scans
}

export interface ScanResponse {
    alerts: AlertEvent[];
    rules_evaluated: number;
    scan_time_ms: number;
}

export interface FileScanResult {
    file_name: string;
    file_path: string;
    alerts: AlertEvent[];
    scan_time_ms: number;
}

export interface FailedFileScan {
    file_name: string;
    file_path: string;
    error: string;
}

export interface BulkScanResponse {
    total_alerts: number;
    total_files_scanned: number;
    total_scan_time_ms: number;
    rules_evaluated: number;
    file_results: FileScanResult[];
    failed_files: FailedFileScan[];
}

export const scanService = {
    scanLogs: async (logPath: string, logType: string): Promise<ScanResponse> => {
        return await invoke("scan_logs", { logPath, logType });
    },

    scanAllLogs: async (): Promise<BulkScanResponse> => {
        return await invoke("scan_all_logs");
    },

    validateLogFile: async (logPath: string): Promise<boolean> => {
        return await invoke("validate_log_file", { logPath });
    },
};
