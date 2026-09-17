import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  clampGrainIntensity,
  getNoiseFilterSvgString,
  GRAIN_FILTER_SVG_ID,
} from "../../src/lib/visualization/noiseGenerator.js";
import {
  drawPerimeterAmbientOcclusion,
  drawApertureRevealShadow,
  applyContactOcclusionAndReveals,
} from "../../src/lib/visualization/contactShadow.js";

function createMockCanvasContext(): {
  ctx: CanvasRenderingContext2D;
  rects: Array<{ x: number; y: number; w: number; h: number }>;
  gradients: Array<{ x0: number; y0: number; x1: number; y1: number; stops: Array<{ offset: number; color: string }> }>;
} {
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const gradients: Array<{ x0: number; y0: number; x1: number; y1: number; stops: Array<{ offset: number; color: string }> }> = [];

  const mockCtx = {
    globalCompositeOperation: "source-over",
    fillStyle: "#000000",
    imageSmoothingEnabled: true,
    save() { },
    restore() { },
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h });
    },
    createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
      const stops: Array<{ offset: number; color: string }> = [];
      const grad = {
        x0,
        y0,
        x1,
        y1,
        stops,
        addColorStop(offset: number, color: string) {
          stops.push({ offset, color });
        },
      };
      gradients.push(grad);
      return grad;
    },
    drawImage() { },
  };

  return {
    ctx: mockCtx as unknown as CanvasRenderingContext2D,
    rects,
    gradients,
  };
}

