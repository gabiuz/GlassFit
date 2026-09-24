import type { Point2D, QuadrilateralCorners } from "./types";

/**
 * Converts opposite rectangle corners into the perspective corner order used by
 * PRD-F6 and SDD-C5: top-left, top-right, bottom-right, bottom-left.
 */
export function rectangleToQuadrilateral(
  start: Point2D,
  end: Point2D,
): QuadrilateralCorners {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}
