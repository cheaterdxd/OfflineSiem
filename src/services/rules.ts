import { invoke } from "@tauri-apps/api/core";

export interface RuleYaml {
    id: string;
    title: string;
    description: string;
    author: string;
    status: string;
    date: string;
    tags: string[];
    detection: {
        severity: string;
        condition: string;
    };
    output?: {
        alert_title: string;
    };
}

export const ruleService = {
    listRules: async (): Promise<RuleYaml[]> => {
        return await invoke("list_rules");
    },

    getRule: async (ruleId: string): Promise<RuleYaml> => {
        return await invoke("get_rule", { ruleId });
    },

    saveRule: async (rule: RuleYaml): Promise<RuleYaml> => {
        return await invoke("save_rule", { rule });
    },

    deleteRule: async (ruleId: string): Promise<void> => {
        return await invoke("delete_rule", { ruleId });
    },

    exportRule: async (ruleId: string, destPath: string): Promise<void> => {
        return await invoke("export_rule", { ruleId, destPath });
    },

    exportAllRules: async (destPath: string): Promise<number> => {
        return await invoke("export_all_rules", { destPath });
    },

    importRule: async (sourcePath: string, overwrite: boolean): Promise<RuleYaml> => {
        return await invoke("import_rule", { sourcePath, overwrite });
    },

    importRulesZip: async (zipPath: string, overwrite: boolean): Promise<ImportSummary> => {
        return await invoke("import_rules_zip", { zipPath, overwrite });
    },

    importMultipleRules: async (filePaths: string[], overwrite: boolean): Promise<ImportSummary> => {
        return await invoke("import_multiple_rules", { filePaths, overwrite });
    },
};

export interface ImportSummary {
    success_count: number;
    skipped: string[];
    errors: string[];
}
