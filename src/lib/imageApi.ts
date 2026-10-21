import { validatePaperDetection } from "./visualization/paperReference";
const FALLBACK_API_URL = "http://localhost:8000";

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const ACCEPTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
] as const;
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export type ImagePreviewMode = "image" | "file-card";

const GENERIC_IMAGE_TYPES = new Set(["", "application/octet-stream"]);
const MIME_EXTENSIONS: Readonly<Partial<Record<string, readonly string[]>>> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/heic": [".heic", ".heif"],
  "image/heif": [".heic", ".heif"],
};

export function isHeicFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (mime === "image/heic" || mime === "image/heif") return true;

  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

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
    exposure_bias?: number;
    ambient_tint_hex?: string;
    directional_intensity?: number;
    ambient_intensity?: number;
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

import type {
  CalibrationIntakeOptions,
  CalibrationMetadata,
  CalibrationMode,
  FiducialPaperStandard,
  PaperCalibrationResult,
  PaperCalibrationStatus,
  Point2D,
  ScaleEstimationSignal,
} from "@/lib/visualization/types";

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
  scale_estimation?: ScaleEstimationSignal;
  paper_calibration?: PaperCalibrationResult;
  calibration_meta?: {
    mode: CalibrationMode;
    paper_standard: FiducialPaperStandard | null;
    suggested_paper_standard?: FiducialPaperStandard | null;
    aspect_ratio_match_confidence?: number;
    unwarped_aspect_ratio?: number | null;
    status: PaperCalibrationStatus;
    confidence: number;
    homography_matrix?: number[][] | null;
    detected_corners?: [number, number][] | null;
    user_verified?: boolean;
    verified_corners?: [Point2D, Point2D, Point2D, Point2D] | null;
    verified_scale_cm_per_px?: number | null;
  };
  warning?: string | null;
  warnings?: string[];
}

export type UploadProgressStage =
  | "validating"
  | "uploading"
  | "retrying"
  | "processing"
  | "completed";

export interface SpaceImageSession {
  sessionId: string;
  originalFileName: string;
  workspaceImage: WorkspaceImage;
  localBlobUrl?: string;
  brightness: BrightnessAnalysis;
  lighting: LightingAnalysis;
  objects: DetectedObject[];
  segmentation: ImageAnalysisResponse["segmentation"];
  depth?: DepthAnalysis;
  scene?: SceneAnalysis;
  scaleEstimation?: ScaleEstimationSignal;
  scale_estimation?: ScaleEstimationSignal;
  paperCalibration?: PaperCalibrationResult;
  paper_calibration?: PaperCalibrationResult;
  calibrationMeta?: CalibrationMetadata;
  warnings: string[];
}

export interface AnalyzeImageOptions extends CalibrationIntakeOptions {
  onProgress?: (stage: UploadProgressStage, attempt?: number) => void;
  maxRetries?: number;
  timeoutMs?: number;
  initialDelayMs?: number;
}

export function getImageApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_IMAGE_API_URL || FALLBACK_API_URL).replace(/\/$/, "");
}

export function validateImageFile(file: File): string | null {
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const extension = ACCEPTED_IMAGE_EXTENSIONS.find((candidate) =>
    fileName.endsWith(candidate),
  );
  const allowedExtensions = MIME_EXTENSIONS[fileType];

  if (GENERIC_IMAGE_TYPES.has(fileType)) {
    if (!extension) return "Upload a JPG, PNG, WebP, or HEIC/HEIF image.";
  } else if (!allowedExtensions || !extension || !allowedExtensions.includes(extension)) {
    return "The file type and filename extension do not match.";
  }

  if (!ACCEPTED_IMAGE_TYPES.some((accepted) => accepted === fileType) && !GENERIC_IMAGE_TYPES.has(fileType)) {
    return "Upload a JPG, PNG, WebP, or HEIC/HEIF image.";
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return "Upload an image smaller than 12 MB.";
  }

  return null;
}

export async function validateImageDecode(file: File): Promise<ImagePreviewMode> {
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
    return "image";
  } catch (error) {
    if (isHeicFile(file)) return "file-card";
    throw error;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function combineAbortSignals(signal1?: AbortSignal, signal2?: AbortSignal): AbortSignal | undefined {
  if (!signal1) return signal2;
  if (!signal2) return signal1;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal1, signal2]);
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal1.aborted ? signal1.reason : signal2.reason);
  if (signal1.aborted || signal2.aborted) {
    onAbort();
    return controller.signal;
  }
  signal1.addEventListener("abort", onAbort, { once: true });
  signal2.addEventListener("abort", onAbort, { once: true });
  return controller.signal;
}

