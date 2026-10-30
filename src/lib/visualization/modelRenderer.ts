import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ProductStructuralDefinition } from "@/lib/visualization/types";
import type { LightingAnalysis } from "@/lib/imageApi";
import type { GlassAppearanceMode, GlassColorKey, GlassThicknessMm } from "./types";
import {
  getHorizontalFovRadians,
  getVerticalFovDegrees,
} from "./cameraFraming";

import { buildParametricProduct } from "@/lib/visualization/parametricProductBuilder";
import { resolveProductStructure } from "@/lib/visualization/structuralResolver";
import { preloadComponentModels } from "@/lib/visualization/componentModelCache";
import {
  applyPBRToMesh,
  applyPresentationMaterials,
  detectProductMaterialCapabilities,
  type ProductMaterialCapabilities,
} from "@/lib/visualization/materialClassifier";
import type { RawMaterial } from "@/lib/pricing/types";
import type { RrdAluminumFinishKey } from "@/lib/visualization/colorVariations";
import type { AddonGeometryConfig } from "@/lib/visualization/addonGeometryBuilder";

export type ModelPresentationOptions = {
  aluminumFinish: RrdAluminumFinishKey;
  glassAppearance: GlassAppearanceMode;
  glassColor: GlassColorKey;
  glassThicknessMm: GlassThicknessMm;
  includeSill: boolean;
  activeAddon?: "screen" | "grill" | "none" | null;
  addonProductId?: string | null;
  addonAluminumFinish?: string;
  addonMountingSide?: "front" | "back";
  screenMeshDensity?: "fine" | "micro" | "coarse";
  hatchTargetComponentKeys?: string[];
  addonConfig?: AddonGeometryConfig;
  swappedAccessories?: Record<string, import("./types").SelectedAccessoryState>;
  removableStates?: Record<string, boolean>;
};

export type LoadedModelResult = {
  capabilities: ProductMaterialCapabilities;
};

export type PreparedProductModel = LoadedModelResult & {
  group: THREE.Group;
  sharedGeometry: boolean;
};

// Cache the environment map globally so we only download the HDR once
let cachedEnvironmentMap: THREE.Texture | null = null;
let isEnvironmentLoading = false;
let environmentLoadQueue: Array<(envMap: THREE.Texture) => void> = [];
const fixedModelLoader = new GLTFLoader();

function loadCityEnvironment(renderer: THREE.WebGLRenderer): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    if (cachedEnvironmentMap) {
      resolve(cachedEnvironmentMap);
      return;
    }
    
    environmentLoadQueue.push(resolve);
    
    if (isEnvironmentLoading) {
      return;
    }
    
    isEnvironmentLoading = true;
    const loader = new THREE.TextureLoader();
    
    loader.load("/textures/outdoor-view.jpg", (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      pmremGenerator.compileEquirectangularShader();
      
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      
      texture.dispose();
      pmremGenerator.dispose();
      
      cachedEnvironmentMap = envMap;
      isEnvironmentLoading = false;
      environmentLoadQueue.forEach((cb) => cb(envMap));
      environmentLoadQueue = [];
    }, undefined, (err) => {
      console.warn("Failed to load local environment texture:", err);
      isEnvironmentLoading = false;
      environmentLoadQueue.forEach((cb) => cb(null as unknown as THREE.Texture));
      environmentLoadQueue = [];
    });
  });
}

const CAMERA_DIRECTION = new THREE.Vector3(3.4, 1.8, 5.6).normalize();
const CAMERA_BASE_DISTANCE = 3.8;
const CAMERA_BASE_VERTICAL_FOV_DEGREES = 38;

