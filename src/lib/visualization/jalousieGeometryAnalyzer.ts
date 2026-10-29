/**
 * Parametric Jalousie Dynamic Louver & Operator Geometry Analyzer (IMP-MS81)
 *
 * Upstream Specifications: docs/implementation/ms81.md, docs/sdd-glassfit.md
 * Traceability Codes: PRD-F5, PRD-F10, PRD-F14, SDD-C4, SDD-C5, ERD-E6, IMP-MS81, QAD-TC96
 */

import * as THREE from "three";
import type { DimensionBinding, PresentationCategory } from "@/lib/pricing/types";

export interface JalousieAnalysisResult {
  isLouverBlade: boolean;
  isLouverOperator: boolean;
  louverCount: number;
  pitchMm: number;
  bladeHeightMm: number;
  bladeWidthMm: number;
  operatorCount: number;
  bladesPerOperator: number;
  suggestedBinding: DimensionBinding;
  suggestedBaseQuantity: number;
  suggestedPresentationCategory: PresentationCategory;
  suggestedBillingUnit: "pc" | "m";
  bladeElevationsM: number[];
  operatorElevationsM: number[];
}

/**
 * Computes dynamic louver blade count based on aperture height, modeled pitch, and perimeter clearance.
 * Formula (IMP-MS81 Section 3.1):
 * N_louvers = max(1, round((heightMm - clearanceMm) / pitchMm))
 */
export function computeLouverBladeCount(
  heightMm: number,
  pitchMm: number = 175,
  clearanceMm: number = 50,
): number {
  const safePitch = Math.max(1, pitchMm);
  return Math.max(1, Math.round((heightMm - clearanceMm) / safePitch));
}

/**
 * Computes required operator mechanism count based on louver count and bank load capacity.
 * Formula (IMP-MS81 Section 3.2):
 * N_operators = max(1, ceil(louverCount / bladesPerOperator))
 */
export function computeLouverOperatorCount(
  louverCount: number,
  bladesPerOperator: number = 4,
): number {
  const safeBank = Math.max(1, bladesPerOperator);
  return Math.max(1, Math.ceil(louverCount / safeBank));
}

/**
 * Evaluates local vertical coordinates (Y in meters) for centered louver blades.
 * Formula (IMP-MS81 Section 3.1):
 * Y_blade,i = -((N - 1) * pitch) / 2 + (i * pitch)
 */
export function computeLouverBladeYCoordinates(
  louverCount: number,
  pitchMm: number = 175,
): number[] {
  const pitchM = pitchMm / 1000;
  const elevations: number[] = [];
  const startY = -((louverCount - 1) * pitchM) / 2;
  for (let i = 0; i < louverCount; i++) {
    elevations.push(Number((startY + i * pitchM).toFixed(4)));
  }
  return elevations;
}

/**
 * Evaluates local vertical coordinates (Y in meters) for operator mechanism bank centroids.
 * Formula (IMP-MS81 Section 3.2):
 * Y_operator,k = -((N - 1) * pitch) / 2 + (((k + 0.5) * N / N_operators) - 0.5) * pitch
 */
export function computeOperatorYCoordinates(
  louverCount: number,
  operatorCount: number,
  pitchMm: number = 175,
): number[] {
  const pitchM = pitchMm / 1000;
  const coordinates: number[] = [];
  const totalSpanM = (louverCount - 1) * pitchM;
  const halfSpanM = totalSpanM / 2;

  for (let k = 0; k < operatorCount; k++) {
    const virtualBladeIdx = ((k + 0.5) * louverCount) / operatorCount - 0.5;
    const yVal = -halfSpanM + virtualBladeIdx * pitchM;
    coordinates.push(Number(yVal.toFixed(4)));
  }
  return coordinates;
}

/**
 * Inspects a 3D geometry hierarchy and/or file name to detect jalousie louver blades or operator units.
 * Identifies blade counts, vertical pitch, blade height, and operator counts.
 */
