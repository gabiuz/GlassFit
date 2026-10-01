import assert from "node:assert";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PITCH_MAX,
  PITCH_MIN,
  stepPitch,
  stepYaw,
  YAW_MAX,
  YAW_MIN,
} from "../../src/features/visualization/rotationStepper";

const workspaceSource = readFileSync(
  "src/features/visualization/components/ProductModelWorkspace.tsx",
  "utf8",
);

describe("QAD-TC54: discrete yaw and pitch steppers", () => {
  it("increments and decrements yaw by one degree", () => {
    assert.equal(stepYaw(0, 1), 1);
    assert.equal(stepYaw(0, -1), -1);
  });

  it("clamps yaw to its configured bounds", () => {
    assert.equal(stepYaw(YAW_MAX, 1), YAW_MAX);
    assert.equal(stepYaw(YAW_MIN, -1), YAW_MIN);
    assert.equal(stepYaw(500, 1), YAW_MAX);
    assert.equal(stepYaw(-500, -1), YAW_MIN);
  });

  it("increments and decrements pitch by one degree", () => {
    assert.equal(stepPitch(0, 1), 1);
    assert.equal(stepPitch(0, -1), -1);
  });

  it("clamps pitch to its configured bounds", () => {
    assert.equal(stepPitch(PITCH_MAX, 1), PITCH_MAX);
    assert.equal(stepPitch(PITCH_MIN, -1), PITCH_MIN);
    assert.equal(stepPitch(500, 1), PITCH_MAX);
    assert.equal(stepPitch(-500, -1), PITCH_MIN);
  });

  it("snaps fractional values before applying the step", () => {
    assert.equal(stepYaw(14.7, 1), 16);
    assert.equal(stepYaw(14.7, -1), 14);
    assert.equal(stepPitch(5.4, 1), 6);
    assert.equal(stepPitch(-12.8, -1), -14);
  });

  it("exposes accessible bounded controls and tabular degree readouts", () => {
    for (const label of [
      "Decrease yaw by 1 degree",
      "Increase yaw by 1 degree",
      "Decrease pitch by 1 degree",
      "Increase pitch by 1 degree",
    ]) {
      assert.ok(workspaceSource.includes(`aria-label="${label}"`));
    }

    assert.match(workspaceSource, /disabled=\{yaw <= -180\}/);
    assert.match(workspaceSource, /disabled=\{yaw >= 180\}/);
    assert.match(workspaceSource, /disabled=\{pitch <= -90\}/);
    assert.match(workspaceSource, /disabled=\{pitch >= 90\}/);
    assert.ok(workspaceSource.includes("min-h-11 min-w-11"));
    assert.ok(workspaceSource.includes("tabular-nums"));
    assert.ok(workspaceSource.includes('aria-label="Turn Left / Right"'));
    assert.ok(workspaceSource.includes('aria-label="Tilt Up / Down"'));
  });
});
