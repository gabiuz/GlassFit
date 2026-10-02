import type {
  ProductStructuralDefinition,
  ResolvedStructure,
} from "./types";

type ResolveProductStructureInput = {
  definition: ProductStructuralDefinition;
  values?: Record<string, unknown>;
};

export function resolveProductStructure({
  definition,
  values = {},
}: ResolveProductStructureInput): ResolvedStructure {
  const resolvedValues: Record<string, unknown> = {
    ...definition.template.baseConfiguration,
  };
  const parameterKeys = new Set<string>();

  for (const parameter of definition.parameters) {
    parameterKeys.add(parameter.parameterKey);
    resolvedValues[parameter.parameterKey] = normalizeParameterValue(
      values[parameter.parameterKey] ?? resolvedValues[parameter.parameterKey] ?? parameter.defaultValue,
      parameter.parameterType,
      parameter.minimumValue,
      parameter.maximumValue,
      parameter.stepValue,
    );
  }

  for (const [key, value] of Object.entries(values)) {
    if (!parameterKeys.has(key)) {
      resolvedValues[key] = value;
    }
  }

  const componentQuantities: Record<string, number> = {};
  for (const component of definition.components) {
    componentQuantities[normalizeComponentKey(component.componentKey)] =
      component.baseQuantity;
  }

  const appliedRuleIds: string[] = [];
  for (const rule of [...definition.rules].sort((a, b) => a.priority - b.priority)) {
    const condition = rule.conditionData;
    const ruleType = condition.rule_type ?? (condition.step_value ? "loop" : "when_then");

    if (ruleType === "loop") {
      const isApplied = applyStepLoopRule(condition, rule.actionData, resolvedValues, componentQuantities);
      if (isApplied) {
        appliedRuleIds.push(rule.ruleId);
      }
    } else {
      if (!matchesCondition(condition, resolvedValues)) {
        continue;
      }
      applyRuleAction(rule.actionData, resolvedValues, componentQuantities);
      appliedRuleIds.push(rule.ruleId);
    }
  }

  return {
    resolvedValues,
    numericValuesMm: getNumericValuesMm(
      definition.template.measurementUnit,
      definition.parameters,
      resolvedValues,
    ),
    componentQuantities,
    appliedRuleIds,
  };
}

export function normalizeComponentKey(key: string) {
  return key.trim().toLowerCase().replace(/_/g, "-");
}

function normalizeParameterValue(
  value: unknown,
  parameterType: string,
  min: number | null,
  max: number | null,
  step: number | null,
) {
  if (parameterType === "Boolean") {
    return Boolean(value);
  }

  if (parameterType === "Number" || parameterType === "Integer") {
    let numericValue = toNumber(value, 0);

    if (min !== null) {
      numericValue = Math.max(min, numericValue);
    }

    if (max !== null) {
      numericValue = Math.min(max, numericValue);
    }

    if (step && step > 0) {
      numericValue = Math.round(numericValue / step) * step;
    }

    return parameterType === "Integer" ? Math.round(numericValue) : numericValue;
  }

  return value;
}

function matchesCondition(
  condition: Record<string, unknown>,
  resolvedValues: Record<string, unknown>,
) {
  const parameter = typeof condition.parameter === "string" ? condition.parameter : (typeof condition.parameter_key === "string" ? condition.parameter_key : null);
  const operator = typeof condition.operator === "string" ? condition.operator : null;

  if (!parameter || !operator) {
    return false;
  }

  const actual = resolvedValues[parameter];
  const expected = condition.value;

  switch (operator) {
    case ">=":
      return toNumber(actual, Number.NaN) >= toNumber(expected, Number.NaN);
    case ">":
      return toNumber(actual, Number.NaN) > toNumber(expected, Number.NaN);
    case "<=":
      return toNumber(actual, Number.NaN) <= toNumber(expected, Number.NaN);
    case "<":
      return toNumber(actual, Number.NaN) < toNumber(expected, Number.NaN);
    case "==":
    case "=":
      return actual === expected;
    case "!=":
      return actual !== expected;
    default:
      return false;
  }
}

