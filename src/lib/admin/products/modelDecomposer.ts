/**
 * Whole-Model GLB Decomposition Engine (MS-06)
 *
 * Upstream Specifications: docs/pricing.md, docs/milestone.md, docs/implementation/ms06.md
 * Traceability Codes: PRD-F14, PRD-F19, SDD-C9, DSD-UI10, ERD-E6, QAD-TC20
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import type { DimensionBinding, PresentationCategory } from "@/lib/pricing/types";
import type { ComponentType } from "./componentMutations";
import { autoDetectComponentSettings } from "./autoDetection";

// Polyfill FileReader for Node.js / unit testing environments if absent
if (typeof globalThis.FileReader === "undefined") {
  class NodeFileReader {
    result: ArrayBuffer | string | null = null;
    onload: ((e: { target: NodeFileReader }) => void) | null = null;
    onloadend: ((e: { target: NodeFileReader }) => void) | null = null;
    onerror: ((e: { target: NodeFileReader; error: unknown }) => void) | null = null;

    readAsArrayBuffer(blob: Blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          this.result = buf;
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        })
        .catch((err) => {
          if (this.onerror) this.onerror({ target: this, error: err });
          if (this.onloadend) this.onloadend({ target: this });
        });
    }

    readAsDataURL(blob: Blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          const base64 = Buffer.from(buf).toString("base64");
          this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
          if (this.onload) this.onload({ target: this });
          if (this.onloadend) this.onloadend({ target: this });
        })
        .catch((err) => {
          if (this.onerror) this.onerror({ target: this, error: err });
          if (this.onloadend) this.onloadend({ target: this });
        });
    }
  }

  (globalThis as unknown as { FileReader: typeof NodeFileReader }).FileReader = NodeFileReader;
}

export interface ExtractedComponentPart {
  id: string;
  sourceNodeName: string;
  componentKey: string;
  componentName: string;
  componentType: ComponentType;
  presentationCategory: PresentationCategory;
  dimensionBinding: DimensionBinding;
  spanRatio: number;
  isRemovable: boolean;
  togglePropertyKey: string | null;
  baseQuantity: number;
  dimensionsMm: {
    width: number;
    height: number;
    depth: number;
  };
  assemblyPosition?: { x: number; y: number; z: number };
  assemblyDimensionsMm?: { width: number; height: number; depth: number };
  file: File;
  previewMesh: THREE.Group;
  isSelected: boolean;
}

export interface ModelDecompositionResult {
  success: boolean;
  sourceFileName: string;
  totalNodesDetected: number;
  extractedParts: ExtractedComponentPart[];
  warnings: string[];
  error?: string;
}

export interface ModelDecomposerOptions {
  sanitizeKeys?: boolean;
  filterEmptyNodes?: boolean;
  minBoundingDimensionMeters?: number; // Ignores micro-geometry below 5mm
}

export interface DisconnectedPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  worldBox: THREE.Box3;
  suggestedName: string;
}

export function formatLabel(name: string): string {
  return name
    .replace(/\.glb$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function sanitizeComponentKey(name: string): string {
  const sanitized = name
    .replace(/\.glb$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");
  return sanitized || "component";
}

/**
 * Segment a mesh into its constituent disconnected loose parts (topological connected components).
 */
