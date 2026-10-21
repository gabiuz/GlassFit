import type { DuplicateProductProposal, ProductConfigurationSnapshot, QuadrilateralCorners } from "./types";
import { isValidQuadrilateral } from "./perspectiveTransform";

const interpolate = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

// SDD-C5, QAD-TC62. Each piece inherits the complete configuration.
export function createSplitConfigurations(
  source: ProductConfigurationSnapshot,
  proposal: DuplicateProductProposal,
  overlayWidth: number,
  overlayHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): ProductConfigurationSnapshot[] {
  const { axis, count, pieceMm } = proposal;
  if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight) || canvasWidth <= 0 || canvasHeight <= 0 ||
    !Number.isFinite(overlayWidth) || !Number.isFinite(overlayHeight) || overlayWidth <= 0 || overlayHeight <= 0) {
    throw new Error("The opening is not ready for placement. Fit the product to the photo and retry.");
  }
  const pieceWidth = axis === "width" ? overlayWidth / count : overlayWidth;
  const pieceHeight = axis === "height" ? overlayHeight / count : overlayHeight;
  const centerX = canvasWidth / 2 + (source.positionX ?? 0);
  const centerY = canvasHeight / 2 + (source.positionY ?? 0);
  const radians = (source.rotateAngle * Math.PI) / 180;
  const extentX = (Math.abs(overlayWidth * Math.cos(radians)) + Math.abs(overlayHeight * Math.sin(radians))) / 2;
  const extentY = (Math.abs(overlayWidth * Math.sin(radians)) + Math.abs(overlayHeight * Math.cos(radians))) / 2;
  if (!source.perspectiveFitCorners && (centerX - extentX < 0 || centerX + extentX > canvasWidth ||
    centerY - extentY < 0 || centerY + extentY > canvasHeight)) {
    throw new Error("The split products do not fit on the canvas. Resize or reposition the opening and retry.");
  }
  const corners = source.perspectiveFitCorners;
  if (corners && (!isValidQuadrilateral(corners) || corners.some(point => point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1))) {
    throw new Error("The perspective opening is invalid or outside the canvas. Fit it again and retry.");
  }
  return Array.from({ length: count }, (_, index) => {
    const start = index / count;
    const end = (index + 1) / count;
    let pieceCorners: QuadrilateralCorners | null = null;
    if (corners) {
      pieceCorners = axis === "width"
        ? [interpolate(corners[0], corners[1], start), interpolate(corners[0], corners[1], end), interpolate(corners[3], corners[2], end), interpolate(corners[3], corners[2], start)]
        : [interpolate(corners[0], corners[3], start), interpolate(corners[1], corners[2], start), interpolate(corners[1], corners[2], end), interpolate(corners[0], corners[3], end)];
      if (!isValidQuadrilateral(pieceCorners)) throw new Error("The fitted opening cannot be split into valid adjacent regions.");
    }
    return {
      ...source,
      widthCm: axis === "width" ? pieceMm / 10 : source.widthCm,
      heightCm: axis === "height" ? pieceMm / 10 : source.heightCm,
      positionX: (source.positionX ?? 0) + (axis === "width" ? (index + 0.5 - count / 2) * pieceWidth * Math.cos(radians) : -(index + 0.5 - count / 2) * pieceHeight * Math.sin(radians)),
      positionY: (source.positionY ?? 0) + (axis === "width" ? (index + 0.5 - count / 2) * pieceWidth * Math.sin(radians) : (index + 0.5 - count / 2) * pieceHeight * Math.cos(radians)),
      perspectiveFitCorners: pieceCorners,
      visualParameterValues: {
        ...source.visualParameterValues,
        [axis]: pieceMm,
      },
    };
  });
}
