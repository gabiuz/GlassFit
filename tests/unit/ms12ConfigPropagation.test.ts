/** IMP-MS12 coverage. Traceability: PRD-F1, PRD-F2, PRD-F6, PRD-F7, QAD-TC2, QAD-TC6, QAD-TC7, QAD-TC27. */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deriveGlassTypeFromAppearance,
  getMatchingProductConfigurationSeed,
  hydrateProductVariationConfiguration,
  normalizeGlassColor,
  normalizeGlassThickness,
  normalizeProductConfigurationSeed,
} from "../../src/lib/visualization/configurationPropagation.js";
import {
  ALUMINUM_COLOR_VARIATIONS,
  getAvailableVariationFinishes,
  getVariationFinishes,
  normalizeAluminumFinish,
} from "../../src/lib/visualization/colorVariations.js";
import { ALUMINUM_FINISH_OPTIONS } from "../../src/lib/products/materialMapping.js";
import {
  createPreparedSpaceImageState,
  initialState,
  readStoredVisualizationSession,
  SESSION_STORAGE_KEY,
  transitionSessionState,
} from "../../src/lib/visualization/visualizationSession.js";
import { hasCompleteVariationLayers } from "../../src/lib/visualization/multiProductPresentation.js";
import type {
  PlacedOverlay,
  ProductConfigurationSeed,
  ProductConfigurationSnapshot,
} from "../../src/lib/visualization/types.js";
import type { SpaceImageSession } from "../../src/lib/imageApi.js";

const seed: ProductConfigurationSeed = {
  aluminumFinish: "al_1006",
  glassType: "frosted",
  glassAppearance: "frosted",
  glassColor: "bronze",
  glassThicknessMm: 8,
  widthCm: 140,
  heightCm: 180,
  quantity: 3,
};

const session = {
  sessionId: "ms12",
  originalFileName: "room.jpg",
  workspaceImage: { url: "/room.jpg", width: 1200, height: 800 },
  objects: [],
  warnings: [],
} as unknown as SpaceImageSession;

const fullConfiguration: ProductConfigurationSnapshot = {
  widthCm: 90,
  heightCm: 210,
  thicknessMm: 3,
  quantity: 1,
  aluminumFinish: "al_1004",
  glassAppearance: "outdoor",
  glassColor: "blue",
  glassThicknessMm: 12,
  includeSill: false,
  yaw: 12,
  pitch: 4,
  rotateAngle: 90,
  isFlipped: true,
  visualParameterValues: {},
};

describe("IMP-MS12 QAD-TC6 seed validation and hydration", () => {
  it("normalizes a valid seed and survives a JSON round-trip", () => {
    assert.deepEqual(normalizeProductConfigurationSeed(JSON.parse(JSON.stringify(seed))), seed);
    assert.deepEqual(getMatchingProductConfigurationSeed({ productId: "p1", configuration: seed }, "p1"), seed);
    assert.equal(getMatchingProductConfigurationSeed({ productId: "p1", configuration: seed }, "p2"), null);
  });

  it("allows both dimensions to be omitted and rejects incomplete or invalid pairs", () => {
    const withoutDimensions = {
      aluminumFinish: seed.aluminumFinish,
      glassType: seed.glassType,
      glassAppearance: seed.glassAppearance,
      glassColor: seed.glassColor,
      glassThicknessMm: seed.glassThicknessMm,
      quantity: seed.quantity,
    };
    assert.deepEqual(normalizeProductConfigurationSeed(withoutDimensions), withoutDimensions);
    assert.equal(normalizeProductConfigurationSeed({ ...withoutDimensions, widthCm: 100 }), null);
    assert.equal(normalizeProductConfigurationSeed({ ...seed, heightCm: 0 }), null);
  });

  it("rejects invalid enum values and normalizes quantity", () => {
    assert.equal(normalizeProductConfigurationSeed({ ...seed, glassColor: "green" }), null);
    assert.equal(normalizeProductConfigurationSeed({ ...seed, aluminumFinish: "black" }), null);
    assert.equal(normalizeProductConfigurationSeed({ ...seed, glassThicknessMm: 10 }), null);
    assert.equal(normalizeProductConfigurationSeed({ ...seed, quantity: 1000 })?.quantity, 999);
  });

  it("gives full configuration precedence over a seed and preserves non-seed fields", () => {
    const hydrated = hydrateProductVariationConfiguration(fullConfiguration, seed);
    assert.equal(hydrated.aluminumFinish, "al_1004");
    assert.equal(hydrated.glassAppearance, "outdoor");
    assert.equal(hydrated.glassType, undefined);
    assert.equal(fullConfiguration.thicknessMm, 3);
    assert.equal(fullConfiguration.yaw, 12);
  });

  it("uses the seed over defaults only for variation fields", () => {
    assert.deepEqual(hydrateProductVariationConfiguration(null, seed), seed);
    assert.deepEqual(hydrateProductVariationConfiguration(null, null), {
      aluminumFinish: "white",
      glassAppearance: "clear",
      glassType: "regular",
      glassColor: "clear",
      glassThicknessMm: 6,
      widthCm: undefined,
      heightCm: undefined,
      quantity: 1,
    });
  });
});