export function analyzeJalousieGeometry(
  object: THREE.Object3D,
  fileNameOrKey: string = "",
): JalousieAnalysisResult {
  const lowerName = (fileNameOrKey + " " + object.name).toLowerCase();

  const isOperatorKeyword =
    lowerName.includes("operator") ||
    lowerName.includes("rotopers") ||
    lowerName.includes("crank") ||
    lowerName.includes("jw_operators");

  const isLouverKeyword =
    lowerName.includes("louver") ||
    lowerName.includes("jalousie") ||
    lowerName.includes("blade") ||
    lowerName.includes("clips_and_glass");

  const isFrameKeyword =
    lowerName.includes("frame") ||
    lowerName.includes("jamb") ||
    lowerName.includes("sill") ||
    lowerName.includes("mullion") ||
    lowerName.includes("rail") ||
    lowerName.includes("stile") ||
    lowerName.includes("track") ||
    lowerName.includes("head") ||
    lowerName.includes("bottom") ||
    lowerName.includes("top") ||
    lowerName.includes("center") ||
    lowerName.includes("transom") ||
    lowerName.includes("subframe") ||
    lowerName.includes("perimeter");

  // Analyze mesh vertices and clusters
  const glassYCenters: number[] = [];
  const allYCenters: number[] = [];
  const bounds = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  bounds.getSize(size);

  let hasGlassMesh = false;
  let hasHardwareMetal = false;
  let hasOperatorBlack = false;

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geom = child.geometry;
      if (!geom || !geom.attributes.position) return;
      const pos = geom.attributes.position;
      const index = geom.index;
      const triCount = index ? index.count / 3 : pos.count / 3;

      const mat = child.material;
      const matNames: string[] = Array.isArray(mat)
        ? mat.map((m) => (m.name || "").toLowerCase())
        : [((mat && mat.name) || "").toLowerCase()];

      const isGlass =
        matNames.some((n) => n.includes("glass") || n.includes("glazing")) ||
        (child.name || "").toLowerCase().includes("glass");

      const isOpBlack =
        matNames.some((n) => n.includes("operator_black") || n.includes("black")) ||
        (child.name || "").toLowerCase().includes("operator_lower_1");

      if (isGlass) hasGlassMesh = true;
      if (matNames.some((n) => n.includes("metal") || n.includes("hardware"))) hasHardwareMetal = true;
      if (isOpBlack) hasOperatorBlack = true;

      for (let i = 0; i < triCount; i++) {
        const i0 = index ? index.getX(i * 3) : i * 3;
        const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
        const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;
        const avgY = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
        allYCenters.push(avgY);
        if (isGlass) {
          glassYCenters.push(avgY);
        }
      }
    }
  });

  const isOperator =
    isOperatorKeyword ||
    hasOperatorBlack ||
    (lowerName.includes("operator") && hasHardwareMetal);

  if (isOperator) {
    const operatorCount = 2; // Baseline 2 operators per track
    const bladesPerOp = 4;
    return {
      isLouverBlade: false,
      isLouverOperator: true,
      louverCount: 0,
      pitchMm: 175,
      bladeHeightMm: 105.3,
      bladeWidthMm: size.x > 0 ? Number((size.x * 1000).toFixed(1)) : 800,
      operatorCount,
      bladesPerOperator: bladesPerOp,
      suggestedBinding: "LOUVER_OPERATOR",
      suggestedBaseQuantity: operatorCount,
      suggestedPresentationCategory: "Hardware",
      suggestedBillingUnit: "pc",
      bladeElevationsM: [],
      operatorElevationsM: [-0.415, 0.11],
    };
  }

  // Frame profiles are never jalousie blades or operators unless explicitly titled louver
  if (isFrameKeyword && !isLouverKeyword) {
    return {
      isLouverBlade: false,
      isLouverOperator: false,
      louverCount: 0,
      pitchMm: 175,
      bladeHeightMm: 105.3,
      bladeWidthMm: size.x > 0 ? Number((size.x * 1000).toFixed(1)) : 800,
      operatorCount: 0,
      bladesPerOperator: 4,
      suggestedBinding: "FIXED",
      suggestedBaseQuantity: 1,
      suggestedPresentationCategory: "Framing",
      suggestedBillingUnit: "m",
      bladeElevationsM: [],
      operatorElevationsM: [],
    };
  }

  // Louver glass / clip detection:
  // Must have louver keyword OR (hasGlassMesh and NOT frame and NOT operator)
  const isEligibleLouverBlade = isLouverKeyword || (hasGlassMesh && !isFrameKeyword && !isOperatorKeyword);
  if (!isEligibleLouverBlade) {
    return {
      isLouverBlade: false,
      isLouverOperator: false,
      louverCount: 0,
      pitchMm: 175,
      bladeHeightMm: 105.3,
      bladeWidthMm: size.x > 0 ? Number((size.x * 1000).toFixed(1)) : 800,
      operatorCount: 0,
      bladesPerOperator: 4,
      suggestedBinding: "FIXED",
      suggestedBaseQuantity: 1,
      suggestedPresentationCategory: "Framing",
      suggestedBillingUnit: "m",
      bladeElevationsM: [],
      operatorElevationsM: [],
    };
  }

  const targetCenters = glassYCenters.length > 0 ? glassYCenters : allYCenters;

  if (targetCenters.length > 0) {
    targetCenters.sort((a, b) => a - b);
    // Cluster centers with 50mm tolerance
    const clusters: Array<{ avg: number; count: number }> = [];
    for (const y of targetCenters) {
      let placed = false;
      for (const cl of clusters) {
        if (Math.abs(cl.avg - y) < 0.05) {
          cl.avg = (cl.avg * cl.count + y) / (cl.count + 1);
          cl.count++;
          placed = true;
          break;
        }
      }
      if (!placed) {
        clusters.push({ avg: y, count: 1 });
      }
    }

    // Pair adjacent edge clusters within 90mm into blade centers
    const bladeCenters: number[] = [];
    let i = 0;
    while (i < clusters.length) {
      if (i + 1 < clusters.length && Math.abs(clusters[i + 1].avg - clusters[i].avg) < 0.09) {
        bladeCenters.push(Number(((clusters[i].avg + clusters[i + 1].avg) / 2).toFixed(4)));
        i += 2;
      } else {
        bladeCenters.push(Number(clusters[i].avg.toFixed(4)));
        i++;
      }
    }

    const detectedCount = bladeCenters.length > 0 ? bladeCenters.length : 7;
    let pitchMm = 175;
    if (bladeCenters.length > 1) {
      const deltas: number[] = [];
      for (let d = 1; d < bladeCenters.length; d++) {
        deltas.push(bladeCenters[d] - bladeCenters[d - 1]);
      }
      const avgDeltaM = deltas.reduce((s, v) => s + v, 0) / deltas.length;
      pitchMm = Math.round(avgDeltaM * 1000);
      if (Math.abs(pitchMm - 175) <= 5) pitchMm = 175;
    }

    const isLouverBlade = isLouverKeyword || (hasGlassMesh && detectedCount >= 3);

    return {
      isLouverBlade,
      isLouverOperator: false,
      louverCount: detectedCount,
      pitchMm,
      bladeHeightMm: 105.3,
      bladeWidthMm: size.x > 0 ? Number((size.x * 1000).toFixed(1)) : 800,
      operatorCount: computeLouverOperatorCount(detectedCount, 4),
      bladesPerOperator: 4,
      suggestedBinding: isLouverBlade ? "LOUVER_BLADE" : "FIXED",
      suggestedBaseQuantity: isLouverBlade ? detectedCount : 1,
      suggestedPresentationCategory: isLouverBlade ? "Glazing" : "Framing",
      suggestedBillingUnit: isLouverBlade ? "pc" : "m",
      bladeElevationsM: bladeCenters,
      operatorElevationsM: computeOperatorYCoordinates(detectedCount, computeLouverOperatorCount(detectedCount, 4), pitchMm),
    };
  }

  // Fallback defaults
  return {
    isLouverBlade: isLouverKeyword,
    isLouverOperator: false,
    louverCount: 7,
    pitchMm: 175,
    bladeHeightMm: 105.3,
    bladeWidthMm: 800,
    operatorCount: 2,
    bladesPerOperator: 4,
    suggestedBinding: isLouverKeyword ? "LOUVER_BLADE" : "FIXED",
    suggestedBaseQuantity: isLouverKeyword ? 7 : 1,
    suggestedPresentationCategory: isLouverKeyword ? "Glazing" : "Framing",
    suggestedBillingUnit: isLouverKeyword ? "pc" : "m",
    bladeElevationsM: [-0.525, -0.35, -0.175, 0, 0.175, 0.35, 0.525],
    operatorElevationsM: [-0.3063, 0.3063],
  };
}

