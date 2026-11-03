/** IMP-MS88 / PRD-F6 / SDD-C4,C5: physical viewing side, independent of mounting. */
import * as THREE from "three";
import type { ProductConfigurationSnapshot, ProductFacing } from "./types";

export function resolveProductFacing(value: unknown): ProductFacing {
  if (value === undefined) return "front";
  if (value === "front" || value === "back") return value;
  throw new Error("Product facing must be front or back.");
}

export function getConfigurationProductFacing(
  configuration?: Pick<ProductConfigurationSnapshot, "productFacing" | "visualParameterValues"> | null,
): ProductFacing {
  // Validate both representations, including an invalid explicit JSON value.
  const stored = configuration?.visualParameterValues?.productFacing;
  if (stored !== undefined) resolveProductFacing(stored);
  return resolveProductFacing(configuration?.productFacing === undefined ? stored : configuration.productFacing);
}

/** Rebuild the rigid transform from scratch so repeated switches never accumulate. */
export function applyProductFacing(
  group: THREE.Group,
  pivot: THREE.Vector3,
  yaw: number,
  pitch: number,
  facing: ProductFacing,
  exteriorYaw = 0,
) {
  const face = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0), exteriorYaw + (resolveProductFacing(facing) === "back" ? Math.PI : 0),
  );
  const manual = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(pitch), THREE.MathUtils.degToRad(yaw), 0,
  ));
  group.quaternion.copy(manual.multiply(face));
  group.position.copy(pivot).sub(pivot.clone().applyQuaternion(group.quaternion));
  group.updateMatrixWorld(true);
}
