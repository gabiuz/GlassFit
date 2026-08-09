const FALLBACK_API_URL = "http://localhost:8000";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png"];
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export type BrightnessCategory = "dim" | "normal" | "bright";

export interface BrightnessAnalysis {
  mean_pixel_intensity: number;
  category: BrightnessCategory;
}

export interface LightingAnalysis {
  mean_rgb: [number, number, number];
  ambient_rgb: [number, number, number];
  ambient_hex: string;
  contrast: number;
  saturation: number;
  warmth: number;
  tint: number;
  temperature: "cool" | "neutral" | "warm";
  sharpness: number;
  noise: number;
  light_direction: {
    x: number;
    y: number;
  };
  suggested: {
    brightness: number;
    contrast: number;
    saturation: number;
    color_mix: number;
    blur_px: number;
    grain: number;
    shadow_opacity: number;
  };
}

export interface DetectedObject {
  id: string;
  label: string;
  confidence: number;
  bbox: [number, number, number, number];
  mask_url: string;
}

export interface DepthAnalysis {
  depth_map_url: string | null;
  available: boolean;
  mode: "depth_anything_v2" | "unavailable" | string;
  error: string | null;
}

export interface SceneAnalysis {
  floor_top_y_normalized: number | null;
  floor_coverage: number | null;
  wall_coverage: number | null;
  wall_left_x_normalized: number | null;
  wall_right_x_normalized: number | null;
  wall_top_y_normalized: number | null;
  floor_mask_url: string | null;
  wall_mask_url: string | null;
  available: boolean;
  method: "segformer_ade20k" | "depth_plane_fitting" | "unavailable" | string;
  error: string | null;
}

export interface WorkspaceImage {
  url: string;
  width: number;
  height: number;
}

export interface ImageAnalysisResponse {
  session_id: string;
  workspace_image: WorkspaceImage;
  brightness: BrightnessAnalysis;
  lighting: LightingAnalysis;
  objects: DetectedObject[];
  segmentation: {
    mode: "auto" | "yolo" | "mock" | "none" | string;
    model: string | null;
  };
  depth?: DepthAnalysis;
  scene?: SceneAnalysis;
  warning?: string | null;
  warnings?: string[];
}

export interface SpaceImageSession {
  sessionId: string;
  originalFileName: string;
  workspaceImage: WorkspaceImage;
  brightness: BrightnessAnalysis;
  lighting: LightingAnalysis;
  objects: DetectedObject[];
  segmentation: ImageAnalysisResponse["segmentation"];
  depth?: DepthAnalysis;
  scene?: SceneAnalysis;
  warnings: string[];
}

export function getImageApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_IMAGE_API_URL || FALLBACK_API_URL).replace(/\/$/, "");
}

export function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Upload a JPG, JPEG, or PNG image.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "Upload an image smaller than 12 MB.";
  }

  return null;
}

export async function validateImageDecode(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => {
        if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
          reject(new Error("Uploaded image has invalid dimensions."));
          return;
        }

        resolve();
      };
      image.onerror = () => reject(new Error("Uploaded image could not be decoded."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function analyzeImage(file: File): Promise<SpaceImageSession> {
  const formData = new FormData();
  formData.append("image", file);

  const apiBaseUrl = getImageApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/analyze-image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Image analysis failed.";

    try {
      const errorBody = (await response.json()) as { detail?: string };
      if (errorBody.detail) {
        message = errorBody.detail;
      }
    } catch {
      // Keep the generic message when the service returns non-JSON errors.
    }

    throw new Error(message);
  }

  const payload = (await response.json()) as ImageAnalysisResponse;
  return toSpaceImageSession(payload, file.name, apiBaseUrl);
}

function toSpaceImageSession(
  payload: ImageAnalysisResponse,
  originalFileName: string,
  apiBaseUrl: string,
): SpaceImageSession {
  return {
    sessionId: payload.session_id,
    originalFileName,
    workspaceImage: {
      ...payload.workspace_image,
      url: toAbsoluteApiUrl(payload.workspace_image.url, apiBaseUrl),
    },
    brightness: payload.brightness,
    lighting: payload.lighting,
    objects: (payload.objects || []).map((object) => ({
      ...object,
      mask_url: toAbsoluteApiUrl(object.mask_url, apiBaseUrl),
    })),
    segmentation: payload.segmentation,
    depth: payload.depth
      ? {
          ...payload.depth,
          depth_map_url: toAbsoluteOptionalApiUrl(payload.depth.depth_map_url, apiBaseUrl),
        }
      : undefined,
    scene: payload.scene
      ? {
          ...payload.scene,
          floor_mask_url: toAbsoluteOptionalApiUrl(payload.scene.floor_mask_url, apiBaseUrl),
          wall_mask_url: toAbsoluteOptionalApiUrl(payload.scene.wall_mask_url, apiBaseUrl),
        }
      : undefined,
    warnings: payload.warnings?.length ? payload.warnings : payload.warning ? [payload.warning] : [],
  };
}

function toAbsoluteOptionalApiUrl(url: string | null, apiBaseUrl: string) {
  return url ? toAbsoluteApiUrl(url, apiBaseUrl) : null;
}

function toAbsoluteApiUrl(url: string, apiBaseUrl: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${apiBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}
