import { describe, it } from "node:test";
import assert from "node:assert";
import { cn } from "../../src/lib/utils.js";

describe("Core Utilities: cn (Class Name Merge Helper)", () => {
  it("should concatenate simple string class names", () => {
    const result = cn("flex", "items-center", "justify-between");
    assert.strictEqual(result, "flex items-center justify-between");
  });

  it("should filter out falsy, null, and undefined values cleanly", () => {
    const isPrimary = false;
    const isVisible = true;
    const result = cn(
      "base-class",
      isPrimary && "primary-class",
      null,
      undefined,
      false,
      isVisible && "visible-class"
    );
    assert.strictEqual(result, "base-class visible-class");
  });

  it("should resolve Tailwind CSS conflicts using twMerge rules", () => {
    // Overriding padding
    const paddingOverride = cn("p-4", "p-8");
    assert.strictEqual(paddingOverride, "p-8");

    // Overriding horizontal padding specifically
    const xPaddingOverride = cn("px-2 py-1", "px-6");
    assert.strictEqual(xPaddingOverride, "py-1 px-6");

    // Overriding text color
    const textColorOverride = cn("text-red-500", "text-blue-500");
    assert.strictEqual(textColorOverride, "text-blue-500");

    // Overriding background color
    const bgOverride = cn("bg-white", "bg-neutral-900");
    assert.strictEqual(bgOverride, "bg-neutral-900");
  });

  it("should accept nested arrays and condition objects", () => {
    const result = cn(
      ["px-4", "py-2"],
      { "font-bold": true, "opacity-50": false }
    );
    assert.strictEqual(result, "px-4 py-2 font-bold");
  });
});
