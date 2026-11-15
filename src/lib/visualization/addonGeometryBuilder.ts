/**
 * Parametric Procedural 3D Add-on Generation & Pattern Repetition Engine (IMP-MS68)
 *
 * Upstream Specifications: docs/implementation/ms68.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F2, PRD-F5, PRD-F6, SDD-C4, SDD-C5, SDD-C9, DSD-UI4, DSD-UI10, QAD-TC83.1 through QAD-TC83.8
 */

import * as THREE from "three";
import { createInsectScreenMaterial, createGrillMaterial } from "./materialClassifier";
import { calculateGrilleLinearBOM } from "../pricing/grillePricingEngine";

export interface AddonGeometryConfig {
  frameWidthMm?: number; // Face width of screen/grill frame profile (default: 25mm for screen, 20mm for grill)
  frameDepthMm?: number; // Profile depth along Z-axis (default: 12mm for screen, 16mm for grill)
  grillBarWidthMm?: number; // Cross-section of repeating bars (default: 14mm)
  nominalBarPitchMm?: number; // Target spacing between grill bars (default: 140mm for standard, 230mm for Lab_Grill)
  nominalRowPitchMm?: number; // Target spacing between horizontal tie bars (default: 191mm)
  grillPatternStyle?: "staggered" | "standard"; // Architectural grille repetition pattern
  zOffsetMm?: number; // Forward offset in front of window (default: 18mm for screen, 22mm for grill)
  finishColor?: string; // Hex color for aluminum frame/bars
  mountPosition?: "front" | "rear"; // Mount placement relative to host window (default: front)
  hasHatch?: boolean; // Whether procedural screen includes a wicket access hatch
  isHatchHorizontal?: boolean; // Whether procedural screen hatch is oriented horizontally
  hatchPositions?: Array<{ x: number; y: number }>; // World or relative positions for procedural hatches
  hasGrilleOpening?: boolean; // Whether procedural grille includes handle access opening(s)
  grilleOpenings?: Array<{
    x: number;
    y: number;
    widthMm?: number;
    heightMm?: number;
    targetKey?: string;
  }>;
}

export interface GrillPatternInfo {
  verticalBarCount: number;
  horizontalBarCount: number;
  actualPitchMm: number;
  actualRowPitchMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
}

const MM_TO_METERS = 0.001;

/**
 * Computes optimal bar counts and uniform pitch for a window security grill.
 */
export function computeGrillPattern(
  widthMm: number,
  heightMm: number,
  config: AddonGeometryConfig = {},
): GrillPatternInfo {
  const frameWidthMm = config.frameWidthMm ?? 20;
  const innerWidthMm = Math.max(0, widthMm - 2 * frameWidthMm);
  const innerHeightMm = Math.max(0, heightMm - 2 * frameWidthMm);
  const nominalPitchMm = config.nominalBarPitchMm ?? 140;

  const verticalBarCount = innerWidthMm > 0 ? Math.max(1, Math.floor(innerWidthMm / nominalPitchMm)) : 0;
  const actualPitchMm = verticalBarCount > 0 ? innerWidthMm / (verticalBarCount + 1) : 0;

  const horizontalBarCount = heightMm > 1000 ? Math.max(1, Math.floor(heightMm / 800)) : 0;
  const actualRowPitchMm = horizontalBarCount > 0 ? innerHeightMm / (horizontalBarCount + 1) : 0;

  return {
    verticalBarCount,
    horizontalBarCount,
    actualPitchMm,
    actualRowPitchMm,
    innerWidthMm,
    innerHeightMm,
  };
}

/**
 * Procedurally generates an extruded 4-sided aluminum screen frame
 * with an interior insect wire mesh infill plane.
 */
