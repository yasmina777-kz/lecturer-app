import type { MotionAsset } from "./motion";

/** A readable pose inside the sign, excluding its neutral preparation/release. */
export function letterPreviewTime(step: MotionAsset): number {
  const middle = ((step.leadIn ?? 0) + step.duration - (step.leadOut ?? 0)) / 2;
  const requested = step.chartPose?.holdTime ?? middle;
  return Math.max(0, Math.min(step.duration - 1 / 30, requested));
}

/** Finish after the meaningful movement, before the hand returns to the hip. */
export function letterEndTime(step: MotionAsset): number {
  return Math.max(
    letterPreviewTime(step),
    step.duration - (step.leadOut ?? 0) - 1 / 30,
  );
}
