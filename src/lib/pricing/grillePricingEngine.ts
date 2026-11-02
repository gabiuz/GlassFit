/**
 * Parametric Linear Grille Pricing Engine (IMP-MS71)
 *
 * Upstream Specifications: docs/implementation/ms71.md, docs/pricing.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F10, PRD-F11, SDD-C7, ERD-E6, ERD-E13, ERD-E14, ERD-E17, BRD-M2, BRD-M5, QAD-TC86.3 through QAD-TC86.10
 */

import type {
  GrilleLinearPricingInput,
  GrilleLinearBOMResult,
  GrilleBarMetric,
  GrilleOpeningBOMImpact,
} from "./types";

const DEFAULT_AL_SCRAP = 0.12; // 12% offcut scrap allowance
const DEFAULT_LABOR_FLOOR = 650.0; // Minimum fabrication labor in PHP
const DEFAULT_LABOR_RATE = 0.25; // 25% of material cost
const DEFAULT_CONTRACTOR_MARGIN = 0.25; // 25% gross contractor margin

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Calculates itemized Bill of Materials (BOM) for an architectural window security grille
 * by computing the exact linear meters and piece count for horizontal bars, vertical bars,
 * and perimeter rails under dynamic dimensional expansion.
 */
export function calculateGrilleLinearBOM(input: GrilleLinearPricingInput): GrilleLinearBOMResult {
  const {
    widthMm,
    heightMm,
    patternType = "staggered_brick",
    nominalPitchColMm = 140,
    nominalPitchRowMm = 191,
    frameProfileWidthMm = 20,
    includePerimeterFrame = true,
    openingCount,
    openingWidthMm,
    openingHeightMm,
    openingTargetKeys,
    openingConfig,
    grilleRawMaterial,
    frameRawMaterial,
    laborRate = DEFAULT_LABOR_RATE,
    laborFloor = DEFAULT_LABOR_FLOOR,
    contractorMarginRate = DEFAULT_CONTRACTOR_MARGIN,
  } = input;

  const barRatePerMeter = grilleRawMaterial.unit_price;
  const barScrap = grilleRawMaterial.waste_allowance ?? DEFAULT_AL_SCRAP;
  const frameRatePerMeter = frameRawMaterial ? frameRawMaterial.unit_price : barRatePerMeter;
  const frameScrap = frameRawMaterial?.waste_allowance ?? DEFAULT_AL_SCRAP;

  const widthM = widthMm / 1000;
  const heightM = heightMm / 1000;
  const frameWidthM = frameProfileWidthMm / 1000;

  // 0. Resolve Operator Clearance Openings (IMP-MS86)
  const resolvedOpeningCount = openingCount !== undefined
    ? openingCount
    : (openingConfig?.enabled && openingConfig.targetComponentKeys)
      ? openingConfig.targetComponentKeys.length
      : (openingTargetKeys ? openingTargetKeys.length : 0);

  const rawCutoutW = openingWidthMm ?? openingConfig?.cutoutWidthMm ?? 150;
  const rawCutoutH = openingHeightMm ?? openingConfig?.cutoutHeightMm ?? 180;
  // Guardrail clamping per QAD-TC101.10 (width: 100mm to 250mm, height: 120mm to 300mm)
  const cutoutWidthMm = Math.max(100, Math.min(250, rawCutoutW));
  const cutoutHeightMm = Math.max(120, Math.min(300, rawCutoutH));
  const cutoutWidthM = cutoutWidthMm / 1000;
  const cutoutHeightM = cutoutHeightMm / 1000;

  // Inner aperture dimensions inside the mounting perimeter frame
  const innerWidthM = includePerimeterFrame ? Math.max(0.1, widthM - 2 * frameWidthM) : widthM;
  const innerHeightM = includePerimeterFrame ? Math.max(0.1, heightM - 2 * frameWidthM) : heightM;
  const innerWidthMm = innerWidthM * 1000;
  const innerHeightMm = innerHeightM * 1000;

  // 1. Perimeter Mounting Rails (Top, Bottom, Left, Right)
  let perimeterDetails: GrilleLinearBOMResult["perimeterRails"] = null;
  let perimeterMetersTotal = 0;
  let perimeterCostTotal = 0;

  if (includePerimeterFrame) {
    const topLengthM = widthM;
    const botLengthM = widthM;
    const sideLengthM = Math.max(0, heightM - 2 * frameWidthM);

    const topMetric: GrilleBarMetric = {
      id: "perimeter-top",
      name: "Grille Frame Top Rail",
      orientation: "HORIZONTAL",
      lengthMm: Math.round(topLengthM * 1000),
      lengthM: topLengthM,
      count: 1,
      totalLinearM: topLengthM,
      unitPricePerMeter: frameRatePerMeter,
      subtotalCost: round2(topLengthM * frameRatePerMeter * (1 + frameScrap)),
    };

    const botMetric: GrilleBarMetric = {
      id: "perimeter-bottom",
      name: "Grille Frame Bottom Rail",
      orientation: "HORIZONTAL",
      lengthMm: Math.round(botLengthM * 1000),
      lengthM: botLengthM,
      count: 1,
      totalLinearM: botLengthM,
      unitPricePerMeter: frameRatePerMeter,
      subtotalCost: round2(botLengthM * frameRatePerMeter * (1 + frameScrap)),
    };

    const leftMetric: GrilleBarMetric = {
      id: "perimeter-left",
      name: "Grille Frame Left Jamb",
      orientation: "VERTICAL",
      lengthMm: Math.round(sideLengthM * 1000),
      lengthM: sideLengthM,
      count: 1,
      totalLinearM: sideLengthM,
      unitPricePerMeter: frameRatePerMeter,
      subtotalCost: round2(sideLengthM * frameRatePerMeter * (1 + frameScrap)),
    };

    const rightMetric: GrilleBarMetric = {
      id: "perimeter-right",
      name: "Grille Frame Right Jamb",
      orientation: "VERTICAL",
      lengthMm: Math.round(sideLengthM * 1000),
      lengthM: sideLengthM,
      count: 1,
      totalLinearM: sideLengthM,
      unitPricePerMeter: frameRatePerMeter,
      subtotalCost: round2(sideLengthM * frameRatePerMeter * (1 + frameScrap)),
    };

    perimeterMetersTotal = topLengthM + botLengthM + sideLengthM * 2;
    perimeterCostTotal =
      topMetric.subtotalCost + botMetric.subtotalCost + leftMetric.subtotalCost + rightMetric.subtotalCost;

    perimeterDetails = {
      topRail: topMetric,
      bottomRail: botMetric,
      leftJamb: leftMetric,
      rightJamb: rightMetric,
      totalLinearM: round2(perimeterMetersTotal),
      subtotalCost: round2(perimeterCostTotal),
    };
  }

  // 2. Dynamic Center Infill Bars (Vertical and Horizontal)
  const vMetrics: GrilleBarMetric[] = [];
  const hMetrics: GrilleBarMetric[] = [];

  let splitPicketsCount = 0;

  if (patternType === "grid") {
    // Style 1: Grid pattern (full-height vertical pickets + full-width horizontal divider rails)
    const colCount = input.verticalBarCount !== undefined
      ? input.verticalBarCount
      : (innerWidthMm > 0 ? Math.max(1, Math.floor(innerWidthMm / nominalPitchColMm)) : 0);
    const rowCount = input.horizontalBarCount !== undefined
      ? input.horizontalBarCount
      : (innerHeightMm > 0 ? Math.max(1, Math.floor(innerHeightMm / nominalPitchRowMm)) : 0);

    const picketsPerOpening = Math.max(1, Math.round(cutoutWidthMm / (nominalPitchColMm > 0 ? nominalPitchColMm : 140)));
    splitPicketsCount = resolvedOpeningCount > 0 ? Math.min(colCount, resolvedOpeningCount * picketsPerOpening) : 0;
    const fullPicketsCount = Math.max(0, colCount - splitPicketsCount);

    const vBarLengthM = innerHeightM;
    const splitBarLengthM = Math.max(0.01, innerHeightM - cutoutHeightM);

    if (splitPicketsCount > 0) {
      if (fullPicketsCount > 0) {
        const vFullTotalM = fullPicketsCount * vBarLengthM;
        vMetrics.push({
          id: "grid-v-bars-full",
          name: `Vertical Grille Bars (${fullPicketsCount} continuous pickets)`,
          orientation: "VERTICAL",
          lengthMm: Math.round(vBarLengthM * 1000),
          lengthM: vBarLengthM,
          count: fullPicketsCount,
          totalLinearM: round2(vFullTotalM),
          unitPricePerMeter: barRatePerMeter,
          subtotalCost: round2(vFullTotalM * barRatePerMeter * (1 + barScrap)),
        });
      }
      const vSplitTotalM = splitPicketsCount * splitBarLengthM;
      vMetrics.push({
        id: "grid-v-bars-split",
        name: `Vertical Grille Bars (${splitPicketsCount} interrupted pickets / ${splitPicketsCount * 2} segments)`,
        orientation: "VERTICAL",
        lengthMm: Math.round(splitBarLengthM * 1000),
        lengthM: splitBarLengthM,
        count: splitPicketsCount * 2,
        totalLinearM: round2(vSplitTotalM),
        unitPricePerMeter: barRatePerMeter,
        subtotalCost: round2(vSplitTotalM * barRatePerMeter * (1 + barScrap)),
      });
    } else {
      const vTotalLinearM = colCount * vBarLengthM;
      vMetrics.push({
        id: "grid-v-bars",
        name: `Vertical Grille Bars (${colCount} pickets)`,
        orientation: "VERTICAL",
        lengthMm: Math.round(vBarLengthM * 1000),
        lengthM: vBarLengthM,
        count: colCount,
        totalLinearM: round2(vTotalLinearM),
        unitPricePerMeter: barRatePerMeter,
        subtotalCost: round2(vTotalLinearM * barRatePerMeter * (1 + barScrap)),
      });
    }

    const hBarLengthM = innerWidthM;
    const hTotalLinearM = rowCount * hBarLengthM;
    const hCost = round2(hTotalLinearM * barRatePerMeter * (1 + barScrap));

    hMetrics.push({
      id: "grid-h-bars",
      name: `Horizontal Cross Rails (${rowCount} rails)`,
      orientation: "HORIZONTAL",
      lengthMm: Math.round(hBarLengthM * 1000),
      lengthM: hBarLengthM,
      count: rowCount,
      totalLinearM: round2(hTotalLinearM),
      unitPricePerMeter: barRatePerMeter,
      subtotalCost: hCost,
    });
  } else if (patternType === "louvers") {
    // Style 2: Horizontal louvers / slats with vertical center mullion
    const numSlats = innerHeightMm > 0 ? Math.max(2, Math.floor(innerHeightMm / 45)) : 0; // 45mm slat pitch
    const numMullions = innerWidthMm > 1200 ? 2 : 1; // 1 center mullion up to 1200mm, 2 above

    const hSlatLengthM = innerWidthM;
    const hTotalLinearM = numSlats * hSlatLengthM;
    const hCost = round2(hTotalLinearM * barRatePerMeter * (1 + barScrap));

    hMetrics.push({
      id: "louver-slats",
      name: `Horizontal Grille Slats (${numSlats} slats)`,
      orientation: "HORIZONTAL",
      lengthMm: Math.round(hSlatLengthM * 1000),
      lengthM: hSlatLengthM,
      count: numSlats,
      totalLinearM: round2(hTotalLinearM),
      unitPricePerMeter: barRatePerMeter,
      subtotalCost: hCost,
    });

    const vMullionLengthM = innerHeightM;
    const vTotalLinearM = numMullions * vMullionLengthM;
    const vCost = round2(vTotalLinearM * barRatePerMeter * (1 + barScrap));

    vMetrics.push({
      id: "louver-mullions",
      name: `Center Vertical Mullions (${numMullions} pcs)`,
      orientation: "VERTICAL",
      lengthMm: Math.round(vMullionLengthM * 1000),
      lengthM: vMullionLengthM,
      count: numMullions,
      totalLinearM: round2(vTotalLinearM),
      unitPricePerMeter: barRatePerMeter,
      subtotalCost: vCost,
    });
  } else {
    // Style 3: Staggered brick / running bond (matches Lab_Grill_Middle_Bars.glb and buildDynamicGrillPatternGroup)
    const colCount = innerWidthMm > 0 ? Math.max(1, Math.floor(innerWidthMm / nominalPitchColMm)) : 0;
    const actualPitchM = colCount > 0 ? innerWidthM / (colCount + 1) : 0;
    const actualPitchMm = actualPitchM * 1000;

    const picketsPerOpening = Math.max(1, Math.round(cutoutWidthMm / (actualPitchMm > 0 ? actualPitchMm : nominalPitchColMm)));
    splitPicketsCount = resolvedOpeningCount > 0 ? Math.min(colCount, resolvedOpeningCount * picketsPerOpening) : 0;
    const fullPicketsCount = Math.max(0, colCount - splitPicketsCount);

    const vBarLengthM = innerHeightM;
    const splitBarLengthM = Math.max(0.01, innerHeightM - cutoutHeightM);

    if (splitPicketsCount > 0) {
      if (fullPicketsCount > 0) {
        const vFullTotalM = fullPicketsCount * vBarLengthM;
        vMetrics.push({
          id: "brick-v-bars-full",
          name: `Vertical Grille Bars (${fullPicketsCount} continuous pickets)`,
          orientation: "VERTICAL",
          lengthMm: Math.round(vBarLengthM * 1000),
          lengthM: vBarLengthM,
          count: fullPicketsCount,
          totalLinearM: round2(vFullTotalM),
          unitPricePerMeter: barRatePerMeter,
          subtotalCost: round2(vFullTotalM * barRatePerMeter * (1 + barScrap)),
        });
      }
      const vSplitTotalM = splitPicketsCount * splitBarLengthM;
      vMetrics.push({
        id: "brick-v-bars-split",
        name: `Vertical Grille Bars (${splitPicketsCount} interrupted pickets / ${splitPicketsCount * 2} segments)`,
        orientation: "VERTICAL",
        lengthMm: Math.round(splitBarLengthM * 1000),
        lengthM: splitBarLengthM,
        count: splitPicketsCount * 2,
        totalLinearM: round2(vSplitTotalM),
        unitPricePerMeter: barRatePerMeter,
        subtotalCost: round2(vSplitTotalM * barRatePerMeter * (1 + barScrap)),
      });
    } else {
      const vTotalLinearM = colCount * vBarLengthM;
      vMetrics.push({
        id: "brick-v-bars",
        name: `Vertical Grille Bars (${colCount} pickets)`,
        orientation: "VERTICAL",
        lengthMm: Math.round(vBarLengthM * 1000),
        lengthM: vBarLengthM,
        count: colCount,
        totalLinearM: round2(vTotalLinearM),
        unitPricePerMeter: barRatePerMeter,
        subtotalCost: round2(vTotalLinearM * barRatePerMeter * (1 + barScrap)),
      });
    }

    const totalCols = colCount + 1;
    const numLevels = Math.max(2, Math.round(innerHeightMm / nominalPitchRowMm));
    let horizontalBarCount = 0;

    for (let c = 0; c < totalCols; c++) {
      for (let lvl = 1; lvl < numLevels; lvl++) {
        if ((c + lvl) % 2 === 0) {
          horizontalBarCount++;
        }
      }
    }

    const hSpanLengthM = actualPitchM;
    const hTotalLinearM = horizontalBarCount * hSpanLengthM;
    const hCost = round2(hTotalLinearM * barRatePerMeter * (1 + barScrap));

    hMetrics.push({
      id: "brick-h-ties",
      name: `Staggered Horizontal Tie Bars (${horizontalBarCount} pcs)`,
      orientation: "HORIZONTAL",
      lengthMm: Math.round(hSpanLengthM * 1000),
      lengthM: hSpanLengthM,
      count: horizontalBarCount,
      totalLinearM: round2(hTotalLinearM),
      unitPricePerMeter: barRatePerMeter,
      subtotalCost: hCost,
    });
  }

  // 3. Opening Collar Extrusion Framing and Hardware (IMP-MS86)
  let collarLinearMeters = 0;
  let collarPieceCount = 0;
  let collarCostTotal = 0;
  let collarRailsMetric: GrilleBarMetric | null = null;
  let collarStilesMetric: GrilleBarMetric | null = null;

  const cleatUnitPrice = 25.0; // PHP per internal corner bracket
  const cleatsPerOpening = openingConfig?.cornerCleatCountPerOpening ?? 4;
  const totalCornerCleats = resolvedOpeningCount * cleatsPerOpening;
  const cleatCostTotal = round2(totalCornerCleats * cleatUnitPrice);

  if (resolvedOpeningCount > 0) {
    const collarRailsCount = 2 * resolvedOpeningCount;
    const collarRailsLinearM = round2(collarRailsCount * cutoutWidthM);
    const collarRailsCost = round2(collarRailsLinearM * frameRatePerMeter * (1 + frameScrap));

    collarRailsMetric = {
      id: "collar-border-rails",
      name: `Handle Opening Collar Border Rails (${collarRailsCount} rails @ ${cutoutWidthMm}mm)`,
      orientation: "HORIZONTAL",
      lengthMm: cutoutWidthMm,
      lengthM: cutoutWidthM,
      count: collarRailsCount,
      totalLinearM: collarRailsLinearM,
      unitPricePerMeter: frameRatePerMeter,
      subtotalCost: collarRailsCost,
    };

    const collarStilesCount = 2 * resolvedOpeningCount;
    const collarStilesLinearM = round2(collarStilesCount * cutoutHeightM);
    const collarStilesCost = round2(collarStilesLinearM * frameRatePerMeter * (1 + frameScrap));

    collarStilesMetric = {
      id: "collar-border-stiles",
      name: `Handle Opening Collar Border Stiles (${collarStilesCount} stiles @ ${cutoutHeightMm}mm)`,
      orientation: "VERTICAL",
      lengthMm: cutoutHeightMm,
      lengthM: cutoutHeightM,
      count: collarStilesCount,
      totalLinearM: collarStilesLinearM,
      unitPricePerMeter: frameRatePerMeter,
      subtotalCost: collarStilesCost,
    };

    collarPieceCount = 4 * resolvedOpeningCount;
    collarLinearMeters = round2(collarRailsLinearM + collarStilesLinearM);
    collarCostTotal = round2(collarRailsCost + collarStilesCost);
  }

  // 4. Summaries & Final Totals
  const vPieces = vMetrics.reduce((s, m) => s + m.count, 0);
  const vLinearM = vMetrics.reduce((s, m) => s + m.totalLinearM, 0);
  const vCostTotal = vMetrics.reduce((s, m) => s + m.subtotalCost, 0);

  const hPieces = hMetrics.reduce((s, m) => s + m.count, 0);
  const hLinearM = hMetrics.reduce((s, m) => s + m.totalLinearM, 0);
  const hCostTotal = hMetrics.reduce((s, m) => s + m.subtotalCost, 0);

  const totalPieces = (perimeterDetails ? 4 : 0) + vPieces + hPieces + collarPieceCount;
  const totalLinearMeters = round2(perimeterMetersTotal + vLinearM + hLinearM + collarLinearMeters);

  // Raw material subtotal without scrap
  const netMaterialCost =
    perimeterMetersTotal * frameRatePerMeter +
    (vLinearM + hLinearM) * barRatePerMeter +
    collarLinearMeters * frameRatePerMeter +
    (totalCornerCleats * cleatUnitPrice);

  const grossMaterialCost = perimeterCostTotal + vCostTotal + hCostTotal + collarCostTotal + cleatCostTotal;
  const wasteAllowanceCost = round2(grossMaterialCost - netMaterialCost);
  const directMaterialCost = round2(grossMaterialCost);

  // Fabrication labor floor
  const computedLabor = Math.max(laborFloor, directMaterialCost * laborRate);
  const laborCost = round2(computedLabor);

  // Contractor gross margin
  const contractorMargin = round2((directMaterialCost + laborCost) * contractorMarginRate);
  const finalPrice = round2(directMaterialCost + laborCost + contractorMargin);

  // Formulate detailed itemized table
  const itemizedBreakdown: GrilleLinearBOMResult["itemizedBreakdown"] = [];

  if (perimeterDetails) {
    itemizedBreakdown.push({
      item: perimeterDetails.topRail.name,
      orientation: "PERIMETER",
      pieces: 1,
      lengthMm: perimeterDetails.topRail.lengthMm,
      totalMeters: perimeterDetails.topRail.totalLinearM,
      unitRate: frameRatePerMeter,
      subtotal: perimeterDetails.topRail.subtotalCost,
    });
    itemizedBreakdown.push({
      item: perimeterDetails.bottomRail.name,
      orientation: "PERIMETER",
      pieces: 1,
      lengthMm: perimeterDetails.bottomRail.lengthMm,
      totalMeters: perimeterDetails.bottomRail.totalLinearM,
      unitRate: frameRatePerMeter,
      subtotal: perimeterDetails.bottomRail.subtotalCost,
    });
    itemizedBreakdown.push({
      item: "Grille Frame Side Jambs (Left & Right)",
      orientation: "PERIMETER",
      pieces: 2,
      lengthMm: perimeterDetails.leftJamb.lengthMm,
      totalMeters: round2(perimeterDetails.leftJamb.totalLinearM * 2),
      unitRate: frameRatePerMeter,
      subtotal: round2(perimeterDetails.leftJamb.subtotalCost + perimeterDetails.rightJamb.subtotalCost),
    });
  }

  for (const vm of vMetrics) {
    itemizedBreakdown.push({
      item: vm.name,
      orientation: "VERTICAL",
      pieces: vm.count,
      lengthMm: vm.lengthMm,
      totalMeters: vm.totalLinearM,
      unitRate: vm.unitPricePerMeter,
      subtotal: vm.subtotalCost,
    });
  }

  for (const hm of hMetrics) {
    itemizedBreakdown.push({
      item: hm.name,
      orientation: "HORIZONTAL",
      pieces: hm.count,
      lengthMm: hm.lengthMm,
      totalMeters: hm.totalLinearM,
      unitRate: hm.unitPricePerMeter,
      subtotal: hm.subtotalCost,
    });
  }

  if (resolvedOpeningCount > 0 && collarRailsMetric && collarStilesMetric) {
    itemizedBreakdown.push({
      item: collarRailsMetric.name,
      orientation: "COLLAR",
      pieces: collarRailsMetric.count,
      lengthMm: collarRailsMetric.lengthMm,
      totalMeters: collarRailsMetric.totalLinearM,
      unitRate: collarRailsMetric.unitPricePerMeter,
      subtotal: collarRailsMetric.subtotalCost,
    });
    itemizedBreakdown.push({
      item: collarStilesMetric.name,
      orientation: "COLLAR",
      pieces: collarStilesMetric.count,
      lengthMm: collarStilesMetric.lengthMm,
      totalMeters: collarStilesMetric.totalLinearM,
      unitRate: collarStilesMetric.unitPricePerMeter,
      subtotal: collarStilesMetric.subtotalCost,
    });
    itemizedBreakdown.push({
      item: `Opening Internal Corner Cleats (${totalCornerCleats} pcs)`,
      orientation: "HARDWARE",
      pieces: totalCornerCleats,
      lengthMm: 0,
      totalMeters: 0,
      unitRate: cleatUnitPrice,
      subtotal: cleatCostTotal,
    });
  }

  const openingsImpact: GrilleOpeningBOMImpact | null = resolvedOpeningCount > 0
    ? {
      openingCount: resolvedOpeningCount,
      collarLinearMeters,
      collarPieceCount,
      interruptedPicketCount: splitPicketsCount,
      netPicketLengthDeduction: round2(splitPicketsCount * cutoutHeightM),
      cornerCleatQuantity: totalCornerCleats,
    }
    : null;

  const openingDetails = (resolvedOpeningCount > 0 && collarRailsMetric && collarStilesMetric)
    ? {
      count: resolvedOpeningCount,
      cutoutWidthMm,
      cutoutHeightMm,
      collarRailsMetric,
      collarStilesMetric,
      cornerCleatCount: totalCornerCleats,
    }
    : null;

  return {
    patternType,
    totalPieces,
    totalLinearMeters,
    directMaterialCost,
    wasteAllowanceCost,
    laborCost,
    contractorMargin,
    finalPrice,
    perimeterRails: perimeterDetails,
    verticalBars: {
      barCount: vPieces,
      cutLengthMm: vMetrics[0]?.lengthMm ?? 0,
      totalLinearM: round2(vLinearM),
      subtotalCost: round2(vCostTotal),
      details: vMetrics,
    },
    horizontalBars: {
      barCount: hPieces,
      cutLengthMm: hMetrics[0]?.lengthMm ?? 0,
      totalLinearM: round2(hLinearM),
      subtotalCost: round2(hCostTotal),
      details: hMetrics,
    },
    openings: openingsImpact,
    openingDetails,
    itemizedBreakdown,
  };
}
