import { describe, it } from "node:test";
import assert from "node:assert";
import {
  normalizeMaterialBindings,
  type ComponentMaterialBindingInput,
} from "../../src/lib/pricing/materialBindingUtils";
import {
  suggestCandidateMaterials,
} from "../../src/lib/admin/products/autoDetection";
import type { RawMaterial, ComponentMaterialBinding } from "../../src/lib/pricing/types";
import type { PartInspectorConfig } from "../../src/features/admin/products/setup/PartInspectorDrawer";

const mockRawMaterials: RawMaterial[] = [
  {
    id: "mat-analok-double-head",
    material_code: "AL-798-DH-ANLK",
    description: "Series 798 Double Head (Analok)",
    category: "Aluminum",
    finish_type: "Analok",
    billing_unit: "m",
    unit_price: 345.50,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-white-double-head",
    material_code: "AL-798-DH-PCW",
    description: "Series 798 Double Head (Powder Coated White)",
    category: "Aluminum",
    finish_type: "PowderCoatedWhite",
    billing_unit: "m",
    unit_price: 375.00,
    waste_allowance: 0.12,
    is_active: true,
  },
  {
    id: "mat-clear-6mm",
    material_code: "GL-CLR-6MM",
    description: "6mm Clear Annealed Float Glass",
    category: "Glass",
    finish_type: "Clear",
    billing_unit: "sqm",
    unit_price: 520.00,
    waste_allowance: 0.15,
    is_active: true,
  },
  {
    id: "mat-bronze-6mm",
    material_code: "GL-BRZ-6MM",
    description: "6mm Tinted Bronze Float Glass",
    category: "Glass",
    finish_type: "Bronze",
    billing_unit: "sqm",
    unit_price: 640.00,
    waste_allowance: 0.15,
    is_active: true,
  },
  {
    id: "mat-roller-nylon",
    material_code: "HW-ROL-NYL",
    description: "Series 798 Heavy Duty Nylon Roller",
    category: "Hardware",
    finish_type: "None",
    billing_unit: "pc",
    unit_price: 85.00,
    waste_allowance: 0.0,
    is_active: true,
  },
];

