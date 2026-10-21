import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveProductStructure } from "../../src/lib/visualization/structuralResolver";
import type { ProductStructuralDefinition } from "../../src/lib/visualization/types";

describe("IMP-MS43: Unconstrained Dimension Parameters and Incremental Step-Loop Structural Rules", () => {
  const createBaseDefinition = (): ProductStructuralDefinition => ({
    product: {
      productId: "prod-test-01",
      productName: "Test Panoramic Fenestration",
      productType: "Window",
    },
    template: {
      templateId: "tpl-test-01",
      templateName: "Parametric Window Template",
      modelStrategy: "Parametric",
      measurementUnit: "mm",
      baseConfiguration: {
        width: 1200,
        height: 1000,
      },
    },
    parameters: [
      {
        parameterId: "param-w",
        parameterKey: "width",
        parameterName: "Width",
        parameterType: "Number",
        minimumValue: 500,
        maximumValue: null, // Unconstrained
        defaultValue: 1200,
        stepValue: 1,
        unit: "mm",
        affectsStructure: true,
        displayOrder: 1,
      },
      {
        parameterId: "param-h",
        parameterKey: "height",
        parameterName: "Height",
        parameterType: "Number",
        minimumValue: 500,
        maximumValue: null, // Unconstrained
        defaultValue: 1000,
        stepValue: 1,
        unit: "mm",
        affectsStructure: true,
        displayOrder: 2,
      },
    ],
    components: [
      {
        componentId: "comp-mullion",
        componentKey: "horizontal-mullion",
        componentName: "Horizontal Mullion Bar",
        componentType: "Profile",
        baseQuantity: 0,
        componentData: {},
        model: {
          assetId: "ast-mullion",
          r2ObjectKey: "models/mullion.glb",
          url: "https://example.com/mullion.glb",
          fileName: "mullion.glb",
          sourceDimensionsMm: null,
        },
      },
      {
        componentId: "comp-center",
        componentKey: "frame-center",
        componentName: "Vertical Center Mullion",
        componentType: "Profile",
        baseQuantity: 0,
        componentData: {},
        model: {
          assetId: "ast-center",
          r2ObjectKey: "models/center.glb",
          url: "https://example.com/center.glb",
          fileName: "center.glb",
          sourceDimensionsMm: null,
        },
      },
    ],
    rules: [],
  });

  it("TC-LOOP-01: Exact step interval match (height 1500mm -> 1 mullion)", () => {
    const def = createBaseDefinition();
    def.rules = [
      {
        ruleId: "rule-mullion-loop",
        ruleName: "Add horizontal mullion every 500mm",
        priority: 1,
        conditionData: {
          rule_type: "loop",
          parameter_key: "height",
          step_value: 500,
          start_value: 1000,
        },
        actionData: {
          target_type: "component",
          target_key: "horizontal-mullion",
          action_type: "add_quantity",
          value: 1,
        },
      },
    ];

    const result = resolveProductStructure({
      definition: def,
      values: { height: 1500 },
    });

    assert.equal(result.componentQuantities["horizontal-mullion"], 1);
    assert.deepEqual(result.appliedRuleIds, ["rule-mullion-loop"]);
  });

  it("TC-LOOP-02: Intermediate value rounding down (height 1850mm -> 1 mullion)", () => {
    const def = createBaseDefinition();
    def.rules = [
      {
        ruleId: "rule-mullion-loop",
        ruleName: "Add horizontal mullion every 500mm",
        priority: 1,
        conditionData: {
          rule_type: "loop",
          parameter_key: "height",
          step_value: 500,
          start_value: 1000,
        },
        actionData: {
          target_type: "component",
          target_key: "horizontal-mullion",
          action_type: "add_quantity",
          value: 1,
        },
      },
    ];

    const result = resolveProductStructure({
      definition: def,
      values: { height: 1850 },
    });

    assert.equal(result.componentQuantities["horizontal-mullion"], 1);
    assert.deepEqual(result.appliedRuleIds, ["rule-mullion-loop"]);
  });

  it("TC-LOOP-03: Multiple step multiples (height 3000mm -> 4 mullions)", () => {
    const def = createBaseDefinition();
    def.rules = [
      {
        ruleId: "rule-mullion-loop",
        ruleName: "Add horizontal mullion every 500mm",
        priority: 1,
        conditionData: {
          rule_type: "loop",
          parameter_key: "height",
          step_value: 500,
          start_value: 1000,
        },
        actionData: {
          target_type: "component",
          target_key: "horizontal-mullion",
          action_type: "add_quantity",
          value: 1,
        },
      },
    ];

    const result = resolveProductStructure({
      definition: def,
      values: { height: 3000 },
    });

    assert.equal(result.componentQuantities["horizontal-mullion"], 4);
    assert.deepEqual(result.appliedRuleIds, ["rule-mullion-loop"]);
  });

  it("TC-LOOP-04: Dimension below start threshold (height 900mm -> 0 mullions)", () => {
    const def = createBaseDefinition();
    def.rules = [
      {
        ruleId: "rule-mullion-loop",
        ruleName: "Add horizontal mullion every 500mm",
        priority: 1,
        conditionData: {
          rule_type: "loop",
          parameter_key: "height",
          step_value: 500,
          start_value: 1000,
        },
        actionData: {
          target_type: "component",
          target_key: "horizontal-mullion",
          action_type: "add_quantity",
          value: 1,
        },
      },
    ];

    const result = resolveProductStructure({
      definition: def,
      values: { height: 900 },
    });

    assert.equal(result.componentQuantities["horizontal-mullion"], 0);
    assert.deepEqual(result.appliedRuleIds, []);
  });

  it("TC-LOOP-05: Zero and negative step interval safety", () => {
    const def = createBaseDefinition();
    def.rules = [
      {
        ruleId: "rule-zero-step",
        ruleName: "Zero step interval",
        priority: 1,
        conditionData: {
          rule_type: "loop",
          parameter_key: "height",
          step_value: 0,
          start_value: 1000,
        },
        actionData: {
          target_type: "component",
          target_key: "horizontal-mullion",
          action_type: "add_quantity",
          value: 1,
        },
      },
    ];

    const result = resolveProductStructure({
      definition: def,
      values: { height: 2500 },
    });

    assert.equal(result.componentQuantities["horizontal-mullion"], 0);
    assert.deepEqual(result.appliedRuleIds, []);
  });

  it("TC-LOOP-06: Unconstrained parameter normalization (width 8500mm remains 8500mm)", () => {
    const def = createBaseDefinition();

    const result = resolveProductStructure({
      definition: def,
      values: { width: 8500, height: 4200 },
    });

    assert.equal(result.resolvedValues.width, 8500);
    assert.equal(result.resolvedValues.height, 4200);
    assert.equal(result.numericValuesMm.width, 8500);
    assert.equal(result.numericValuesMm.height, 4200);
  });

  it("TC-LOOP-07: Backward compatibility with threshold rules", () => {
    const def = createBaseDefinition();
    def.rules = [
      {
        ruleId: "rule-threshold-center",
        ruleName: "2-Panel Wide Window (1 Center Mullion)",
        priority: 1,
        conditionData: {
          parameter_key: "width",
          operator: ">=",
          value: 1800,
        },
        actionData: {
          target_type: "component",
          target_key: "frame-center",
          action_type: "set_quantity",
          value: 1,
        },
      },
    ];

    const resultBelow = resolveProductStructure({
      definition: def,
      values: { width: 1200 },
    });
    assert.equal(resultBelow.componentQuantities["frame-center"], 0);
    assert.deepEqual(resultBelow.appliedRuleIds, []);

    const resultAbove = resolveProductStructure({
      definition: def,
      values: { width: 2000 },
    });
    assert.equal(resultAbove.componentQuantities["frame-center"], 1);
    assert.deepEqual(resultAbove.appliedRuleIds, ["rule-threshold-center"]);
  });
});
