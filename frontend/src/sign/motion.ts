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
export function motionTimeline(steps: MotionStep[]) {
  let cursor = 0;
  return steps.map((step, index) => {
    const start = cursor;
    cursor += step.duration + (index < steps.length - 1 ? MOTION_GAP : 0);
    return { ...step, start, end: start + step.duration };
  });
}
