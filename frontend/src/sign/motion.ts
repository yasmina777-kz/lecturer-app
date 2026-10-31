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
  duration: number;
  reference?: string;
  review: string;
  handCoverage?: Record<string, number>;
  leadIn?: number;
  leadOut?: number;
  transitionPose?: {
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
const legacyFiles: Record<string, string> = {
  hello: "mira-hello.glb",
  thanks: "mira-thanks.glb",
  "name-demo": "mira-signing-soft.glb",
  a: "letter-a.glb",
  v: "letter-v.glb",
  g: "letter-g.glb",
  l: "letter-l.glb",
  u: "letter-u.glb",
  sh: "letter-sh.glb",
  y: "letter-y.glb",
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
    let asset = p.entry ? byId.get(p.entry.id) : undefined;
    if (p.entry?.id.startsWith("prepared-")) {
      const id = p.entry.id.slice(9);
      asset = {
        id: p.entry.id,
        label: p.entry.label,
        url: "/avatars/mira-blender/" + legacyFiles[id],
        duration: 8,
        review: "experimental-unreviewed",
      };
    }
    // Existing authored letters remain available if motion capture failed.
    if (!asset && p.entry?.category === "Алфавит") {
      const sign = preparedSigns.find((s) => s.phrase === p.entry?.label);
      if (sign)
        asset = {
          id: p.entry.id,
          label: p.entry.label,
          url: "/avatars/mira-blender/" + legacyFiles[sign.animation],
          duration: 8,
          review: "experimental-unreviewed",
          reference: p.entry.video,
        };
    }
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
  if (!from || !to) return 1.5; // Legacy authored clips: safe even for a 180° change.
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
    // Trim only synthetic rest poses, never the captured sign itself.
    const trimStart = index > 0 ? (step.leadIn ?? 0) : 0;
    const trimEnd = index < steps.length - 1 ? (step.leadOut ?? 0) : 0;
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
