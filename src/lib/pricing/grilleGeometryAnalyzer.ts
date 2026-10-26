/**
 * Automated 3D Sub-Bar Geometry Analyzer (IMP-MS71)
 *
 * Upstream Specifications: docs/implementation/ms71.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F2, PRD-F5, PRD-F14, SDD-C4, SDD-C9, ERD-E6, ERD-E17, BRD-M2, BRD-M5, QAD-TC86.1, QAD-TC86.2
 */

import * as THREE from "three";
import type { GrilleBarOrientation, GrillePatternType } from "./types";

export interface AnalyzedSubBar {
  meshName: string;
  orientation: GrilleBarOrientation;
  lengthMm: number;
  crossSectionMm: { width: number; depth: number };
  boundingBoxMm: { x: number; y: number; z: number };
  centerMm: { x: number; y: number; z: number };
}

export interface GrilleGeometryAnalysis {
  patternType: GrillePatternType;
  detectedFrameThicknessMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  innerApertureMm: {
    width: number;
    height: number;
  };
  nominalPitchMm: {
    columnPitch: number;
    rowPitch: number;
  };
  subBars: AnalyzedSubBar[];
  horizontalSummary: {
    distinctLengthsMm: number[];
    pieceCount: number;
    totalLinearM: number;
  };
  verticalSummary: {
    distinctLengthsMm: number[];
    pieceCount: number;
    totalLinearM: number;
  };
}

function extractBarsFromMergedMesh(mesh: THREE.Mesh): AnalyzedSubBar[] {
  const geo = mesh.geometry;
  if (!geo.index || !geo.attributes.position) return [];

  const pos = geo.attributes.position;
  const index = geo.index;
  const triCount = index.count / 3;
  const vCount = pos.count;

  const parent = Array.from({ length: vCount }, (_, i) => i);
  function find(i: number): number {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  }
  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  for (let t = 0; t < triCount; t++) {
    union(index.getX(t * 3), index.getX(t * 3 + 1));
    union(index.getX(t * 3 + 1), index.getX(t * 3 + 2));
  }

  const groups = new Map<number, number[]>();
  for (let v = 0; v < vCount; v++) {
    const r = find(v);
    let groupList = groups.get(r);
    if (!groupList) {
      groupList = [];
      groups.set(r, groupList);
    }
    groupList.push(v);
  }

  interface FaceCluster {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    centerX: number;
    centerY: number;
    centerZ: number;
    dx: number;
    dy: number;
    dz: number;
  }

  const clusters: FaceCluster[] = [];

  const scaleX = Math.abs(mesh.scale.x);
  const scaleY = Math.abs(mesh.scale.y);
  const scaleZ = Math.abs(mesh.scale.z);

  for (const [, vIndices] of groups) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const vi of vIndices) {
      const x = pos.getX(vi);
      const y = pos.getY(vi);
      const z = pos.getZ(vi);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    const dx = Math.round((maxX - minX) * scaleX * 1000);
    const dy = Math.round((maxY - minY) * scaleY * 1000);
    const dz = Math.round((maxZ - minZ) * scaleZ * 1000);

    // Only consider clusters with substantial length (ignoring tiny end-caps)
    if (Math.max(dx, dy) >= 80) {
      clusters.push({
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        centerZ: (minZ + maxZ) / 2,
        dx,
        dy,
        dz,
      });
    }
  }

  // Merge parallel faces of the same bar by position proximity (tolerance 20mm)
  const bars: AnalyzedSubBar[] = [];
  const used = new Set<number>();

  for (let i = 0; i < clusters.length; i++) {
    if (used.has(i)) continue;
    const c = clusters[i];
    used.add(i);

    let minX = c.minX;
    let maxX = c.maxX;
    let minY = c.minY;
    let maxY = c.maxY;
    let minZ = c.minZ;
    let maxZ = c.maxZ;
    const isH = c.dx > c.dy;

    for (let j = i + 1; j < clusters.length; j++) {
      if (used.has(j)) continue;
      const o = clusters[j];
      const otherIsH = o.dx > o.dy;
      if (isH !== otherIsH) continue;

      if (isH) {
        // Horizontal bar: shares similar Y position (within 20mm in model space)
        if (Math.abs(c.centerY - o.centerY) * scaleY < 0.02) {
          used.add(j);
          if (o.minX < minX) minX = o.minX;
          if (o.maxX > maxX) maxX = o.maxX;
          if (o.minY < minY) minY = o.minY;
          if (o.maxY > maxY) maxY = o.maxY;
          if (o.minZ < minZ) minZ = o.minZ;
          if (o.maxZ > maxZ) maxZ = o.maxZ;
        }
      } else {
        // Vertical bar: shares similar X position (within 20mm in model space)
        if (Math.abs(c.centerX - o.centerX) * scaleX < 0.02) {
          used.add(j);
          if (o.minX < minX) minX = o.minX;
          if (o.maxX > maxX) maxX = o.maxX;
          if (o.minY < minY) minY = o.minY;
          if (o.maxY > maxY) maxY = o.maxY;
          if (o.minZ < minZ) minZ = o.minZ;
          if (o.maxZ > maxZ) maxZ = o.maxZ;
        }
      }
    }

    const dxMm = Math.round((maxX - minX) * scaleX * 1000);
    const dyMm = Math.round((maxY - minY) * scaleY * 1000);
    const dzMm = Math.round((maxZ - minZ) * scaleZ * 1000);
    const orientation: GrilleBarOrientation = isH ? "HORIZONTAL" : "VERTICAL";
    const lengthMm = isH ? dxMm : dyMm;
    const crossWidth = isH ? dyMm : dxMm;
    const crossDepth = dzMm;

    bars.push({
      meshName: `${mesh.name || "Grille"}_${orientation}_${bars.length + 1}`,
      orientation,
      lengthMm,
      crossSectionMm: { width: crossWidth, depth: crossDepth },
      boundingBoxMm: { x: dxMm, y: dyMm, z: dzMm },
      centerMm: {
        x: Math.round((((minX + maxX) / 2) * mesh.scale.x + mesh.position.x) * 1000),
        y: Math.round((((minY + maxY) / 2) * mesh.scale.y + mesh.position.y) * 1000),
        z: Math.round((((minZ + maxZ) / 2) * mesh.scale.z + mesh.position.z) * 1000),
      },
    });
  }

  return bars;
}

