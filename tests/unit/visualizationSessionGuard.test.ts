import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  transitionSessionState,
  writeStoredVisualizationSession,
  readStoredVisualizationSession,
  SESSION_STORAGE_KEY,
  initialState,
} from "../../src/lib/visualization/visualizationSession";
import type {
  PlacedOverlay,
  ProductConfigurationSnapshot,
  VisualizationSessionState,
} from "../../src/lib/visualization/types";
import type { SpaceImageSession } from "../../src/lib/imageApi";

// Traceability: PRD-F5, PRD-F6, PRD-F15, PRD-F16, SDD-C4, SDD-C5, DSD-UI10, QAD-TC24, QAD-TC25

const mockSpaceImageSession: SpaceImageSession = {
  sessionId: "space-session-test-01",
  originalFileName: "living-room.jpg",
  workspaceImage: {
    url: "https://example.com/cdn/living-room.jpg",
    width: 1920,
    height: 1080,
  },
  brightness: {
    mean_pixel_intensity: 128,
    category: "normal",
  },
  lighting: {
    mean_rgb: [128, 128, 128],
    ambient_rgb: [120, 120, 120],
    ambient_hex: "#787878",
    contrast: 1.0,
    saturation: 1.0,
    warmth: 0,
    tint: 0,
    temperature: "neutral",
    sharpness: 1.0,
    noise: 0,
    light_direction: { x: 0, y: -1 },
    suggested: {
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      color_mix: 0,
      blur_px: 0,
      grain: 0,
      shadow_opacity: 0.3,
    },
  },
  objects: [],
  segmentation: {
    mode: "mock",
    model: null,
  },
  warnings: [],
};

const windowConfig: ProductConfigurationSnapshot = {
  widthCm: 150,
  heightCm: 120,
  thicknessMm: 6,
  quantity: 1,
  aluminumFinish: "Analok",
  glassAppearance: "clear",
  includeSill: true,
  panelCount: 2,
  yaw: 5,
  pitch: -2,
  rotateAngle: 0,
  isFlipped: false,
  zoomLevel: 1,
  positionX: 50,
  positionY: -20,
  visualParameterValues: {},
};

const doorConfig: ProductConfigurationSnapshot = {
  widthCm: 90,
  heightCm: 210,
  thicknessMm: 6,
  quantity: 1,
  aluminumFinish: "Powder Coated White",
  glassAppearance: "frosted",
  includeSill: false,
  panelCount: 1,
  yaw: 0,
  pitch: 0,
  rotateAngle: 0,
  isFlipped: false,
  zoomLevel: 1,
  positionX: -100,
  positionY: 0,
  visualParameterValues: {},
};

const windowOverlay: PlacedOverlay = {
  overlayId: "overlay-window-uuid-001",
  productId: "prod-fixed-window",
  productName: "Series 798 Fixed Window",
  templateId: "series-798",
  configuration: windowConfig,
  flattenedImageDataUrl: "data:image/png;base64,sampleWindowRender",
  totalPrice: 8500,
  unitPrice: 8500,
};

const doorOverlay: PlacedOverlay = {
  overlayId: "overlay-door-uuid-002",
  productId: "prod-screen-door",
  productName: "Series 798 Screen Door",
  templateId: "series-798",
  configuration: doorConfig,
  flattenedImageDataUrl: "data:image/png;base64,sampleDoorRender",
  totalPrice: 12500,
  unitPrice: 12500,
};