function applyStepLoopRule(
  condition: Record<string, unknown>,
  action: Record<string, unknown>,
  resolvedValues: Record<string, unknown>,
  componentQuantities: Record<string, number>,
): boolean {
  const paramKey = typeof condition.parameter_key === "string" 
    ? condition.parameter_key 
    : (typeof condition.parameter === "string" ? condition.parameter : null);

  if (!paramKey) return false;

  const actualValue = toNumber(resolvedValues[paramKey], Number.NaN);
  if (Number.isNaN(actualValue)) return false;

  const stepValue = toNumber(condition.step_value, 0);
  if (stepValue <= 0) return false; // Prevent division by zero or infinite loop

  const startValue = toNumber(condition.start_value, 0);
  const delta = actualValue - startValue;

  if (delta <= 0) return false;

  const steps = Math.floor(delta / stepValue);
  if (steps <= 0) return false;

  const quantityPerStep = toNumber(action.value, 1);
  const totalAdded = steps * quantityPerStep;

  const targetType = action.target_type;
  const targetKey = action.target_key;
  const actionType = action.action_type;

  if (typeof targetKey === "string" && targetType === "component") {
    const normalizedKey = normalizeComponentKey(targetKey);
    const currentQty = componentQuantities[normalizedKey] ?? 0;

    if (actionType === "set_quantity") {
      componentQuantities[normalizedKey] = Math.max(0, totalAdded);
    } else {
      // Default: "add_quantity"
      componentQuantities[normalizedKey] = Math.max(0, currentQty + totalAdded);
    }
    return true;
  } else if (typeof targetKey === "string" && targetType === "parameter") {
    const currentVal = toNumber(resolvedValues[targetKey], 0);
    resolvedValues[targetKey] = currentVal + totalAdded;
    return true;
  }

  return false;
}

function applyRuleAction(
  action: Record<string, unknown>,
  resolvedValues: Record<string, unknown>,
  componentQuantities: Record<string, number>,
) {
  // Support legacy nested structure
  const set = action.set;
  if (set && typeof set === "object" && !Array.isArray(set)) {
    Object.assign(resolvedValues, set);
  }

  const quantities = action.component_quantities ?? action.componentQuantities;
  if (quantities && typeof quantities === "object" && !Array.isArray(quantities)) {
    for (const [key, value] of Object.entries(quantities)) {
      componentQuantities[normalizeComponentKey(key)] = Math.max(0, toNumber(value, 0));
    }
  }

  // Support new flat structure from admin UI builder
  if (action.target_type === "component" && typeof action.target_key === "string") {
    const normalizedKey = normalizeComponentKey(action.target_key);
    const currentQty = componentQuantities[normalizedKey] ?? 0;
    if (action.action_type === "set_quantity") {
      componentQuantities[normalizedKey] = Math.max(0, toNumber(action.value, 0));
    } else if (action.action_type === "add_quantity") {
      componentQuantities[normalizedKey] = Math.max(0, currentQty + toNumber(action.value, 0));
    }
  } else if (action.target_type === "parameter" && action.action_type === "set_value" && typeof action.target_key === "string") {
    resolvedValues[action.target_key] = action.value;
  }
}

function getNumericValuesMm(
  templateUnit: string,
  parameters: ProductStructuralDefinition["parameters"],
  values: Record<string, unknown>,
) {
  const result: Record<string, number> = {};

  for (const parameter of parameters) {
    const raw = values[parameter.parameterKey];
    const numeric = toNumber(raw, Number.NaN);
    if (!Number.isFinite(numeric)) {
      continue;
    }

    result[parameter.parameterKey] = toMillimeters(
      numeric,
      parameter.unit ?? templateUnit,
    );
  }

  for (const [key, value] of Object.entries(values)) {
    if (key in result) {
      continue;
    }

    const numeric = toNumber(value, Number.NaN);
    if (Number.isFinite(numeric)) {
      result[key] = toMillimeters(numeric, templateUnit);
    }
  }

  return result;
}

function toMillimeters(value: number, unit: string) {
  switch (unit) {
    case "m":
      return value * 1000;
    case "cm":
      return value * 10;
    case "mm":
    default:
      return value;
  }
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}
