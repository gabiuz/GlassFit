import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Milestone 11: Full-Codebase Automated Test Suite Consolidation & Coverage", () => {
  const docsDir = path.resolve(process.cwd(), "docs");
  const testsDir = path.resolve(process.cwd(), "tests/unit");

  // --------------------------------------------------------------------------
  // 1. Audit for Hard Ban BAN-PUNCT-01 (Zero Em-Dashes across documentation)
  // --------------------------------------------------------------------------
  describe("BAN-PUNCT-01: Zero Em-Dashes across Documentation Hub", () => {
    ["milestone.md", "index.md", "qad-glassfit.md"].forEach((file) => {
      it(`should verify ${file} exists and contains zero em-dashes`, () => {
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
  // 2. Audit for BAN-DIAG-03: Zero Box Diagrams in Code Blocks
  // --------------------------------------------------------------------------
  describe("BAN-DIAG-03: No ASCII Box/Tree Diagrams inside Code Blocks", () => {
    ["milestone.md", "index.md", "qad-glassfit.md"].forEach((file) => {
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
  // 3. Milestone 11 Specification & Matrix Verification in docs/milestone.md
  // --------------------------------------------------------------------------
  describe("docs/milestone.md: Milestone 11 Specification Alignment", () => {
    it("should list MS-11 in Milestone Overview & Sequencing Matrix", () => {
      const content = fs.readFileSync(path.join(docsDir, "milestone.md"), "utf-8");
      assert.ok(content.includes("MS-11"), "milestone.md must include MS-11");
      assert.ok(
        content.includes("Full-Codebase Automated Test Suite Consolidation & Comprehensive Unit Coverage"),
        "milestone.md must have MS-11 title"
      );
      assert.ok(content.includes("QAD-TC20"), "milestone.md must link to QAD-TC20");
      assert.ok(content.includes("QAD-TC21"), "milestone.md must link to QAD-TC21");
    });

    it("should document Milestone 11 technical tasks and exit criteria", () => {
      const content = fs.readFileSync(path.join(docsDir, "milestone.md"), "utf-8");
      assert.ok(
        content.includes("### Milestone 11: Full-Codebase Automated Test Suite Consolidation & Comprehensive Unit Coverage"),
        "milestone.md must have MS-11 detailed section header"
      );
      assert.ok(
        content.includes("Consolidated Similar Test Suites"),
        "milestone.md must document test suite consolidation task"
      );
      assert.ok(
        content.includes("Full Codebase Domain Coverage"),
        "milestone.md must document full codebase coverage task"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Quality Assurance Test Catalog in docs/qad-glassfit.md
  // --------------------------------------------------------------------------
  describe("docs/qad-glassfit.md: QAD-TC20 & QAD-TC21 Registration", () => {
    it("should detail QAD-TC20 and QAD-TC21 with execution steps and expected results", () => {
      const content = fs.readFileSync(path.join(docsDir, "qad-glassfit.md"), "utf-8");
      assert.ok(content.includes("QAD-TC20"), "qad-glassfit.md must define QAD-TC20");
      assert.ok(
        content.includes("Full-Codebase Domain Unit Test Coverage"),
        "qad-glassfit.md must define QAD-TC20 title"
      );
      assert.ok(content.includes("QAD-TC21"), "qad-glassfit.md must define QAD-TC21");
      assert.ok(
        content.includes("Test Suite Consolidation & Optimization"),
        "qad-glassfit.md must define QAD-TC21 title"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 5. Documentation Index Traceability in docs/index.md
  // --------------------------------------------------------------------------
  describe("docs/index.md: Master Document Registry & Traceability", () => {
    it("should trace QAD-TC20 and QAD-TC21 in the master End-to-End Traceability Matrix", () => {
      const content = fs.readFileSync(path.join(docsDir, "index.md"), "utf-8");
      assert.ok(content.includes("QAD-TC20"), "index.md must trace QAD-TC20");
      assert.ok(content.includes("QAD-TC21"), "index.md must trace QAD-TC21");
      assert.ok(content.includes("PR #11"), "index.md must record PR #11 revision");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Whole-Codebase Test File Registry
  // --------------------------------------------------------------------------
  describe("Test Suite File Verification", () => {
    it("should confirm existence of all whole-codebase and consolidated test files", () => {
      const requiredTestFiles = [
        "pricing.test.ts",
        "governance.test.ts",
        "booking.test.ts",
        "auth.test.ts",
        "utils.test.ts",
        "products.test.ts",
        "visualization.test.ts",
        "legal.test.ts",
        "milestone1-database-schema.test.ts",
        "milestone2-raw-materials.test.ts",
        "milestone3-part-inspector.test.ts",
        "milestone4-testdrive-simulator.test.ts",
        "milestone5-pricing-engine.test.ts",
        "milestone6-engineering-guardrails.test.ts",
        "milestone7-quotation-pdf.test.ts",
        "milestone8-numerical-validation.test.ts",
        "milestone9-docs-governance.test.ts",
        "milestone10-wizard-persistence.test.ts",
        "milestone11-codebase-coverage.test.ts",
      ];

      for (const file of requiredTestFiles) {
        const filePath = path.join(testsDir, file);
        assert.ok(fs.existsSync(filePath), `Required test file ${file} must exist in tests/unit/`);
      }
    });
  });
});