/**
 * Extracts a single prototype louver blade mesh centered at Y = 0 from a multi-blade louver assembly.
 * Preserves geometries, sub-mesh materials, and clip hardware.
 */
export function extractLouverBladePrototype(
  source: THREE.Object3D,
  centerThresholdM: number = 0.07,
): THREE.Object3D {
  const group = new THREE.Group();
  group.name = "Prototype_Louver_Blade";

  let extractedCount = 0;

  source.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const origGeom = child.geometry;
      if (!origGeom || !origGeom.attributes.position) return;
      const pos = origGeom.attributes.position;
      const index = origGeom.index;
      const triCount = index ? index.count / 3 : pos.count / 3;

      const newIndices: number[] = [];
      const newPositions: number[] = [];
      const newNormals: number[] = [];
      const newUvs: number[] = [];

      for (let i = 0; i < triCount; i++) {
        const i0 = index ? index.getX(i * 3) : i * 3;
        const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
        const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;
        const y0 = pos.getY(i0);
        const y1 = pos.getY(i1);
        const y2 = pos.getY(i2);
        const avgY = (y0 + y1 + y2) / 3;

        if (Math.abs(avgY) <= centerThresholdM) {
          const baseIdx = newPositions.length / 3;
          [i0, i1, i2].forEach((vIdx, offset) => {
            newPositions.push(pos.getX(vIdx), pos.getY(vIdx), pos.getZ(vIdx));
            if (origGeom.attributes.normal) {
              newNormals.push(
                origGeom.attributes.normal.getX(vIdx),
                origGeom.attributes.normal.getY(vIdx),
                origGeom.attributes.normal.getZ(vIdx),
              );
            }
            if (origGeom.attributes.uv) {
              newUvs.push(
                origGeom.attributes.uv.getX(vIdx),
                origGeom.attributes.uv.getY(vIdx),
              );
            }
            newIndices.push(baseIdx + offset);
          });
        }
      }

      if (newIndices.length > 0) {
        const newGeom = new THREE.BufferGeometry();
        newGeom.setAttribute("position", new THREE.Float32BufferAttribute(newPositions, 3));
        if (newNormals.length > 0) {
          newGeom.setAttribute("normal", new THREE.Float32BufferAttribute(newNormals, 3));
        }
        if (newUvs.length > 0) {
          newGeom.setAttribute("uv", new THREE.Float32BufferAttribute(newUvs, 2));
        }
        newGeom.setIndex(newIndices);

        const mesh = new THREE.Mesh(newGeom, child.material);
        mesh.name = `${child.name}_prototype`;
        mesh.castShadow = child.castShadow;
        mesh.receiveShadow = child.receiveShadow;
        group.add(mesh);
        extractedCount++;
      }
    }
  });

  if (extractedCount > 0) {
    return group;
  }

  // If no center cluster was extracted (e.g. mock test geometry or single blade already),
  // return a clone of source recentered at Y = 0.
  const fallbackClone = source.clone(true);
  fallbackClone.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(fallbackClone);
  const c = new THREE.Vector3();
  b.getCenter(c);
  fallbackClone.position.y -= c.y;

  const wrapper = new THREE.Group();
  wrapper.name = "Prototype_Louver_Blade_Fallback";
  wrapper.add(fallbackClone);
  return wrapper;
}

