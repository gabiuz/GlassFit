// PRD-F5, PRD-F14, SDD-C4, SDD-C9, QAD-TC62.
export type DuplicateProductAction = {
  target_type: "product";
  action_type: "duplicate_product";
  split_axis: "width" | "height";
  max_per_instance: number;
};

export type DuplicateRuleParameter = {
  parameter_key: string;
  parameter_type: string;
  minimum_value: number | null;
  unit: string | null;
};

export type DuplicateRuleInput = {
  rule_name: string;
  condition_data: { rule_type?: string; parameter_key: string; operator?: string; value?: number | string; step_value?: number; start_value?: number };
  action_data: { target_type: string; action_type: string; split_axis?: string; max_per_instance?: number; target_key?: string; value?: number | string };
};

export function duplicateProductRuleError(
  rule: DuplicateRuleInput,
  parameters: DuplicateRuleParameter[],
): string | null {
  const action = rule.action_data;
  if (action.action_type !== "duplicate_product" && action.target_type !== "product") return null;
  const prefix = `Rule ${rule.rule_name}: `;
  if (action.target_type !== "product" || action.action_type !== "duplicate_product") return prefix + "select a valid whole-product action.";
  const axis = action.split_axis;
  if (axis !== "width" && axis !== "height") return prefix + "select Width or Height.";
  const parameter = parameters.find(p => p.parameter_key === axis);
  if (!parameter || !["Number", "Integer"].includes(parameter.parameter_type) || rule.condition_data.parameter_key !== axis) {
    return prefix + "the numeric rule dimension must match the split dimension.";
  }
  if (rule.condition_data.rule_type === "loop") {
    const step = rule.condition_data.step_value;
    const start = rule.condition_data.start_value;
    if (typeof step !== "number" || !Number.isFinite(step) || step <= 0) return prefix + "enter a finite, positive loop step.";
    if (typeof start !== "number" || !Number.isFinite(start) || start < 0) return prefix + "enter a finite, nonnegative loop start.";
  } else {
    if (rule.condition_data.operator !== ">" && rule.condition_data.operator !== ">=") return prefix + "use > or >= for the threshold.";
    const threshold = rule.condition_data.value;
    if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold < 0) return prefix + "enter a finite, nonnegative threshold.";
  }
  const cap = action.max_per_instance;
  if (typeof cap !== "number" || !Number.isFinite(cap) || cap <= 0) return prefix + "enter a positive Maximum per product.";
  if (parameter.minimum_value !== null && cap < parameter.minimum_value) return prefix + "Maximum per product must be at least the parameter minimum.";
  if ("target_key" in action || "value" in action) return prefix + "remove component or parameter target fields.";
  return null;
}