describe("PRD-F6/QAD-TC25: Session Guard Invariant in ProductAwareWorkspacePage", () => {
  const pageSource = readFileSync(
    "src/features/visualization/components/ProductAwareWorkspacePage.tsx",
    "utf8",
  );

  it("decouples session validity from route productId matching", () => {
    // Session validity must strictly depend on Boolean(spaceImageSession)
    assert.match(pageSource, /const\s+hasValidSession\s*=\s*Boolean\(spaceImageSession\);/);
    assert.doesNotMatch(pageSource, /selectedProductId\s*===\s*productId\s*&&\s*Boolean\(spaceImageSession\)/);
  });

  it("does not redirect when route productId differs as long as space session exists", () => {
    // useEffect must redirect ONLY when !hasValidSession
    assert.match(pageSource, /if\s*\(!hasValidSession\)\s*\{\s*router\.replace\(`/);
    assert.doesNotMatch(pageSource, /if\s*\(!hasMatchingSession\)/);
  });

  it("passes atomic transition parameters to transitionWorkspaceProduct", () => {
    assert.match(pageSource, /transitionWorkspaceProduct\(\{/);
    assert.match(pageSource, /nextProductId,/);
    assert.match(pageSource, /mode,/);
    assert.match(pageSource, /newPlacedOverlay,/);
  });
});

describe("PRD-F15/QAD-TC24: Cross-Category Multi-Product Placement (mode: add)", () => {
  it("transitions active product from Window to Door while preserving Window in placedOverlays", () => {
    const startState: VisualizationSessionState = {
      ...initialState,
      selectedProductId: "prod-fixed-window",
      spaceImageSession: mockSpaceImageSession,
      productConfiguration: windowConfig,
      placedOverlays: [],
    };

    const nextState = transitionSessionState(startState, {
      nextProductId: "prod-screen-door",
      mode: "add",
      newPlacedOverlay: windowOverlay,
    });

    assert.equal(nextState.selectedProductId, "prod-screen-door");
    assert.equal(nextState.placedOverlays.length, 1);
    assert.equal(nextState.placedOverlays[0].overlayId, windowOverlay.overlayId);
    assert.equal(nextState.placedOverlays[0].productId, "prod-fixed-window");
    assert.equal(nextState.productConfiguration, null);
    assert.equal(nextState.structuralDefinition, null);
  });

  it("does not duplicate an overlay if the same overlayId is already in placedOverlays", () => {
    const startState: VisualizationSessionState = {
      ...initialState,
      selectedProductId: "prod-fixed-window",
      spaceImageSession: mockSpaceImageSession,
      placedOverlays: [windowOverlay],
    };

    const nextState = transitionSessionState(startState, {
      nextProductId: "prod-screen-door",
      mode: "add",
      newPlacedOverlay: windowOverlay,
    });

    assert.equal(nextState.placedOverlays.length, 1);
  });
});

describe("PRD-F16/QAD-TC24: Layer Editing Transition (mode: edit)", () => {
  it("freezes active Door into placedOverlays and restores target Window configuration", () => {
    const startState: VisualizationSessionState = {
      ...initialState,
      selectedProductId: "prod-screen-door",
      spaceImageSession: mockSpaceImageSession,
      productConfiguration: doorConfig,
      placedOverlays: [windowOverlay],
    };

    const nextState = transitionSessionState(startState, {
      nextProductId: "prod-fixed-window",
      mode: "edit",
      newPlacedOverlay: doorOverlay,
      targetOverlayId: windowOverlay.overlayId,
      nextConfiguration: windowOverlay.configuration,
    });

    assert.equal(nextState.selectedProductId, "prod-fixed-window");
    assert.equal(nextState.placedOverlays.length, 1);
    assert.equal(nextState.placedOverlays[0].overlayId, doorOverlay.overlayId);
    assert.equal(nextState.placedOverlays[0].productId, "prod-screen-door");
    assert.deepEqual(nextState.productConfiguration, windowConfig);
    assert.equal(nextState.structuralDefinition, null);
  });
});

describe("PRD-F5/QAD-TC25: Change Product Transition (mode: change)", () => {
  it("replaces active product without creating an orphan layer in placedOverlays", () => {
    const startState: VisualizationSessionState = {
      ...initialState,
      selectedProductId: "prod-fixed-window",
      spaceImageSession: mockSpaceImageSession,
      productConfiguration: windowConfig,
      placedOverlays: [],
    };

    const nextState = transitionSessionState(startState, {
      nextProductId: "prod-screen-door",
      mode: "change",
    });

    assert.equal(nextState.selectedProductId, "prod-screen-door");
    assert.equal(nextState.placedOverlays.length, 0);
    assert.equal(nextState.productConfiguration, null);
  });
});

describe("SDD-C5/QAD-TC25: Storage Quota Resilience & Serialization", () => {
  let mockStorage: Record<string, string> = {};
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    mockStorage = {};
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("successfully serializes standard session into sessionStorage", () => {
    globalThis.window = {
      sessionStorage: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
        key: () => null,
        length: 0,
      },
    } as unknown as typeof globalThis.window;

    const state: VisualizationSessionState = {
      ...initialState,
      selectedProductId: "prod-fixed-window",
      spaceImageSession: mockSpaceImageSession,
      placedOverlays: [windowOverlay],
    };

    writeStoredVisualizationSession(state);
    const restored = readStoredVisualizationSession();

    assert.equal(restored.selectedProductId, "prod-fixed-window");
    assert.equal(restored.placedOverlays.length, 1);
    assert.equal(restored.placedOverlays[0].productName, "Series 798 Fixed Window");
    assert.ok(mockStorage[SESSION_STORAGE_KEY], "Session was stored under SESSION_STORAGE_KEY");
  });

  it("handles QuotaExceededError by stripping oversized base64 data URLs while preserving BOM and transforms", () => {
    let callCount = 0;
    const oversizedBase64 = "data:image/png;base64," + "A".repeat(250000);

    globalThis.window = {
      sessionStorage: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          callCount += 1;
          if (callCount === 1) {
            throw new Error("QuotaExceededError: DOMException: Quota exceeded");
          }
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
        key: () => null,
        length: 0,
      },
    } as unknown as typeof globalThis.window;

    const heavyOverlay: PlacedOverlay = {
      ...windowOverlay,
      flattenedImageDataUrl: oversizedBase64,
    };

    const state: VisualizationSessionState = {
      ...initialState,
      selectedProductId: "prod-fixed-window",
      spaceImageSession: mockSpaceImageSession,
      placedOverlays: [heavyOverlay],
    };

    writeStoredVisualizationSession(state);

    assert.equal(callCount, 2, "Should have fallen back to lightweight serialization on quota error");
    const restored = readStoredVisualizationSession();
    assert.equal(restored.selectedProductId, "prod-fixed-window");
    assert.equal(restored.placedOverlays.length, 1);
    assert.equal(restored.placedOverlays[0].flattenedImageDataUrl, "", "Oversized data URL stripped in storage");
    assert.equal(restored.placedOverlays[0].totalPrice, 8500, "Pricing BOM preserved");
    assert.equal(restored.placedOverlays[0].configuration.widthCm, 150, "Transforms preserved");
  });

  it("safely tolerates total storage quota exhaustion without throwing", () => {
    globalThis.window = {
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("Persistent QuotaExceededError");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
    } as unknown as typeof globalThis.window;

    const state: VisualizationSessionState = {
      ...initialState,
      selectedProductId: "prod-fixed-window",
      spaceImageSession: mockSpaceImageSession,
      placedOverlays: [windowOverlay],
    };

    assert.doesNotThrow(() => {
      writeStoredVisualizationSession(state);
    });
  });
});