export class ProductModelRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private fittedCanvas: HTMLCanvasElement;
  private modelGroup: THREE.Group;
  private modelLoadVersion = 0;
  private materialCapabilities: ProductMaterialCapabilities = {
    hasAluminum: false,
    hasGlass: false,
  };
  private lockedHorizontalFovRadians: number | null = null;
  
  private ambientLight: THREE.AmbientLight;
  private mainLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private bevelLight: THREE.DirectionalLight;

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.fittedCanvas = document.createElement("canvas");
    this.fittedCanvas.width = width;
    this.fittedCanvas.height = height;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      CAMERA_BASE_VERTICAL_FOV_DEGREES,
      width / height,
      0.1,
      100,
    );
    this.camera.position.copy(CAMERA_DIRECTION).multiplyScalar(CAMERA_BASE_DISTANCE);
    this.camera.lookAt(0, 0, 0);

    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    // Initialize environment map
    loadCityEnvironment(this.renderer).then((envMap) => {
      this.scene.environment = envMap;
    });

    // Initial lights: calibrated to prevent white powder-coat washout while highlighting 3D bevels
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambientLight);

    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.35);
    this.mainLight.position.set(2.5, 4.0, 3.5);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 2048;
    this.mainLight.shadow.mapSize.height = 2048;
    this.mainLight.shadow.bias = -0.0005;
    this.mainLight.shadow.camera.near = 0.1;
    this.mainLight.shadow.camera.far = 25;
    this.mainLight.shadow.camera.left = -4;
    this.mainLight.shadow.camera.right = 4;
    this.mainLight.shadow.camera.top = 4;
    this.mainLight.shadow.camera.bottom = -4;
    this.scene.add(this.mainLight);
    this.scene.add(this.mainLight.target);

    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.40);
    this.fillLight.position.set(-2.5, 2.0, -2.5);
    this.scene.add(this.fillLight);

    this.bevelLight = new THREE.DirectionalLight(0xffffff, 0.75);
    this.bevelLight.position.set(2.2, 3.8, 3.0);
    this.scene.add(this.bevelLight);
  }

  setSize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.fittedCanvas.width = width;
    this.fittedCanvas.height = height;
    this.renderer.setSize(width, height, false);

    const aspect = Math.max(width / Math.max(height, 1), 0.01);
    if (this.lockedHorizontalFovRadians === null) {
      this.lockedHorizontalFovRadians = getHorizontalFovRadians(
        this.camera.fov,
        aspect,
      );
    }

    this.camera.aspect = aspect;
    this.camera.fov = getVerticalFovDegrees(
      this.lockedHorizontalFovRadians,
      aspect,
    );
    this.camera.updateProjectionMatrix();
  }

  getCameraFraming() {
    return this.lockedHorizontalFovRadians;
  }

  setCameraFraming(horizontalFovRadians: number) {
    if (Number.isFinite(horizontalFovRadians) && horizontalFovRadians > 0) {
      this.lockedHorizontalFovRadians = horizontalFovRadians;
    }
  }

  async loadModel(
    definition: ProductStructuralDefinition,
    values: Record<string, unknown>,
    presentation: ModelPresentationOptions,
    customMaterials?: {
      selectedMaterials: Record<string, string>;
      rawMaterialsMap: Map<string, RawMaterial>;
      hasExplicitOverrides?: boolean;
    },
  ): Promise<LoadedModelResult | undefined> {
    const loadVersion = (this.modelLoadVersion += 1);
    const prepared = await this.prepareModel(definition, values, presentation);
    if (loadVersion !== this.modelLoadVersion) {
      this.releasePreparedModel(prepared);
      return;
    }
    this.commitPreparedModel(prepared);
    if (
      customMaterials?.hasExplicitOverrides &&
      customMaterials?.selectedMaterials &&
      Object.keys(customMaterials.selectedMaterials).length > 0
    ) {
      this.updateCustomMaterials(customMaterials.selectedMaterials, customMaterials.rawMaterialsMap);
    }
    return { capabilities: prepared.capabilities };
  }

  async prepareModel(
    definition: ProductStructuralDefinition,
    values: Record<string, unknown>,
    presentation: ModelPresentationOptions,
  ): Promise<PreparedProductModel> {
    const group =
      definition.template.modelStrategy === "Fixed"
        ? await this.loadFixedModel(definition, presentation)
        : await this.loadParametricModel(
            definition,
            values,
            presentation,
          );
    const capabilities = detectProductMaterialCapabilities(group);

    // Ensure the environment map is loaded before rendering
    try {
      const envMap = await loadCityEnvironment(this.renderer);
      if (envMap) {
        this.scene.environment = envMap;
      }
    } catch (e) {
      console.warn("Failed to load environment map", e);
    }

    return { group, capabilities, sharedGeometry: definition.template.modelStrategy !== "Fixed" };
  }

  commitPreparedModel(prepared: PreparedProductModel) {
    this.modelLoadVersion += 1;
    while (this.modelGroup.children.length > 0) {
      const child = this.modelGroup.children[0];
      this.modelGroup.remove(child);
      releaseModelGroup(child, child.userData.sharedGeometry === true);
    }
    prepared.group.userData.sharedGeometry = prepared.sharedGeometry;
    this.modelGroup.add(prepared.group);
    this.materialCapabilities = prepared.capabilities;
  }

  releasePreparedModel(prepared: PreparedProductModel) {
    releaseModelGroup(prepared.group, prepared.sharedGeometry);
  }

  updatePresentation(
    presentation: ModelPresentationOptions,
  ): ProductMaterialCapabilities {
    if (this.modelGroup.children.length === 0) {
      return this.materialCapabilities;
    }
    disposeOwnedModelMaterials(this.modelGroup);
    applyPresentationMaterials(this.modelGroup, {
      aluminumFinish: presentation.aluminumFinish,
      glassAppearance: presentation.glassAppearance,
      glassColor: presentation.glassColor,
      glassThicknessMm: presentation.glassThicknessMm,
    });

    if (presentation.addonConfig?.finishColor || presentation.addonAluminumFinish) {
      const finishColor = presentation.addonConfig?.finishColor ?? (
        presentation.addonAluminumFinish === "white"
          ? "#f5f6f8"
          : presentation.addonAluminumFinish === "black"
            ? "#1a1a1a"
            : presentation.addonAluminumFinish === "mill" || presentation.addonAluminumFinish === "al_1001"
              ? "#d4d8dc"
              : "#221d1a"
      );
      this.modelGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const isAddonFrame =
            child.name.startsWith("Screen_Frame_") ||
            child.name.startsWith("Grill_Frame_") ||
            child.name.startsWith("Grill_Bar_") ||
            (child.userData.isAddon && child.userData.presentationCategory === "Framing");
          if (isAddonFrame && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.color.set(finishColor);
            child.material.needsUpdate = true;
          }
        }
      });
    }

    if (presentation.removableStates) {
      const states = presentation.removableStates;
      this.modelGroup.traverse((child) => {
        const compId = child.userData?.componentId as string | undefined;
        const compKey = child.userData?.componentKey as string | undefined;
        const toggleKey = child.userData?.togglePropertyKey as string | undefined;
        const isHatch = child.userData?.isHatchClone || child.name?.toLowerCase().includes("hatch");
        if (compId && states[compId] !== undefined) {
          child.visible = states[compId];
        } else if (compKey && states[compKey] !== undefined) {
          child.visible = states[compKey];
        } else if (toggleKey && states[toggleKey] !== undefined) {
          child.visible = states[toggleKey];
        } else if (isHatch && (states.screen_access_hatch !== undefined || states.has_screen_access_hatch !== undefined || states.has_hatch !== undefined)) {
          child.visible = (states.screen_access_hatch ?? states.has_screen_access_hatch ?? states.has_hatch) !== false;
        }
      });
    }

    return this.materialCapabilities;
  }


  updateCustomMaterials(
    selectedMaterials: Record<string, string>,
    rawMaterialsMap: Map<string, RawMaterial>,
  ): void {
    if (this.modelGroup.children.length === 0) return;
    this.modelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        let compKey: string | undefined =
          typeof child.userData?.componentKey === "string"
            ? child.userData.componentKey
            : undefined;
        let curr: THREE.Object3D | null = child.parent;
        while (!compKey && curr && curr !== this.modelGroup) {
          if (typeof curr.userData?.componentKey === "string") {
            compKey = curr.userData.componentKey;
          }
          curr = curr.parent;
        }

        const targetKey =
          compKey ||
          (child.name && selectedMaterials[child.name] ? child.name : undefined);

        if (targetKey && selectedMaterials[targetKey]) {
          const rawMat = rawMaterialsMap.get(selectedMaterials[targetKey]);
          if (rawMat) {
            applyPBRToMesh(child, rawMat);
          }
        }
      }
    });
  }

  private async loadParametricModel(
    definition: ProductStructuralDefinition,
    values: Record<string, unknown>,
    presentation: ModelPresentationOptions,
  ) {
    const resolved = resolveProductStructure({ definition, values });
    const allComponents = [
      ...definition.components,
      ...(definition.compatibleAddons?.flatMap((a) => a.components ?? []) ?? []),
    ];
    const cache = await preloadComponentModels(allComponents);
    const { group } = buildParametricProduct(definition, resolved, cache, {
      glassAppearance: presentation.glassAppearance,
      glassColor: presentation.glassColor,
      glassThicknessMm: presentation.glassThicknessMm,
      includeSill: presentation.includeSill,
      alumFinish: presentation.aluminumFinish,
      activeAddon: presentation.activeAddon,
      addonProductId: presentation.addonProductId,
      addonAluminumFinish: presentation.addonAluminumFinish,
      addonMountingSide: presentation.addonMountingSide,
      hatchTargetComponentKeys: presentation.hatchTargetComponentKeys,
      screenMeshDensity: presentation.screenMeshDensity,
      addonConfig: presentation.addonConfig,
      swappedAccessories: presentation.swappedAccessories,
      removableStates: presentation.removableStates,
    });

    return group;
  }

  private async loadFixedModel(
    definition: ProductStructuralDefinition,
    presentation: ModelPresentationOptions,
  ) {
    const asset = definition.assets?.find(
      (item) =>
        (item.assetType === "Whole Model" ||
          item.assetType === "Catalog 3D Preview") &&
        item.status === "Active" &&
        item.url,
    );

    if (!asset?.url) {
      throw new Error("This fixed product does not have an active 3D model asset.");
    }

    const gltf = await fixedModelLoader.loadAsync(asset.url);
    const source = gltf.scene;

    if (!source || source.children.length === 0) {
      throw new Error(`The 3D model for ${definition.product.productName} is empty.`);
    }

    const group = new THREE.Group();
    group.add(source);
    normalizeModelForViewer(group, source);
    applyPresentationMaterials(group, {
      aluminumFinish: presentation.aluminumFinish,
      glassAppearance: presentation.glassAppearance,
      glassColor: presentation.glassColor,
      glassThicknessMm: presentation.glassThicknessMm,
    });

    return group;
  }

  applyLighting(lighting: LightingAnalysis | null) {
    if (!lighting) {
      // Baseline clean studio lighting profile
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.35;
      this.mainLight.color.setHex(0xffffff);
      this.mainLight.intensity = 1.35;
      this.mainLight.position.set(2.5, 4.0, 3.5);
      this.fillLight.color.setHex(0xffffff);
      this.fillLight.intensity = 0.40;
      this.fillLight.position.set(-2.5, 2.0, -2.5);
      this.bevelLight.color.setHex(0xffffff);
      this.bevelLight.intensity = 0.75;
      this.bevelLight.position.set(2.2, 3.8, 3.0);
      return;
    }

    const ambientRgb = lighting.ambient_rgb ?? [255, 255, 255];
    const meanRgb = lighting.mean_rgb ?? [160, 160, 160];
    const meanLuminance = meanRgb.reduce((sum, value) => sum + value, 0) / 3;

    // Dynamic ACESFilmic tone mapping exposure
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const exposureBias = lighting.suggested?.exposure_bias ?? 0;
    const baseExposure = THREE.MathUtils.clamp(
      (meanLuminance / 128.0) * 0.95 + 0.10 + exposureBias,
      0.75,
      1.20,
    );
    this.renderer.toneMappingExposure = baseExposure;

    // Environmental bounce tint with 30% neutral white floor
    const rawAmbient = new THREE.Color(
      ambientRgb[0] / 255,
      ambientRgb[1] / 255,
      ambientRgb[2] / 255,
    );
    const finalAmbient = rawAmbient.clone().multiplyScalar(0.70).add(new THREE.Color(1, 1, 1).multiplyScalar(0.30));
    this.ambientLight.color.copy(finalAmbient);

    const ambientIntensity = lighting.suggested?.ambient_intensity ?? (0.28 + (meanLuminance / 255.0) * 0.12);
    this.ambientLight.intensity = THREE.MathUtils.clamp(ambientIntensity, 0.28, 0.42);

    // Directional key light: picks up 25% subtle scene warmth/bounce
    const keyColor = new THREE.Color(1, 1, 1).multiplyScalar(0.75).add(rawAmbient.clone().multiplyScalar(0.25));
    this.mainLight.color.copy(keyColor);

    const mainIntensity = lighting.suggested?.directional_intensity ?? (1.10 + (lighting.contrast ?? 0.2) * 0.35);
    this.mainLight.intensity = THREE.MathUtils.clamp(mainIntensity, 0.80, 1.55);

    const direction = lighting.light_direction ?? { x: 0.6, y: 0.4 };
    this.mainLight.position.set(direction.x * 4.5 || 2.5, 4.2 + direction.y * 1.8, 3.8);

    // Fill light with complementary Kelvin temperature tint
    const fillLightColor = lighting.warmth && lighting.warmth >= 0 ? 0xffead3 : 0xd8eeff;
    this.fillLight.color.setHex(fillLightColor);
    const fillIntensity = THREE.MathUtils.clamp(0.35 + (1.0 - (lighting.contrast ?? 0.5)) * 0.15, 0.25, 0.50);
    this.fillLight.intensity = fillIntensity;
    this.fillLight.position.set(-direction.x * 3.5 || -2.5, 2.0, -2.5);

    // Bevel light highlights extrusion edges without highlight blowout
    this.bevelLight.color.copy(keyColor);
    const bevelIntensity = THREE.MathUtils.clamp(0.60 + (lighting.contrast ?? 0.2) * 0.25, 0.45, 0.85);
    this.bevelLight.intensity = bevelIntensity;
    this.bevelLight.position.set(direction.x * 2.2 || 2.2, 3.8, 3.0);
  }

  render(yaw: number, pitch: number, isPlanarFit = false) {
    if (this.modelGroup.children.length === 0) {
      return null;
    }

    if (isPlanarFit) {
      // 1. Establish the reference base bounds of the unrotated model at (0, 0, 0)
      // Exclude add-on attachments so planar perspective camera framing never shifts or resizes host product
      this.modelGroup.rotation.set(0, 0, 0);
      this.modelGroup.updateMatrixWorld(true);

      const baseBounds = computeHostProductBounds(this.modelGroup);
      const fitBounds = computeFitFrameBounds(this.modelGroup) ?? baseBounds;
      const baseSize = new THREE.Vector3();
      const baseCenter = new THREE.Vector3();
      fitBounds.getSize(baseSize);
      fitBounds.getCenter(baseCenter);

      if (baseSize.x > 0 && baseSize.y > 0) {
        // PRD-F6: fit the installation frame to the chosen opening corners.
        // Keep a perspective camera so frame depth and glass parallax remain visible.
        const fovDegrees = CAMERA_BASE_VERTICAL_FOV_DEGREES;
        const fovRad = THREE.MathUtils.degToRad(fovDegrees);
        const distance = (baseSize.y / 2) / Math.tan(fovRad / 2);

        this.camera.fov = fovDegrees;
        this.camera.aspect = this.canvas.width / this.canvas.height;
        const cameraZ = baseBounds.max.z + distance;
        this.camera.position.set(baseCenter.x, baseCenter.y, cameraZ);
        this.camera.lookAt(baseCenter.x, baseCenter.y, fitBounds.max.z);

        const near = this.camera.near;
        const far = this.camera.far;
        // Fit the visible installation frame, even when handles or other host
        // parts protrude in front of it. The entire 3D model still renders.
        const scale = near / (cameraZ - fitBounds.max.z);
        const halfWidth = (baseSize.x / 2) * scale;
        const halfHeight = (baseSize.y / 2) * scale;

        this.camera.projectionMatrix.makePerspective(
          -halfWidth,
          halfWidth,
          halfHeight,
          -halfHeight,
          near,
          far,
        );
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
        this.camera.updateMatrixWorld(true);

        // 2. Apply the user's yaw and pitch rotations to the 3D model
        this.modelGroup.rotation.set(
          THREE.MathUtils.degToRad(pitch),
          THREE.MathUtils.degToRad(yaw),
          0
        );
        this.modelGroup.updateMatrixWorld(true);

        this.renderer.render(this.scene, this.camera);
        // PRD-F6: the chosen quadrilateral must map to visible product pixels,
        // not transparent space left around the WebGL render.
        if (yaw === 0 && pitch === 0) {
          const fittedContext = this.fittedCanvas.getContext("2d", { willReadFrequently: true });
          if (fittedContext) {
            const { width, height } = this.canvas;
            fittedContext.clearRect(0, 0, width, height);
            fittedContext.drawImage(this.canvas, 0, 0);
            const bounds = getVisibleAlphaBounds(fittedContext.getImageData(0, 0, width, height));
            if (bounds && bounds.width > 0 && bounds.height > 0) {
              fittedContext.clearRect(0, 0, width, height);
              fittedContext.drawImage(
                this.canvas,
                bounds.x, bounds.y, bounds.width, bounds.height,
                0, 0, width, height,
              );
              return this.fittedCanvas;
            }
          }
        }
        return this.canvas;
      }
    }

    // Default free-placement rendering
    this.camera.fov = CAMERA_BASE_VERTICAL_FOV_DEGREES;
    this.camera.aspect = this.canvas.width / this.canvas.height;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(CAMERA_DIRECTION).multiplyScalar(CAMERA_BASE_DISTANCE);
    this.camera.lookAt(0, 0, 0);
    this.modelGroup.rotation.set(
      THREE.MathUtils.degToRad(pitch),
      THREE.MathUtils.degToRad(yaw),
      0
    );

    this.modelGroup.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);

    return this.canvas;
  }

  dispose() {
    for (const child of [...this.modelGroup.children]) {
      releaseModelGroup(child, child.userData.sharedGeometry === true);
    }
    this.renderer.dispose();
  }
}

