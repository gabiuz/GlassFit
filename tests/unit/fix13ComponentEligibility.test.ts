/** FIX13-V1/V2/V6: PRD-F5, PRD-F10, QAD-TC94. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    getComponentIssues,
    getProductComponentIssue,
    isQualifyingModelAsset,
    requiresComponentMaterial,
} from "../../src/lib/admin/products/componentEligibility.js";

describe("fix-13 component eligibility", () => {
    it("allows an active Fixed whole model without components", () => {
        assert.equal(isQualifyingModelAsset({ asset_type: "Whole Model", status: "Active" }), true);
        assert.equal(isQualifyingModelAsset({ asset_type: "Whole Model", status: "Draft" }), false);
        assert.equal(getProductComponentIssue({ modelStrategy: "Fixed", componentsCount: 0, hasQualifyingModelAsset: true }), null);
        assert.match(getProductComponentIssue({ modelStrategy: "Fixed", componentsCount: 0, hasQualifyingModelAsset: false })!, /3D model asset/);
    });

    it("exempts fixed-priced and FIXED parts while requiring a parametric material", () => {
        const context = { modelStrategy: "Parametric" };
        assert.equal(requiresComponentMaterial({ pricingMethod: "Fixed" }, context), false);
        assert.equal(requiresComponentMaterial({ dimensionBinding: "FIXED" }, context), false);
        assert.equal(requiresComponentMaterial({ unitPrice: 100 }, context), false);
        assert.equal(requiresComponentMaterial({ unitPrice: 0 }, context), true);
        assert.deepEqual(getComponentIssues({ dimensionBinding: "HEIGHT", hasModelPreview: true }, context), ["assign a default material"]);
    });

    it("reports model and material issues independently", () => {
        const context = { modelStrategy: "Parametric" };
        assert.deepEqual(getComponentIssues({ rawMaterialId: "mat", hasModelPreview: false }, context), ["verify a model preview"]);
        assert.deepEqual(getComponentIssues({ rawMaterialId: "mat", hasModelPreview: true }, context), []);
        assert.equal(getProductComponentIssue({ ...context, componentsCount: 0, hasQualifyingModelAsset: true }), "Parametric products require at least one component.");
        assert.deepEqual(getComponentIssues({ materialBindings: [{ rawMaterialId: "mat", isDefault: false }], hasModelPreview: true }, context), ["assign a default material"]);
        assert.deepEqual(getComponentIssues({ materialBindings: [{ rawMaterialId: "mat", isDefault: true }], hasModelPreview: true }, context), []);
        assert.deepEqual(getComponentIssues({ hasModelPreview: false }, { modelStrategy: "Fixed" }), []);
    });
});