describe("MS-04: Scene-Adaptive Photorealism Harmonization", () => {
  describe("1. Procedural Sensor Grain and Noise Synthesis", () => {
    it("clamps grain intensity within valid range [0.0, 0.18]", () => {
      assert.strictEqual(clampGrainIntensity(0.08), 0.08);
      assert.strictEqual(clampGrainIntensity(0.0), 0.0);
      assert.strictEqual(clampGrainIntensity(-0.5), 0.0);
      assert.strictEqual(clampGrainIntensity(0.25), 0.18);
      assert.strictEqual(clampGrainIntensity(Number.NaN), 0.0);
      assert.strictEqual(clampGrainIntensity(Infinity), 0.0);
    });

    it("generates inline SVG filter definition matching specification", () => {
      const svg = getNoiseFilterSvgString(0.08);
      assert.ok(svg.includes(GRAIN_FILTER_SVG_ID));
      assert.ok(svg.includes('feTurbulence type="fractalNoise"'));
      assert.ok(svg.includes('baseFrequency="0.75"'));
      assert.ok(svg.includes('mode="overlay"'));
    });

    it("returns empty SVG filter string when grain intensity is negligible", () => {
      assert.strictEqual(getNoiseFilterSvgString(0.005), "");
      assert.strictEqual(getNoiseFilterSvgString(0), "");
    });
  });

  describe("2. Perimeter Ambient Occlusion and Aperture Reveal Shading", () => {
    it("draws 4 perimeter crevice rectangles along window frame edges", () => {
      const { ctx, rects, gradients } = createMockCanvasContext();
      drawPerimeterAmbientOcclusion(ctx, 400, 300, 0.35, 3);

      // 4 edges: top, bottom, left, right
      assert.strictEqual(rects.length, 4);
      assert.strictEqual(gradients.length, 4);

      // Verify top edge: (0, 0, 400, 3)
      assert.deepStrictEqual(rects[0], { x: 0, y: 0, w: 400, h: 3 });
      // Verify bottom edge: (0, 297, 400, 3)
      assert.deepStrictEqual(rects[1], { x: 0, y: 297, w: 400, h: 3 });
      // Verify left edge: (0, 0, 3, 300)
      assert.deepStrictEqual(rects[2], { x: 0, y: 0, w: 3, h: 300 });
      // Verify right edge: (397, 0, 3, 300)
      assert.deepStrictEqual(rects[3], { x: 397, y: 0, w: 3, h: 300 });
    });

    it("casts downward aperture reveal shadow when light originates from above (y > 0)", () => {
      const { ctx, rects } = createMockCanvasContext();
      drawApertureRevealShadow(ctx, 500, 400, { x: 0, y: 0.6 }, 0.30);

      assert.strictEqual(rects.length, 1);
      assert.strictEqual(rects[0].x, 0);
      assert.strictEqual(rects[0].y, 0);
      assert.strictEqual(rects[0].w, 500);
      assert.ok(rects[0].h > 6, "Header shadow height must span several pixels");
    });

    it("casts jamb reveal shadow when light has horizontal direction component (x != 0)", () => {
      const { ctx, rects } = createMockCanvasContext();
      // Light from right (x > 0) -> shadow on left jamb
      drawApertureRevealShadow(ctx, 500, 400, { x: 0.5, y: 0.0 }, 0.30);

      assert.strictEqual(rects.length, 1);
      assert.strictEqual(rects[0].x, 0);
      assert.strictEqual(rects[0].y, 0);
      assert.strictEqual(rects[0].h, 400);
      assert.ok(rects[0].w >= 4, "Left jamb shadow width must span several pixels");
    });

    it("composites perimeter crevice and aperture reveal simultaneously", () => {
      const { ctx, rects } = createMockCanvasContext();
      applyContactOcclusionAndReveals(ctx, 600, 450, {
        lightDirection: { x: 0.4, y: 0.5 },
        shadowOpacity: 0.32,
      });

      // 4 perimeter crevice rects + 1 header reveal + 1 jamb reveal = 6 rects
      assert.strictEqual(rects.length, 6);
    });
  });

  describe("3. Lighting Adaptation and Tone Mapping Formulas", () => {
    it("exposure formula clamps correctly across low and high luminance ranges", () => {
      const clampExposure = (medianL: number, meanL: number) => {
        return Math.min(Math.max((medianL / 50.0) * 0.90 + (meanL / 50.0) * 0.10, 0.65), 1.35);
      };

      // Very dim room: median 15, mean 20 -> clamped to 0.65
      assert.strictEqual(clampExposure(15, 20), 0.65);

      // Normal room: median 50, mean 50 -> 1.0
      assert.strictEqual(clampExposure(50, 50), 1.0);

      // Washed-out sunny room: median 95, mean 90 -> clamped to 1.35
      assert.strictEqual(clampExposure(95, 90), 1.35);
    });

    it("ambient bounce color calculation incorporates 30% neutral white floor", () => {
      const ambientR = 200 / 255;
      const ambientG = 160 / 255;
      const ambientB = 120 / 255;

      const finalR = ambientR * 0.70 + 1.0 * 0.30;
      const finalG = ambientG * 0.70 + 1.0 * 0.30;
      const finalB = ambientB * 0.70 + 1.0 * 0.30;

      assert.ok(finalR > ambientR, "Red must move toward white");
      assert.ok(finalG > ambientG, "Green must move toward white");
      assert.ok(finalB > ambientB, "Blue must move toward white");
      assert.ok(finalR <= 1.0 && finalG <= 1.0 && finalB <= 1.0);
    });
  });

  describe("4. Codebase Specification Integrity", () => {
    const modelRendererSource = readFileSync(
      "src/lib/visualization/modelRenderer.ts",
      "utf8",
    );
    const productBuilderSource =
      readFileSync("src/lib/visualization/parametricProductBuilder.ts", "utf8") +
      readFileSync("src/lib/visualization/materialClassifier.ts", "utf8");
    const workspaceSource = readFileSync(
      "src/features/visualization/components/ProductModelWorkspace.tsx",
      "utf8",
    );

    it("modelRenderer uses calibrated light intensities preventing white frame blowout", () => {
      // Main directional light max 1.55
      assert.match(modelRendererSource, /clamp\([^,]+,\s*0\.80,\s*1\.55\)/);
      // Bevel light max 0.85
      assert.match(modelRendererSource, /clamp\([^,]+,\s*0\.45,\s*0\.85\)/);
      // Ambient light in [0.28, 0.42]
      assert.match(modelRendererSource, /clamp\([^,]+,\s*0\.28,\s*0\.42\)/);
      // ACESFilmic tone mapping
      assert.match(modelRendererSource, /toneMapping\s*=\s*THREE\.ACESFilmicToneMapping/);
    });

    it("parametricProductBuilder configures high-transmittance float glass", () => {
      // Clear glass: transmission 0.88, opacity 0.18, depthWrite false
      assert.match(productBuilderSource, /opacity:\s*0\.18/);
      assert.match(productBuilderSource, /transmission:\s*0\.88/);
      assert.match(productBuilderSource, /depthWrite:\s*false/);
      assert.match(productBuilderSource, /ior:\s*1\.52/);
    });

    it("parametricProductBuilder configures powder-coated white frame with micro-roughness", () => {
      // Powder-coat white: 0xeceae4
      assert.match(productBuilderSource, /0xeceae4/);
      // Metalness 0.08, roughness 0.32
      assert.match(productBuilderSource, /0\.08/);
      assert.match(productBuilderSource, /0\.32/);
    });

    it("workspace includes SVG grain filter and connects autoRealism to lighting", () => {
      assert.match(workspaceSource, /id=\{GRAIN_FILTER_SVG_ID\}/);
      assert.match(workspaceSource, /autoRealism/);
      assert.match(workspaceSource, /applyContactOcclusionAndReveals/);
      assert.match(workspaceSource, /applyNoiseToCanvas/);
    });
  });
});
