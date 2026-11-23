import type { HandPoint, PosePoint } from "./wordFeatures";

/** Concrete advice after a failed camera attempt — what to change, not just
 * "wrong". Measured on the clip the recognizer saw (normalised 0..1 image
 * coordinates). Most important first; at most two. */
export type CameraHint = { id: string; ru: string; en: string; kk: string };

const HINTS: Record<string, Omit<CameraHint, "id">> = {
  fast: {
    ru: "Жест получился слишком быстрым — покажите медленнее и чуть задержите руку в конце.",
    en: "Too fast — sign more slowly and hold the hand briefly at the end.",
    kk: "Тым жылдам — баяуырақ көрсетіңіз.",
  },
  edge: {
    ru: "Рука выходит за край кадра — отодвиньтесь от камеры или сядьте по центру.",
    en: "Your hand leaves the frame — move back or centre yourself.",
    kk: "Қол кадрдан шығып кетеді — артқа жылжыңыз.",
  },
  far: {
    ru: "Рука далеко от камеры — подойдите ближе, чтобы пальцы были крупнее.",
    en: "Your hand is far away — come closer so the fingers are bigger.",
    kk: "Қол алыста — жақынырақ келіңіз.",
  },
  low: {
    ru: "Поднимите руку выше — жест показывают на уровне груди или лица.",
    en: "Raise your hand — signs are made at chest or face height.",
    kk: "Қолды жоғарырақ көтеріңіз.",
  },
  lost: {
    ru: "Пальцы плохо видны — встаньте лицом к свету и уберите яркое окно из-за спины.",
    en: "Fingers are hard to see — face the light and avoid a bright window behind you.",
    kk: "Саусақтар нашар көрінеді — жарыққа қарап тұрыңыз.",
  },
  body: {
    ru: "Плечи не видны в кадре — отодвиньтесь, чтобы были видны голова, плечи и руки.",
    en: "Shoulders are not in view — move back so head, shoulders and hands are visible.",
    kk: "Иық көрінбейді — артқа жылжыңыз.",
  },
};

export function cameraHints(frames: HandPoint[][][], poses: PosePoint[][] = [], frameMs = 50): CameraHint[] {
  const out: string[] = [];
  const n = frames.length;
  if (!n) return [{ id: "lost", ...HINTS.lost }];
  if (n * frameMs < 500) out.push("fast");
  const hands = frames.flat().filter((h) => h.length === 21);
  const withHands = frames.filter((f) => f.some((h) => h.length === 21)).length / n;
  if (withHands < 0.6) out.push("lost");
  if (hands.length) {
    const edge = hands.filter((h) => h.some((p) => p.x < 0.02 || p.x > 0.98 || p.y > 0.98 || p.y < 0.02)).length / hands.length;
    if (edge > 0.25) out.push("edge");
    const size = hands.map((h) => {
      const xs = h.map((p) => p.x), ys = h.map((p) => p.y);
      return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    }).sort((a, b) => a - b)[Math.floor(hands.length / 2)];
    if (size < 0.09) out.push("far");
  }
  const body = poses.filter((p) => p.length >= 17 && (p[11].visibility ?? 1) > 0.5 && (p[12].visibility ?? 1) > 0.5);
  if (poses.length && body.length < poses.length * 0.4) out.push("body");
  else if (body.length && hands.length) {
    // Wrist height vs the body: a sign below mid-torso usually was not seen fully.
    const low = frames.filter((f, i) => {
      const p = poses[i];
      if (!p || p.length < 25 || !f.length) return false;
      const shoulder = (p[11].y + p[12].y) / 2, hip = p[23] && p[24] ? (p[23].y + p[24].y) / 2 : shoulder + 0.35;
      return f.every((h) => h[0].y > shoulder + (hip - shoulder) * 0.75);
    }).length;
    if (low > n * 0.6) out.push("low");
  }
  return out.slice(0, 2).map((id) => ({ id, ...HINTS[id] }));
}