export function buildParametricScreenGroup(
  widthMm: number,
  heightMm: number,
  config: AddonGeometryConfig = {},
  frameMaterial?: THREE.Material,
  meshMaterial?: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "Addon_Screen_Assembly";

  const frameWidth = (config.frameWidthMm ?? 25) * MM_TO_METERS;
  const frameDepth = (config.frameDepthMm ?? 12) * MM_TO_METERS;
  const zOffset = Number(((config.zOffsetMm ?? 18) * MM_TO_METERS).toFixed(6));

  const widthM = widthMm * MM_TO_METERS;
  const heightM = heightMm * MM_TO_METERS;

  const resolvedFrameMat = frameMaterial ?? new THREE.MeshStandardMaterial({
    color: config.finishColor ?? "#221d1a",
    roughness: 0.4,
    metalness: 0.5,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
  });

  // 1. Outer Frame Extrusions (Top, Bottom, Left, Right rails)
  const topRailGeo = new THREE.BoxGeometry(widthM, frameWidth, frameDepth);
  const topRail = new THREE.Mesh(topRailGeo, resolvedFrameMat);
  topRail.name = "Screen_Frame_Top";
  topRail.position.set(0, heightM / 2 - frameWidth / 2, zOffset);
  topRail.castShadow = true;
  topRail.receiveShadow = true;
  topRail.renderOrder = 0;
  topRail.userData.preserveMaterial = true;
  topRail.userData.presentationCategory = "Framing";
  topRail.userData.isAddon = true;
  topRail.userData.addonType = "screen";

  const bottomRailGeo = new THREE.BoxGeometry(widthM, frameWidth, frameDepth);
  const bottomRail = new THREE.Mesh(bottomRailGeo, resolvedFrameMat);
  bottomRail.name = "Screen_Frame_Bottom";
  bottomRail.position.set(0, -heightM / 2 + frameWidth / 2, zOffset);
  bottomRail.castShadow = true;
  bottomRail.receiveShadow = true;
  bottomRail.renderOrder = 0;
  bottomRail.userData.preserveMaterial = true;
  bottomRail.userData.presentationCategory = "Framing";
  bottomRail.userData.isAddon = true;
  bottomRail.userData.addonType = "screen";

  const innerHeightM = Math.max(0, heightM - 2 * frameWidth);
  const sideJambGeo = new THREE.BoxGeometry(frameWidth, innerHeightM, frameDepth);

  const leftJamb = new THREE.Mesh(sideJambGeo, resolvedFrameMat);
  leftJamb.name = "Screen_Frame_Left";
  leftJamb.position.set(-widthM / 2 + frameWidth / 2, 0, zOffset);
  leftJamb.castShadow = true;
  leftJamb.receiveShadow = true;
  leftJamb.renderOrder = 0;
  leftJamb.userData.preserveMaterial = true;
  leftJamb.userData.presentationCategory = "Framing";
  leftJamb.userData.isAddon = true;
  leftJamb.userData.addonType = "screen";

  const rightJamb = new THREE.Mesh(sideJambGeo, resolvedFrameMat);
  rightJamb.name = "Screen_Frame_Right";
  rightJamb.position.set(widthM / 2 - frameWidth / 2, 0, zOffset);
  rightJamb.castShadow = true;
  rightJamb.receiveShadow = true;
  rightJamb.renderOrder = 0;
  rightJamb.userData.preserveMaterial = true;
  rightJamb.userData.presentationCategory = "Framing";
  rightJamb.userData.isAddon = true;
  rightJamb.userData.addonType = "screen";

  group.add(topRail, bottomRail, leftJamb, rightJamb);

  // 2. Interior Wire Mesh Plane (fills frame opening)
  const innerWidthM = Math.max(0, widthM - 2 * frameWidth);
  if (innerWidthM > 0 && innerHeightM > 0) {
    const meshPlaneGeo = new THREE.PlaneGeometry(innerWidthM, innerHeightM);
    const tailoredMeshMat = meshMaterial ?? createInsectScreenMaterial(innerWidthM * 1000, innerHeightM * 1000);
    const meshPlane = new THREE.Mesh(meshPlaneGeo, tailoredMeshMat);
    meshPlane.name = "Screen_Mesh_Infill";
    meshPlane.renderOrder = 0;
    meshPlane.userData.preserveMaterial = true;
    meshPlane.userData.isScreenMesh = true;
    meshPlane.userData.presentationCategory = "Hardware";
    meshPlane.position.set(0, 0, zOffset);
    group.add(meshPlane);
  }

  // 3. Optional Procedural Wicket Access Hatch (IMP-MS80)
  if (config.hasHatch && innerWidthM > 0.25 && innerHeightM > 0.25) {
    const isHorizontal = Boolean(config.isHatchHorizontal);
    const hatchW = isHorizontal ? 0.28 : 0.18;
    const hatchH = isHorizontal ? 0.16 : 0.26;
    const hatchBorderW = 0.015;
    const hatchDepth = frameDepth * 0.9;
    const hatchGroup = new THREE.Group();
    hatchGroup.name = "Screen_Access_Hatch_Procedural";
    hatchGroup.userData.componentKey = "screen_access_hatch";
    hatchGroup.userData.componentName = "Screen Access Hatch";
    hatchGroup.userData.isAddon = true;
    hatchGroup.userData.isHatchClone = true;
    hatchGroup.userData.isHorizontalHatch = isHorizontal;
    hatchGroup.userData.presentationCategory = "Hardware";

    // Sub-frame extrusion rails for hatch opening
    const hTop = new THREE.Mesh(new THREE.BoxGeometry(hatchW, hatchBorderW, hatchDepth), resolvedFrameMat);
    hTop.name = "Screen_Access_Hatch_Top";
    hTop.position.set(0, hatchH / 2 - hatchBorderW / 2, 0);
    const hBot = new THREE.Mesh(new THREE.BoxGeometry(hatchW, hatchBorderW, hatchDepth), resolvedFrameMat);
    hBot.name = "Screen_Access_Hatch_Bottom";
    hBot.position.set(0, -hatchH / 2 + hatchBorderW / 2, 0);
    const hLeft = new THREE.Mesh(new THREE.BoxGeometry(hatchBorderW, hatchH - 2 * hatchBorderW, hatchDepth), resolvedFrameMat);
    hLeft.name = "Screen_Access_Hatch_Left";
    hLeft.position.set(-hatchW / 2 + hatchBorderW / 2, 0, 0);
    const hRight = new THREE.Mesh(new THREE.BoxGeometry(hatchBorderW, hatchH - 2 * hatchBorderW, hatchDepth), resolvedFrameMat);
    hRight.name = "Screen_Access_Hatch_Right";
    hRight.position.set(hatchW / 2 - hatchBorderW / 2, 0, 0);

    // Hatch latch hardware knob: placed at top center when horizontal, or side center when vertical
    const latchMesh = isHorizontal
      ? new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.015), resolvedFrameMat)
      : new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.015), resolvedFrameMat);
    latchMesh.name = "Screen_Access_Hatch_Latch";
    if (isHorizontal) {
      latchMesh.position.set(0, hatchH / 2 - hatchBorderW - 0.015, 0.006);
    } else {
      latchMesh.position.set(hatchW / 2 - hatchBorderW - 0.015, 0, 0.006);
    }

    hatchGroup.add(hTop, hBot, hLeft, hRight, latchMesh);
    hatchGroup.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        c.renderOrder = 0;
        c.userData.preserveMaterial = true;
        c.userData.isAddon = true;
        c.userData.addonType = "screen";
        c.userData.presentationCategory = c === latchMesh ? "Hardware" : "Framing";
      }
    });

    const positions = (config.hatchPositions && config.hatchPositions.length > 0)
      ? config.hatchPositions
      : [{ x: isHorizontal ? 0 : (innerWidthM / 2 - hatchW / 2 - 0.03), y: -innerHeightM / 2 + hatchH / 2 + 0.02 }];

    positions.forEach((pos, idx) => {
      const hGroup = hatchGroup.clone(true);
      hGroup.name = `Screen_Access_Hatch_Procedural_${idx}`;
      hGroup.userData = {
        ...hatchGroup.userData,
        hatchIndex: idx,
      };

      const minX = -innerWidthM / 2 + hatchW / 2 + 0.01;
      const maxX = innerWidthM / 2 - hatchW / 2 - 0.01;
      const minY = -innerHeightM / 2 + hatchH / 2 + 0.01;
      const maxY = innerHeightM / 2 - hatchH / 2 - 0.01;

      const posX = Math.max(minX, Math.min(maxX, pos.x));
      const posY = Math.max(minY, Math.min(maxY, pos.y));

      hGroup.position.set(posX, posY, zOffset + 0.002);
      group.add(hGroup);
    });
  }

  group.userData.addonType = "screen";
  group.userData.widthMm = widthMm;
  group.userData.heightMm = heightMm;
  group.userData.zOffsetMm = zOffset / MM_TO_METERS;

  return group;
}

