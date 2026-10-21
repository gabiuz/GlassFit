import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeIntersectionBox,
  formatObstructionMessage,
  findObstructionWarnings,
  type CanvasBox,
} from "../../src/lib/visualization/obstructionWarnings";
import type { DetectedObject, WorkspaceImage } from "../../src/lib/imageApi";

describe("IMP-MS42: Canvas Obstruction Warning Detection & Tooltips", () => {
  const dummyWorkspaceImage: WorkspaceImage = {
    url: "https://example.com/room.jpg",
    width: 1920,
    height: 1080,
  };

  describe("computeIntersectionBox", () => {
    it("returns null when two boxes are disjoint", () => {
      const boxA: CanvasBox = { x1: 0, y1: 0, x2: 100, y2: 100 };
      const boxB: CanvasBox = { x1: 150, y1: 150, x2: 250, y2: 250 };
      const result = computeIntersectionBox(boxA, boxB);
      assert.equal(result, null);
    });

    it("returns null when boxes touch only on edges or corners", () => {
      const boxA: CanvasBox = { x1: 0, y1: 0, x2: 100, y2: 100 };
      const boxB: CanvasBox = { x1: 100, y1: 100, x2: 200, y2: 200 };
      const result = computeIntersectionBox(boxA, boxB);
      assert.equal(result, null);
    });

    it("returns exact intersection box for partially overlapping rectangles", () => {
      const boxA: CanvasBox = { x1: 50, y1: 50, x2: 200, y2: 200 };
      const boxB: CanvasBox = { x1: 100, y1: 120, x2: 300, y2: 250 };
      const result = computeIntersectionBox(boxA, boxB);
      assert.deepEqual(result, {
        x1: 100,
        y1: 120,
        x2: 200,
        y2: 200,
      });
    });

    it("returns inner box when one box fully contains another", () => {
      const outer: CanvasBox = { x1: 0, y1: 0, x2: 500, y2: 500 };
      const inner: CanvasBox = { x1: 50, y1: 60, x2: 150, y2: 180 };
      const result = computeIntersectionBox(outer, inner);
      assert.deepEqual(result, inner);
    });
  });

  describe("formatObstructionMessage", () => {
    it("formats message for couch correctly", () => {
      const msg = formatObstructionMessage("couch");
      assert.equal(msg, "This product may overlap or block the couch in your room.");
    });

    it("normalizes synonym sofa to couch", () => {
      const msg = formatObstructionMessage("sofa");
      assert.equal(msg, "This product may overlap or block the couch in your room.");
    });

    it("normalizes dining table to table", () => {
      const msg = formatObstructionMessage("dining table");
      assert.equal(msg, "This product may overlap or block the table in your room.");
    });

    it("normalizes potted plant to plant", () => {
      const msg = formatObstructionMessage("potted plant");
      assert.equal(msg, "This product may overlap or block the plant in your room.");
    });

    it("normalizes uppercase and trimmed labels", () => {
      const msg = formatObstructionMessage("  CHAIR  ");
      assert.equal(msg, "This product may overlap or block the chair in your room.");
    });

    it("falls back to friendly generic phrase for unknown labels", () => {
      const msg = formatObstructionMessage("custom_sculpture_xyz");
      assert.equal(msg, "This product may overlap or block a nearby object in your room.");
    });

    it("ensures all messages are single sentences ending in a period without technical jargon", () => {
      const testLabels = ["couch", "chair", "table", "bed", "potted plant", "refrigerator", "tv", "sink", "unknown"];
      for (const label of testLabels) {
        const msg = formatObstructionMessage(label);
        assert.ok(msg.endsWith("."), `Message for ${label} should end with a period`);
        // Single sentence check (no internal periods, exclamation marks, or question marks)
        const sentences = msg.split(/[.!?]/).filter((s) => s.trim().length > 0);
        assert.equal(sentences.length, 1, `Message for ${label} should contain exactly 1 sentence`);
        assert.ok(!msg.toLowerCase().includes("yolo"), "Should not contain YOLO");
        assert.ok(!msg.toLowerCase().includes("bounding"), "Should not contain bounding box");
        assert.ok(!msg.toLowerCase().includes("pixel"), "Should not contain pixel jargon");
      }
    });
  });

  describe("findObstructionWarnings", () => {
    it("correctly scales natural image pixels to canvas display pixels (0.5x scaling)", () => {
      // Natural: 1920x1080, Display: 960x540 -> scale factor 0.5
      const detectedObjects: DetectedObject[] = [
        {
          id: "obj-couch-1",
          label: "couch",
          confidence: 0.95,
          bbox: [200, 300, 800, 700], // scaled to [100, 150, 400, 350]
          mask_url: "",
        },
      ];

      const overlayBox: CanvasBox = {
        x1: 150,
        y1: 200,
        x2: 350,
        y2: 400,
      };

      const warnings = findObstructionWarnings({
        overlayBox,
        detectedObjects,
        workspaceImage: dummyWorkspaceImage,
        canvasDisplayWidth: 960,
        canvasDisplayHeight: 540,
      });

      assert.equal(warnings.length, 1);
      const w = warnings[0];
      assert.equal(w.id, "obj-couch-1");
      assert.equal(w.objectLabel, "couch");
      assert.equal(w.friendlyLabel, "couch");
      assert.equal(w.message, "This product may overlap or block the couch in your room.");

      // Expected intersection: max(150, 100) = 150, max(200, 150) = 200, min(350, 400) = 350, min(400, 350) = 350
      assert.deepEqual(w.intersectionBox, {
        x1: 150,
        y1: 200,
        x2: 350,
        y2: 350,
      });

      // Anchor point top-center: x = (150 + 350) / 2 = 250, y = 200
      assert.deepEqual(w.anchorPoint, { x: 250, y: 200 });
      assert.equal(w.overlapArea, (350 - 150) * (350 - 200)); // 200 * 150 = 30000
    });

    it("filters out tiny noise overlaps below 400 px^2 or with width/height < 12px", () => {
      const detectedObjects: DetectedObject[] = [
        {
          id: "obj-small-1",
          label: "chair",
          confidence: 0.88,
          // Scaled to [100, 100, 110, 150] -> width = 10px (< 12px min)
          bbox: [200, 200, 220, 300],
          mask_url: "",
        },
        {
          id: "obj-small-2",
          label: "table",
          confidence: 0.85,
          // Overlap will be 15px by 15px = 225 px^2 (< 400 px^2 min)
          bbox: [400, 400, 430, 430], // scaled to [200, 200, 215, 215]
          mask_url: "",
        },
      ];

      const overlayBox: CanvasBox = {
        x1: 50,
        y1: 50,
        x2: 500,
        y2: 500,
      };

      const warnings = findObstructionWarnings({
        overlayBox,
        detectedObjects,
        workspaceImage: dummyWorkspaceImage,
        canvasDisplayWidth: 960,
        canvasDisplayHeight: 540,
      });

      assert.equal(warnings.length, 0, "Noise overlaps should be completely ignored");
    });

    it("sorts multiple obstructions descending by overlap area", () => {
      const detectedObjects: DetectedObject[] = [
        {
          id: "obj-small-area",
          label: "chair",
          confidence: 0.9,
          bbox: [200, 200, 400, 400], // scaled to [100, 100, 200, 200] -> area 10000
          mask_url: "",
        },
        {
          id: "obj-large-area",
          label: "couch",
          confidence: 0.92,
          bbox: [500, 200, 1100, 600], // scaled to [250, 100, 550, 300] -> area 60000
          mask_url: "",
        },
      ];

      const overlayBox: CanvasBox = {
        x1: 50,
        y1: 50,
        x2: 600,
        y2: 400,
      };

      const warnings = findObstructionWarnings({
        overlayBox,
        detectedObjects,
        workspaceImage: dummyWorkspaceImage,
        canvasDisplayWidth: 960,
        canvasDisplayHeight: 540,
      });

      assert.equal(warnings.length, 2);
      assert.equal(warnings[0].id, "obj-large-area");
      assert.equal(warnings[1].id, "obj-small-area");
      assert.ok(warnings[0].overlapArea > warnings[1].overlapArea);
    });

    it("excludes dismissed object keys", () => {
      const detectedObjects: DetectedObject[] = [
        {
          id: "obj-couch",
          label: "couch",
          confidence: 0.9,
          bbox: [200, 200, 600, 600],
          mask_url: "",
        },
      ];

      const overlayBox: CanvasBox = {
        x1: 50,
        y1: 50,
        x2: 500,
        y2: 500,
      };

      const dismissed = new Set<string>(["obj-couch"]);

      const warnings = findObstructionWarnings({
        overlayBox,
        detectedObjects,
        workspaceImage: dummyWorkspaceImage,
        canvasDisplayWidth: 960,
        canvasDisplayHeight: 540,
        dismissedKeys: dismissed,
      });

      assert.equal(warnings.length, 0);
    });

    it("returns empty array safely when inputs are missing or dimensions are 0", () => {
      const emptyWarnings = findObstructionWarnings({
        overlayBox: { x1: 0, y1: 0, x2: 100, y2: 100 },
        detectedObjects: [],
        workspaceImage: dummyWorkspaceImage,
        canvasDisplayWidth: 0,
        canvasDisplayHeight: 0,
      });
      assert.deepEqual(emptyWarnings, []);
    });
  });
});