describe("IMP-MS12 QAD-TC6 session lifecycle", () => {
  it("preserves a matching pending seed and clears a mismatched seed", () => {
    const pending = { productId: "p1", configuration: seed };
    const matching = createPreparedSpaceImageState({ ...initialState, pendingProductConfiguration: pending }, "p1", session);
    const mismatched = createPreparedSpaceImageState({ ...initialState, pendingProductConfiguration: pending }, "p2", session);
    assert.deepEqual(matching.pendingProductConfiguration, pending);
    assert.equal(mismatched.pendingProductConfiguration, null);
  });

  it("clears pending data on add, change, and edit transitions", () => {
    for (const mode of ["add", "change", "edit"] as const) {
      const next = transitionSessionState(
        { ...initialState, selectedProductId: "p1", pendingProductConfiguration: { productId: "p1", configuration: seed } },
        { nextProductId: "p2", mode },
      );
      assert.equal(next.pendingProductConfiguration, null);
    }
    assert.equal(initialState.pendingProductConfiguration, null);
  });
});

describe("IMP-MS12 QAD-TC7 normalization and glass invariants", () => {
  it("normalizes aliases, passes all catalog finishes through, and falls back safely", () => {
    assert.equal(normalizeAluminumFinish("black"), "al_1009");
    assert.equal(normalizeAluminumFinish("silver"), "al_1001");
    for (const option of ALUMINUM_FINISH_OPTIONS) {
      assert.equal(normalizeAluminumFinish(option.id), option.id);
    }
    assert.equal(normalizeAluminumFinish("unknown"), "white");
  });

  it("defaults legacy glass fields and derives only compatible R.R.D. types", () => {
    assert.equal(normalizeGlassColor(undefined), "clear");
    assert.equal(normalizeGlassColor("invalid"), "clear");
    assert.equal(normalizeGlassThickness(undefined), 6);
    assert.equal(deriveGlassTypeFromAppearance("clear"), "regular");
    assert.equal(deriveGlassTypeFromAppearance("frosted"), "frosted");
    assert.equal(deriveGlassTypeFromAppearance("reflective"), "reflective");
    assert.equal(deriveGlassTypeFromAppearance("opaque"), undefined);
    assert.equal(deriveGlassTypeFromAppearance("outdoor"), undefined);
  });
});

describe("IMP-MS12 QAD-TC27 deterministic variation policy", () => {
  const baseKeys = ["white", "al_1009", "analok", "al_1001", "al_1004", "al_1006", "al_1015", "al_1018"];

  it("defines the exact ordered base set and adds at most one active finish", () => {
    assert.deepEqual(ALUMINUM_COLOR_VARIATIONS.map((item) => item.key), baseKeys);
    assert.deepEqual(getVariationFinishes("al_1004"), baseKeys);
    assert.deepEqual(getVariationFinishes("peacock_blue"), [...baseKeys, "peacock_blue"]);
    assert.equal(getVariationFinishes("peacock_blue").length, 9);
  });

  it("requires the base set and exposes only the intersection across overlays", () => {
    const first = Object.fromEntries([...baseKeys, "peacock_blue"].map((key) => [key, `${key}-1`]));
    const second = Object.fromEntries(baseKeys.map((key) => [key, `${key}-2`]));
    assert.deepEqual(getAvailableVariationFinishes([first, second]), baseKeys);
    const overlay = {
      overlayId: "o1",
      productId: "p1",
      productName: "Window",
      templateId: "t1",
      configuration: fullConfiguration,
      flattenedImageDataUrl: "image",
      variationImageDataUrls: first,
    } as PlacedOverlay;
    assert.equal(hasCompleteVariationLayers([overlay]), true);
    assert.equal(hasCompleteVariationLayers([{ ...overlay, variationImageDataUrls: { white: "only" } }]), false);
  });
});

describe("IMP-MS12 renderer contract", () => {
  it("forwards optical options in fixed and parametric paths and rejects stale loads", () => {
    const renderer = readFileSync("src/lib/visualization/modelRenderer.ts", "utf8");
    const builder = readFileSync("src/lib/visualization/parametricProductBuilder.ts", "utf8");
    assert.match(renderer, /glassColor: presentation\.glassColor/);
    assert.match(renderer, /glassThicknessMm: presentation\.glassThicknessMm/);
    assert.match(renderer, /detectProductMaterialCapabilities\(group\)/);
    assert.match(renderer, /loadVersion !== this\.modelLoadVersion/);
    assert.match(builder, /glassColor: options\.glassColor/);
    assert.match(builder, /glassThicknessMm: options\.glassThicknessMm/);
  });
});

describe("IMP-MS12 session payload restoration", () => {
  const originalWindow = globalThis.window;
  afterEach(() => { globalThis.window = originalWindow; });

  for (const shape of ["primary", "lightweight", "minimal"] as const) {
    it(`restores a normalized pending seed from the ${shape} payload`, () => {
      const payload = JSON.stringify({
        selectedProductId: shape === "primary" ? "p1" : null,
        spaceImageSession: shape === "minimal" ? null : session,
        pendingProductConfiguration: { productId: "p1", configuration: seed },
      });
      globalThis.window = {
        sessionStorage: { getItem: (key: string) => key === SESSION_STORAGE_KEY ? payload : null },
      } as unknown as typeof globalThis.window;
      assert.deepEqual(readStoredVisualizationSession().pendingProductConfiguration, {
        productId: "p1",
        configuration: seed,
      });
    });
  }
});
