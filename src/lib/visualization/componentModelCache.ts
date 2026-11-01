"use client";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import type {
  ProductComponentDefinition,
  SourceDimensionsMm,
} from "./types";

const loader = new GLTFLoader();
const pendingCache = new Map<string, Promise<LoadedComponentModel>>();
const resolvedCache = new Map<string, LoadedComponentModel>();

export type LoadedComponentModel = {
  source: THREE.Object3D;
  sourceSizeMeters: THREE.Vector3;
};

export type ComponentModelCache = {
  getClone(componentId: string): THREE.Object3D;
  getSourceSizeMeters(componentId: string): THREE.Vector3;
};

/** Validate and cache an active registered accessory asset before selection is committed. */
export async function preloadAccessoryModel(accessoryId: string, url: string): Promise<void> {
  await loadAccessoryModel(accessoryId, url);
}

export async function getAccessoryModelSource(accessoryId: string, url: string): Promise<THREE.Object3D> {
  const loaded = await loadAccessoryModel(accessoryId, url);
  return loaded.source;
}

async function loadAccessoryModel(accessoryId: string, url: string): Promise<LoadedComponentModel> {
  if (!accessoryId || !url) throw new Error("Accessory model ID and URL are required.");
  const cached = resolvedCache.get(url);
  if (cached) return cached;
  const pending = pendingCache.get(url) ?? loader.loadAsync(url).then((gltf) => {
    const source = gltf.scene;
    let hasRenderableGeometry = false;
    source?.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry?.attributes.position?.count > 0) {
        hasRenderableGeometry = true;
      }
    });
    if (!source || !hasRenderableGeometry) throw new Error("The model contains no renderable geometry.");
    const sourceSizeMeters = measureObjectSize(source);
    if (![sourceSizeMeters.x, sourceSizeMeters.y, sourceSizeMeters.z].every(Number.isFinite) ||
        sourceSizeMeters.x <= 0 || sourceSizeMeters.y <= 0 || sourceSizeMeters.z <= 0) {
      throw new Error("The model has invalid dimensions.");
    }
    const loaded = { source, sourceSizeMeters };
    resolvedCache.set(url, loaded);
    return loaded;
  }).catch((error: unknown) => {
    pendingCache.delete(url);
    throw new Error(`Unable to load accessory ${accessoryId}: ${error instanceof Error ? error.message : "Unknown GLB error"}`);
  });
  pendingCache.set(url, pending);
  void pending.finally(() => pendingCache.delete(url)).catch(() => undefined);
  return pending;
}

export async function preloadComponentModels(
  components: ProductComponentDefinition[],
): Promise<ComponentModelCache> {
  const entries = await Promise.all(
    components.map(async (component) => {
      const loaded = await loadComponentModel(component);
      return [component.componentId, loaded] as const;
    }),
  );

  const byComponentId = new Map(entries);

  return {
    getClone(componentId: string) {
      const loaded = byComponentId.get(componentId);
      if (!loaded) {
        throw new Error(`Component model ${componentId} has not been loaded.`);
      }

      return cloneModel(loaded.source);
    },
    getSourceSizeMeters(componentId: string) {
      const loaded = byComponentId.get(componentId);
      if (!loaded) {
        throw new Error(`Component model ${componentId} has not been loaded.`);
      }

      return loaded.sourceSizeMeters.clone();
    },
  };
}

async function loadComponentModel(component: ProductComponentDefinition) {
  const cacheKey = component.model.url;
  const cached = resolvedCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending =
    pendingCache.get(cacheKey) ??
    loader
      .loadAsync(component.model.url)
      .then((gltf) => {
        const source = gltf.scene;
        if (!source || source.children.length === 0) {
          throw new Error(`Component ${component.componentKey} loaded an empty GLB.`);
        }

        const sourceSizeMeters =
          sourceDimensionsMmToMeters(component.model.sourceDimensionsMm) ??
          measureObjectSize(source);

        if (
          sourceSizeMeters.x <= 0 ||
          sourceSizeMeters.y <= 0 ||
          sourceSizeMeters.z <= 0
        ) {
          throw new Error(`Component ${component.componentKey} has invalid bounds.`);
        }

        const loaded = { source, sourceSizeMeters };
        resolvedCache.set(cacheKey, loaded);
        return loaded;
      })
      .catch((error: unknown) => {
        pendingCache.delete(cacheKey);
        const message = error instanceof Error ? error.message : "Unknown GLB error";
        throw new Error(
          `Unable to load Component Model for ${component.componentKey}. ${message}`,
        );
      });

  pendingCache.set(cacheKey, pending);
  return pending;
}

function sourceDimensionsMmToMeters(dimensions: SourceDimensionsMm | null) {
  if (!dimensions) {
    return null;
  }

  return new THREE.Vector3(
    dimensions.width / 1000,
    dimensions.height / 1000,
    dimensions.depth / 1000,
  );
}

function measureObjectSize(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  return size;
}

function cloneModel(source: THREE.Object3D) {
  const clone = cloneSkeleton(source);

  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.userData.sharedCachedGeometry = true;

    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => material.clone());
    } else {
      object.material = object.material.clone();
    }
  });

  return clone;
}
