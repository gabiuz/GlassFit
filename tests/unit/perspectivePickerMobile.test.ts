/** PRD-F6, DSD-UI4, QAD-TC6 mobile interaction contract coverage. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  "src/features/visualization/components/PerspectivePlanePicker.tsx",
  "utf8",
);

describe("MS-02 mobile perspective picker contract", () => {
  it("uses pointer events, primary-pointer isolation, capture, and touch scroll suppression", () => {
    assert.match(source, /onPointerDown=\{handleSvgPointerDown\}/);
    assert.match(source, /!e\.isPrimary/);
    assert.match(source, /setPointerCapture\(e\.pointerId\)/);
    assert.match(source, /style=\{\{ touchAction: "none" \}\}/);
  });

  it("wraps mobile actions and preserves 44px touch targets", () => {
    assert.match(source, /flex flex-wrap sm:flex-nowrap/);
    assert.match(source, /flex w-full items-center justify-end gap-2 sm:w-auto/);
    assert.match(source, /className="flex size-11 shrink-0/);
    assert.match(source, /flex min-h-11 items-center gap-2/);
    assert.match(source, /className="min-h-11 px-4 py-2\.5/);
  });
});