/**
 * Procedurally generates a repeating window security grill middle bar pattern
 * across the specified inner aperture, preserving constant 14mm bar cross-sections
 * and dynamically repeating vertical bars and staggered horizontal tie bars without stretching.
 */
export function buildDynamicGrillPatternGroup(
  innerWidthM: number,
  innerHeightM: number,
  config: AddonGeometryConfig = {},
  grillMaterial?: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "Grill_Middle_Bars_Assembly";

  const barWidth = (config.grillBarWidthMm ?? 14) * MM_TO_METERS;
  const barDepth = (config.frameDepthMm ?? 14) * MM_TO_METERS;
  const zOffset = Number(((config.zOffsetMm ?? 22) * MM_TO_METERS).toFixed(6));
  const nominalPitchMm = config.nominalBarPitchMm ?? 140;
  const nominalRowPitchMm = config.nominalRowPitchMm ?? 191;

  const resolvedGrillMat = grillMaterial ?? createGrillMaterial(config.finishColor);

  const innerWidthMm = innerWidthM / MM_TO_METERS;
  const innerHeightMm = innerHeightM / MM_TO_METERS;

  // Precompute rectangular cutout boundary boxes for picket clipping (IMP-MS86)
  const openings = (config.grilleOpenings || []).map((op) => {
    const wM = (op.widthMm ?? 150) * MM_TO_METERS;
    const hM = (op.heightMm ?? 180) * MM_TO_METERS;
    return {
      minX: op.x - wM / 2,
      maxX: op.x + wM / 2,
      minY: op.y - hM / 2,
      maxY: op.y + hM / 2,
      x: op.x,
      y: op.y,
      wM,
      hM,
    };
  });

  // 1. Dynamic Vertical Bars (maintaining constant cross section and uniform spacing)
  const colCount = innerWidthMm > 0 ? Math.max(1, Math.floor(innerWidthMm / nominalPitchMm)) : 0;
  const actualPitchM = colCount > 0 ? innerWidthM / (colCount + 1) : 0;

  if (colCount > 0 && innerHeightM > 0) {
    const vBarGeo = new THREE.BoxGeometry(barWidth, innerHeightM, barDepth);
    for (let i = 1; i <= colCount; i++) {
      const xPos = -innerWidthM / 2 + i * actualPitchM;
      // Check if xPos falls inside any clearance opening's lateral span
      const intersectingOpening = openings.find(
        (op) => xPos >= op.minX && xPos <= op.maxX
      );

      if (!intersectingOpening) {
        // Continuous uninterrupted picket spanning full inner height
        const vBar = new THREE.Mesh(vBarGeo, resolvedGrillMat);
        vBar.name = `Grill_Bar_V_${i}`;
        vBar.position.set(xPos, 0, zOffset);
        vBar.castShadow = true;
        vBar.receiveShadow = true;
        vBar.renderOrder = 0;
        vBar.userData.preserveMaterial = true;
        vBar.userData.presentationCategory = "Framing";
        vBar.userData.isAddon = true;
        vBar.userData.addonType = "grill";
        group.add(vBar);
      } else {
        // Interrupted picket: clipped into discrete lower and upper segments (IMP-MS86, QAD-TC101.4)
        // Lower Segment: bottom frame rail to bottom collar rail
        const lowerH = Math.max(0.005, intersectingOpening.minY - (-innerHeightM / 2));
        const lowerCenterY = (-innerHeightM / 2 + intersectingOpening.minY) / 2;
        const lowerGeo = new THREE.BoxGeometry(barWidth, lowerH, barDepth);
        const lowerMesh = new THREE.Mesh(lowerGeo, resolvedGrillMat);
        lowerMesh.name = `Grill_Bar_V_${i}_Lower`;
        lowerMesh.position.set(xPos, lowerCenterY, zOffset);
        lowerMesh.castShadow = true;
        lowerMesh.receiveShadow = true;
        lowerMesh.renderOrder = 0;
        lowerMesh.userData.preserveMaterial = true;
        lowerMesh.userData.presentationCategory = "Framing";
        lowerMesh.userData.isAddon = true;
        lowerMesh.userData.addonType = "grill";
        lowerMesh.userData.isInterruptedSegment = true;
        group.add(lowerMesh);

        // Upper Segment: top collar rail to top frame rail
        const upperH = Math.max(0.005, innerHeightM / 2 - intersectingOpening.maxY);
        const upperCenterY = (intersectingOpening.maxY + innerHeightM / 2) / 2;
        const upperGeo = new THREE.BoxGeometry(barWidth, upperH, barDepth);
        const upperMesh = new THREE.Mesh(upperGeo, resolvedGrillMat);
        upperMesh.name = `Grill_Bar_V_${i}_Upper`;
        upperMesh.position.set(xPos, upperCenterY, zOffset);
        upperMesh.castShadow = true;
        upperMesh.receiveShadow = true;
        upperMesh.renderOrder = 0;
        upperMesh.userData.preserveMaterial = true;
        upperMesh.userData.presentationCategory = "Framing";
        upperMesh.userData.isAddon = true;
        upperMesh.userData.addonType = "grill";
        upperMesh.userData.isInterruptedSegment = true;
        group.add(upperMesh);
      }
    }
  }

  // 2. Dynamic Horizontal Tie Bars (Alternating Staggered Pattern matching Lab_Grill_Middle_Bars.glb)
  const totalCols = colCount + 1;
  const numLevels = Math.max(2, Math.round(innerHeightMm / nominalRowPitchMm));
  const actualRowPitchM = innerHeightM / numLevels;

  let horizontalBarCount = 0;
  for (let c = 0; c < totalCols; c++) {
    const colCenterX = -innerWidthM / 2 + (c + 0.5) * actualPitchM;
    const colSpan = actualPitchM;

    for (let lvl = 1; lvl < numLevels; lvl++) {
      // Stagger condition: even columns at even levels, odd columns at odd levels
      if ((c + lvl) % 2 === 0) {
        const yPos = -innerHeightM / 2 + lvl * actualRowPitchM;
        const tieMinX = colCenterX - colSpan / 2;
        const tieMaxX = colCenterX + colSpan / 2;

        // Skip horizontal tie bar if it intersects the empty interior of any opening
        const isInsideOpening = openings.some(
          (op) => yPos >= op.minY && yPos <= op.maxY && tieMinX < op.maxX && tieMaxX > op.minX
        );

        if (!isInsideOpening) {
          horizontalBarCount++;
          const hBarGeo = new THREE.BoxGeometry(colSpan, barWidth, barDepth);
          const hBar = new THREE.Mesh(hBarGeo, resolvedGrillMat);
          hBar.name = `Grill_Bar_H_${c}_${lvl}`;
          hBar.position.set(colCenterX, yPos, zOffset);
          hBar.castShadow = true;
          hBar.receiveShadow = true;
          hBar.renderOrder = 0;
          hBar.userData.preserveMaterial = true;
          hBar.userData.presentationCategory = "Framing";
          hBar.userData.isAddon = true;
          hBar.userData.addonType = "grill";
          group.add(hBar);
        }
      }
    }
  }

  group.userData.addonType = "grill";
  group.userData.isAddon = true;
  group.userData.verticalBarCount = colCount;
  group.userData.horizontalBarCount = horizontalBarCount;
  group.userData.colPitchMm = actualPitchM / MM_TO_METERS;
  group.userData.rowPitchMm = actualRowPitchM / MM_TO_METERS;
  group.userData.zOffsetMm = zOffset / MM_TO_METERS;

  return group;
}

