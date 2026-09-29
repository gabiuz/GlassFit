import type {
  ManualOcclusionPolygon,
  Point2D,
} from "@/lib/visualization/types";

const GEOMETRY_EPSILON = 1e-7;

export type OcclusionPolygonValidation =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "too_few_points"
        | "non_finite"
        | "duplicate_points"
        | "zero_area"
        | "self_intersection";
    };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointsAreEqual(first: Point2D, second: Point2D) {
  return (
    Math.abs(first.x - second.x) <= GEOMETRY_EPSILON &&
    Math.abs(first.y - second.y) <= GEOMETRY_EPSILON
  );
}

function orientation(first: Point2D, second: Point2D, third: Point2D) {
  return (
    (second.y - first.y) * (third.x - second.x) -
    (second.x - first.x) * (third.y - second.y)
  );
}

function isPointOnSegment(start: Point2D, point: Point2D, end: Point2D) {
  return (
    point.x <= Math.max(start.x, end.x) + GEOMETRY_EPSILON &&
    point.x + GEOMETRY_EPSILON >= Math.min(start.x, end.x) &&
    point.y <= Math.max(start.y, end.y) + GEOMETRY_EPSILON &&
    point.y + GEOMETRY_EPSILON >= Math.min(start.y, end.y)
  );
}

function segmentsIntersect(
  firstStart: Point2D,
  firstEnd: Point2D,
  secondStart: Point2D,
  secondEnd: Point2D,
) {
  const firstOrientation = orientation(firstStart, firstEnd, secondStart);
  const secondOrientation = orientation(firstStart, firstEnd, secondEnd);
  const thirdOrientation = orientation(secondStart, secondEnd, firstStart);
  const fourthOrientation = orientation(secondStart, secondEnd, firstEnd);

  if (
    ((firstOrientation > GEOMETRY_EPSILON && secondOrientation < -GEOMETRY_EPSILON) ||
      (firstOrientation < -GEOMETRY_EPSILON && secondOrientation > GEOMETRY_EPSILON)) &&
    ((thirdOrientation > GEOMETRY_EPSILON && fourthOrientation < -GEOMETRY_EPSILON) ||
      (thirdOrientation < -GEOMETRY_EPSILON && fourthOrientation > GEOMETRY_EPSILON))
  ) {
    return true;
  }

  return (
    (Math.abs(firstOrientation) <= GEOMETRY_EPSILON &&
      isPointOnSegment(firstStart, secondStart, firstEnd)) ||
    (Math.abs(secondOrientation) <= GEOMETRY_EPSILON &&
      isPointOnSegment(firstStart, secondEnd, firstEnd)) ||
    (Math.abs(thirdOrientation) <= GEOMETRY_EPSILON &&
      isPointOnSegment(secondStart, firstStart, secondEnd)) ||
    (Math.abs(fourthOrientation) <= GEOMETRY_EPSILON &&
      isPointOnSegment(secondStart, firstEnd, secondEnd))
  );
}

export function normalizeOcclusionPolygon(
  points: Point2D[],
  width: number,
  height: number,
): ManualOcclusionPolygon {
  if (width <= 0 || height <= 0) {
    return points.map(() => ({ x: 0, y: 0 }));
  }

  return points.map((point) => ({
    x: clamp(point.x / width, 0, 1),
    y: clamp(point.y / height, 0, 1),
  }));
}

export function denormalizeOcclusionPolygon(
  points: ManualOcclusionPolygon,
  width: number,
  height: number,
): Point2D[] {
  return points.map((point) => ({
    x: clamp(point.x, 0, 1) * Math.max(width, 0),
    y: clamp(point.y, 0, 1) * Math.max(height, 0),
  }));
}

export function getPolygonSignedArea(points: Point2D[]) {
  if (points.length < 3) {
    return 0;
  }

  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

export function hasSelfIntersections(points: Point2D[]) {
  if (points.length < 4) {
    return false;
  }

  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    const firstNextIndex = (firstIndex + 1) % points.length;

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < points.length;
      secondIndex += 1
    ) {
      const secondNextIndex = (secondIndex + 1) % points.length;
      const edgesAreAdjacent =
        firstIndex === secondIndex ||
        firstIndex === secondNextIndex ||
        firstNextIndex === secondIndex;

      if (edgesAreAdjacent) {
        continue;
      }

      if (
        segmentsIntersect(
          points[firstIndex],
          points[firstNextIndex],
          points[secondIndex],
          points[secondNextIndex],
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function validateOcclusionPolygon(
  points: Point2D[],
): OcclusionPolygonValidation {
  if (points.length < 3) {
    return { valid: false, reason: "too_few_points" };
  }

  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    return { valid: false, reason: "non_finite" };
  }

  for (let firstIndex = 0; firstIndex < points.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < points.length;
      secondIndex += 1
    ) {
      if (pointsAreEqual(points[firstIndex], points[secondIndex])) {
        return { valid: false, reason: "duplicate_points" };
      }
    }
  }

  if (Math.abs(getPolygonSignedArea(points)) <= GEOMETRY_EPSILON) {
    return { valid: false, reason: "zero_area" };
  }

  if (hasSelfIntersections(points)) {
    return { valid: false, reason: "self_intersection" };
  }

  return { valid: true };
}

export function rasterizeOcclusionPolygons(
  polygons: ManualOcclusionPolygon[],
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0 || polygons.length === 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 255, 255, 1)";
  context.globalCompositeOperation = "source-over";

  for (const polygon of polygons) {
    const points = denormalizeOcclusionPolygon(polygon, width, height);
    if (!validateOcclusionPolygon(points).valid) {
      continue;
    }

    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      context.lineTo(points[index].x, points[index].y);
    }
    context.closePath();
    context.fill();
  }

  return canvas.toDataURL("image/png");
}
