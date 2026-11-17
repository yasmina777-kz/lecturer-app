/** Canonical two-hand clip features: exact twin of ml/rsl/word_features.py.
 * See that file for the algorithm. Input: per frame, the MediaPipe image
 * landmarks of every detected hand (handedness is not used), plus the video
 * size. Output: [frames][134] for the cropped clip, or null without hands.
 */
export type HandPoint = { x: number; y: number; z: number };
export const WORD_CHANNELS = 134;

type Hand = number[][]; // 21 x [X, Y, Z]
const palm = (h: Hand) => Math.hypot(h[9][0] - h[0][0], h[9][1] - h[0][1], h[9][2] - h[0][2]);
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

export function clipFeatures(frames: HandPoint[][][], width: number, height: number): number[][] | null {
  const m = Math.max(width, height);
  if (!(m > 0)) return null;
  const sx = width / m, sy = height / m;
  const tracks: (Hand | null)[][] = [];
  const last: ([number, number] | null)[] = [null, null];
  for (const hands of frames) {
    const scaled: { area: number; h: Hand }[] = [];
    for (const raw of hands) {
      if (raw.length !== 21 || raw.some((p) => !Number.isFinite(p.x + p.y + p.z))) continue;
      const h = raw.map((p) => [p.x * sx, p.y * sy, p.z * sx]);
      const xs = h.map((p) => p[0]), ys = h.map((p) => p[1]);
      scaled.push({ area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)), h });
    }
    const top = scaled.sort((a, b) => b.area - a.area).slice(0, 2).map((s) => s.h);
    const row: (Hand | null)[] = [null, null];
    if (top.length === 2) {
      const pair = top[0][0][0] <= top[1][0][0] ? top : [top[1], top[0]];
      for (let k = 0; k < 2; k++) {
        row[k] = pair[k];
        last[k] = [pair[k][0][0], pair[k][0][1]];
      }
    } else if (top.length === 1) {
      const s = top[0];
      let k: number;
      if (!last[0] && !last[1]) k = s[0][0] < 0.5 * sx ? 0 : 1;
      else {
        const d = last.map((l) => (l ? Math.hypot(s[0][0] - l[0], s[0][1] - l[1]) : Infinity));
        k = d[0] <= d[1] ? 0 : 1;
      }
      row[k] = s;
      last[k] = [s[0][0], s[0][1]];
    }
    tracks.push(row);
  }
  const withHand = tracks.map((r, i) => (r[0] || r[1] ? i : -1)).filter((i) => i >= 0);
  if (!withHand.length) return null;
  let clip = tracks.slice(withHand[0], withHand[withHand.length - 1] + 1);
  const path = (k: number) => {
    const w = clip.map((r) => r[k]).filter((h): h is Hand => !!h).map((h) => h[0]);
    if (!w.length) return -1;
    let sum = 0;
    for (let i = 1; i < w.length; i++) sum += Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]);
    return sum;
  };
  if (path(1) > path(0))
    clip = clip.map((r) => [r[1], r[0]].map((h) => (h ? h.map((p) => [-p[0], p[1], p[2]]) : null)));
  const dom = clip.map((r) => r[0]).filter((h): h is Hand => !!h);
  if (!dom.length) return null;
  const scale = Math.max(median(dom.map(palm)), 1e-3);
  const origin = [median(dom.map((h) => h[0][0])), median(dom.map((h) => h[0][1]))];
  return clip.map((r) => {
    const out = new Array<number>(WORD_CHANNELS).fill(0);
    r.forEach((h, k) => {
      if (!h) return;
      const p = Math.max(palm(h), 1e-3), base = k * 66;
      h.forEach((pt, j) => {
        for (let c = 0; c < 3; c++) out[base + j * 3 + c] = (pt[c] - h[0][c]) / p;
      });
      out[base + 63] = (h[0][0] - origin[0]) / scale;
      out[base + 64] = (h[0][1] - origin[1]) / scale;
      out[base + 65] = 1;
    });
    if (r[0] && r[1]) {
      out[132] = (r[1][0][0] - r[0][0][0]) / scale;
      out[133] = (r[1][0][1] - r[0][0][1]) / scale;
    }
    return out;
  });
}

export function resampleFrames(features: number[][], frames = 32): number[][] {
  const n = features.length;
  return Array.from({ length: frames }, (_, i) => features[Math.floor((i * (n - 1)) / (frames - 1))]);
}

/** Smoothed wrist extent in palm lengths (max over both hands): twin of
 * motion() in ml/rsl/spotting_gate_eval.py. Resting/jittering hands stay
 * near 0; real signs move well above MOTION_GATE. */
export const MOTION_GATE = 0.6;
/** Lower gate for a single deliberate attempt (drops <1% of real signs). */
export const ATTEMPT_GATE = 0.3;
export function motionExtent(features: number[][]): number {
  let best = 0;
  for (const b of [0, 66]) {
    const pts = features.filter((f) => f[b + 65] > 0).map((f) => [f[b + 63], f[b + 64]]);
    if (pts.length < 3) continue;
    for (let axis = 0; axis < 2; axis++) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 1; i < pts.length - 1; i++) {
        const v = (pts[i - 1][axis] + pts[i][axis] + pts[i + 1][axis]) / 3;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      best = Math.max(best, hi - lo);
    }
  }
  return best;
}