/**
 * Procedurally generates a security window grill with an outer perimeter
 * and repeating vertical/horizontal bars spanning dynamic dimensions.
 */
export function buildParametricGrillGroup(
  widthMm: number,
  heightMm: number,
  config: AddonGeometryConfig = {},
  grillMaterial?: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "Addon_Grill_Assembly";

  const frameWidth = (config.frameWidthMm ?? 20) * MM_TO_METERS;
  const frameDepth = (config.frameDepthMm ?? 16) * MM_TO_METERS;
  const zOffset = Number(((config.zOffsetMm ?? 22) * MM_TO_METERS).toFixed(6));

  const widthM = widthMm * MM_TO_METERS;
  const heightM = heightMm * MM_TO_METERS;

  const resolvedGrillMat = grillMaterial ?? createGrillMaterial(config.finishColor);

  // 1. Perimeter Frame (Matches window outer dimensions)
  const topGeo = new THREE.BoxGeometry(widthM, frameWidth, frameDepth);
  const topMesh = new THREE.Mesh(topGeo, resolvedGrillMat);
  topMesh.name = "Grill_Frame_Top";
  topMesh.position.set(0, heightM / 2 - frameWidth / 2, zOffset);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  topMesh.renderOrder = 0;
  topMesh.userData.preserveMaterial = true;
  topMesh.userData.presentationCategory = "Framing";
  topMesh.userData.isAddon = true;
  topMesh.userData.addonType = "grill";

  const bottomMesh = new THREE.Mesh(topGeo, resolvedGrillMat);
  bottomMesh.name = "Grill_Frame_Bottom";
  bottomMesh.position.set(0, -heightM / 2 + frameWidth / 2, zOffset);
  bottomMesh.castShadow = true;
  bottomMesh.receiveShadow = true;
  bottomMesh.renderOrder = 0;
  bottomMesh.userData.preserveMaterial = true;
  bottomMesh.userData.presentationCategory = "Framing";
  bottomMesh.userData.isAddon = true;
  bottomMesh.userData.addonType = "grill";

  const innerHeightM = Math.max(0, heightM - 2 * frameWidth);
  const sideGeo = new THREE.BoxGeometry(frameWidth, innerHeightM, frameDepth);

  const leftMesh = new THREE.Mesh(sideGeo, resolvedGrillMat);
  leftMesh.name = "Grill_Frame_Left";
  leftMesh.position.set(-widthM / 2 + frameWidth / 2, 0, zOffset);
  leftMesh.castShadow = true;
  leftMesh.receiveShadow = true;
  leftMesh.renderOrder = 0;
  leftMesh.userData.preserveMaterial = true;
  leftMesh.userData.presentationCategory = "Framing";
  leftMesh.userData.isAddon = true;
  leftMesh.userData.addonType = "grill";

  const rightMesh = new THREE.Mesh(sideGeo, resolvedGrillMat);
  rightMesh.name = "Grill_Frame_Right";
  rightMesh.position.set(widthM / 2 - frameWidth / 2, 0, zOffset);
  rightMesh.castShadow = true;
  rightMesh.receiveShadow = true;
  rightMesh.renderOrder = 0;
  rightMesh.userData.preserveMaterial = true;
  rightMesh.userData.presentationCategory = "Framing";
  rightMesh.userData.isAddon = true;
  rightMesh.userData.addonType = "grill";

  group.add(topMesh, bottomMesh, leftMesh, rightMesh);

  // 2. Dynamic Pattern Repetition Engine: Middle Bars
  const innerWidthM = Math.max(0, widthM - 2 * frameWidth);
  const patternGroup = buildDynamicGrillPatternGroup(
    innerWidthM,
    innerHeightM,
    config,
    resolvedGrillMat,
  );
  group.add(patternGroup);

  // 3. Opening Clearance Collars (IMP-MS86)
  if (config.grilleOpenings && config.grilleOpenings.length > 0) {
    const barWidth = (config.grillBarWidthMm ?? 14) * MM_TO_METERS;
    const barDepth = (config.frameDepthMm ?? 16) * MM_TO_METERS;

    config.grilleOpenings.forEach((op, idx) => {
      const wM = (op.widthMm ?? 150) * MM_TO_METERS;
      const hM = (op.heightMm ?? 180) * MM_TO_METERS;
      const minX = op.x - wM / 2;
      const maxX = op.x + wM / 2;
      const minY = op.y - hM / 2;
      const maxY = op.y + hM / 2;

      const collarGroup = new THREE.Group();
      collarGroup.name = `Grille_Opening_Collar_${idx}`;
      collarGroup.userData.isAddon = true;
      collarGroup.userData.addonType = "grill";
      collarGroup.userData.isOpenClearance = true;
      collarGroup.userData.openingIndex = idx;
      collarGroup.userData.targetKey = op.targetKey;
      collarGroup.userData.presentationCategory = "Framing";

      const cBot = new THREE.Mesh(new THREE.BoxGeometry(wM, barWidth, barDepth), resolvedGrillMat);
      cBot.name = `Grille_Opening_Collar_Bottom_${idx}`;
      cBot.position.set(op.x, minY + barWidth / 2, zOffset);

      const cTop = new THREE.Mesh(new THREE.BoxGeometry(wM, barWidth, barDepth), resolvedGrillMat);
      cTop.name = `Grille_Opening_Collar_Top_${idx}`;
      cTop.position.set(op.x, maxY - barWidth / 2, zOffset);

      const sideH = Math.max(0.005, hM - 2 * barWidth);
      const cLeft = new THREE.Mesh(new THREE.BoxGeometry(barWidth, sideH, barDepth), resolvedGrillMat);
      cLeft.name = `Grille_Opening_Collar_Left_${idx}`;
      cLeft.position.set(minX + barWidth / 2, op.y, zOffset);

      const cRight = new THREE.Mesh(new THREE.BoxGeometry(barWidth, sideH, barDepth), resolvedGrillMat);
      cRight.name = `Grille_Opening_Collar_Right_${idx}`;
      cRight.position.set(maxX - barWidth / 2, op.y, zOffset);

      collarGroup.add(cBot, cTop, cLeft, cRight);
      collarGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.renderOrder = 0;
          child.userData.preserveMaterial = true;
          child.userData.presentationCategory = "Framing";
          child.userData.isAddon = true;
          child.userData.addonType = "grill";
        }
      });
      group.add(collarGroup);
    });
  }

  group.userData.addonType = "grill";
  group.userData.widthMm = widthMm;
  group.userData.heightMm = heightMm;
  group.userData.verticalBarCount = patternGroup.userData.verticalBarCount;
  group.userData.horizontalBarCount = patternGroup.userData.horizontalBarCount;
  group.userData.pitchMm = patternGroup.userData.colPitchMm;
  group.userData.zOffsetMm = zOffset / MM_TO_METERS;
  group.userData.grilleBOM = calculateGrilleLinearBOM({
    widthMm,
    heightMm,
    patternType: "staggered_brick",
    nominalPitchColMm: config.nominalBarPitchMm ?? 140,
    nominalPitchRowMm: config.nominalRowPitchMm ?? 191,
    includePerimeterFrame: true,
    openingCount: config.grilleOpenings?.length ?? 0,
    openingWidthMm: config.grilleOpenings?.[0]?.widthMm ?? 150,
    openingHeightMm: config.grilleOpenings?.[0]?.heightMm ?? 180,
    openingTargetKeys: config.grilleOpenings?.map((o) => o.targetKey).filter(Boolean) as string[],
    openingConfig: {
      enabled: (config.grilleOpenings?.length ?? 0) > 0,
      cutoutWidthMm: config.grilleOpenings?.[0]?.widthMm ?? 150,
      cutoutHeightMm: config.grilleOpenings?.[0]?.heightMm ?? 180,
      cornerCleatCountPerOpening: 4,
    },
    grilleRawMaterial: {
      id: "default-grille-mat",
      material_code: "AL-GRILLE-TUBE-16MM",
      description: "16mm Square Tube Aluminum",
      unit_price: 160,
      waste_allowance: 0.12,
    },
  });

  return group;
}

