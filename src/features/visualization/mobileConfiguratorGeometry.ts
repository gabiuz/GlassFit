/** PRD-F6, SDD-C5, DSD-UI15, QAD-TC52. */
export type CompactOrientation = "portrait" | "landscape";

export interface CompactViewportState {
  isCompactViewport: boolean;
  orientation: CompactOrientation;
}

export interface PointerCanvasMapping {
  clientX: number;
  clientY: number;
  bounds: Pick<DOMRect, "left" | "top" | "width" | "height">;
  canvasWidth: number;
  canvasHeight: number;
  offsetCssPx?: number;
}

export const TOUCH_PROXY_OFFSET_CSS_PX = 48;

export function classifyCompactViewport(
  width: number,
  height: number,
): CompactViewportState {
  const orientation: CompactOrientation = height >= width ? "portrait" : "landscape";
  const isCompactViewport = orientation === "portrait"
    ? width < 768
    : width < 900 && height < 600;
  return { isCompactViewport, orientation };
}

export function mapPointerToCanvas({
  clientX,
  clientY,
  bounds,
  canvasWidth,
  canvasHeight,
  offsetCssPx = 0,
}: PointerCanvasMapping) {
  const scaleX = canvasWidth / Math.max(bounds.width, 1);
  const scaleY = canvasHeight / Math.max(bounds.height, 1);
  return {
    x: clamp((clientX - bounds.left) * scaleX, 0, canvasWidth),
    y: clamp((clientY - bounds.top - offsetCssPx) * scaleY, 0, canvasHeight),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
