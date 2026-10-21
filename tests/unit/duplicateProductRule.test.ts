import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { duplicateProductRuleError } from "../../src/lib/admin/products/duplicateProductRule";
import { selectDuplicateProductProposal } from "../../src/lib/visualization/structuralResolver";
import { createSplitConfigurations } from "../../src/lib/visualization/duplicateProductPlacement";
import type { ProductConfigurationSnapshot, ProductStructuralDefinition } from "../../src/lib/visualization/types";

const definition: ProductStructuralDefinition = {
  product: { productId: "product", productName: "Sliding Window", productType: "Window" },
  template: { templateId: "template", templateName: "Window", modelStrategy: "Parametric", measurementUnit: "mm", baseConfiguration: {} },
  parameters: [{ parameterId: "width", parameterKey: "width", parameterName: "Width", parameterType: "Number", minimumValue: 500, maximumValue: null, defaultValue: 1200, stepValue: 1, unit: "mm", affectsStructure: true, displayOrder: 1 }],
  components: [],
  rules: [{ ruleId: "rule", ruleName: "Wide opening", priority: 1, conditionData: { rule_type: "when_then", parameter_key: "width", operator: ">", value: 3600 }, actionData: { target_type: "product", action_type: "duplicate_product", split_axis: "width", max_per_instance: 3600 } }],
};