/**
 * Analyzes a 3D scene or group representing a center grille infill.
 * Traverses mesh nodes and loose geometry primitives, classifies bar orientations
 * along local X (Horizontal) and Y (Vertical) axes, and measures cut lengths.
 */
export function analyzeGrilleGeometry(
  root: THREE.Object3D,
  targetWidthMm: number,
  targetHeightMm: number,
): GrilleGeometryAnalysis {
  root.updateMatrixWorld(true);

  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      meshes.push(child);
    }
  });

  const analyzedBars: AnalyzedSubBar[] = [];

  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (!box) continue;

    const size = new THREE.Vector3();
    box.getSize(size);

    const scaleX = Math.abs(mesh.scale.x);
    const scaleY = Math.abs(mesh.scale.y);
    const scaleZ = Math.abs(mesh.scale.z);

    // Convert from Three.js meters to millimeters
    const dxMm = Math.round(size.x * scaleX * 1000);
    const dyMm = Math.round(size.y * scaleY * 1000);
    const dzMm = Math.round(size.z * scaleZ * 1000);

    // Ignore negligible micro-geometry (below 5mm in all axes)
    if (dxMm < 5 && dyMm < 5 && dzMm < 5) continue;

    // Check if this mesh is a combined lattice with multiple bars in both axes
    if (dxMm > 80 && dyMm > 80 && mesh.geometry.index) {
      const subBars = extractBarsFromMergedMesh(mesh);
      if (subBars.length > 1) {
        analyzedBars.push(...subBars);
        continue;
      }
    }

    // Orientation classification heuristic:
    // If length along X is greater than height along Y: Horizontal bar.
    // If height along Y is greater than length along X: Vertical bar.
    let orientation: GrilleBarOrientation = "VERTICAL";
    let lengthMm = dyMm;
    let crossWidth = dxMm;
    let crossDepth = dzMm;

    if (dxMm > dyMm) {
      orientation = "HORIZONTAL";
      lengthMm = dxMm;
      crossWidth = dyMm;
      crossDepth = dzMm;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    center.x *= mesh.scale.x;
    center.y *= mesh.scale.y;
    center.z *= mesh.scale.z;
    center.add(mesh.position);

    analyzedBars.push({
      meshName: mesh.name || "Grille_Bar",
      orientation,
      lengthMm,
      crossSectionMm: { width: crossWidth, depth: crossDepth },
      boundingBoxMm: { x: dxMm, y: dyMm, z: dzMm },
      centerMm: {
        x: Math.round(center.x * 1000),
        y: Math.round(center.y * 1000),
        z: Math.round(center.z * 1000),
      },
    });
  }

  // Aggregate horizontal and vertical summaries
  const horizontalBars = analyzedBars.filter((b) => b.orientation === "HORIZONTAL");
  const verticalBars = analyzedBars.filter((b) => b.orientation === "VERTICAL");

  const hDistinct = Array.from(new Set(horizontalBars.map((b) => b.lengthMm)));
  const vDistinct = Array.from(new Set(verticalBars.map((b) => b.lengthMm)));

  const hTotalM = horizontalBars.reduce((sum, b) => sum + b.lengthMm / 1000, 0);
  const vTotalM = verticalBars.reduce((sum, b) => sum + b.lengthMm / 1000, 0);

  // Pattern type heuristic based on bar distribution:
  let detectedPattern: GrillePatternType = "grid";
  if (horizontalBars.length > verticalBars.length * 3) {
    detectedPattern = "louvers";
  } else if (horizontalBars.length > 0 && hDistinct.length > 1) {
    detectedPattern = "staggered_brick";
  } else if (analyzedBars.length > 0) {
    detectedPattern = "grid";
  }

  return {
    patternType: detectedPattern,
    detectedFrameThicknessMm: { top: 20, bottom: 20, left: 20, right: 20 },
    innerApertureMm: {
      width: Math.max(100, targetWidthMm - 40),
      height: Math.max(100, targetHeightMm - 40),
    },
    nominalPitchMm: {
      columnPitch: verticalBars.length > 0 ? Math.round(targetWidthMm / (verticalBars.length + 1)) : 140,
      rowPitch: horizontalBars.length > 0 ? Math.round(targetHeightMm / (horizontalBars.length + 1)) : 191,
    },
    subBars: analyzedBars,
    horizontalSummary: {
      distinctLengthsMm: hDistinct,
      pieceCount: horizontalBars.length,
      totalLinearM: Math.round(hTotalM * 100) / 100,
    },
    verticalSummary: {
      distinctLengthsMm: vDistinct,
      pieceCount: verticalBars.length,
      totalLinearM: Math.round(vTotalM * 100) / 100,
    },
  };
}
