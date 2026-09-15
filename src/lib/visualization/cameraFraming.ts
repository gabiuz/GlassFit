export function getHorizontalFovRadians(
  verticalFovDegrees: number,
  aspectRatio: number,
) {
  const verticalFovRadians = (verticalFovDegrees * Math.PI) / 180;
  return 2 * Math.atan(
    Math.tan(verticalFovRadians / 2) * Math.max(aspectRatio, 0.01),
  );
}

export function getVerticalFovDegrees(
  horizontalFovRadians: number,
  aspectRatio: number,
) {
  const verticalFovRadians = 2 * Math.atan(
    Math.tan(horizontalFovRadians / 2) / Math.max(aspectRatio, 0.01),
  );
  return (verticalFovRadians * 180) / Math.PI;
}
