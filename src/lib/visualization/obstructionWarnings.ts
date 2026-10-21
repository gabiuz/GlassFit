import type { DetectedObject, WorkspaceImage } from "@/lib/imageApi";

export interface CanvasBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ObstructionCandidate {
  id: string;
  objectId: string;
  objectLabel: string;
  friendlyLabel: string;
  message: string;
  intersectionBox: CanvasBox;
  anchorPoint: {
    x: number;
    y: number;
  };
  overlapArea: number;
}

const LABEL_MAP: Record<string, string> = {
  couch: "couch",
  sofa: "couch",
  chair: "chair",
  table: "table",
  "dining table": "table",
  bed: "bed",
  plant: "plant",
  "potted plant": "plant",
  refrigerator: "refrigerator",
  fridge: "refrigerator",
  tv: "television",
  television: "television",
  sink: "sink",
  desk: "desk",
  countertop: "counter",
  counter: "counter",
};

export function formatObstructionMessage(label: string): string {
  const normalized = label.trim().toLowerCase();
  const friendly = LABEL_MAP[normalized];
  if (!friendly) {
    return "This product may overlap or block a nearby object in your room.";
  }
  return `This product may overlap or block the ${friendly} in your room.`;
}

export function computeIntersectionBox(a: CanvasBox, b: CanvasBox): CanvasBox | null {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);

  if (x1 < x2 && y1 < y2) {
    return { x1, y1, x2, y2 };
  }
  return null;
}

export interface FindObstructionsParams {
  overlayBox: CanvasBox;
  detectedObjects: DetectedObject[];
  workspaceImage: WorkspaceImage;
  canvasDisplayWidth: number;
  canvasDisplayHeight: number;
  dismissedKeys?: Set<string>;
}

export function findObstructionWarnings({
  overlayBox,
  detectedObjects,
  workspaceImage,
  canvasDisplayWidth,
  canvasDisplayHeight,
  dismissedKeys,
}: FindObstructionsParams): ObstructionCandidate[] {
  if (
    !detectedObjects ||
    detectedObjects.length === 0 ||
    !workspaceImage ||
    workspaceImage.width <= 0 ||
    workspaceImage.height <= 0 ||
    canvasDisplayWidth <= 0 ||
    canvasDisplayHeight <= 0
  ) {
    return [];
  }

  const scaleX = canvasDisplayWidth / workspaceImage.width;
  const scaleY = canvasDisplayHeight / workspaceImage.height;

  const candidates: ObstructionCandidate[] = [];

  for (const obj of detectedObjects) {
    if (!obj.bbox || obj.bbox.length !== 4) continue;
    const warningKey = obj.id;
    if (dismissedKeys && dismissedKeys.has(warningKey)) continue;

    const [ox1, oy1, ox2, oy2] = obj.bbox;
    const objBox: CanvasBox = {
      x1: ox1 * scaleX,
      y1: oy1 * scaleY,
      x2: ox2 * scaleX,
      y2: oy2 * scaleY,
    };

    const intersection = computeIntersectionBox(overlayBox, objBox);
    if (!intersection) continue;

    const width = intersection.x2 - intersection.x1;
    const height = intersection.y2 - intersection.y1;
    const area = width * height;

    // Reject incidental touch points below 400 square pixels or 12px min dimension
    if (area < 400 || width < 12 || height < 12) {
      continue;
    }

    const anchorPoint = {
      x: (intersection.x1 + intersection.x2) / 2,
      y: intersection.y1,
    };

    const normalizedLabel = obj.label.trim().toLowerCase();
    const friendlyLabel = LABEL_MAP[normalizedLabel] || normalizedLabel;

    candidates.push({
      id: warningKey,
      objectId: obj.id,
      objectLabel: obj.label,
      friendlyLabel,
      message: formatObstructionMessage(obj.label),
      intersectionBox: intersection,
      anchorPoint,
      overlapArea: area,
    });
  }

  // Sort descending by overlap area so the most significant obstruction takes priority
  return candidates.sort((a, b) => b.overlapArea - a.overlapArea);
}