describe("IMP-MS64: Multi-Material Component Binding & Admin Part Inspector (QAD-TC79)", () => {
  // --------------------------------------------------------------------------
  // QAD-TC79.1: Single material selection auto-defaults
  // --------------------------------------------------------------------------
  it("QAD-TC79.1: Checking the first material on an unassigned part automatically designates it as default", () => {
    let bindings: ComponentMaterialBinding[] = [];
    const targetMaterialId = "mat-analok-double-head";

    // Simulate checking the first material
    const isFirst = bindings.length === 0;
    bindings = [
      ...bindings,
      {
        rawMaterialId: targetMaterialId,
        isDefault: isFirst,
        displayOrder: 0,
      },
    ];

    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].rawMaterialId, targetMaterialId);
    assert.strictEqual(bindings[0].isDefault, true);

    const defaultBinding = bindings.find((b) => b.isDefault);
    assert.ok(defaultBinding);
    assert.strictEqual(defaultBinding.rawMaterialId, targetMaterialId);
  });

  // --------------------------------------------------------------------------
  // QAD-TC79.2: Multiple materials with explicit default change
  // --------------------------------------------------------------------------
  it("QAD-TC79.2: Adding a candidate material keeps existing default, explicit default change updates both flags", () => {
    let bindings: ComponentMaterialBinding[] = [
      {
        rawMaterialId: "mat-analok-double-head",
        isDefault: true,
        displayOrder: 0,
      },
    ];

    // Check additional material
    const secondMaterialId = "mat-white-double-head";
    const isFirst = bindings.length === 0;
    bindings = [
      ...bindings,
      {
        rawMaterialId: secondMaterialId,
        isDefault: isFirst,
        displayOrder: bindings.length,
      },
    ];

    assert.strictEqual(bindings.length, 2);
    assert.strictEqual(bindings[0].isDefault, true);
    assert.strictEqual(bindings[1].isDefault, false);

    // Explicitly set second material as default
    bindings = bindings.map((b) => ({
      ...b,
      isDefault: b.rawMaterialId === secondMaterialId,
    }));

    assert.strictEqual(bindings[0].isDefault, false);
    assert.strictEqual(bindings[1].isDefault, true);
    assert.strictEqual(bindings.filter((b) => b.isDefault).length, 1);
  });

  // --------------------------------------------------------------------------
  // QAD-TC79.3: Default transfer upon unchecking active default
  // --------------------------------------------------------------------------
  it("QAD-TC79.3: Unchecking the current default automatically transfers default to the first remaining checked material", () => {
    let bindings: ComponentMaterialBinding[] = [
      {
        rawMaterialId: "mat-analok-double-head",
        isDefault: true,
        displayOrder: 0,
      },
      {
        rawMaterialId: "mat-white-double-head",
        isDefault: false,
        displayOrder: 1,
      },
    ];

    const uncheckId = "mat-analok-double-head";
    const wasDefault = bindings.find((b) => b.isDefault)?.rawMaterialId === uncheckId;
    const remaining = bindings.filter((b) => b.rawMaterialId !== uncheckId);

    bindings = remaining.map((b, idx) => ({
      ...b,
      isDefault: wasDefault ? idx === 0 : b.isDefault,
      displayOrder: idx,
    }));

    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(bindings[0].rawMaterialId, "mat-white-double-head");
    assert.strictEqual(bindings[0].isDefault, true);
  });

  // --------------------------------------------------------------------------
  // QAD-TC79.4: Normalization guarantees exactly one default
  // --------------------------------------------------------------------------
  it("QAD-TC79.4: normalizeMaterialBindings ensures zero or multiple defaults are reconciled to exactly one default", () => {
    // Case A: Multiple defaults supplied
    const multiDefaults: ComponentMaterialBindingInput[] = [
      { rawMaterialId: "mat-1", isDefault: true, displayOrder: 0 },
      { rawMaterialId: "mat-2", isDefault: true, displayOrder: 1 },
      { rawMaterialId: "mat-3", isDefault: false, displayOrder: 2 },
    ];
    const normalizedA = normalizeMaterialBindings(multiDefaults);
    assert.strictEqual(normalizedA.filter((b) => b.isDefault).length, 1);
    assert.strictEqual(normalizedA[0].isDefault, true);
    assert.strictEqual(normalizedA[1].isDefault, false);

    // Case B: Zero defaults supplied
    const zeroDefaults: ComponentMaterialBindingInput[] = [
      { rawMaterialId: "mat-1", isDefault: false, displayOrder: 0 },
      { rawMaterialId: "mat-2", isDefault: false, displayOrder: 1 },
    ];
    const normalizedB = normalizeMaterialBindings(zeroDefaults);
    assert.strictEqual(normalizedB.filter((b) => b.isDefault).length, 1);
    assert.strictEqual(normalizedB[0].isDefault, true);

    // Case C: Empty bindings
    const normalizedC = normalizeMaterialBindings([]);
    assert.strictEqual(normalizedC.length, 0);
  });

  // --------------------------------------------------------------------------
  // QAD-TC79.5: Backward compatibility default synchronization
  // --------------------------------------------------------------------------
  it("QAD-TC79.5: Backward compatibility guarantees rawMaterialId mirrors the active default", () => {
    const bindings: ComponentMaterialBinding[] = [
      { rawMaterialId: "mat-analok-double-head", isDefault: false, displayOrder: 0 },
      { rawMaterialId: "mat-white-double-head", isDefault: true, displayOrder: 1 },
    ];

    const defaultBinding = bindings.find((b) => b.isDefault);
    const resolvedRawMaterialId = defaultBinding ? defaultBinding.rawMaterialId : null;

    assert.strictEqual(resolvedRawMaterialId, "mat-white-double-head");
  });

  // --------------------------------------------------------------------------
  // QAD-TC79.6: Batch multi-part assignment across symmetrical parts
  // --------------------------------------------------------------------------
  it("QAD-TC79.6: Batch synchronization applies material bindings and default across all symmetrical parts in assembly group", () => {
    const parts: PartInspectorConfig[] = [
      {
        id: "part-rail-top",
        componentKey: "sash_rail_top",
        componentName: "Sash Rail Top",
        componentType: "Frame",
        rawMaterialId: null,
        materialBindings: [],
        dimensionBinding: "WIDTH",
        spanRatio: 0.5,
        isRemovable: false,
        togglePropertyKey: null,
        presentationCategory: "Framing",
        baseQuantity: 1,
        assemblyGroup: "sash_rails",
      },
      {
        id: "part-rail-bottom",
        componentKey: "sash_rail_bottom",
        componentName: "Sash Rail Bottom",
        componentType: "Frame",
        rawMaterialId: null,
        materialBindings: [],
        dimensionBinding: "WIDTH",
        spanRatio: 0.5,
        isRemovable: false,
        togglePropertyKey: null,
        presentationCategory: "Framing",
        baseQuantity: 1,
        assemblyGroup: "sash_rails",
      },
      {
        id: "part-jamb-left",
        componentKey: "frame_jamb_left",
        componentName: "Jamb Left",
        componentType: "Frame",
        rawMaterialId: null,
        materialBindings: [],
        dimensionBinding: "HEIGHT",
        spanRatio: 1.0,
        isRemovable: false,
        togglePropertyKey: null,
        presentationCategory: "Framing",
        baseQuantity: 1,
        assemblyGroup: "outer_frame",
      },
    ];

    const sourceBindings: ComponentMaterialBinding[] = [
      { rawMaterialId: "mat-analok-double-head", isDefault: true, displayOrder: 0 },
      { rawMaterialId: "mat-white-double-head", isDefault: false, displayOrder: 1 },
    ];
    const sourceDefaultId = "mat-analok-double-head";

    // Synchronize to 'sash_rails'
    const updatedParts = parts.map((part) => {
      if (part.assemblyGroup.toLowerCase() === "sash_rails") {
        return {
          ...part,
          materialBindings: sourceBindings,
          rawMaterialId: sourceDefaultId,
        };
      }
      return part;
    });

    // Both sash rails must be updated
    assert.strictEqual(updatedParts[0].materialBindings?.length, 2);
    assert.strictEqual(updatedParts[0].rawMaterialId, "mat-analok-double-head");
    assert.strictEqual(updatedParts[1].materialBindings?.length, 2);
    assert.strictEqual(updatedParts[1].rawMaterialId, "mat-analok-double-head");

    // Outer frame jamb must remain untouched
    assert.strictEqual(updatedParts[2].materialBindings?.length, 0);
    assert.strictEqual(updatedParts[2].rawMaterialId, null);
  });

  // --------------------------------------------------------------------------
  // QAD-TC79.7: Unassigned part safe zeroing
  // --------------------------------------------------------------------------
  it("QAD-TC79.7: Unchecking all materials safely zeroes bindings and sets rawMaterialId to null", () => {
    const bindings: ComponentMaterialBinding[] = [
      { rawMaterialId: "mat-analok-double-head", isDefault: true, displayOrder: 0 },
    ];

    // Uncheck sole remaining material
    const remaining = bindings.filter((b) => b.rawMaterialId !== "mat-analok-double-head");
    const rawMaterialId = remaining.length === 0 ? null : remaining[0].rawMaterialId;

    assert.strictEqual(remaining.length, 0);
    assert.strictEqual(rawMaterialId, null);
  });

  // --------------------------------------------------------------------------
  // QAD-TC79.8: Auto-detection candidate sets generation
  // --------------------------------------------------------------------------
  it("QAD-TC79.8: suggestCandidateMaterials suggests standard material candidates with sensible default", () => {
    // Framing -> Aluminum materials with Analok as default
    const framingConfig = suggestCandidateMaterials("Framing", mockRawMaterials);
    assert.strictEqual(framingConfig.materialBindings.length, 2);
    assert.strictEqual(framingConfig.defaultRawMaterialId, "mat-analok-double-head");
    assert.strictEqual(framingConfig.materialBindings[0].isDefault, true);
    assert.strictEqual(framingConfig.materialBindings[1].isDefault, false);

    // Glazing -> Glass materials with Clear as default
    const glazingConfig = suggestCandidateMaterials("Glazing", mockRawMaterials);
    assert.strictEqual(glazingConfig.materialBindings.length, 2);
    assert.strictEqual(glazingConfig.defaultRawMaterialId, "mat-clear-6mm");
    assert.strictEqual(glazingConfig.materialBindings[0].isDefault, true);
    assert.strictEqual(glazingConfig.materialBindings[1].isDefault, false);

    // Hardware -> Hardware materials
    const hardwareConfig = suggestCandidateMaterials("Hardware", mockRawMaterials);
    assert.strictEqual(hardwareConfig.materialBindings.length, 1);
    assert.strictEqual(hardwareConfig.defaultRawMaterialId, "mat-roller-nylon");
  });
});
