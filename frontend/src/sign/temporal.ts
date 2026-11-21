import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { classifyFeatures, type SignClassifier } from "./recognition";
import { classifySeq, type SeqModel } from "./seqModel";
export type TemporalFrame = number[];
export function temporalFrame(r: HandLandmarkerResult): TemporalFrame {
  if (
    !r.landmarks.length ||
    r.landmarks.some(
      (points) =>
        points.length !== 21 ||
        points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)),
    )
  )
    return Array(66).fill(0);
  const area = (p: (typeof r.landmarks)[number]) =>
    (Math.max(...p.map((v) => v.x)) - Math.min(...p.map((v) => v.x))) *
    (Math.max(...p.map((v) => v.y)) - Math.min(...p.map((v) => v.y)));
  const k = r.landmarks.reduce(
    (best, p, i) => (area(p) > area(r.landmarks[best]) ? i : best),
    0,
  );
  const p = r.worldLandmarks[k],
    im = r.landmarks[k];
  if (!p || p.length !== 21 || p.some((v) => !Number.isFinite(v.x + v.y + v.z)))
    return Array(66).fill(0);
  const scale = Math.hypot(p[0].x - p[9].x, p[0].y - p[9].y, p[0].z - p[9].z);
  if (scale < 1e-6) return Array(66).fill(0);
  const flip = r.handedness[k]?.[0]?.categoryName === "Left" ? -1 : 1;
  return [
    ...p.flatMap((v) => [
      ((v.x - p[0].x) / scale) * flip,
      (v.y - p[0].y) / scale,
      (v.z - p[0].z) / scale,
    ]),
    im[0].x * flip,
    im[0].y,
    Math.max(Math.hypot(im[0].x - im[9].x, im[0].y - im[9].y), 0.02),
  ];
}
/** Where the hand is on the body (v6 letters): the wrist relative to the
 * shoulders, nose and mouth, the elbow on that side, in shoulder widths,
 * mirrored for a left hand like temporalFrame; last value = body found.
 * Twin of ml/rsl/train_alphabet_v6.py body_features. `pose` = MediaPipe Pose
 * landmarks (image coords), `aspect` = frame width / height. */
export const BODY_CHANNELS = 9;
export function bodyFrame(hand: TemporalFrame, pose: { x: number; y: number; visibility?: number }[], aspect: number): number[] {
  const zero = Array(BODY_CHANNELS).fill(0);
  const at = (i: number) => pose[i];
  if (!(hand[65] > 0) || pose.length < 17 || (at(11).visibility ?? 1) < 0.5 || (at(12).visibility ?? 1) < 0.5) return zero;
  const flip = hand[63] < 0 ? -1 : 1;
  const P = (i: number): [number, number] => [at(i).x * aspect, at(i).y];
  const w: [number, number] = [hand[63] * flip * aspect, hand[64]];
  const [l, r] = [P(11), P(12)];
  const sm: [number, number] = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
  const sw = Math.hypot(l[0] - r[0], l[1] - r[1]);
  if (sw < 1e-3) return zero;
  const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const elbow = d(P(15), w) <= d(P(16), w) ? P(13) : P(14);
  const rel = (a: [number, number], o: [number, number]) => [((a[0] - o[0]) * flip) / sw, (a[1] - o[1]) / sw];
  const m1 = P(9), m2 = P(10);
  const mouth: [number, number] = [(m1[0] + m2[0]) / 2, (m1[1] + m2[1]) / 2];
  return [...rel(w, sm), ...rel(w, P(0)), ...rel(w, mouth), ...rel(elbow, sm), 1];
}

/** Gap-interpolated, wrist-normalized 16x66 window (v5 model input; also
 * the first stage of the v1-v4 aggregated features). */
