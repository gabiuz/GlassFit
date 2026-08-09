"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import type { LightingAnalysis } from "@/lib/imageApi";
import { preloadComponentModels } from "./componentModelCache";
import { buildParametricProduct } from "./parametricProductBuilder";
import { resolveProductStructure } from "./structuralResolver";
import type { GlassAppearanceMode, ProductStructuralDefinition } from "./types";

type GeneratedProductCanvasProps = {
  definition: ProductStructuralDefinition;
  values?: Record<string, unknown>;
  yaw?: number;
  pitch?: number;
  lighting?: LightingAnalysis | null;
  glassAppearance?: GlassAppearanceMode;
  includeSill?: boolean;
  suspendProjectedBounds?: boolean;
  onProjectedBounds?: (bounds: ProjectedModelBounds | null) => void;
  onError?: (message: string) => void;
  onReady?: () => void;
};

export type ProjectedModelBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function GeneratedProductCanvas({
  definition,
  values,
  yaw = 0,
  pitch = 0,
  lighting,
  glassAppearance = "frosted",
  includeSill = true,
  suspendProjectedBounds = false,
  onProjectedBounds,
  onError,
  onReady,
}: GeneratedProductCanvasProps) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const valuesKey = JSON.stringify(values ?? {});
  const stableValues = useMemo<Record<string, unknown>>(
    () => JSON.parse(valuesKey) as Record<string, unknown>,
    [valuesKey],
  );

  const resolved = useMemo(
    () => resolveProductStructure({ definition, values: stableValues }),
    [definition, stableValues],
  );

  useEffect(() => {
    let cancelled = false;

    async function build() {
      try {
        const cache = await preloadComponentModels(definition.components);
        const { group: nextGroup } = buildParametricProduct(definition, resolved, cache, {
          glassAppearance,
          includeSill,
        });
        normalizeForCanvas(nextGroup);

        if (cancelled) {
          disposeGroup(nextGroup);
          return;
        }

        setGroup((current) => {
          if (current) {
            disposeGroup(current);
          }
          return nextGroup;
        });
        onReady?.();
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unable to build the product overlay.";
        onError?.(message);
      }
    }

    void build();

    return () => {
      cancelled = true;
    };
  }, [definition, resolved, glassAppearance, includeSill, onError, onReady]);

  useEffect(() => {
    return () => {
      if (group) {
        disposeGroup(group);
      }
    };
  }, [group]);

  return (
    <Canvas
      camera={{ position: [3.4, 1.8, 5.6], fov: 38 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <SceneLighting lighting={lighting} />
      <Environment preset="city" />
      <Suspense fallback={null}>
        {group ? (
          <GeneratedProductScene
            group={group}
            yaw={yaw}
            pitch={pitch}
            suspendProjectedBounds={suspendProjectedBounds}
            onProjectedBounds={onProjectedBounds}
          />
        ) : null}
      </Suspense>
    </Canvas>
  );
}

function GeneratedProductScene({
  group,
  yaw,
  pitch,
  suspendProjectedBounds,
  onProjectedBounds,
}: {
  group: THREE.Group;
  yaw: number;
  pitch: number;
  suspendProjectedBounds: boolean;
  onProjectedBounds?: (bounds: ProjectedModelBounds | null) => void;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const lastBoundsRef = useRef<string | null>(null);
  const { camera, size } = useThree();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      onProjectedBounds?.(null);
      return;
    }

    root.rotation.set(
      THREE.MathUtils.degToRad(pitch),
      THREE.MathUtils.degToRad(yaw),
      0,
    );
    root.updateMatrixWorld(true);
  }, [pitch, yaw, onProjectedBounds]);

  useEffect(() => {
    lastBoundsRef.current = null;
  }, [group, pitch, size.height, size.width, suspendProjectedBounds, yaw]);

  useFrame(() => {
    const root = rootRef.current;
    if (!root || !onProjectedBounds || suspendProjectedBounds) {
      return;
    }

    root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      camera.updateProjectionMatrix();
    }

    const bounds = getProjectedObjectBounds(root, camera);
    const boundsKey = bounds
      ? `${bounds.left.toFixed(4)}:${bounds.top.toFixed(4)}:${bounds.width.toFixed(4)}:${bounds.height.toFixed(4)}`
      : "null";

    if (boundsKey !== lastBoundsRef.current) {
      lastBoundsRef.current = boundsKey;
      onProjectedBounds(bounds);
    }
  });

  return (
    <group ref={rootRef}>
      <primitive object={group} />
    </group>
  );
}

function getProjectedObjectBounds(
  object: THREE.Object3D,
  camera: THREE.Camera,
): ProjectedModelBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const point = new THREE.Vector3();

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.computeBoundingBox();
    const bounds = child.geometry.boundingBox;
    if (!bounds) {
      return;
    }

    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          point.set(x, y, z).applyMatrix4(child.matrixWorld).project(camera);
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            continue;
          }

          minX = Math.min(minX, (point.x + 1) / 2);
          maxX = Math.max(maxX, (point.x + 1) / 2);
          minY = Math.min(minY, (1 - point.y) / 2);
          maxY = Math.max(maxY, (1 - point.y) / 2);
        }
      }
    }
  });

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return null;
  }

  const padding = 0.04;
  const left = clampOverscan(minX - padding);
  const top = clampOverscan(minY - padding);
  const right = clampOverscan(maxX + padding);
  const bottom = clampOverscan(maxY + padding);

  return {
    left,
    top,
    width: Math.max(0.08, right - left),
    height: Math.max(0.08, bottom - top),
  };
}

function clampOverscan(value: number) {
  return Math.min(1.3, Math.max(-0.3, value));
}

function SceneLighting({ lighting }: { lighting?: LightingAnalysis | null }) {
  const ambientRgb = lighting?.ambient_rgb ?? [255, 255, 255];
  const meanRgb = lighting?.mean_rgb ?? [160, 160, 160];
  const ambient = new THREE.Color(
    ambientRgb[0] / 255,
    ambientRgb[1] / 255,
    ambientRgb[2] / 255,
  );
  const mean = meanRgb.reduce((sum, value) => sum + value, 0) / 3;
  const exposure = THREE.MathUtils.clamp(mean / 128 + 0.04, 0.82, 1.3);
  const direction = lighting?.light_direction ?? { x: 0.6, y: 0.4 };

  return (
    <>
      <ambientLight color={ambient} intensity={THREE.MathUtils.clamp(1.05 + exposure * 0.28, 1, 1.8)} />
      <directionalLight
        color={ambient.clone().lerp(new THREE.Color(0xffffff), 0.45)}
        position={[direction.x * 4.5 || 2.8, 4.2 + direction.y * 1.8, 4.4]}
        intensity={THREE.MathUtils.clamp(1.65 + (lighting?.contrast ?? 0.2) * 0.5, 1.45, 2.8)}
      />
      <directionalLight
        color={lighting?.warmth && lighting.warmth >= 0 ? 0xffead3 : 0xd8eeff}
        position={[-direction.x * 3.5 || -3, 2.4, -3.4]}
        intensity={0.75}
      />
    </>
  );
}

function normalizeForCanvas(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const maxAxis = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.65 / maxAxis;
  group.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  group.scale.setScalar(scale);
}

function disposeGroup(group: THREE.Group) {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.geometry.dispose();
    if (Array.isArray(object.material)) {
      object.material.forEach(disposeMaterial);
    } else {
      disposeMaterial(object.material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  if ("map" in material && material.map instanceof THREE.Texture) {
    material.map.dispose();
  }

  material.dispose();
}