export function segmentMeshLooseParts(
  mesh: THREE.Mesh,
  minDimensionMeters = 0.005
): DisconnectedPart[] {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);

  const position = geometry.attributes.position;
  if (!position || position.count === 0) return [];

  const index = geometry.index;
  const numTriangles = index ? index.count / 3 : position.count / 3;
  if (numTriangles <= 1) {
    const box = new THREE.Box3().setFromBufferAttribute(position as THREE.BufferAttribute);
    return [
      {
        geometry,
        material: mesh.material,
        worldBox: box,
        suggestedName: mesh.name || "part",
      },
    ];
  }

  // 1. Initialize Disjoint-Set Union (DSU)
  const parent = new Int32Array(numTriangles);
  for (let i = 0; i < numTriangles; i++) parent[i] = i;

  const find = (i: number): number => {
    let root = i;
    while (root !== parent[root]) root = parent[root];
    let curr = i;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  };

  const union = (i: number, j: number) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  // 2. Map spatial coordinates to triangle indices (0.1mm tolerance hashing)
  const vertexToTriangles = new Map<string, number[]>();
  for (let t = 0; t < numTriangles; t++) {
    for (let v = 0; v < 3; v++) {
      const vIdx = index ? index.getX(t * 3 + v) : t * 3 + v;
      const x = Math.round(position.getX(vIdx) * 10000);
      const y = Math.round(position.getY(vIdx) * 10000);
      const z = Math.round(position.getZ(vIdx) * 10000);
      const key = `${x},${y},${z}`;

      let list = vertexToTriangles.get(key);
      if (!list) {
        list = [];
        vertexToTriangles.set(key, list);
      }
      list.push(t);
    }
  }

  // 3. Union adjacent triangles touching the same spatial vertex
  for (const triList of vertexToTriangles.values()) {
    if (triList.length > 1) {
      const first = triList[0];
      for (let i = 1; i < triList.length; i++) {
        union(first, triList[i]);
      }
    }
  }

  // 4. Group triangle indices by DSU root
  const groups = new Map<number, number[]>();
  for (let t = 0; t < numTriangles; t++) {
    const root = find(t);
    let list = groups.get(root);
    if (!list) {
      list = [];
      groups.set(root, list);
    }
    list.push(t);
  }

  // If only 1 connected component, return the original
  if (groups.size <= 1) {
    const box = new THREE.Box3().setFromBufferAttribute(position as THREE.BufferAttribute);
    return [
      {
        geometry,
        material: mesh.material,
        worldBox: box,
        suggestedName: mesh.name || "part",
      },
    ];
  }

  // 5. Extract sub-geometries while preserving assembly coordinates
  const results: DisconnectedPart[] = [];
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;

  let partIndex = 1;
  for (const triIndices of groups.values()) {
    const subGeo = new THREE.BufferGeometry();
    const vertexCount = triIndices.length * 3;
    const subPositions = new Float32Array(vertexCount * 3);
    const subNormals = normal ? new Float32Array(vertexCount * 3) : null;
    const subUvs = uv ? new Float32Array(vertexCount * 2) : null;

    let outV = 0;
    for (const t of triIndices) {
      for (let v = 0; v < 3; v++) {
        const srcIdx = index ? index.getX(t * 3 + v) : t * 3 + v;
        subPositions[outV * 3] = position.getX(srcIdx);
        subPositions[outV * 3 + 1] = position.getY(srcIdx);
        subPositions[outV * 3 + 2] = position.getZ(srcIdx);

        if (subNormals && normal) {
          subNormals[outV * 3] = normal.getX(srcIdx);
          subNormals[outV * 3 + 1] = normal.getY(srcIdx);
          subNormals[outV * 3 + 2] = normal.getZ(srcIdx);
        }

        if (subUvs && uv) {
          subUvs[outV * 2] = uv.getX(srcIdx);
          subUvs[outV * 2 + 1] = uv.getY(srcIdx);
        }

        outV++;
      }
    }

    subGeo.setAttribute("position", new THREE.BufferAttribute(subPositions, 3));
    if (subNormals) subGeo.setAttribute("normal", new THREE.BufferAttribute(subNormals, 3));
    if (subUvs) subGeo.setAttribute("uv", new THREE.BufferAttribute(subUvs, 2));

    subGeo.computeBoundingBox();
    const box = subGeo.boundingBox || new THREE.Box3();
    const size = new THREE.Vector3();
    box.getSize(size);

    // Filter negligible noise geometry
    if (size.x < minDimensionMeters && size.y < minDimensionMeters && size.z < minDimensionMeters) {
      continue;
    }

    const baseName = mesh.name ? mesh.name.trim() : "part";
    results.push({
      geometry: subGeo,
      material: mesh.material,
      worldBox: box,
      suggestedName: groups.size > 1 ? `${baseName}_part_${partIndex++}` : baseName,
    });
  }

  return results;
}

/**
 * Decompose a whole assembled 3D model (GLB) into discrete structural components.
 */
export async function decomposeWholeModel(
  input: File | Blob | ArrayBuffer,
  options: ModelDecomposerOptions = {}
): Promise<ModelDecompositionResult> {
  const fileName = input instanceof File ? input.name : "assembled_model.glb";
  const loader = new GLTFLoader();
  const exporter = new GLTFExporter();

  try {
    let arrayBuffer: ArrayBuffer;
    if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
    } else if (typeof input.arrayBuffer === "function") {
      arrayBuffer = await input.arrayBuffer();
    } else {
      throw new Error("Invalid input format provided for GLB decomposition.");
    }

    const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
      loader.parse(
        arrayBuffer,
        "",
        (parsedGltf) => resolve(parsedGltf),
        (err) => reject(err)
      );
    });

    const root = gltf.scene;
    return await decomposeSceneGraph(root, fileName, options, exporter);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to parse 3D GLB file";
    return {
      success: false,
      sourceFileName: fileName,
      totalNodesDetected: 0,
      extractedParts: [],
      warnings: [],
      error: errorMsg,
    };
  }
}

/**
 * Core scene graph traversal and sub-mesh isolation routine.
 */
