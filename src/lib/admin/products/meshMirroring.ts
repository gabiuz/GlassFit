/**
 * Pure Geometry Mirroring Service for Hardware Accessories
 *
 * Provides bilateral reflection across the X=0 plane with surface normal negation
 * and triangle index winding order reversal to prevent inverted backface culling.
 *
 * Traceability: PRD-F5, SDD-C4, IMP-MS78, QAD-TC93.4, QAD-TC93.5, QAD-TC93.6
 */

import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";

/**
 * Bilaterally mirrors a Three.js Object3D hierarchy across the X=0 plane.
 * Inverts triangle vertex index winding to preserve outward-facing surface normals.
 * Traceability: PRD-F5, SDD-C4, IMP-MS78, QAD-TC93.4
 */
export function mirrorObjectHierarchyAcrossX(source: THREE.Object3D): THREE.Object3D {
  const clone = source.clone(true);

  clone.traverse((child) => {
    // 1. Mirror child node positions and rotations across X=0 plane
    if (child !== clone && child.position) {
      child.position.x = -child.position.x;
      if (child.quaternion) {
        child.quaternion.y = -child.quaternion.y;
        child.quaternion.z = -child.quaternion.z;
      }
    }

    if (child instanceof THREE.Mesh && child.geometry) {
      // Clone geometry to avoid mutating cached original
      child.geometry = child.geometry.clone();
      const geom = child.geometry as THREE.BufferGeometry;

      // 2. Mirror vertex positions across X (x' = -x)
      const posAttr = geom.getAttribute("position");
      if (posAttr) {
        for (let i = 0; i < posAttr.count; i++) {
          posAttr.setX(i, -posAttr.getX(i));
        }
        posAttr.needsUpdate = true;
      }

      // 3. Mirror vertex normals across X (n_x' = -n_x)
      const normAttr = geom.getAttribute("normal");
      if (normAttr) {
        for (let i = 0; i < normAttr.count; i++) {
          normAttr.setX(i, -normAttr.getX(i));
        }
        normAttr.needsUpdate = true;
      }

      // 4. Mirror vertex tangents if present
      const tangAttr = geom.getAttribute("tangent");
      if (tangAttr) {
        for (let i = 0; i < tangAttr.count; i++) {
          tangAttr.setX(i, -tangAttr.getX(i));
          // Invert handedness sign (w' = -w)
          tangAttr.setW(i, -tangAttr.getW(i));
        }
        tangAttr.needsUpdate = true;
      }

      // 5. Invert triangle winding order so front faces remain front faces
      const index = geom.getIndex();
      if (index) {
        const indices = index.array;
        for (let i = 0; i < indices.length; i += 3) {
          const temp = indices[i + 1];
          indices[i + 1] = indices[i + 2];
          indices[i + 2] = temp;
        }
        index.needsUpdate = true;
      } else if (posAttr) {
        // Non-indexed geometry: swap consecutive vertices in groups of 3
        const attributeNames = Object.keys(geom.attributes);
        for (let i = 0; i < posAttr.count; i += 3) {
          for (const name of attributeNames) {
            const attr = geom.getAttribute(name);
            if (!attr) continue;
            const itemSize = attr.itemSize;
            for (let k = 0; k < itemSize; k++) {
              const val1 = attr.getComponent(i + 1, k);
              const val2 = attr.getComponent(i + 2, k);
              attr.setComponent(i + 1, k, val2);
              attr.setComponent(i + 2, k, val1);
            }
            attr.needsUpdate = true;
          }
        }
      }

      geom.computeVertexNormals();
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
    }
  });

  return clone;
}

/**
 * Bilaterally reflects an accessory or structural part across the host product centerline.
 * Preserves exact Y-axis elevation and Z-axis depth while moving the part to the opposite lateral side.
 * Traceability: PRD-F5, SDD-C4, IMP-MS78, QAD-TC93.11
 */
export function mirrorPartAcrossCenterline(
  sourceObject: THREE.Object3D,
  baseCenterX: number,
  targetHanding: "left" | "right",
  targetY?: number,
  targetZ?: number,
  overrideTargetX?: number
): THREE.Object3D {
  sourceObject.updateMatrixWorld(true);
  const origBox = new THREE.Box3().setFromObject(sourceObject);
  const origCenter = new THREE.Vector3();
  origBox.getCenter(origCenter);

  const deltaX = origCenter.x - baseCenterX;
  const modeledHanding: "left" | "right" = deltaX >= 0 ? "right" : "left";

  const targetX = overrideTargetX !== undefined
    ? overrideTargetX
    : (targetHanding === "left"
        ? (baseCenterX - Math.abs(deltaX))
        : (baseCenterX + Math.abs(deltaX)));
  const finalY = targetY !== undefined ? targetY : origCenter.y;
  const finalZ = targetZ !== undefined ? targetZ : origCenter.z;

  const clone = sourceObject.clone(true);

  if (targetHanding === modeledHanding && targetY === undefined && targetZ === undefined && overrideTargetX === undefined) {
    clone.userData = { ...sourceObject.userData, isMirroredHanding: false };
    return clone;
  }

  // 1. Recenter clone at local (0, 0, 0)
  clone.updateMatrixWorld(true);
  const curBox = new THREE.Box3().setFromObject(clone);
  const curCenter = new THREE.Vector3();
  curBox.getCenter(curCenter);
  clone.position.sub(curCenter);
  clone.updateMatrixWorld(true);

  let finalMesh = clone;
  if (targetHanding !== modeledHanding) {
    // 2. Reflect hierarchy across X=0 when handedness deviates from naturally modeled side
    finalMesh = mirrorObjectHierarchyAcrossX(clone);

    // 3. Re-verify center at (0, 0, 0) after reflection
    finalMesh.updateMatrixWorld(true);
    const postBox = new THREE.Box3().setFromObject(finalMesh);
    const postCenter = new THREE.Vector3();
    postBox.getCenter(postCenter);
    finalMesh.position.sub(postCenter);
    finalMesh.updateMatrixWorld(true);
  }

  // 4. Wrap in container positioned at target coordinates
  const container = new THREE.Group();
  container.name = `${sourceObject.name || "part"}_${targetHanding}`;
  container.userData = { ...sourceObject.userData, isMirroredHanding: targetHanding !== modeledHanding };
  container.add(finalMesh);
  container.position.set(targetX, finalY, finalZ);
  container.rotation.set(0, 0, 0);
  container.updateMatrixWorld(true);

  return container;
}

/**
 * Exports a Three.js Object3D hierarchy as a binary GLB File.
 * Traceability: IMP-MS78, QAD-TC93.4
 */
export async function exportMirroredGlb(
  object: THREE.Object3D,
  fileName: string = "mirrored_accessory.glb"
): Promise<File> {
  const exporter = new GLTFExporter();
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      object,
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

  return new File([buffer], fileName, { type: "model/gltf-binary" });
}