export interface OperatorTrack {
  trackIndex: number;
  modeledCenterX: number;
  modeledCenterY: number;
  modeledCenterZ: number;
  prototype: THREE.Object3D;
}

/**
 * Extracts individual operator tracks (e.g. left jamb bank and right jamb bank in a dual-bay jalousie)
 * and recenters each mechanism prototype to local (0, 0, 0).
 */
export function extractOperatorTracks(source: THREE.Object3D): OperatorTrack[] {
  // Collect all vertex X coordinates across all meshes
  const allXs: number[] = [];
  source.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geom = child.geometry;
      if (!geom || !geom.attributes.position) return;
      const pos = geom.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        allXs.push(pos.getX(i));
      }
    }
  });

  if (allXs.length === 0) {
    const fallbackClone = source.clone(true);
    fallbackClone.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(fallbackClone);
    const c = new THREE.Vector3();
    b.getCenter(c);
    fallbackClone.position.set(-c.x, -c.y, -c.z);
    const wrapper = new THREE.Group();
    wrapper.name = "Centered_Operator_Prototype_Fallback";
    wrapper.add(fallbackClone);
    return [
      {
        trackIndex: 0,
        modeledCenterX: 0,
        modeledCenterY: 0,
        modeledCenterZ: 0,
        prototype: wrapper,
      },
    ];
  }

  allXs.sort((a, b) => a - b);
  // Cluster X coordinates with 0.15m tolerance
  const xClusters: Array<{ avg: number; count: number }> = [];
  for (const x of allXs) {
    let placed = false;
    for (const cl of xClusters) {
      if (Math.abs(cl.avg - x) < 0.15) {
        cl.avg = (cl.avg * cl.count + x) / (cl.count + 1);
        cl.count++;
        placed = true;
        break;
      }
    }
    if (!placed) xClusters.push({ avg: x, count: 1 });
  }

  // Filter out tiny outlier clusters (< 5% of total vertices)
  const totalVerts = allXs.length;
  const validClusters = xClusters.filter((c) => c.count >= totalVerts * 0.05);
  const activeClusters = validClusters.length > 0 ? validClusters : xClusters;

  const tracks: OperatorTrack[] = [];

  activeClusters.forEach((cluster, trackIndex) => {
    const group = new THREE.Group();
    group.name = `Prototype_Operator_Unit_Track_${trackIndex}`;
    let extractedCount = 0;

    source.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const origGeom = child.geometry;
        if (!origGeom || !origGeom.attributes.position) return;
        const pos = origGeom.attributes.position;
        const index = origGeom.index;
        const triCount = index ? index.count / 3 : pos.count / 3;

        const newIndices: number[] = [];
        const newPositions: number[] = [];
        const newNormals: number[] = [];
        const newUvs: number[] = [];

        for (let i = 0; i < triCount; i++) {
          const i0 = index ? index.getX(i * 3) : i * 3;
          const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
          const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;
          const avgX = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
          const avgY = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;

          // Match this lateral cluster and take lower mechanism unit (avgY < -0.10)
          if (Math.abs(avgX - cluster.avg) < 0.15 && avgY < -0.10) {
            const baseIdx = newPositions.length / 3;
            [i0, i1, i2].forEach((vIdx, offset) => {
              newPositions.push(pos.getX(vIdx), pos.getY(vIdx), pos.getZ(vIdx));
              if (origGeom.attributes.normal) {
                newNormals.push(
                  origGeom.attributes.normal.getX(vIdx),
                  origGeom.attributes.normal.getY(vIdx),
                  origGeom.attributes.normal.getZ(vIdx),
                );
              }
              if (origGeom.attributes.uv) {
                newUvs.push(
                  origGeom.attributes.uv.getX(vIdx),
                  origGeom.attributes.uv.getY(vIdx),
                );
              }
              newIndices.push(baseIdx + offset);
            });
          }
        }

        // If no triangles met avgY < -0.10, take all in this lateral cluster
        if (newIndices.length === 0) {
          for (let i = 0; i < triCount; i++) {
            const i0 = index ? index.getX(i * 3) : i * 3;
            const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
            const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;
            const avgX = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
            if (Math.abs(avgX - cluster.avg) < 0.15) {
              const baseIdx = newPositions.length / 3;
              [i0, i1, i2].forEach((vIdx, offset) => {
                newPositions.push(pos.getX(vIdx), pos.getY(vIdx), pos.getZ(vIdx));
                if (origGeom.attributes.normal) {
                  newNormals.push(
                    origGeom.attributes.normal.getX(vIdx),
                    origGeom.attributes.normal.getY(vIdx),
                    origGeom.attributes.normal.getZ(vIdx),
                  );
                }
                if (origGeom.attributes.uv) {
                  newUvs.push(
                    origGeom.attributes.uv.getX(vIdx),
                    origGeom.attributes.uv.getY(vIdx),
                  );
                }
                newIndices.push(baseIdx + offset);
              });
            }
          }
        }

        if (newIndices.length > 0) {
          const newGeom = new THREE.BufferGeometry();
          newGeom.setAttribute("position", new THREE.Float32BufferAttribute(newPositions, 3));
          if (newNormals.length > 0) {
            newGeom.setAttribute("normal", new THREE.Float32BufferAttribute(newNormals, 3));
          }
          if (newUvs.length > 0) {
            newGeom.setAttribute("uv", new THREE.Float32BufferAttribute(newUvs, 2));
          }
          newGeom.setIndex(newIndices);

          const mesh = new THREE.Mesh(newGeom, child.material);
          mesh.name = `${child.name}_proto_t${trackIndex}`;
          mesh.castShadow = child.castShadow;
          mesh.receiveShadow = child.receiveShadow;
          group.add(mesh);
          extractedCount++;
        }
      }
    });

    if (extractedCount > 0) {
      const box = new THREE.Box3().setFromObject(group);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Recenter prototype strictly to local 0,0,0
      group.position.set(-center.x, -center.y, -center.z);

      const wrapper = new THREE.Group();
      wrapper.name = `Centered_Operator_Prototype_Track_${trackIndex}`;
      wrapper.add(group);

      tracks.push({
        trackIndex,
        modeledCenterX: center.x,
        modeledCenterY: center.y,
        modeledCenterZ: center.z,
        prototype: wrapper,
      });
    }
  });

  if (tracks.length > 0) {
    return tracks;
  }

  // Fallback for mock or single operator geometries
  const fallbackClone = source.clone(true);
  fallbackClone.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(fallbackClone);
  const c = new THREE.Vector3();
  b.getCenter(c);
  fallbackClone.position.set(-c.x, -c.y, -c.z);

  const wrapper = new THREE.Group();
  wrapper.name = "Centered_Operator_Prototype_Fallback";
  wrapper.add(fallbackClone);

  return [
    {
      trackIndex: 0,
      modeledCenterX: c.x,
      modeledCenterY: c.y,
      modeledCenterZ: c.z,
      prototype: wrapper,
    },
  ];
}

/**
 * Extracts a single operator unit mechanism centered at local (0, 0, 0) from an operator assembly.
 */
export function extractOperatorPrototype(
  source: THREE.Object3D,
): THREE.Object3D {
  const tracks = extractOperatorTracks(source);
  return tracks[0]?.prototype ?? source.clone(true);
}

