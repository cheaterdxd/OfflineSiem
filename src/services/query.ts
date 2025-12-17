import { invoke } from "@tauri-apps/api/core";

export interface QueryResult {
    query: string;
    columns: string[];
    rows: any[];
    row_count: number;
    execution_time_ms: number;
}

export const queryService = {
    runQuery: async (query: string): Promise<QueryResult> => {
        return await invoke("run_query", { query });
    },
};
