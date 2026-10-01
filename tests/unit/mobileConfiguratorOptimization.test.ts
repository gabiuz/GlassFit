/** PRD-F6, SDD-C5, DSD-UI15, QAD-TC52. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  classifyCompactViewport,
  mapPointerToCanvas,
  TOUCH_PROXY_OFFSET_CSS_PX,
} from "../../src/features/visualization/mobileConfiguratorGeometry";

describe("MS37 compact viewport classification", () => {
  it("classifies portrait, landscape, and boundary geometries", () => {
    assert.deepEqual(classifyCompactViewport(430, 932), { isCompactViewport: true, orientation: "portrait" });
    assert.deepEqual(classifyCompactViewport(767, 900), { isCompactViewport: true, orientation: "portrait" });
    assert.equal(classifyCompactViewport(768, 900).isCompactViewport, false);
    assert.deepEqual(classifyCompactViewport(899, 599), { isCompactViewport: true, orientation: "landscape" });
    assert.equal(classifyCompactViewport(900, 599).isCompactViewport, false);
    assert.equal(classifyCompactViewport(899, 600).isCompactViewport, false);
  });
});

describe("MS37 pointer geometry", () => {
  const bounds = { left: 100, top: 50, width: 400, height: 300 };

  it("subtracts surface bounds and scales CSS pixels", () => {
    assert.deepEqual(mapPointerToCanvas({ clientX: 300, clientY: 200, bounds, canvasWidth: 800, canvasHeight: 600 }), { x: 400, y: 300 });
    assert.deepEqual(mapPointerToCanvas({ clientX: 300, clientY: 200, bounds, canvasWidth: 800, canvasHeight: 600, offsetCssPx: TOUCH_PROXY_OFFSET_CSS_PX }), { x: 400, y: 204 });
  });

  it("clamps all canvas boundaries", () => {
    assert.deepEqual(mapPointerToCanvas({ clientX: 0, clientY: 0, bounds, canvasWidth: 800, canvasHeight: 600, offsetCssPx: 48 }), { x: 0, y: 0 });
    assert.deepEqual(mapPointerToCanvas({ clientX: 900, clientY: 900, bounds, canvasWidth: 800, canvasHeight: 600 }), { x: 800, y: 600 });
  });
});

describe("MS37 source contracts", () => {
  const workspace = readFileSync("src/features/visualization/components/ProductModelWorkspace.tsx", "utf8");
  const picker = readFileSync("src/features/visualization/components/PerspectivePlanePicker.tsx", "utf8");
  const lock = readFileSync("src/features/visualization/hooks/useDocumentScrollLock.ts", "utf8");

  it("provides dynamic viewport, drawer, navbar, and re-entry semantics", () => {
    assert.match(workspace, /h-\[100dvh\]/);
    assert.match(workspace, /env\(safe-area-inset-top\)/);
    assert.match(workspace, /aria-controls="mobile-configuration-controls"/);
    assert.match(workspace, /Open full-screen editor/);
    assert.match(workspace, /shouldLockMobileEditor/);
    assert.match(workspace, /touch-none/);
    assert.match(workspace, /min-h-10 items-end text-\[#c3c3c3\]/);
  });

  it("uses nested lock ownership and 48px picker targets", () => {
    assert.match(lock, /ownerCount \+= 1/);
    assert.match(lock, /ownerCount -= 1/);
    assert.match(lock, /window\.scrollTo\(x, y\)/);
    assert.match(picker, /useDocumentScrollLock\(true\)/);
    assert.match(picker, /<circle r=\{24\}/);
    assert.match(picker, /TOUCH_PROXY_OFFSET_CSS_PX/);
    assert.match(picker, /landscape:top-\[3\.75rem\]/);
    assert.match(picker, /landscape:bottom-16/);
    assert.match(picker, /landscape:hidden/);
  });
});
