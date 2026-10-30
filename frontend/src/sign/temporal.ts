import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { classifyFeatures, type SignClassifier } from "./recognition";
export type TemporalFrame = number[];
export function temporalFrame(r: HandLandmarkerResult): TemporalFrame {
  if (!r.landmarks.length) return Array(66).fill(0);
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
export function temporalFeatures(frames: TemporalFrame[]): number[] | null {
  if (
    frames.length !== 16 ||
    frames.some((f) => f.length !== 66 || f.some((v) => !Number.isFinite(v)))
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
  model: SignClassifier,
) {
  const f = temporalFeatures(frames);
  if (!f) return null;
  const r = classifyFeatures(f, model);
  if (!r) return null;
  return {
    ...r,
    accepted:
      r.accepted &&
      r.label !== "no_event" &&
      frames.filter((f) => f[65] > 0).length >= 8,
  };
}
