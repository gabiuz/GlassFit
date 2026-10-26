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

  const bottomRailGeo = new THREE.BoxGeometry(widthM, frameWidth, frameDepth);
  const bottomRail = new THREE.Mesh(bottomRailGeo, resolvedFrameMat);
  bottomRail.name = "Screen_Frame_Bottom";
  bottomRail.position.set(0, -heightM / 2 + frameWidth / 2, zOffset);
  bottomRail.castShadow = true;
  bottomRail.receiveShadow = true;
  bottomRail.renderOrder = 0;
  bottomRail.userData.preserveMaterial = true;
  bottomRail.userData.presentationCategory = "Framing";

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

  const rightJamb = new THREE.Mesh(sideJambGeo, resolvedFrameMat);
  rightJamb.name = "Screen_Frame_Right";
  rightJamb.position.set(widthM / 2 - frameWidth / 2, 0, zOffset);
  rightJamb.castShadow = true;
  rightJamb.receiveShadow = true;
  rightJamb.renderOrder = 0;
  rightJamb.userData.preserveMaterial = true;
  rightJamb.userData.presentationCategory = "Framing";

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

  // 1. Dynamic Vertical Bars (maintaining constant cross section and uniform spacing)
  const colCount = innerWidthMm > 0 ? Math.max(1, Math.floor(innerWidthMm / nominalPitchMm)) : 0;
  const actualPitchM = colCount > 0 ? innerWidthM / (colCount + 1) : 0;

  if (colCount > 0 && innerHeightM > 0) {
    const vBarGeo = new THREE.BoxGeometry(barWidth, innerHeightM, barDepth);
    for (let i = 1; i <= colCount; i++) {
      const xPos = -innerWidthM / 2 + i * actualPitchM;
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
        horizontalBarCount++;
        const yPos = -innerHeightM / 2 + lvl * actualRowPitchM;
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

  const bottomMesh = new THREE.Mesh(topGeo, resolvedGrillMat);
  bottomMesh.name = "Grill_Frame_Bottom";
  bottomMesh.position.set(0, -heightM / 2 + frameWidth / 2, zOffset);
  bottomMesh.castShadow = true;
  bottomMesh.receiveShadow = true;
  bottomMesh.renderOrder = 0;
  bottomMesh.userData.preserveMaterial = true;
  bottomMesh.userData.presentationCategory = "Framing";

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

  const rightMesh = new THREE.Mesh(sideGeo, resolvedGrillMat);
  rightMesh.name = "Grill_Frame_Right";
  rightMesh.position.set(widthM / 2 - frameWidth / 2, 0, zOffset);
  rightMesh.castShadow = true;
  rightMesh.receiveShadow = true;
  rightMesh.renderOrder = 0;
  rightMesh.userData.preserveMaterial = true;
  rightMesh.userData.presentationCategory = "Framing";

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