export async function snapPaperReference(
  sessionId: string,
  seedPoint: Point2D,
  paperStandard?: FiducialPaperStandard,
  signal?: AbortSignal,
): Promise<PaperCalibrationResult> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("seed_x", String(seedPoint.x));
  formData.append("seed_y", String(seedPoint.y));
  if (paperStandard) {
    formData.append("paper_standard", paperStandard);
  }

  const apiBaseUrl = getImageApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/snap-paper`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    let message = "Paper fiducial snap failed.";
    try {
      const errorBody = (await response.json()) as { detail?: string };
      if (errorBody.detail) {
        message = errorBody.detail;
      }
    } catch {
      // Keep default message
    }
    throw new Error(message);
  }

  return (await response.json()) as PaperCalibrationResult;
}

export async function analyzeImage(
  file: File,
  calibrationOptions?: AnalyzeImageOptions,
  signal?: AbortSignal,
): Promise<SpaceImageSession> {
  const formData = new FormData();
  formData.append("image", file);

  const mode = calibrationOptions?.mode ?? "auto_detect";
  formData.append("calibration_mode", mode);

  if (mode === "paper_fiducial" && calibrationOptions?.paperStandard) {
    formData.append("paper_standard", calibrationOptions.paperStandard);
  }

  if (mode === "paper_fiducial" && calibrationOptions?.seedPoint) {
    formData.append("seed_x", String(calibrationOptions.seedPoint.x));
    formData.append("seed_y", String(calibrationOptions.seedPoint.y));
  }

  const apiBaseUrl = getImageApiBaseUrl();
  const maxAttempts = calibrationOptions?.maxRetries ?? 3;
  const timeoutMs = calibrationOptions?.timeoutMs ?? (isHeicFile(file) ? 60000 : 30000);
  let backoffDelay = calibrationOptions?.initialDelayMs ?? 1000;

  let lastError: unknown = null;
  let response: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw signal.reason || new Error("Operation aborted");
    }

    if (attempt === 1) {
      calibrationOptions?.onProgress?.("uploading", 1);
    } else {
      calibrationOptions?.onProgress?.("retrying", attempt - 1);
    }

    const timeoutController = new AbortController();
    const timerId = setTimeout(() => {
      timeoutController.abort(new Error("Request timed out."));
    }, timeoutMs);

    const combinedSignal = combineAbortSignals(signal, timeoutController.signal);

    try {
      response = await fetch(`${apiBaseUrl}/analyze-image`, {
        method: "POST",
        body: formData,
        signal: combinedSignal,
      });
      clearTimeout(timerId);

      if (response.ok) {
        calibrationOptions?.onProgress?.("processing");
        break;
      }

      if (response.status >= 400 && response.status < 500) {
        let message = "Image analysis failed.";
        try {
          const errorBody = (await response.json()) as { detail?: string };
          if (errorBody.detail) {
            message = errorBody.detail;
          }
        } catch {
          // Keep generic message
        }
        throw new Error(message);
      }

      lastError = new Error(`Server temporarily unavailable (HTTP ${response.status}).`);
    } catch (err) {
      clearTimeout(timerId);
      if (signal?.aborted) {
        throw signal.reason || err;
      }
      if (err instanceof Error && response && response.status >= 400 && response.status < 500) {
        throw err;
      }
      lastError = err;
    }

    if (attempt < maxAttempts) {
      const jitter = 1 + (Math.random() * 0.4 - 0.2);
      const sleepTime = Math.round(backoffDelay * jitter);
      await new Promise((resolve) => setTimeout(resolve, sleepTime));
      backoffDelay *= 2;
    }
  }

  if (!response || !response.ok) {
    if (lastError instanceof Error && !lastError.message.includes("Server") && !lastError.message.includes("fetch") && !lastError.message.includes("Network")) {
      // Non-network specific error
    }
    throw new Error("Network connection unstable. Please check your internet connection and try again.");
  }

  const payload = (await response.json()) as ImageAnalysisResponse;
  calibrationOptions?.onProgress?.("completed");

  const session = toSpaceImageSession(payload, file.name, apiBaseUrl, mode);

  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    try {
      if (!isHeicFile(file)) {
        session.localBlobUrl = URL.createObjectURL(file);
      } else {
        const wsRes = await fetch(session.workspaceImage.url, { signal });
        if (wsRes.ok) {
          const wsBlob = await wsRes.blob();
          session.localBlobUrl = URL.createObjectURL(wsBlob);
        }
      }
    } catch {
      // Graceful fallback to remote workspace image URL
    }
  }

  if (!session.calibrationMeta) {
    session.calibrationMeta = {
      mode,
      paperStandard: session.paperCalibration?.paper_standard ?? calibrationOptions?.paperStandard ?? null,
      status: mode === "standard" ? "heuristic_fallback" : session.paperCalibration?.status ?? "manual_pin_required",
      confidence: 0,
      homographyMatrix: null,
      detectedCorners: session.paperCalibration?.detected_corners ?? null,
      paperStandardConfirmed: session.paperCalibration?.paper_standard_confirmed ?? false,
      user_verified: false,
      verified_corners: null,
      verified_scale_cm_per_px: null,
    };
  }
  return session;
}

function toSpaceImageSession(
  payload: ImageAnalysisResponse,
  originalFileName: string,
  apiBaseUrl: string,
  mode: CalibrationMode,
): SpaceImageSession {
  const paper = mode === "paper_fiducial"
    ? validatePaperDetection(payload.paper_calibration, payload.workspace_image.width, payload.workspace_image.height, payload.session_id)
    : undefined;
  const metricMethod = payload.scale_estimation?.method ?? "";
  const signal = payload.scale_estimation && (metricMethod.includes("paper") || metricMethod.includes("calibrat"))
    ? { ...payload.scale_estimation, best_scale_cm_per_px: null, confidence: 0, method: "none", anchors: [] }
    : payload.scale_estimation;
  const session: SpaceImageSession = {
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
    scaleEstimation: mode === "paper_fiducial" ? signal : payload.scale_estimation,
    scale_estimation: mode === "paper_fiducial" ? signal : payload.scale_estimation,
    paperCalibration: paper,
    paper_calibration: paper,
    calibrationMeta: paper && payload.calibration_meta
      ? {
          mode,
          paperStandard: paper.paper_standard,
          suggested_paper_standard: paper.suggested_paper_standard ?? payload.calibration_meta.suggested_paper_standard ?? null,
          suggestedPaperStandard: paper.suggested_paper_standard ?? payload.calibration_meta.suggested_paper_standard ?? null,
          aspect_ratio_match_confidence: paper.aspect_ratio_match_confidence ?? payload.calibration_meta.aspect_ratio_match_confidence ?? 0,
          aspectRatioMatchConfidence: paper.aspect_ratio_match_confidence ?? payload.calibration_meta.aspect_ratio_match_confidence ?? 0,
          unwarped_aspect_ratio: paper.unwarped_aspect_ratio ?? payload.calibration_meta.unwarped_aspect_ratio ?? null,
          unwarpedAspectRatio: paper.unwarped_aspect_ratio ?? payload.calibration_meta.unwarped_aspect_ratio ?? null,
          status: paper.status,
          confidence: paper.confidence,
          homographyMatrix: null,
          detectedCorners: paper.detected_corners,
          user_verified: false,
          verified_corners: null,
          verified_scale_cm_per_px: null,
          paperStandardConfirmed: paper.paper_standard_confirmed,
          referenceSource: paper.reference_source ?? undefined,
          selectedCandidateId: paper.selected_candidate_id ?? undefined,
        }
      : undefined,
    warnings: payload.warnings?.length ? payload.warnings : payload.warning ? [payload.warning] : [],
  };
  return mode === "paper_fiducial" ? session : normalizeNonPaperSession(session, mode);
}

/** IMP-MS62 / QAD-TC77: remove paper evidence without changing non-paper analysis. */
export function normalizeNonPaperSession(
  session: SpaceImageSession,
  mode: "auto_detect" | "standard",
): SpaceImageSession {
  const previous = session.scaleEstimation ?? session.scale_estimation;
  const signal = previous && (previous.method.includes("paper") || previous.method.includes("calibrat"))
    ? {
        best_scale_cm_per_px: null,
        confidence: 0,
        method: "none",
        anchors: [],
        exif_focal_length_mm: previous.exif_focal_length_mm,
        exif_focal_length_35mm: previous.exif_focal_length_35mm,
        exif_device_model: previous.exif_device_model,
      }
    : previous;
  return {
    ...session,
    paperCalibration: undefined,
    paper_calibration: undefined,
    scaleEstimation: signal,
    scale_estimation: signal,
    calibrationMeta: {
      mode,
      status: "heuristic_fallback",
      paperStandard: null,
      confidence: 0,
      homographyMatrix: null,
      detectedCorners: null,
      user_verified: false,
      verified_corners: null,
      verified_scale_cm_per_px: null,
      paperStandardConfirmed: false,
    },
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
