/**
 * Unit Test Suite: Non-Technical Raw Material Ingestion & Auto-Conversion (MS-21)
 *
 * Upstream Specifications: docs/plans/pricing_model.md, docs/implementation/ms21.md
 * Traceability Codes: PRD-F14, PRD-F19, SDD-C9, ERD-E17, QAD-TC34, BAN-TYPE-05
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseRawMaterialCsv,
  generateMaterialCode,
  generateCsvTemplate,
} from "@/features/admin/materials/csvMaterialParser";
import { sanitizeDecimalInput } from "@/features/admin/materials/MaterialModal";

describe("MS-21: Non-Technical Raw Material Ingestion (QAD-TC34)", () => {
  describe("Input Sanitization (2 Decimal Places & Non-Numeric Filter)", () => {
    it("should accept valid integer and decimal strings up to 2 decimal places", () => {
      assert.equal(sanitizeDecimalInput("720"), "720");
      assert.equal(sanitizeDecimalInput("720.5"), "720.5");
      assert.equal(sanitizeDecimalInput("720.50"), "720.50");
      assert.equal(sanitizeDecimalInput("0.99"), "0.99");
    });

    it("should reject characters, letters, symbols, and extra periods", () => {
      assert.equal(sanitizeDecimalInput("abc"), "");
      assert.equal(sanitizeDecimalInput("₱720.50"), "720.50");
      assert.equal(sanitizeDecimalInput("720.50.99"), "720.50");
      assert.equal(sanitizeDecimalInput("12a34b.56c"), "1234.56");
    });

    it("should truncate any decimal digits beyond 2 places", () => {
      assert.equal(sanitizeDecimalInput("123.456"), "123.45");
      assert.equal(sanitizeDecimalInput("10.9999"), "10.99");
    });
  });

  describe("Automatic Material Code Generation", () => {
    it("should generate deterministic, readable codes without regex syntax hurdles", () => {
      const codeAl = generateMaterialCode("Aluminum", '1" x 1" Aluminum Tube', "Analok");
      assert.equal(codeAl, "AL-1X1ALUMINU-ANALOK");

      const codeGl = generateMaterialCode("Glass", "Clear Float Glass", "Clear");
      assert.equal(codeGl, "GL-CLEARFLOAT-CLEAR");

      const codeHw = generateMaterialCode("Hardware", "Series 798 Roller", "None");
      assert.equal(codeHw, "HW-SERIES798R-NONE");
    });
  });

  describe("Spreadsheet Template Generation", () => {
    it("should produce a CSV template with friendly human column headers", () => {
      const template = generateCsvTemplate();
      assert.ok(template.includes("Material Name"));
      assert.ok(template.includes("Category"));
      assert.ok(template.includes("Finish or Color"));
      assert.ok(template.includes("RRD Stock Price (PHP)"));
      assert.ok(template.includes("Stock Size (e.g. 6m or 4x6ft)"));
    });
  });

  describe("CSV Pre-Flight Ingestion Engine", () => {
    it("should parse standard template rows and auto-derive workshop unit rates", () => {
      const csv = `Material Name,Category,Finish or Color,RRD Stock Price (PHP),Stock Size,Notes
1" x 1" Aluminum Tube,Aluminum,Analok,720,6m,Standard hollow tube
1" x 2" Aluminum Tube,Aluminum,White,1040,6m,Standard framing tube
Clear Float Glass,Glass,Clear,864,4x6ft,Standard window glass
Tempered Silver Glass,Glass,Silver,1728,4x6ft,Premium safety glass
Series 798 Roller,Hardware,None,45,1pc,Single sash roller`;

      const result = parseRawMaterialCsv(csv);
      assert.equal(result.summary.total, 5);
      assert.equal(result.summary.errorCount, 0);

      // Row 1: Aluminum 6m @ ₱720 -> ₱120.00 / m
      const row1 = result.rows[0];
      assert.equal(row1.category, "Aluminum");
      assert.equal(row1.finishType, "Analok");
      assert.equal(row1.stockPriceRrd, 720);
      assert.equal(row1.unitPrice, 120);
      assert.equal(row1.billingUnit, "m");
      assert.equal(row1.status, "valid");

      // Row 2: Aluminum 6m @ ₱1040 -> ₱173.33 / m
      const row2 = result.rows[1];
      assert.equal(row2.unitPrice, 173.33);

      // Row 3: Glass 4x6ft @ ₱864 -> ₱387.50 / sqm
      const row3 = result.rows[2];
      assert.equal(row3.category, "Glass");
      assert.equal(row3.finishType, "Clear");
      assert.equal(row3.stockPriceRrd, 864);
      assert.equal(row3.unitPrice, 387.5);
      assert.equal(row3.billingUnit, "sqm");
      assert.equal(row3.pricingTier, "Standard");

      // Row 4: Tempered Silver Glass (Premium) -> ₱775.00 / sqm with warning/info flag
      const row4 = result.rows[3];
      assert.equal(row4.category, "Glass");
      assert.equal(row4.isPremiumTrigger, true);
      assert.equal(row4.pricingTier, "Premium");
      assert.equal(row4.status, "warning"); // Contains info message about premium rule

      // Row 5: Hardware roller @ ₱45 -> ₱45.00 / pc
      const row5 = result.rows[4];
      assert.equal(row5.category, "Hardware");
      assert.equal(row5.unitPrice, 45);
      assert.equal(row5.billingUnit, "pc");
    });

    it("should handle irregular column headers and synonyms flexibly", () => {
      const csv = `Description,Type,Color,Price
Heavy Duty Jamb,Aluminum,AL 1009,2400
Reflective Blue Glass,Glass,Blue,1200`;

      const result = parseRawMaterialCsv(csv);
      assert.equal(result.summary.total, 2);

      const jamb = result.rows[0];
      assert.equal(jamb.category, "Aluminum");
      assert.equal(jamb.finishType, "AL 1009");
      assert.equal(jamb.unitPrice, 400); // 2400 / 6
      assert.equal(jamb.isPremiumTrigger, true); // Special finish triggers multiplier

      const glass = result.rows[1];
      assert.equal(glass.category, "Glass");
      assert.equal(glass.finishType, "Blue");
      assert.equal(glass.isPremiumTrigger, true);
    });

    it("should allow simplified raw materials without finish or color columns", () => {
      const csv = `Material Name,Category,RRD Stock Price (PHP),Stock Size
1" x 3" Aluminum Framing Tube,Aluminum,1600,6m
Standard Clear Architectural Glass Sheet,Glass,864,4x6ft`;

      const result = parseRawMaterialCsv(csv);
      assert.equal(result.summary.total, 2);
      assert.equal(result.summary.errorCount, 0);

      const al = result.rows[0];
      assert.equal(al.category, "Aluminum");
      assert.equal(al.unitPrice, 266.67); // 1600 / 6
      assert.equal(al.status, "valid");

      const gl = result.rows[1];
      assert.equal(gl.category, "Glass");
      assert.equal(gl.unitPrice, 387.5);
      assert.equal(gl.status, "valid");
    });
  });
});

