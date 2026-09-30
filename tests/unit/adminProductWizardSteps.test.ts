import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildProductSetupUrl,
  resolveWizardStep,
  WIZARD_STEPS,
} from "../../src/lib/admin/products/wizardSteps";

const PRODUCT_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("QAD-TC19: Admin Product Setup Wizard Step Progression & Parameter Resolution", () => {
  it("resolves basic step when no query parameter is provided", () => {
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, undefined), "basic");
  });

  it("resolves valid step parameter for persisted product", () => {
    for (const step of WIZARD_STEPS) {
      assert.strictEqual(resolveWizardStep(PRODUCT_ID, step), step);
    }
  });

  it("falls back to basic when an invalid step parameter is supplied", () => {
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, "invalid_step"), "basic");
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, "12345"), "basic");
  });

  it("falls back to basic when repeated step parameters are supplied", () => {
    assert.strictEqual(resolveWizardStep(PRODUCT_ID, ["strategy", "review"]), "basic");
  });

  it("enforces draft boundary: unpersisted draft cannot bypass basic step", () => {
    assert.strictEqual(resolveWizardStep("draft", "strategy"), "basic");
    assert.strictEqual(resolveWizardStep("draft", "assets"), "basic");
    assert.strictEqual(resolveWizardStep("draft", "components"), "basic");
    assert.strictEqual(resolveWizardStep("draft", "review"), "basic");
  });

  it("serializes the successful Step 1 to Step 2 destination", () => {
    assert.strictEqual(
      buildProductSetupUrl(PRODUCT_ID, "strategy"),
      `/admin/products/${PRODUCT_ID}/setup?step=strategy`,
    );
  });
});
