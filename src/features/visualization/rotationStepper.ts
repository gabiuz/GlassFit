export const YAW_MIN = -180;
export const YAW_MAX = 180;
export const PITCH_MIN = -90;
export const PITCH_MAX = 90;

type RotationDelta = 1 | -1;

const stepAngle = (
  current: number,
  delta: RotationDelta,
  minimum: number,
  maximum: number,
): number => {
  const snappedCurrent = Number.isFinite(current) ? Math.round(current) : 0;
  return Math.min(maximum, Math.max(minimum, snappedCurrent + delta));
};

export const stepYaw = (currentYaw: number, delta: RotationDelta): number =>
  stepAngle(currentYaw, delta, YAW_MIN, YAW_MAX);

export const stepPitch = (currentPitch: number, delta: RotationDelta): number =>
  stepAngle(currentPitch, delta, PITCH_MIN, PITCH_MAX);
