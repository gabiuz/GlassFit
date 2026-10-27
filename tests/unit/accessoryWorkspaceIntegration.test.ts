/**
 * Unit Tests: Customer Visualization Workspace Dynamic Accessory Swapping, Positional Matrix Alignment, and Real-Time Quotation/PDF BOM Handoff (IMP-MS76)
 *
 * Upstream Specifications: docs/implementation/ms76.md, docs/sdd-glassfit.md, docs/qad-glassfit.md
 * Traceability Codes: PRD-F2, PRD-F5, PRD-F6, PRD-F10, PRD-F11, SDD-C4, SDD-C5, SDD-C7, SDD-C8, DSD-UI4, DSD-UI7, DSD-UI16, ERD-E3, ERD-E6, ERD-E13, ERD-E14, BRD-M2, BRD-M3, BRD-M4, BRD-M5, QAD-TC91.1 through QAD-TC91.10
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  applyAccessoryBOMAdjustments,
  calculateStandardSeries798,
  type AccessoryBOMAdjustment,
} from "../../src/lib/pricing/pricingEngine.js";
import {
  createHardwareFinishMaterial,
  createProceduralAccessoryMesh,
  mountAccessoryMesh,
} from "../../src/lib/visualization/parametricProductBuilder.js";
import {
  createQuotationDocumentSnapshotV1,
  createQuotationDocumentViewModel,
  QuotationDocumentSnapshotV1Schema,
} from "../../src/lib/pricing/quotationDocument.js";
import {
  generateQuotationPdfHtml,
} from "../../src/lib/pricing/quotationPdfGenerator.js";
import type {
  ItemizedProductQuotation,
} from "../../src/lib/pricing/types.js";
import type { AccessoryPositionOptions } from "../../src/lib/visualization/types.js";

describe("IMP-MS76: Customer Visualization Workspace Dynamic Accessory Swapping & Pricing Integration", () => {
  // --------------------------------------------------------------------------
  // Scenario 1: Real-Time Hardware BOM Pricing Engine Recalculation (QAD-TC91.6)
  // --------------------------------------------------------------------------
  describe("1. Real-Time Hardware BOM Pricing Engine Recalculation (QAD-TC91.6)", () => {
    it("deducts default component cost and adds selected accessory price with scrap and contractor margin", () => {
      const baseHardwareCost = 1000;
      const adjustments: AccessoryBOMAdjustment[] = [
        {
          slotComponentId: "slot-door-handle",
          defaultComponentCost: 350,
          selectedAccessoryPrice: 4500,
          finishRateDelta: 0,
        },
      ];

      // netCost = 1000 - 350 + (4500 * (1 + 0.10)) = 650 + 4950 = 5600
      // finalPrice = 5600 * 1.25 = 7000
      // baseHardwarePrice = 1000 * 1.25 = 1250
      // priceDelta = 7000 - 1250 = 5750
      const result = applyAccessoryBOMAdjustments(baseHardwareCost, adjustments, 0.10, 0.25);

      assert.equal(result.netHardwareCost, 5600);
      assert.equal(result.priceDelta, 5750);
    });

    it("handles multiple accessory adjustments simultaneously with positive and negative deltas", () => {
      const baseHardwareCost = 2000;
      const adjustments: AccessoryBOMAdjustment[] = [
        {
          slotComponentId: "slot-lever-handle",
          defaultComponentCost: 500,
          selectedAccessoryPrice: 350, // downgrade / cheaper knob
          finishRateDelta: 0,
        },
        {
          slotComponentId: "slot-deadbolt",
          defaultComponentCost: 400,
          selectedAccessoryPrice: 2500, // upgrade to electronic deadbolt
          finishRateDelta: 150, // finish rate surcharge
        },
      ];

      const result = applyAccessoryBOMAdjustments(baseHardwareCost, adjustments, 0.10, 0.25);
      // netCost = 2000 - 500 + (350 * 1.1) - 400 + ((2500 + 150) * 1.1)
      // = 1500 + 385 - 400 + 2915 = 4400
      assert.equal(result.netHardwareCost, 4400);
      // finalPrice = 4400 * 1.25 = 5500
      // basePrice = 2000 * 1.25 = 2500
      // delta = 3000
      assert.equal(result.priceDelta, 3000);
    });

    it("returns zero price delta when no adjustments are applied", () => {
      const result = applyAccessoryBOMAdjustments(1200, [], 0.10, 0.25);
      assert.equal(result.netHardwareCost, 1200);
      assert.equal(result.priceDelta, 0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Spatial Positional Matrix Transformations (QAD-TC91.3, QAD-TC91.4)
  // --------------------------------------------------------------------------
  describe("2. Spatial Positional Matrix Transformations (QAD-TC91.3, QAD-TC91.4)", () => {
    const hostBounds = { widthM: 0.9, heightM: 2.1, depthM: 0.05 };
    const positionOptions: AccessoryPositionOptions = {
      allowHorizontalToggle: true,
      defaultHorizontal: "right",
      horizontalOffsetMm: 45,
      allowVerticalToggle: true,
      defaultVertical: "up",
      verticalOffsetMm: 150,
    };

    it("strictly translates along lateral X axis for Left vs Right handings while Y elevation and Z depth remain invariant (QAD-TC91.3)", () => {
      const parentGroup = new THREE.Group();
      const accessoryMesh = new THREE.Group();
      accessoryMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05)));

      const mountedRight = mountAccessoryMesh(
        accessoryMesh,
        parentGroup,
        hostBounds,
        positionOptions,
        "right",
        "up",
        "Matte Black"
      );

      const mountedLeft = mountAccessoryMesh(
        accessoryMesh,
        parentGroup,
        hostBounds,
        positionOptions,
        "left",
        "up",
        "Matte Black"
      );

      // Expected X coordinates:
      // widthM = 0.9, marginX = 45mm = 0.045m
      // right = +0.45 - 0.045 = +0.405
      // left  = -0.45 + 0.045 = -0.405
      assert.ok(Math.abs(mountedRight.position.x - 0.405) < 0.001, `Right X should be +0.405, got ${mountedRight.position.x}`);
      assert.ok(Math.abs(mountedLeft.position.x - (-0.405)) < 0.001, `Left X should be -0.405, got ${mountedLeft.position.x}`);

      // Strict spatial invariant: Y and Z coordinates must be identical
      assert.equal(mountedRight.position.y, mountedLeft.position.y, "Y axis elevation must remain completely identical between Left and Right handings");
      assert.equal(mountedRight.position.z, mountedLeft.position.z, "Z axis depth must remain completely identical between Left and Right handings");
    });

    it("strictly translates along vertical Y axis for Bottom vs Up elevations while X coordinate and Z depth remain invariant (QAD-TC91.4)", () => {
      const parentGroup = new THREE.Group();
      const accessoryMesh = new THREE.Group();
      accessoryMesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05)));

      const mountedUp = mountAccessoryMesh(
        accessoryMesh,
        parentGroup,
        hostBounds,
        positionOptions,
        "right",
        "up",
        "Stainless Steel"
      );

      const mountedBottom = mountAccessoryMesh(
        accessoryMesh,
        parentGroup,
        hostBounds,
        positionOptions,
        "right",
        "bottom",
        "Stainless Steel"
      );

      // Expected Y coordinates:
      // heightM = 2.1
      // bottom = -2.1/2 + 0.15 = -0.90
      // up = 2.1 * 0.05 = 0.105
      assert.ok(mountedBottom.position.y < mountedUp.position.y, "Bottom position must be lower than Up position");
      assert.ok(Math.abs(mountedBottom.position.y - (-0.90)) < 0.001, `Bottom Y should be -0.90, got ${mountedBottom.position.y}`);
      assert.ok(Math.abs(mountedUp.position.y - 0.105) < 0.001, `Up Y should be 0.105, got ${mountedUp.position.y}`);

      // Strict spatial invariant: X and Z coordinates must be identical
      assert.equal(mountedUp.position.x, mountedBottom.position.x, "Lateral X position must remain completely identical between Bottom and Up elevations");
      assert.equal(mountedUp.position.z, mountedBottom.position.z, "Z axis depth must remain completely identical between Bottom and Up elevations");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 3: PBR Finish Material and Procedural Mesh Generation (QAD-TC91.5)
  // --------------------------------------------------------------------------
  describe("3. PBR Finish Material and Procedural Mesh Generation (QAD-TC91.5)", () => {
    it("creates correct PBR materials for all supported metallic and coated finishes", () => {
      const matteBlack = createHardwareFinishMaterial("Matte Black");
      assert.equal(matteBlack.color.getHex(), 0x18191a);
      assert.equal(matteBlack.metalness, 0.3);
      assert.equal(matteBlack.roughness, 0.75);

      const satinBrass = createHardwareFinishMaterial("Satin Brass");
      assert.equal(satinBrass.color.getHex(), 0xd4af37);
      assert.equal(satinBrass.metalness, 0.85);
      assert.equal(satinBrass.roughness, 0.35);

      const brushedChrome = createHardwareFinishMaterial("Brushed Chrome");
      assert.equal(brushedChrome.color.getHex(), 0xd2d6dc);
      assert.equal(brushedChrome.metalness, 0.9);
      assert.equal(brushedChrome.roughness, 0.22);

      const stainlessSteel = createHardwareFinishMaterial("Stainless Steel");
      assert.equal(stainlessSteel.color.getHex(), 0xd2d6dc);
      assert.equal(stainlessSteel.metalness, 0.9);
      assert.equal(stainlessSteel.roughness, 0.22);
    });

    it("generates procedural fallback accessory mesh for smart lock with keypad and lever", () => {
      const lockObj = createProceduralAccessoryMesh("lock", "Keyless Smart Digital Lock", "Matte Black");
      assert.ok(lockObj instanceof THREE.Object3D);
      assert.ok(lockObj.children.length >= 2, "Smart lock should contain escutcheon body and keypad screen or handle");

      const hasShadowMesh = lockObj.children.some((c) => (c as THREE.Mesh).castShadow === true);
      assert.equal(hasShadowMesh, true, "Procedural mesh components should cast shadows");
    });

    it("generates procedural fallback accessory mesh for standard lever handle and round doorknob", () => {
      const leverObj = createProceduralAccessoryMesh("handle", "Ergonomic Architectural Lever Handle", "Brushed Chrome");
      assert.ok(leverObj instanceof THREE.Object3D);
      assert.ok(leverObj.children.length >= 2, "Lever handle should contain mounting rose and horizontal grip");

      const knobObj = createProceduralAccessoryMesh("handle", "Privacy Round Doorknob", "Satin Brass");
      assert.ok(knobObj instanceof THREE.Object3D);
      assert.ok(knobObj.children.length >= 2, "Doorknob should contain mounting collar and sphere knob");
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Catalog choices now require an explicit MS77 slot approval.
  // --------------------------------------------------------------------------
  // Scenario 5: Quotation Document Snapshot and Consultation PDF Itemization (QAD-TC91.7, QAD-TC91.8)
  // --------------------------------------------------------------------------
  describe("5. Quotation Document Snapshot and Consultation PDF Itemization (QAD-TC91.7, QAD-TC91.8)", () => {
    it("persists swappedAccessories and accessoryPriceDelta into immutable quotation document snapshot", () => {
      const bom = calculateStandardSeries798({ widthMm: 900, heightMm: 2100, panelCount: 1 });
      const sourceItem: ItemizedProductQuotation = {
        itemId: "item-door-101",
        productId: "prod-hinged-glass-door",
        productName: "Tempered Glass Swing Door",
        productType: "Door",
        variantName: "Standard",
        specSummary: "900 x 2100 mm | Clear Tempered 6mm | Matte Black Aluminum",
        dimensionsFormatted: "900 x 2100 mm",
        widthMm: 900,
        heightMm: 2100,
        panelCount: 1,
        hasSill: false,
        structuralWaiver: false,
        glassType: "Clear Tempered 6mm",
        finishType: "Matte Black",
        quantity: 1,
        unitPrice: 10402,
        totalPrice: 10402,
        imageUrl: "",
        bomResult: bom,
        swappedAccessories: {
          "slot-handle": {
            slotComponentId: "slot-handle",
            accessoryId: "keyless-smart-lock",
            accessoryName: "Keyless Smart Digital Lock",
            category: "lock",
            price: 4500,
            finish: "Matte Black",
            horizontalPosition: "right",
            verticalPosition: "up",
            priceDelta: 4500,
          },
        },
        accessoryPriceDelta: 4500,
      };

      const doc = createQuotationDocumentSnapshotV1({
        customer: {
          name: "Maria Santos",
          email: "maria@example.com",
          phone: "09171234567",
          siteLocation: "BGC Taguig City",
        },
        projectName: "Residential Door Renovation",
        items: [sourceItem],
        hasSill: false,
        structuralWaiver: false,
      });

      assert.equal(doc.items.length, 1);
      const docItem = doc.items[0];
      assert.ok(docItem.swappedAccessories, "Document item must retain swappedAccessories");
      assert.equal(docItem.swappedAccessories.length, 1);
      assert.equal(docItem.swappedAccessories[0]?.accessoryName, "Keyless Smart Digital Lock");
      assert.equal(docItem.swappedAccessories[0]?.horizontalPosition, "right");
      assert.equal(docItem.accessoryPriceDelta, 4500);
    });

    it("prints itemized hardware specifications and handing in consultation PDF HTML export (QAD-TC91.8)", () => {
      const bom = calculateStandardSeries798({ widthMm: 900, heightMm: 2100, panelCount: 1 });
      const sourceItem: ItemizedProductQuotation = {
        itemId: "item-door-101",
        productId: "prod-hinged-glass-door",
        productName: "Tempered Glass Swing Door",
        productType: "Door",
        variantName: "Standard",
        specSummary: "900 x 2100 mm | Clear Tempered 6mm | Matte Black Aluminum",
        dimensionsFormatted: "900 x 2100 mm",
        widthMm: 900,
        heightMm: 2100,
        panelCount: 1,
        hasSill: false,
        structuralWaiver: false,
        glassType: "Clear Tempered 6mm",
        finishType: "Matte Black",
        quantity: 1,
        unitPrice: 10402,
        totalPrice: 10402,
        imageUrl: "",
        bomResult: bom,
        swappedAccessories: {
          "slot-handle": {
            slotComponentId: "slot-handle",
            accessoryId: "keyless-smart-lock",
            accessoryName: "Keyless Smart Digital Lock",
            category: "lock",
            price: 4500,
            finish: "Matte Black",
            horizontalPosition: "right",
            verticalPosition: "up",
            priceDelta: 4500,
          },
        },
        accessoryPriceDelta: 4500,
      };

      const doc = createQuotationDocumentSnapshotV1({
        customer: {
          name: "Maria Santos",
          email: "maria@example.com",
          phone: "09171234567",
          siteLocation: "BGC Taguig City",
        },
        projectName: "Residential Door Renovation",
        items: [sourceItem],
        hasSill: false,
        structuralWaiver: false,
      });

      const snapshot = QuotationDocumentSnapshotV1Schema.parse({
        ...doc,
        quotationNumber: "Q-2026-1000",
        referenceCode: "CF-2026-1000",
        shareablePath: "/q/CF-2026-1000",
        createdAt: "2026-10-26T00:00:00.000Z",
        snapshotObjectKey: null,
      });
      const view = createQuotationDocumentViewModel(snapshot, {
        brandLogoUrl: "https://glassfit.test/Logo.svg",
        shareableUrl: "https://glassfit.test/q/CF-2026-1000",
        snapshotImageUrl: null,
        allowedImageOrigins: ["https://glassfit.test"],
        negotiatedAmount: null,
      });

      const html = generateQuotationPdfHtml(view);

      // Verify PDF HTML includes hardware and handing details
      assert.ok(html.includes("Keyless Smart Digital Lock"), "PDF must mention the selected accessory name");
      assert.ok(html.includes("Hardware") || html.includes("Accessories"), "PDF must display hardware section header");
      assert.ok(html.includes("Right Side") || html.includes("Right-Hand"), "PDF must state the chosen horizontal handing");
      assert.ok(html.includes("Matte Black"), "PDF must state the hardware finish");
    });
  });
});