export interface GrilleOpeningBoundary {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ClippedVertex {
  pos: THREE.Vector3;
  norm?: THREE.Vector3;
  uv?: THREE.Vector2;
}

interface ClippedTriangle {
  v0: ClippedVertex;
  v1: ClippedVertex;
  v2: ClippedVertex;
}

function clipTriangleHalfSpace(
  tri: ClippedTriangle,
  nx: number,
  ny: number,
  nz: number,
  d: number,
): ClippedTriangle[] {
  // Plane equation: nx*x + ny*y + nz*z + d >= 0 is inside (kept)
  const d0 = nx * tri.v0.pos.x + ny * tri.v0.pos.y + nz * tri.v0.pos.z + d;
  const d1 = nx * tri.v1.pos.x + ny * tri.v1.pos.y + nz * tri.v1.pos.z + d;
  const d2 = nx * tri.v2.pos.x + ny * tri.v2.pos.y + nz * tri.v2.pos.z + d;

  const in0 = d0 >= -1e-6;
  const in1 = d1 >= -1e-6;
  const in2 = d2 >= -1e-6;

  const inCount = (in0 ? 1 : 0) + (in1 ? 1 : 0) + (in2 ? 1 : 0);

  if (inCount === 3) {
    return [tri];
  }
  if (inCount === 0) {
    return [];
  }

  function lerpVertex(va: ClippedVertex, vb: ClippedVertex, da: number, db: number): ClippedVertex {
    const denom = da - db;
    const t = Math.abs(denom) > 1e-12 ? Math.max(0, Math.min(1, da / denom)) : 0;
    const pos = new THREE.Vector3().lerpVectors(va.pos, vb.pos, t);
    let norm: THREE.Vector3 | undefined = undefined;
    if (va.norm && vb.norm) {
      norm = new THREE.Vector3().lerpVectors(va.norm, vb.norm, t).normalize();
    }
    let uv: THREE.Vector2 | undefined = undefined;
    if (va.uv && vb.uv) {
      uv = new THREE.Vector2().lerpVectors(va.uv, vb.uv, t);
    }
    return { pos, norm, uv };
  }

  if (inCount === 1) {
    let vIn: ClippedVertex, vOut1: ClippedVertex, vOut2: ClippedVertex;
    let dIn: number, dOut1: number, dOut2: number;

    if (in0) {
      vIn = tri.v0; dIn = d0;
      vOut1 = tri.v1; dOut1 = d1;
      vOut2 = tri.v2; dOut2 = d2;
    } else if (in1) {
      vIn = tri.v1; dIn = d1;
      vOut1 = tri.v2; dOut1 = d2;
      vOut2 = tri.v0; dOut2 = d0;
    } else {
      vIn = tri.v2; dIn = d2;
      vOut1 = tri.v0; dOut1 = d0;
      vOut2 = tri.v1; dOut2 = d1;
    }

    const p1 = lerpVertex(vIn, vOut1, dIn, dOut1);
    const p2 = lerpVertex(vIn, vOut2, dIn, dOut2);

    return [{ v0: vIn, v1: p1, v2: p2 }];
  }

  if (inCount === 2) {
    let vIn1: ClippedVertex, vIn2: ClippedVertex, vOut: ClippedVertex;
    let dIn1: number, dIn2: number, dOut: number;

    if (!in0) {
      vOut = tri.v0; dOut = d0;
      vIn1 = tri.v1; dIn1 = d1;
      vIn2 = tri.v2; dIn2 = d2;
    } else if (!in1) {
      vOut = tri.v1; dOut = d1;
      vIn1 = tri.v2; dIn1 = d2;
      vIn2 = tri.v0; dIn2 = d0;
    } else {
      vOut = tri.v2; dOut = d2;
      vIn1 = tri.v0; dIn1 = d0;
      vIn2 = tri.v1; dIn2 = d1;
    }

    const p1 = lerpVertex(vIn1, vOut, dIn1, dOut);
    const p2 = lerpVertex(vIn2, vOut, dIn2, dOut);

    return [
      { v0: vIn1, v1: vIn2, v2: p2 },
      { v0: vIn1, v1: p2, v2: p1 },
    ];
  }

  return [];
}

function isDegenerateTriangle(tri: ClippedTriangle): boolean {
  const ab = new THREE.Vector3().subVectors(tri.v1.pos, tri.v0.pos);
  const ac = new THREE.Vector3().subVectors(tri.v2.pos, tri.v0.pos);
  const cross = new THREE.Vector3().crossVectors(ab, ac);
  return cross.lengthSq() < 1e-12;
}

function clipTrianglesAgainstOpening(
  inputTris: ClippedTriangle[],
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): ClippedTriangle[] {
  const result: ClippedTriangle[] = [];

  for (const tri of inputTris) {
    const tMinX = Math.min(tri.v0.pos.x, tri.v1.pos.x, tri.v2.pos.x);
    const tMaxX = Math.max(tri.v0.pos.x, tri.v1.pos.x, tri.v2.pos.x);
    const tMinY = Math.min(tri.v0.pos.y, tri.v1.pos.y, tri.v2.pos.y);
    const tMaxY = Math.max(tri.v0.pos.y, tri.v1.pos.y, tri.v2.pos.y);

    // Fast reject: if triangle bounding box doesn't overlap opening, keep triangle untouched
    if (tMaxX <= x0 || tMinX >= x1 || tMaxY <= y0 || tMinY >= y1) {
      result.push(tri);
      continue;
    }

    // 1. Portion below opening: y <= y0
    const bottom = clipTriangleHalfSpace(tri, 0, -1, 0, y0);
    for (const b of bottom) {
      if (!isDegenerateTriangle(b)) result.push(b);
    }

    // 2. Portion above opening: y >= y1
    const top = clipTriangleHalfSpace(tri, 0, 1, 0, -y1);
    for (const t of top) {
      if (!isDegenerateTriangle(t)) result.push(t);
    }

    // 3. Middle vertical band: y0 < y < y1
    const midYGeY0 = clipTriangleHalfSpace(tri, 0, 1, 0, -y0);
    const midY: ClippedTriangle[] = [];
    for (const m of midYGeY0) {
      midY.push(...clipTriangleHalfSpace(m, 0, -1, 0, y1));
    }

    // From midY, keep portion to the left (x <= x0) and portion to the right (x >= x1)
    for (const m of midY) {
      const left = clipTriangleHalfSpace(m, -1, 0, 0, x0);
      for (const l of left) {
        if (!isDegenerateTriangle(l)) result.push(l);
      }

      const right = clipTriangleHalfSpace(m, 1, 0, 0, -x1);
      for (const r of right) {
        if (!isDegenerateTriangle(r)) result.push(r);
      }
    }
  }

  return result;
}

/**
 * Clips any grille assembly geometry intersecting rectangular handle clearance openings.
 * Operates in group coordinate space, cutting clean rectangular voids through intersecting bars
 * while preserving all geometry outside the opening bounds.
 */
export function clipGrilleAssemblyOpenings(
  group: THREE.Group | THREE.Object3D,
  openings: Array<{
    x: number;
    y: number;
    widthMm?: number;
    heightMm?: number;
    minX?: number;
    maxX?: number;
    minY?: number;
    maxY?: number;
  }>,
): void {
  if (!openings || openings.length === 0) return;

  const bounds: GrilleOpeningBoundary[] = openings.map((op) => {
    const wM = (op.widthMm ?? 150) * MM_TO_METERS;
    const hM = (op.heightMm ?? 180) * MM_TO_METERS;
    const minX = op.minX ?? (op.x - wM / 2);
    const maxX = op.maxX ?? (op.x + wM / 2);
    const minY = op.minY ?? (op.y - hM / 2);
    const maxY = op.maxY ?? (op.y + hM / 2);
    return { minX, maxX, minY, maxY };
  });

  group.updateMatrixWorld(true);
  const groupInvWorld = group.matrixWorld.clone().invert();

  const targetMeshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      if (
        child.name.startsWith("Grille_Opening_Collar_") ||
        child.name.startsWith("Grill_Opening_Collar_") ||
        child.userData?.isOpenClearance === true
      ) {
        return;
      }
      targetMeshes.push(child);
    }
  });

  for (const mesh of targetMeshes) {
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const origBox = geo.boundingBox;
    if (!origBox) continue;

    mesh.updateMatrixWorld(true);
    const meshToGroup = new THREE.Matrix4().multiplyMatrices(groupInvWorld, mesh.matrixWorld);
    const groupToMesh = meshToGroup.clone().invert();

    const boxInGroup = origBox.clone().applyMatrix4(meshToGroup);
    const overlapsAny = bounds.some((op) =>
      boxInGroup.min.x < op.maxX &&
      boxInGroup.max.x > op.minX &&
      boxInGroup.min.y < op.maxY &&
      boxInGroup.max.y > op.minY
    );
    if (!overlapsAny) continue;

    const posAttr = geo.attributes.position;
    if (!posAttr || posAttr.count === 0) continue;
    const normAttr = geo.attributes.normal as THREE.BufferAttribute | undefined;
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;

    const indices: number[] = geo.index
      ? Array.from(geo.index.array)
      : Array.from({ length: posAttr.count }, (_, i) => i);

    const triCount = Math.floor(indices.length / 3);
    if (triCount === 0) continue;

    function getVertexInGroup(vi: number): ClippedVertex {
      const p = new THREE.Vector3().fromBufferAttribute(posAttr, vi).applyMatrix4(meshToGroup);
      let norm: THREE.Vector3 | undefined = undefined;
      if (normAttr) {
        norm = new THREE.Vector3().fromBufferAttribute(normAttr, vi).transformDirection(meshToGroup).normalize();
      }
      let uv: THREE.Vector2 | undefined = undefined;
      if (uvAttr) {
        uv = new THREE.Vector2().fromBufferAttribute(uvAttr, vi);
      }
      return { pos: p, norm, uv };
    }

    let currentTriangles: ClippedTriangle[] = [];
    for (let t = 0; t < triCount; t++) {
      currentTriangles.push({
        v0: getVertexInGroup(indices[t * 3]),
        v1: getVertexInGroup(indices[t * 3 + 1]),
        v2: getVertexInGroup(indices[t * 3 + 2]),
      });
    }

    for (const op of bounds) {
      if (currentTriangles.length === 0) break;
      currentTriangles = clipTrianglesAgainstOpening(currentTriangles, op.minX, op.maxX, op.minY, op.maxY);
    }

    // Transform resulting triangles back to mesh local coordinate space
    if (currentTriangles.length === 0) {
      mesh.geometry.dispose();
      mesh.parent?.remove(mesh);
      continue;
    }

    // Partition remaining triangles into connected spatial components so severed bars
    // form independent meshes with disjoint, accurate bounding boxes
    const triTotal = currentTriangles.length;
    const parent = new Int32Array(triTotal);
    for (let i = 0; i < triTotal; i++) parent[i] = i;

    function findRoot(i: number): number {
      let root = i;
      while (root !== parent[root]) root = parent[root];
      let curr = i;
      while (curr !== root) {
        const next = parent[curr];
        parent[curr] = root;
        curr = next;
      }
      return root;
    }

    function unionTri(i: number, j: number) {
      const rootI = findRoot(i);
      const rootJ = findRoot(j);
      if (rootI !== rootJ) parent[rootI] = rootJ;
    }

    const vHash = new Map<string, number>();
    for (let t = 0; t < triTotal; t++) {
      const tri = currentTriangles[t];
      const verts = [tri.v0.pos, tri.v1.pos, tri.v2.pos];
      for (const v of verts) {
        const key = `${Math.round(v.x * 1000)},${Math.round(v.y * 1000)},${Math.round(v.z * 1000)}`;
        const prev = vHash.get(key);
        if (prev !== undefined) {
          unionTri(t, prev);
        } else {
          vHash.set(key, t);
        }
      }
    }

    const clusters = new Map<number, ClippedTriangle[]>();
    for (let t = 0; t < triTotal; t++) {
      const r = findRoot(t);
      let list = clusters.get(r);
      if (!list) {
        list = [];
        clusters.set(r, list);
      }
      list.push(currentTriangles[t]);
    }

    function buildGeometry(tris: ClippedTriangle[]): THREE.BufferGeometry {
      const positions = new Float32Array(tris.length * 9);
      const normals = normAttr ? new Float32Array(tris.length * 9) : null;
      const uvs = uvAttr ? new Float32Array(tris.length * 6) : null;

      let pIdx = 0;
      let nIdx = 0;
      let uIdx = 0;

      for (const tri of tris) {
        const verts = [tri.v0, tri.v1, tri.v2];
        for (const v of verts) {
          const localPos = v.pos.clone().applyMatrix4(groupToMesh);
          positions[pIdx++] = localPos.x;
          positions[pIdx++] = localPos.y;
          positions[pIdx++] = localPos.z;

          if (normals) {
            if (v.norm) {
              const localNorm = v.norm.clone().transformDirection(groupToMesh).normalize();
              normals[nIdx++] = localNorm.x;
              normals[nIdx++] = localNorm.y;
              normals[nIdx++] = localNorm.z;
            } else {
              normals[nIdx++] = 0;
              normals[nIdx++] = 0;
              normals[nIdx++] = 1;
            }
          }

          if (uvs) {
            if (v.uv) {
              uvs[uIdx++] = v.uv.x;
              uvs[uIdx++] = v.uv.y;
            } else {
              uvs[uIdx++] = 0;
              uvs[uIdx++] = 0;
            }
          }
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      if (normals) {
        geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      } else {
        geom.computeVertexNormals();
      }
      if (uvs) {
        geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      }
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
      return geom;
    }

    const clusterList = Array.from(clusters.values());
    if (clusterList.length > 0) {
      mesh.geometry.dispose();
      mesh.geometry = buildGeometry(clusterList[0]);

      for (let k = 1; k < clusterList.length; k++) {
        const siblingGeo = buildGeometry(clusterList[k]);
        const siblingMesh = new THREE.Mesh(siblingGeo, mesh.material);
        siblingMesh.name = `${mesh.name}_Segment_${k}`;
        siblingMesh.castShadow = mesh.castShadow;
        siblingMesh.receiveShadow = mesh.receiveShadow;
        siblingMesh.renderOrder = mesh.renderOrder;
        siblingMesh.userData = { ...mesh.userData, isSeveredSegment: true };
        mesh.parent?.add(siblingMesh);
      }
    }
  }
}
