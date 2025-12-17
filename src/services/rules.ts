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
        aggregation?: {
            enabled: boolean;
            window: string;
            threshold: string;
        };
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
};
