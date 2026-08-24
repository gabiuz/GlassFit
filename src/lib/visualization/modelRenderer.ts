import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ProductStructuralDefinition } from "@/lib/visualization/types";
import type { LightingAnalysis } from "@/lib/imageApi";
import type { GlassAppearanceMode } from "./types";

import { buildParametricProduct } from "@/lib/visualization/parametricProductBuilder";
import { resolveProductStructure } from "@/lib/visualization/structuralResolver";
import { preloadComponentModels } from "@/lib/visualization/componentModelCache";

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
  private canvas: HTMLCanvasElement;
  private modelGroup: THREE.Group;
  private modelLoadVersion = 0;
  private lockedHorizontalFovRadians: number | null = null;
  
  private ambientLight: THREE.AmbientLight;
  private mainLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;

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

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    // Initialize environment map
    loadCityEnvironment(this.renderer).then((envMap) => {
      this.scene.environment = envMap;
    });

    // Initial lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 2048;
    this.mainLight.shadow.mapSize.height = 2048;
    this.mainLight.shadow.bias = -0.001;
    this.scene.add(this.mainLight);

    this.fillLight = new THREE.DirectionalLight(0xffffff, 0.75);
    this.scene.add(this.fillLight);
  }

  setSize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.setSize(width, height, false);

    const aspect = Math.max(width / Math.max(height, 1), 0.01);
    if (this.lockedHorizontalFovRadians === null) {
      this.lockedHorizontalFovRadians =
        2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * aspect,
        );
    }

    this.camera.aspect = aspect;
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(this.lockedHorizontalFovRadians / 2) / aspect,
        ),
    );
    this.camera.updateProjectionMatrix();
  }

  async loadModel(
    definition: ProductStructuralDefinition,
    values: Record<string, unknown>,
    glassAppearance: GlassAppearanceMode,
    includeSill: boolean,
    alumFinish?: string
  ) {
    const loadVersion = (this.modelLoadVersion += 1);

    const group =
      definition.template.modelStrategy === "Fixed"
        ? await this.loadFixedModel(definition)
        : await this.loadParametricModel(
            definition,
            values,
            glassAppearance,
            includeSill,
            alumFinish,
          );

    // Ensure the environment map is loaded before rendering
    try {
      const envMap = await loadCityEnvironment(this.renderer);
      if (envMap) {
        this.scene.environment = envMap;
      }
    } catch (e) {
      console.warn("Failed to load environment map", e);
    }

    if (loadVersion !== this.modelLoadVersion) {
      return;
    }

    while (this.modelGroup.children.length > 0) {
      const child = this.modelGroup.children[0];
      this.modelGroup.remove(child);
    }

    this.modelGroup.add(group);
  }

  private async loadParametricModel(
    definition: ProductStructuralDefinition,
    values: Record<string, unknown>,
    glassAppearance: GlassAppearanceMode,
    includeSill: boolean,
    alumFinish?: string,
  ) {
    const resolved = resolveProductStructure({ definition, values });
    const cache = await preloadComponentModels(definition.components);
    const { group } = buildParametricProduct(definition, resolved, cache, {
      glassAppearance,
      includeSill,
      alumFinish,
    });

    return group;
  }

  private async loadFixedModel(definition: ProductStructuralDefinition) {
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

    return group;
  }

  applyLighting(lighting: LightingAnalysis | null) {
    const ambientRgb = lighting?.ambient_rgb ?? [255, 255, 255];
    const meanRgb = lighting?.mean_rgb ?? [160, 160, 160];
    const ambientColor = new THREE.Color(
      ambientRgb[0] / 255,
      ambientRgb[1] / 255,
      ambientRgb[2] / 255
    );
    const mean = meanRgb.reduce((sum, value) => sum + value, 0) / 3;
    const exposure = THREE.MathUtils.clamp(mean / 128 + 0.04, 0.82, 1.3);
    const direction = lighting?.light_direction ?? { x: 0.6, y: 0.4 };

    this.ambientLight.color.copy(ambientColor);
    this.ambientLight.intensity = THREE.MathUtils.clamp(1.05 + exposure * 0.28, 1, 1.8);

    const mainLightColor = ambientColor.clone().lerp(new THREE.Color(0xffffff), 0.45);
    const mainLightIntensity = THREE.MathUtils.clamp(1.65 + (lighting?.contrast ?? 0.2) * 0.5, 1.45, 2.8);
    this.mainLight.color.copy(mainLightColor);
    this.mainLight.intensity = mainLightIntensity;
    this.mainLight.position.set(direction.x * 4.5 || 2.8, 4.2 + direction.y * 1.8, 4.4);

    const fillLightColor = lighting?.warmth && lighting.warmth >= 0 ? 0xffead3 : 0xd8eeff;
    this.fillLight.color.setHex(fillLightColor);
    this.fillLight.position.set(-direction.x * 3.5 || -3, 2.4, -3.4);
  }

  render(yaw: number, pitch: number) {
    if (this.modelGroup.children.length === 0) {
      return null;
    }

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
    this.renderer.dispose();
  }
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
