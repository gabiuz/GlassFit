import { describe, it } from "node:test";
import assert from "node:assert";
import { PRIVACY_SECTIONS } from "../../src/features/privacy/components/privacyData.js";
import { TERMS_SECTIONS } from "../../src/features/terms/components/termsData.js";

describe("Legal & Compliance Domain: Privacy Policy & Terms of Service", () => {
  // --------------------------------------------------------------------------
  // 1. Privacy Policy Integrity (privacyData.ts)
  // --------------------------------------------------------------------------
  describe("Privacy Policy Sections (PRIVACY_SECTIONS)", () => {
    it("should provide structured sections with unique IDs, titles, and TOC labels", () => {
      assert.ok(PRIVACY_SECTIONS.length >= 5);
      const seenIds = new Set<string>();

      for (const section of PRIVACY_SECTIONS) {
        assert.ok(section.id.length > 0, "Section must have non-empty id");
        assert.ok(section.title.length > 0, "Section must have non-empty title");
        assert.ok(section.tocLabel.length > 0, "Section must have non-empty tocLabel");
        assert.strictEqual(seenIds.has(section.id), false, `Duplicate section id: ${section.id}`);
        seenIds.add(section.id);
      }
    });

    it("should cover key compliance requirements: account info, space images, data handling", () => {
      const sectionIds = PRIVACY_SECTIONS.map((s) => s.id);
      assert.ok(sectionIds.includes("introduction"));
      assert.ok(sectionIds.includes("information-we-process"));
      assert.ok(sectionIds.includes("account-information"));
      assert.ok(sectionIds.includes("uploaded-space-images"));
    });

    it("should include customer contact and inquiry details", () => {
      const contactSection = PRIVACY_SECTIONS.find(
        (s) => s.id.includes("contact") || s.id.includes("inquir") || s.contacts !== undefined
      );
      assert.ok(contactSection !== undefined, "Privacy policy must have contact or inquiry section");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Terms of Service Integrity (termsData.ts)
  // --------------------------------------------------------------------------
  describe("Terms of Service Sections (TERMS_SECTIONS)", () => {
    it("should provide structured terms sections with unique IDs and TOC labels", () => {
      assert.ok(TERMS_SECTIONS.length >= 5);
      const seenIds = new Set<string>();

      for (const section of TERMS_SECTIONS) {
        assert.ok(section.id.length > 0, "Terms section must have non-empty id");
        assert.ok(section.title.length > 0, "Terms section must have non-empty title");
        assert.ok(section.tocLabel.length > 0, "Terms section must have non-empty tocLabel");
        assert.strictEqual(seenIds.has(section.id), false, `Duplicate terms id: ${section.id}`);
        seenIds.add(section.id);
      }
    });

    it("should detail quotation estimates as non-binding preliminary calculations", () => {
      const allText = JSON.stringify(TERMS_SECTIONS).toLowerCase();
      assert.ok(allText.includes("estimate"), "Terms must state estimates nature");
      assert.ok(allText.includes("measurement") || allText.includes("inspection"), "Terms must reference site measurement");
    });

    it("should include structural and installation safety disclaimers", () => {
      const allText = JSON.stringify(TERMS_SECTIONS).toLowerCase();
      assert.ok(
        allText.includes("safety") || allText.includes("structural") || allText.includes("installation"),
        "Terms must mention structural or installation conditions"
      );
    });
  });
});