export function getVisibleAlphaBounds(image: ImageData): { x: number; y: number; width: number; height: number } | null {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < minX ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function releaseModelGroup(root: THREE.Object3D, sharedGeometry: boolean) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!sharedGeometry || object.userData.sharedCachedGeometry !== true) object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

function disposeOwnedModelMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.userData?.preserveMaterial || object.userData?.isScreenMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}

export function isAddonObject(object: THREE.Object3D): boolean {
  let curr: THREE.Object3D | null = object;
  while (curr) {
    if (
      curr.userData?.isAddon === true ||
      curr.userData?.isUploadedAddon === true ||
      curr.userData?.addonType !== undefined ||
      (typeof curr.name === "string" && (
        curr.name.startsWith("Addon_") ||
        curr.name.startsWith("Screen_") ||
        curr.name.startsWith("Grill_")
      ))
    ) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

export function computeHostProductBounds(modelGroup: THREE.Group): THREE.Box3 {
  const hostBounds = new THREE.Box3();
  let hasHostMesh = false;

  modelGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (!isAddonObject(child)) {
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox();
        }
        child.updateMatrixWorld(true);
        hostBounds.expandByObject(child);
        hasHostMesh = true;
      }
    }
  });

  if (!hasHostMesh) {
    return new THREE.Box3().setFromObject(modelGroup);
  }

  return hostBounds;
}

export function computeFitFrameBounds(modelGroup: THREE.Group): THREE.Box3 | null {
  const frameBounds = new THREE.Box3();
  let hasFrameMesh = false;

  modelGroup.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || isAddonObject(child)) return;
    let ancestor: THREE.Object3D | null = child;
    let isFrame = false;
    while (ancestor && ancestor !== modelGroup) {
      const key = String(ancestor.userData.componentKey ?? "").toLowerCase();
      const type = String(ancestor.userData.componentType ?? "").toLowerCase();
      const category = String(ancestor.userData.presentationCategory ?? "").toLowerCase();
      if (ancestor.name === "Frame" || type === "frame" || category === "framing" || key.includes("frame")) {
        isFrame = true;
        break;
      }
      ancestor = ancestor.parent;
    }
    if (!isFrame) return;
    child.updateMatrixWorld(true);
    frameBounds.expandByObject(child);
    hasFrameMesh = true;
  });

  return hasFrameMesh && !frameBounds.isEmpty() ? frameBounds : null;
}

function normalizeModelForViewer(container: THREE.Group, source: THREE.Object3D) {
  container.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(container);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const maxDimension = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
    return;
  }

  source.position.sub(center);
  container.scale.setScalar(2.4 / maxDimension);
}