export async function decomposeSceneGraph(
  root: THREE.Object3D,
  sourceFileName: string,
  options: ModelDecomposerOptions = {},
  exporterInstance?: GLTFExporter
): Promise<ModelDecompositionResult> {
  const exporter = exporterInstance || new GLTFExporter();
  const meshNodes: THREE.Mesh[] = [];

  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry) {
      meshNodes.push(node);
    }
  });

  const minDim = options.minBoundingDimensionMeters ?? 0.005;
  const candidateParts: DisconnectedPart[] = [];
  const warnings: string[] = [];

  for (const mesh of meshNodes) {
    mesh.updateMatrixWorld(true);
    const parts = segmentMeshLooseParts(mesh, minDim);
    for (const p of parts) {
      const size = new THREE.Vector3();
      p.worldBox.getSize(size);
      if (size.x < minDim && size.y < minDim && size.z < minDim) {
        warnings.push(`Ignored micro-geometry node: ${p.suggestedName}`);
        continue;
      }
      candidateParts.push(p);
    }
  }

  if (candidateParts.length <= 1) {
    return {
      success: false,
      sourceFileName,
      totalNodesDetected: candidateParts.length,
      extractedParts: [],
      warnings,
      error:
        "The uploaded GLB contains only a single merged mesh and no loose parts. To use decomposition, export with separate named objects from your 3D modeling tool.",
    };
  }

  const extractedParts: ExtractedComponentPart[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < candidateParts.length; i++) {
    const part = candidateParts[i];
    const nodeName = part.suggestedName || `part_${i + 1}`;
    const baseKey = sanitizeComponentKey(nodeName);
    let sanitizedKey = baseKey;
    let counter = 2;
    while (usedKeys.has(sanitizedKey)) {
      sanitizedKey = `${baseKey}_${counter++}`;
    }
    usedKeys.add(sanitizedKey);

    const partFileName = `${sanitizedKey}.glb`;

    // Create isolated preview scene retaining natural assembly coordinates
    const isolatedGroup = new THREE.Group();
    isolatedGroup.name = sanitizedKey;

    let clonedMaterial: THREE.Material | THREE.Material[];
    if (Array.isArray(part.material)) {
      clonedMaterial = part.material.map((mat) => mat.clone());
    } else if (part.material) {
      clonedMaterial = part.material.clone();
    } else {
      clonedMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    }

    const clonedMesh = new THREE.Mesh(part.geometry.clone(), clonedMaterial);
    clonedMesh.name = nodeName;
    clonedMesh.position.set(0, 0, 0);
    clonedMesh.rotation.set(0, 0, 0);
    clonedMesh.scale.set(1, 1, 1);
    clonedMesh.updateMatrixWorld(true);

    isolatedGroup.add(clonedMesh);

    // Export isolated mesh to standalone binary GLB buffer
    const glbBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        isolatedGroup,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else if (result instanceof Uint8Array) {
            const copy = new Uint8Array(result.byteLength);
            copy.set(result);
            resolve(copy.buffer as ArrayBuffer);
          } else {
            reject(new Error("GLTFExporter did not produce a binary ArrayBuffer"));
          }
        },
        (error) => reject(error),
        { binary: true }
      );
    });

    const partFile = new File([glbBuffer], partFileName, {
      type: "model/gltf-binary",
    });

    const detected = autoDetectComponentSettings(partFileName);
    const size = new THREE.Vector3();
    part.worldBox.getSize(size);
    const center = new THREE.Vector3();
    part.worldBox.getCenter(center);

    clonedMesh.userData.componentKey = sanitizedKey;
    clonedMesh.userData.componentName = formatLabel(nodeName);
    clonedMesh.userData.componentType = detected.componentType;
    clonedMesh.userData.presentationCategory = detected.presentationCategory;
    isolatedGroup.userData.componentKey = sanitizedKey;
    isolatedGroup.userData.componentName = formatLabel(nodeName);
    isolatedGroup.userData.componentType = detected.componentType;
    isolatedGroup.userData.presentationCategory = detected.presentationCategory;

    extractedParts.push({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `part-${Math.random().toString(36).slice(2, 9)}`,
      sourceNodeName: nodeName,
      componentKey: sanitizedKey,
      componentName: formatLabel(nodeName),
      componentType: detected.componentType,
      presentationCategory: detected.presentationCategory,
      dimensionBinding: detected.dimensionBinding,
      spanRatio: detected.spanRatio,
      isRemovable: detected.isRemovable,
      togglePropertyKey: detected.togglePropertyKey,
      baseQuantity: 1,
      dimensionsMm: {
        width: Math.max(1, Math.round(size.x * 1000)),
        height: Math.max(1, Math.round(size.y * 1000)),
        depth: Math.max(1, Math.round(size.z * 1000)),
      },
      assemblyPosition: {
        x: Number(center.x.toFixed(4)),
        y: Number(center.y.toFixed(4)),
        z: Number(center.z.toFixed(4)),
      },
      assemblyDimensionsMm: {
        width: Math.max(1, Math.round(size.x * 1000)),
        height: Math.max(1, Math.round(size.y * 1000)),
        depth: Math.max(1, Math.round(size.z * 1000)),
      },
      file: partFile,
      previewMesh: isolatedGroup,
      isSelected: true,
    });
  }

  return {
    success: extractedParts.length > 0,
    sourceFileName,
    totalNodesDetected: candidateParts.length,
    extractedParts,
    warnings,
    error:
      extractedParts.length === 0
        ? "No valid structural meshes could be extracted from this model."
        : undefined,
  };
}
