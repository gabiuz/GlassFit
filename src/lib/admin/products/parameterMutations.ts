"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";

export type ParameterDefaultValue = string | number | boolean | Record<string, unknown>;

export type UpsertParameterInput = {
    parameter_id?: string;
    parameter_key: string;
    parameter_name: string;
    parameter_type: string;
    minimum_value: number | null;
    maximum_value: number | null;
    default_value: number | string;
    step_value: number | null;
    unit: string | null;
    affects_structure: boolean;
    display_order: number;
};

export type RuleConditionData = {
    parameter_key: string;
    operator: string;
    value: number | string;
};

export type RuleActionData = {
    target_type: string;
    target_key: string;
    action_type: string;
    value: number | string;
};

export type UpsertRuleInput = {
    rule_id?: string;
    rule_name: string;
    priority: number;
    condition_data: RuleConditionData;
    action_data: RuleActionData;
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

    // 1. Delete existing rules
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
        const paramRows = parameters.map(p => ({
            template_id: templateId,
            parameter_key: p.parameter_key,
            parameter_name: p.parameter_name,
            parameter_type: p.parameter_type,
            minimum_value: p.minimum_value,
            maximum_value: p.maximum_value,
            default_value: p.default_value,
            step_value: p.step_value,
            unit: p.unit,
            affects_structure: p.affects_structure,
            display_order: p.display_order,
            created_by: adminCtx.profileId,
            updated_by: adminCtx.profileId,
            status: "Active"
        }));

        const { error: insParamsError } = await supabase
            .from("product_parameters")
            .insert(paramRows);

        if (insParamsError) throw new Error("Failed to insert parameters: " + insParamsError.message);
    }

    // 4. Insert new rules
    if (rules.length > 0) {
        const ruleRows = rules.map(r => ({
            template_id: templateId,
            rule_name: r.rule_name,
            priority: r.priority,
            condition_data: r.condition_data,
            action_data: r.action_data,
            created_by: adminCtx.profileId,
            updated_by: adminCtx.profileId,
            status: "Active"
        }));

        const { error: insRulesError } = await supabase
            .from("structural_rules")
            .insert(ruleRows);

        if (insRulesError) throw new Error("Failed to insert rules: " + insRulesError.message);
    }

    return true;
}

export async function upsertProductParameters(
    templateId: string,
    parameters: UpsertParameterInput[]
) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    const { error: delParamsError } = await supabase
        .from("product_parameters")
        .delete()
        .eq("template_id", templateId);

    if (delParamsError) throw new Error("Failed to clear existing parameters: " + delParamsError.message);

    if (parameters.length > 0) {
        const paramRows = parameters.map((p, idx) => ({
            template_id: templateId,
            parameter_key: p.parameter_key,
            parameter_name: p.parameter_name,
            parameter_type: p.parameter_type,
            minimum_value: p.minimum_value,
            maximum_value: p.maximum_value,
            default_value: p.default_value,
            step_value: p.step_value,
            unit: p.unit,
            affects_structure: p.affects_structure,
            display_order: p.display_order ?? idx + 1,
            created_by: adminCtx.profileId,
            updated_by: adminCtx.profileId,
            status: "Active",
        }));

        const { error: insParamsError } = await supabase
            .from("product_parameters")
            .insert(paramRows);

        if (insParamsError) throw new Error("Failed to insert parameters: " + insParamsError.message);
    }

    return true;
}

export async function upsertStructuralRules(
    templateId: string,
    rules: UpsertRuleInput[]
) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    const { error: delRulesError } = await supabase
        .from("structural_rules")
        .delete()
        .eq("template_id", templateId);

    if (delRulesError) throw new Error("Failed to clear existing rules: " + delRulesError.message);

    if (rules.length > 0) {
        const ruleRows = rules.map((r, idx) => ({
            template_id: templateId,
            rule_name: r.rule_name,
            priority: r.priority ?? idx + 1,
            condition_data: r.condition_data,
            action_data: r.action_data,
            created_by: adminCtx.profileId,
            updated_by: adminCtx.profileId,
            status: "Active",
        }));

        const { error: insRulesError } = await supabase
            .from("structural_rules")
            .insert(ruleRows);

        if (insRulesError) throw new Error("Failed to insert rules: " + insRulesError.message);
    }

    return true;
}

