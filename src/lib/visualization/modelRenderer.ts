import * as THREE from "three";
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
const CAMERA_BASE_DISTANCE = 6.8;

export class ProductModelRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private modelGroup: THREE.Group;
  
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

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
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

  async loadModel(
    definition: ProductStructuralDefinition,
    values: Record<string, unknown>,
    glassAppearance: GlassAppearanceMode,
    includeSill: boolean,
    alumFinish?: string
  ) {
    // Clear previous
    while (this.modelGroup.children.length > 0) {
      const child = this.modelGroup.children[0];
      this.modelGroup.remove(child);
    }

    const resolved = resolveProductStructure({ definition, values });
    const cache = await preloadComponentModels(definition.components);
    const { group } = buildParametricProduct(definition, resolved, cache, {
      glassAppearance,
      includeSill,
      alumFinish,
    });

    // Ensure the environment map is loaded before rendering
    try {
      const envMap = await loadCityEnvironment(this.renderer);
      if (envMap) {
        this.scene.environment = envMap;
      }
    } catch (e) {
      console.warn("Failed to load environment map", e);
    }

    group.position.set(0, 0, 0);
    group.scale.setScalar(1);

    this.modelGroup.add(group);
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

export function getOriginPreservingSourceBounds(canvas: HTMLCanvasElement) {
  // We cannot call getContext("2d") on a WebGL canvas, so we must copy it to a temp 2D canvas first
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const context = tempCanvas.getContext("2d", { willReadFrequently: true });
  
  if (!context) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  context.drawImage(canvas, 0, 0);
  const { width, height } = tempCanvas;
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasVisiblePixels = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 5) {
        hasVisiblePixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasVisiblePixels) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  // Use the absolute tightest bounding box to eliminate gaps
  const padding = 10;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
