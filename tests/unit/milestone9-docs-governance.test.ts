import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Milestone 9: Master Documentation & Governance Reconciliation", () => {
  const docsDir = path.resolve(process.cwd(), "docs");
  const docFiles = [
    "index.md",
    "brd-glassfit.md",
    "prd-glassfit.md",
    "sdd-glassfit.md",
    "dsd-glassfit.md",
    "erd-glassfit.md",
    "qad-glassfit.md",
    "build-glassfit.md",
    "pricing.md",
    "milestone.md",
  ];

  // --------------------------------------------------------------------------
  // 1. Audit for Hard Ban BAN-PUNCT-01 (Zero Em-Dashes across all docs)
  // --------------------------------------------------------------------------
  describe("BAN-PUNCT-01: Zero Em-Dashes across Documentation Hub", () => {
    docFiles.forEach((file) => {
      it(`should verify ${file} exists and contains zero em-dashes (—)`, () => {
        const filePath = path.join(docsDir, file);
        assert.ok(fs.existsSync(filePath), `File ${file} does not exist in docs/`);
        const content = fs.readFileSync(filePath, "utf-8");
        const hasEmDash = content.includes("—");
        assert.strictEqual(
          hasEmDash,
          false,
          `Document ${file} contains forbidden em-dash characters per BAN-PUNCT-01`
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // 2. Audit for BAN-DIAG-03: Zero Box Diagrams or Tree Diagrams in Code Blocks
  // --------------------------------------------------------------------------
  describe("BAN-DIAG-03: No ASCII Box/Tree Diagrams inside Code Blocks", () => {
    docFiles.forEach((file) => {
      it(`should verify ${file} contains no ASCII box/tree drawing characters in code blocks`, () => {
        const filePath = path.join(docsDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const boxDrawingRegex = /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬]/;
        const matches = boxDrawingRegex.test(content);
        assert.strictEqual(
          matches,
          false,
          `Document ${file} contains forbidden ASCII box/tree drawing characters per BAN-DIAG-03`
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. Reconcile Master Document Registry & Traceability in docs/index.md
  // --------------------------------------------------------------------------
  describe("docs/index.md: Master Document Registry & Specification Traceability", () => {
    it("should register all 9 core specs and milestone guide in Master Document Registry", () => {
      const indexContent = fs.readFileSync(path.join(docsDir, "index.md"), "utf-8");
      assert.ok(indexContent.includes("pricing.md"), "pricing.md must be registered in index.md");
      assert.ok(indexContent.includes("milestone.md"), "milestone.md must be registered in index.md");
      assert.ok(indexContent.includes("erd-glassfit.md"), "erd-glassfit.md must be registered in index.md");
      assert.ok(indexContent.includes("qad-glassfit.md"), "qad-glassfit.md must be registered in index.md");
      assert.ok(indexContent.includes("dsd-glassfit.md"), "dsd-glassfit.md must be registered in index.md");
      assert.ok(indexContent.includes("sdd-glassfit.md"), "sdd-glassfit.md must be registered in index.md");
      assert.ok(indexContent.includes("prd-glassfit.md"), "prd-glassfit.md must be registered in index.md");
      assert.ok(indexContent.includes("build-glassfit.md"), "build-glassfit.md must be registered in index.md");
    });

    it("should maintain full traceability for test cases QAD-TC15 through QAD-TC18 and entities ERD-E17", () => {
      const indexContent = fs.readFileSync(path.join(docsDir, "index.md"), "utf-8");
      assert.ok(indexContent.includes("QAD-TC15"), "index.md must trace QAD-TC15");
      assert.ok(indexContent.includes("QAD-TC16"), "index.md must trace QAD-TC16");
      assert.ok(indexContent.includes("QAD-TC17"), "index.md must trace QAD-TC17");
      assert.ok(indexContent.includes("QAD-TC18"), "index.md must trace QAD-TC18");
      assert.ok(indexContent.includes("ERD-E17"), "index.md must trace ERD-E17");
      assert.ok(indexContent.includes("PRD-F19"), "index.md must trace PRD-F19");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Entity-Relationship Spec Alignment in docs/erd-glassfit.md
  // --------------------------------------------------------------------------
  describe("docs/erd-glassfit.md: Parametric Schema & Entity Reconciliation", () => {
    it("should document ERD-E17 RawMaterials table schema and columns", () => {
      const erdContent = fs.readFileSync(path.join(docsDir, "erd-glassfit.md"), "utf-8");
      assert.ok(erdContent.includes("ERD-E17"), "erd-glassfit.md must define ERD-E17");
      assert.ok(erdContent.includes("raw_materials"), "erd-glassfit.md must detail raw_materials table");
      assert.ok(erdContent.includes("material_code"), "erd-glassfit.md must include material_code");
      assert.ok(erdContent.includes("waste_allowance"), "erd-glassfit.md must include waste_allowance");
      assert.ok(erdContent.includes("billing_unit"), "erd-glassfit.md must include billing_unit");
    });

    it("should reconcile ProductComponents (ERD-E6) with dynamic dimension binding fields", () => {
      const erdContent = fs.readFileSync(path.join(docsDir, "erd-glassfit.md"), "utf-8");
      assert.ok(erdContent.includes("raw_material_id"), "ERD-E6 must include raw_material_id foreign key");
      assert.ok(erdContent.includes("dimension_binding"), "ERD-E6 must include dimension_binding");
      assert.ok(erdContent.includes("span_ratio"), "ERD-E6 must include span_ratio");
      assert.ok(erdContent.includes("is_removable"), "ERD-E6 must include is_removable");
      assert.ok(erdContent.includes("toggle_property_key"), "ERD-E6 must include toggle_property_key");
      assert.ok(erdContent.includes("presentation_category"), "ERD-E6 must include presentation_category");
    });

    it("should reconcile QuotationItems (ERD-E14) with item_group_name, pricing_details, and structural_waiver", () => {
      const erdContent = fs.readFileSync(path.join(docsDir, "erd-glassfit.md"), "utf-8");
      assert.ok(erdContent.includes("item_group_name"), "ERD-E14 must document item_group_name");
      assert.ok(erdContent.includes("pricing_details"), "ERD-E14 must document pricing_details");
      assert.ok(erdContent.includes("structural_waiver"), "ERD-E14 must document structural_waiver");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Quality Assurance Test Catalog Alignment in docs/qad-glassfit.md
  // --------------------------------------------------------------------------
  describe("docs/qad-glassfit.md: Quality Assurance Test Catalog Harmonization", () => {
    it("should detail QAD-TC15 through QAD-TC18 with execution steps and expected results", () => {
      const qadContent = fs.readFileSync(path.join(docsDir, "qad-glassfit.md"), "utf-8");
      assert.ok(qadContent.includes("QAD-TC15"), "qad-glassfit.md must define QAD-TC15");
      assert.ok(qadContent.includes("QAD-TC16"), "qad-glassfit.md must define QAD-TC16");
      assert.ok(qadContent.includes("QAD-TC17"), "qad-glassfit.md must define QAD-TC17");
      assert.ok(qadContent.includes("QAD-TC18"), "qad-glassfit.md must define QAD-TC18");
      assert.ok(qadContent.includes("Central Raw Materials Master Catalog CRUD"), "QAD-TC15 title check");
      assert.ok(qadContent.includes("Admin Part Inspector Auto-Binding"), "QAD-TC16 title check");
      assert.ok(qadContent.includes("Hybrid Engineering Guardrails"), "QAD-TC17 title check");
      assert.ok(qadContent.includes("Parametric BOM Pricing"), "QAD-TC18 title check");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Build & Migration Verification in docs/build-glassfit.md
  // --------------------------------------------------------------------------
  describe("docs/build-glassfit.md: Build Protocols & Migration Index", () => {
    it("should list migration 005_parametric_pricing_engine.sql in database migration execution order", () => {
      const buildContent = fs.readFileSync(path.join(docsDir, "build-glassfit.md"), "utf-8");
      assert.ok(
        buildContent.includes("005_parametric_pricing_engine.sql"),
        "build-glassfit.md must document migration 005"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 7. System & Design Specifications Alignment (PRD, SDD, DSD)
  // --------------------------------------------------------------------------
  describe("docs/prd-glassfit.md, sdd-glassfit.md, dsd-glassfit.md: Architectural Alignment", () => {
    it("should verify PRD-F10 and PRD-F14 specify parametric BOM and Part Inspector capabilities", () => {
      const prdContent = fs.readFileSync(path.join(docsDir, "prd-glassfit.md"), "utf-8");
      assert.ok(prdContent.includes("PRD-F10"), "prd-glassfit.md must include PRD-F10");
      assert.ok(prdContent.includes("PRD-F14"), "prd-glassfit.md must include PRD-F14");
      assert.ok(prdContent.includes("PRD-F19"), "prd-glassfit.md must include PRD-F19");
      assert.ok(prdContent.includes("Part Inspector"), "PRD-F14 must reference Part Inspector");
    });

    it("should verify SDD-C7 and SDD-C9 specify PricingEngine and Admin Material Services", () => {
      const sddContent = fs.readFileSync(path.join(docsDir, "sdd-glassfit.md"), "utf-8");
      assert.ok(sddContent.includes("SDD-C7"), "sdd-glassfit.md must include SDD-C7");
      assert.ok(sddContent.includes("SDD-C9"), "sdd-glassfit.md must include SDD-C9");
      assert.ok(sddContent.includes("Parametric BOM Pricing Engine"), "SDD-C7 must define Parametric BOM Pricing Engine");
      assert.ok(sddContent.includes("Role-Based Admin Portal & Part Inspector"), "SDD-C9 must define Role-Based Admin Portal & Part Inspector");
    });

    it("should verify DSD-UI7 and DSD-UI10 detail Modal and Part Inspector Viewports", () => {
      const dsdContent = fs.readFileSync(path.join(docsDir, "dsd-glassfit.md"), "utf-8");
      assert.ok(dsdContent.includes("DSD-UI7"), "dsd-glassfit.md must include DSD-UI7");
      assert.ok(dsdContent.includes("DSD-UI10"), "dsd-glassfit.md must include DSD-UI10");
      assert.ok(dsdContent.includes("Part Inspector"), "DSD-UI10 must include Part Inspector");
    });
  });
});