describe("QAD-TC62 whole-product rule", () => {
  it("rejects invalid rules before persistence", () => {
    const rule = { rule_name: "Wide opening", condition_data: { rule_type: "when_then", parameter_key: "width", operator: ">", value: 3600 }, action_data: { target_type: "product", action_type: "duplicate_product", split_axis: "width", max_per_instance: 3600 } };
    assert.equal(duplicateProductRuleError(rule, [{ parameter_key: "width", parameter_type: "Number", minimum_value: 500, unit: "mm" }]), null);
    assert.match(duplicateProductRuleError({ ...rule, action_data: { ...rule.action_data, max_per_instance: 0 } }, [{ parameter_key: "width", parameter_type: "Number", minimum_value: 500, unit: "mm" }]) ?? "", /positive/);
  });

  it("proposes two identical pieces and preserves source dimensions", () => {
    const raw = { width: 5000 };
    const result = selectDuplicateProductProposal(definition, raw);
    assert.equal(result.proposal?.count, 2);
    assert.equal(result.proposal?.pieceMm, 2500);
    assert.equal(raw.width, 5000);
    assert.equal(selectDuplicateProductProposal(definition, { width: 3600 }).proposal, null);
  });

  it("reports impossible step and count", () => {
    const stepDefinition = { ...definition, parameters: [{ ...definition.parameters[0], stepValue: 3 }] };
    assert.match(selectDuplicateProductProposal(stepDefinition, { width: 5000 }).reason ?? "", /precision/);
    assert.match(selectDuplicateProductProposal(definition, { width: 40000 }).reason ?? "", /2 and 10/);
  });

  it("converts the selected parameter unit exactly once", () => {
    const cmDefinition = {
      ...definition,
      parameters: [{ ...definition.parameters[0], unit: "cm", minimumValue: 50, stepValue: 1 }],
      rules: [{ ...definition.rules[0], conditionData: { rule_type: "when_then", parameter_key: "width", operator: ">", value: 360 }, actionData: { target_type: "product", action_type: "duplicate_product", split_axis: "width", max_per_instance: 360 } }],
    };
    const proposal = selectDuplicateProductProposal(cmDefinition, { width: 500 }).proposal;
    assert.equal(proposal?.originalMm, 5000);
    assert.equal(proposal?.pieceMm, 2500);
  });

  it("offers one additional whole product per completed loop step", () => {
    const loopDefinition: ProductStructuralDefinition = {
      ...definition,
      rules: [{ ...definition.rules[0], conditionData: { rule_type: "loop", parameter_key: "width", start_value: 3600, step_value: 1400 },
        actionData: { target_type: "product", action_type: "duplicate_product", split_axis: "width", max_per_instance: 3600 } }],
    };
    const rule = { rule_name: "Wide opening", condition_data: { rule_type: "loop", parameter_key: "width", start_value: 3600, step_value: 1400 },
      action_data: { target_type: "product", action_type: "duplicate_product", split_axis: "width", max_per_instance: 3600 } };
    const parameters = [{ parameter_key: "width", parameter_type: "Number", minimum_value: 500, unit: "mm" }];
    assert.equal(duplicateProductRuleError(rule, parameters), null);
    assert.equal(selectDuplicateProductProposal(loopDefinition, { width: 4999 }).proposal, null);
    const first = selectDuplicateProductProposal(loopDefinition, { width: 5000 });
    assert.equal(first.proposal?.count, 2);
    assert.equal(first.proposal?.pieceMm, 2500);
    const second = selectDuplicateProductProposal(loopDefinition, { width: 6600 });
    assert.equal(second.proposal?.count, 3);
    assert.equal(selectDuplicateProductProposal(loopDefinition, { width: 6400 }).reason?.includes("precision"), true);
    assert.match(duplicateProductRuleError({ ...rule, condition_data: { ...rule.condition_data, step_value: 0 } }, parameters) ?? "", /positive loop step/);
  });

  it("tiles the opening and preserves each product's configuration and quantity", () => {
    const proposal = selectDuplicateProductProposal(definition, { width: 5000 }).proposal;
    assert.ok(proposal);
    const source = { widthCm: 500, heightCm: 150, quantity: 3, thicknessMm: 6, panelCount: 2,
      aluminumFinish: "black", glassAppearance: "clear" as const, includeSill: true,
      yaw: 0, pitch: 0, rotateAngle: 0, isFlipped: false, glassColor: "bronze" as const,
      visualParameterValues: { width: 5000, height: 1500 }, positionX: 0, positionY: 0 } satisfies ProductConfigurationSnapshot;
    const pieces = createSplitConfigurations(source, proposal, 600, 300, 1000, 700);
    assert.equal(pieces.length, 2);
    assert.deepEqual(pieces.map(piece => piece.widthCm), [250, 250]);
    assert.deepEqual(pieces.map(piece => piece.positionX), [-150, 150]);
    assert.deepEqual(pieces.map(piece => piece.quantity), [3, 3]);
    assert.deepEqual(pieces.map(piece => piece.visualParameterValues?.width), [2500, 2500]);
    assert.deepEqual(pieces.map(piece => piece.glassColor), ["bronze", "bronze"]);
  });

  it("subdivides a fitted quadrilateral along height", () => {
    const heightDefinition: ProductStructuralDefinition = {
      ...definition,
      parameters: [{ ...definition.parameters[0], parameterKey: "height", parameterId: "height" }],
      rules: [{ ...definition.rules[0], conditionData: { rule_type: "when_then", parameter_key: "height", operator: ">", value: 3000 }, actionData: { target_type: "product", action_type: "duplicate_product", split_axis: "height", max_per_instance: 3000 } }],
    };
    const proposal = selectDuplicateProductProposal(heightDefinition, { height: 5000 }).proposal;
    assert.ok(proposal);
    const source = { widthCm: 150, heightCm: 500, quantity: 1, thicknessMm: 6, aluminumFinish: "black", glassAppearance: "clear" as const,
      includeSill: true, yaw: 0, pitch: 0, rotateAngle: 0, isFlipped: false,
      perspectiveFitCorners: [{ x: .2, y: .1 }, { x: .8, y: .1 }, { x: .7, y: .9 }, { x: .3, y: .9 }] as ProductConfigurationSnapshot["perspectiveFitCorners"],
      visualParameterValues: { width: 1500, height: 5000 } } satisfies ProductConfigurationSnapshot;
    const pieces = createSplitConfigurations(source, proposal, 300, 500, 1000, 700);
    assert.deepEqual(pieces.map(piece => piece.heightCm), [250, 250]);
    assert.deepEqual(pieces.map(piece => piece.widthCm), [150, 150]);
    assert.deepEqual(pieces[0].perspectiveFitCorners?.[2], pieces[1].perspectiveFitCorners?.[1]);
    assert.deepEqual(pieces[0].perspectiveFitCorners?.[3], pieces[1].perspectiveFitCorners?.[0]);
  });
});
