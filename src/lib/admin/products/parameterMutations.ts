"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";

export type UpsertParameterInput = {
    parameter_key: string;
    parameter_name: string;
    parameter_type: string;
    minimum_value: number | null;
    maximum_value: number | null;
    default_value: any;
    step_value: number | null;
    unit: string | null;
    affects_structure: boolean;
    display_order: number;
};

export type UpsertRuleInput = {
    rule_name: string;
    priority: number;
    condition_data: any;
    action_data: any;
};

export async function upsertParametersAndRules(
    templateId: string,
    parameters: UpsertParameterInput[],
    rules: UpsertRuleInput[]
) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // To ensure full synchronization, we will do a replacement strategy:
    // Delete existing parameters and rules for this template, then insert the new ones.
    // This works smoothly because no other tables have foreign keys pointing to parameter_id or rule_id.

    // 1. Delete existing rules (child table first conceptually, though no FK constraint points to rules)
    const { error: delRulesError } = await supabase
        .from("structural_rules")
        .delete()
        .eq("template_id", templateId);

    if (delRulesError) throw new Error("Failed to clear existing rules: " + delRulesError.message);

    // 2. Delete existing parameters
    const { error: delParamsError } = await supabase
        .from("product_parameters")
        .delete()
        .eq("template_id", templateId);

    if (delParamsError) throw new Error("Failed to clear existing parameters: " + delParamsError.message);

    // 3. Insert new parameters
    if (parameters.length > 0) {
        const paramRows = parameters.map(p => {
            const { parameter_id, ...rest } = p as any;
            return {
                ...rest,
                template_id: templateId,
                created_by: adminCtx.profileId,
                updated_by: adminCtx.profileId,
                status: "Active"
            };
        });

        const { error: insParamsError } = await supabase
            .from("product_parameters")
            .insert(paramRows);

        if (insParamsError) throw new Error("Failed to insert parameters: " + insParamsError.message);
    }

    // 4. Insert new rules
    if (rules.length > 0) {
        const ruleRows = rules.map(r => {
            const { rule_id, ...rest } = r as any;
            return {
                ...rest,
                template_id: templateId,
                created_by: adminCtx.profileId,
                updated_by: adminCtx.profileId,
                status: "Active"
            };
        });

        const { error: insRulesError } = await supabase
            .from("structural_rules")
            .insert(ruleRows);

        if (insRulesError) throw new Error("Failed to insert rules: " + insRulesError.message);
    }

    return true;
}
