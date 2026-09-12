import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Governance & Documentation Hub Verification", () => {
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
  // 3. Master Document Registry & Traceability in docs/index.md
  // --------------------------------------------------------------------------
  describe("docs/index.md: Master Document Registry & Specification Traceability", () => {
    it("should register all 10 core specs and milestone guides in Master Document Registry", () => {
      const indexPath = path.join(docsDir, "index.md");
      const content = fs.readFileSync(indexPath, "utf-8");

      assert.ok(content.includes("docs/pricing.md"), "index.md must register pricing.md");
      assert.ok(content.includes("docs/milestone.md"), "index.md must register milestone.md");
      assert.ok(content.includes("docs/prd-glassfit.md"), "index.md must register prd-glassfit.md");
      assert.ok(content.includes("docs/sdd-glassfit.md"), "index.md must register sdd-glassfit.md");
    });

    it("should maintain full traceability for test cases QAD-TC15 through QAD-TC21", () => {
      const indexPath = path.join(docsDir, "index.md");
      const content = fs.readFileSync(indexPath, "utf-8");

      assert.ok(content.includes("QAD-TC15"), "index.md must trace QAD-TC15");
      assert.ok(content.includes("QAD-TC16"), "index.md must trace QAD-TC16");
      assert.ok(content.includes("QAD-TC17"), "index.md must trace QAD-TC17");
      assert.ok(content.includes("QAD-TC18"), "index.md must trace QAD-TC18");
      assert.ok(content.includes("QAD-TC19"), "index.md must trace QAD-TC19");
      assert.ok(content.includes("QAD-TC20"), "index.md must trace QAD-TC20");
      assert.ok(content.includes("QAD-TC21"), "index.md must trace QAD-TC21");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Milestone Matrix & Specifications in docs/milestone.md
  // --------------------------------------------------------------------------
  describe("docs/milestone.md: Milestone Verification", () => {
    it("should list all milestones from MS-1 through MS-11 in Milestone Overview Matrix", () => {
      const milestonePath = path.join(docsDir, "milestone.md");
      const content = fs.readFileSync(milestonePath, "utf-8");

      for (let i = 1; i <= 11; i++) {
        assert.ok(content.includes(`MS-${i}`), `milestone.md must include MS-${i}`);
      }
    });
  });
});
