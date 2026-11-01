import {
  decomposeText,
  type DictionaryEntry,
  type DictionaryForms,
} from "./dictionary";
import { preparedSigns } from "./textPlan";
export type MotionAsset = {
  id: string;
  label: string;
  url: string;
  revision?: string;
  duration: number;
  reference?: string;
  review: string;
  handCoverage?: Record<string, number>;
  leadIn?: number;
  leadOut?: number;
  chartPose?: {
    source: string;
    method: string;
    holdTime: number;
    hand: "Right" | "Left";
    movement: string;
    review: string;
  };
  transitionPose?: {
    at?: "rest";
    start: Record<string, number[]>;
    end: Record<string, number[]>;
  };
};
export type MotionStep = MotionAsset & { text: string };
export type MotionPlan = {
  steps: MotionStep[];
  missing: string[];
  spelling: boolean;
};
export function planMotion(
  text: string,
  entries: DictionaryEntry[],
  forms: DictionaryForms,
  assets: MotionAsset[],
  spelling = false,
): MotionPlan {
  spelling = spelling || /^[а-яё]$/iu.test(text.trim());
  const legacy = preparedSigns
    .filter((p) => p.phrase.length > 1)
    .map((p) => ({
      id: "prepared-" + p.animation,
      label: p.phrase,
      category: "Фразы",
      video: "",
      source: "",
      dataset: "",
    }));
  const all = spelling ? entries : [...entries, ...legacy];
  const pieces = decomposeText(text, all, forms, spelling);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const steps: MotionStep[] = [],
    missing: string[] = [];
  for (const p of pieces) {
    if (p.punctuation) continue;
    // Every entry, including the three authored phrases, must resolve to the
    // rebuilt catalog. Never silently fall back to the old finger animations.
    const asset = p.entry ? byId.get(p.entry.id) : undefined;
    if (asset) steps.push({ ...asset, text: p.text });
    else missing.push(p.text);
  }
  return { steps, missing, spelling };
}
export const MOTION_GAP = 0.25;
// Quintic easing has peak derivative 1.875. Bound transition speed to the
// same 8 degrees/frame limit used by the baked clips at 30 fps.
export const TRANSITION_SPEED_DEGREES = 240;
export function transitionDuration(a: MotionAsset, b: MotionAsset) {
  const from = a.transitionPose?.end,
    to = b.transitionPose?.start;
  if (!from || !to || a.transitionPose?.at !== "rest" || b.transitionPose?.at !== "rest")
    return 1.5; // Old catalogs must not use captured handshapes as rest boundaries.
  let angle = 0;
  for (const [name, q] of Object.entries(from)) {
    const r = to[name];
    if (!r) continue;
    const norm = Math.hypot(...q) * Math.hypot(...r);
    if (!norm) continue;
    const dot = Math.abs(q.reduce((sum, v, i) => sum + v * r[i], 0) / norm);
    angle = Math.max(angle, (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI);
  }
  return Math.max(
    MOTION_GAP,
    Math.ceil(((angle * 1.875) / TRANSITION_SPEED_DEGREES) * 60) / 60,
  );
}
export function motionTimeline(steps: MotionStep[]) {
  let cursor = 0;
  return steps.map((step, index) => {
    const start = cursor;
    // Keep Blender's coordinated release and preparation. Slerping local joints
    // directly between two sign handshapes breaks the arm chain and finger pose,
    // even when angular speed is bounded. Only join relaxed endpoints.
    const trimStart = 0;
    const trimEnd = 0;
    const duration = step.duration - trimStart - trimEnd;
    const gapAfter =
      index < steps.length - 1 ? transitionDuration(step, steps[index + 1]) : 0;
    cursor += duration + gapAfter;
    return {
      ...step,
      trimStart,
      trimEnd,
      gapAfter,
      start,
      end: start + duration,
    };
  });
}
