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
    if (!matchesCondition(rule.conditionData, resolvedValues)) {
      continue;
    }

    applyRuleAction(rule.actionData, resolvedValues, componentQuantities);
    appliedRuleIds.push(rule.ruleId);
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
  const parameter = typeof condition.parameter === "string" ? condition.parameter : null;
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

function applyRuleAction(
  action: Record<string, unknown>,
  resolvedValues: Record<string, unknown>,
  componentQuantities: Record<string, number>,
) {
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
