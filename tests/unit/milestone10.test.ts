import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Milestone 10: Admin Product Setup Wizard State & Component Persistence", () => {
  const docsDir = path.resolve(process.cwd(), "docs");

  // --------------------------------------------------------------------------
  // 1. Audit for Hard Ban BAN-PUNCT-01 (Zero Em-Dashes across docs)
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
  // 3. Milestone 10 Specification & Matrix Verification in docs/milestone.md
  // --------------------------------------------------------------------------
  describe("docs/milestone.md: Milestone 10 Specification Alignment", () => {
    it("should list MS-10 in Milestone Overview & Sequencing Matrix", () => {
      const content = fs.readFileSync(path.join(docsDir, "milestone.md"), "utf-8");
      assert.ok(content.includes("MS-10"), "milestone.md must include MS-10");
      assert.ok(
        content.includes("Admin Product Setup Wizard State & Component Persistence"),
        "milestone.md must have MS-10 title"
      );
      assert.ok(content.includes("QAD-TC19"), "milestone.md must link to QAD-TC19");
    });

    it("should document Milestone 10 technical tasks and exit criteria", () => {
      const content = fs.readFileSync(path.join(docsDir, "milestone.md"), "utf-8");
      assert.ok(
        content.includes("### Milestone 10: Admin Product Setup Wizard State & Component Persistence"),
        "milestone.md must have MS-10 detailed section header"
      );
      assert.ok(
        content.includes("Dynamic Step State Revalidation"),
        "milestone.md must document state revalidation task"
      );
      assert.ok(
        content.includes("Bidirectional Component State Propagation"),
        "milestone.md must document bidirectional component state task"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Quality Assurance Test Catalog in docs/qad-glassfit.md
  // --------------------------------------------------------------------------
  describe("docs/qad-glassfit.md: QAD-TC19 Registration", () => {
    it("should detail QAD-TC19 with execution steps and expected results", () => {
      const content = fs.readFileSync(path.join(docsDir, "qad-glassfit.md"), "utf-8");
      assert.ok(content.includes("QAD-TC19"), "qad-glassfit.md must define QAD-TC19");
      assert.ok(
        content.includes("Admin Setup Wizard Step Switching & Component Persistence"),
        "qad-glassfit.md must define QAD-TC19 title"
      );
      assert.ok(content.includes("PRD-F14"), "QAD-TC19 must trace to PRD-F14");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Documentation Index Traceability in docs/index.md
  // --------------------------------------------------------------------------
  describe("docs/index.md: Master Document Registry & Traceability", () => {
    it("should trace QAD-TC19 in the master End-to-End Traceability Matrix", () => {
      const content = fs.readFileSync(path.join(docsDir, "index.md"), "utf-8");
      assert.ok(content.includes("QAD-TC19"), "index.md must trace QAD-TC19");
      assert.ok(content.includes("PR #10"), "index.md must record PR #10 revision");
    });
  });
});