export function temporalWindow(frames: TemporalFrame[]): number[][] | null {
  const width = frames[0]?.length;
  if (
    frames.length !== 16 ||
    (width !== 66 && width !== 66 + BODY_CHANNELS) ||
    frames.some((f) => f.length !== width || f.some((v) => !Number.isFinite(v)))
  )
    return null;
  const valid = frames
    .map((f, i) => (f[65] > 0 ? i : -1))
    .filter((i) => i >= 0);
  const a = frames.map((f) => f.slice());
  if (valid.length) {
    for (let i = 0; i < 16; i++)
      if (!valid.includes(i)) {
        const lo = [...valid].reverse().find((j) => j < i) ?? valid[0],
          hi = valid.find((j) => j > i) ?? valid[valid.length - 1];
        const u = hi === lo ? 0 : (i - lo) / (hi - lo);
        a[i] = a[lo].map((v, c) => v + (a[hi][c] - v) * u);
      }
    const scales = valid.map((i) => a[i][65]).sort((a, b) => a - b),
      n = scales.length;
    const scale = Math.max(
      n % 2 ? scales[(n - 1) / 2] : (scales[n / 2 - 1] + scales[n / 2]) / 2,
      0.02,
    );
    const origin = a[valid[0]].slice(63, 65);
    for (const f of a) {
      f[63] = (f[63] - origin[0]) / scale;
      f[64] = (f[64] - origin[1]) / scale;
    }
  } else for (const f of a) f.fill(0);
  a.forEach((f, i) => (f[65] = valid.includes(i) ? 1 : 0));
  if (width > 66) {
    // Body: interpolated over the frames where it was found (from the raw input).
    const last = width - 1;
    const ok = frames.map((f, i) => (f[last] > 0 ? i : -1)).filter((i) => i >= 0);
    for (let i = 0; i < 16; i++)
      for (let c = 66; c < width; c++) {
        if (!ok.length) a[i][c] = 0;
        else if (c === last) a[i][c] = frames[i][last] > 0 ? 1 : 0;
        else {
          const lo = [...ok].reverse().find((j) => j <= i) ?? ok[0],
            hi = ok.find((j) => j >= i) ?? ok[ok.length - 1];
          const u = hi === lo ? 0 : (i - lo) / (hi - lo);
          a[i][c] = frames[lo][c] + (frames[hi][c] - frames[lo][c]) * u;
        }
      }
  }
  return a;
}
export function temporalFeatures(frames: TemporalFrame[]): number[] | null {
  const a = temporalWindow(frames.map((f) => f.slice(0, 66)));
  if (!a) return null;
  const result: number[] = [];
  for (let bin = 0; bin < 4; bin++)
    for (let c = 0; c < 66; c++)
      result.push(
        a.slice(bin * 4, bin * 4 + 4).reduce((sum, f) => sum + f[c], 0) / 4,
      );
  for (let i = 0; i < 21; i++)
    for (let j = i + 1; j < 21; j++)
      result.push(
        a.reduce(
          (sum, f) =>
            sum +
            Math.hypot(
              f[i * 3] - f[j * 3],
              f[i * 3 + 1] - f[j * 3 + 1],
              f[i * 3 + 2] - f[j * 3 + 2],
            ),
          0,
        ) / 16,
      );
  return result;
}
export function recognizeSequence(
  frames: TemporalFrame[],
  model: SignClassifier | SeqModel,
) {
  let r: { label: string; confidence: number; probabilities: number[]; accepted: boolean } | null;
  if ("layers" in model && model.layers?.[0] && "type" in model.layers[0]) {
    const w = temporalWindow(frames);
    r = w && classifySeq(model as SeqModel, w);
  } else {
    const f = temporalFeatures(frames);
    r = f && classifyFeatures(f, model as SignClassifier);
  }
  if (!r) return null;
  return {
    ...r,
    accepted:
      r.accepted &&
      r.label !== "no_event" &&
      frames.filter((f) => f[65] > 0).length >= 8,
  };
}

/** An explicitly completed sign can be shorter than the streaming debounce.
 * Select the same 16 uniformly spaced positions used by offline extraction.
 * Require eight real observations before resampling; duplicated positions do
 * not count as extra camera evidence. The user marks the utterance boundary.
 */
export function completedLetterFrames(frames: TemporalFrame[]): TemporalFrame[] | null {
  if (frames.length < 8 || frames.length > 100 ||
      frames.some(f => f.length !== frames[0].length || (f.length !== 66 && f.length !== 66 + BODY_CHANNELS) || f.some(v => !Number.isFinite(v))) ||
      frames.filter(f => f[65] > 0).length < Math.max(8, Math.ceil(frames.length / 2)))
    return null;
  return Array.from({length: 16}, (_, i) => frames[Math.floor(i * (frames.length - 1) / 15)].slice());
}
