/** Canonical two-hand clip features: exact twin of ml/rsl/word_features.py.
 * See that file for the algorithm. Input: per frame, the MediaPipe image
 * landmarks of every detected hand (handedness is not used), plus the video
 * size. Output: [frames][134] for the cropped clip, or null without hands.
 */
export type HandPoint = { x: number; y: number; z: number };
export const WORD_CHANNELS = 134;
/** v5 body channels (twin of body_row in ml/rsl/word_features.py). */
export const WORD_BODY = 13;
export type PosePoint = { x: number; y: number; visibility?: number };
/** v6 face channels: twin of ml/rsl/face_features.py face_row. */
export const WORD_FACE = 21;
const FACE_GROUPS = [
  ["browInnerUp"], ["browDownLeft", "browDownRight"], ["browOuterUpLeft", "browOuterUpRight"],
  ["eyeSquintLeft", "eyeSquintRight"], ["eyeWideLeft", "eyeWideRight"], ["eyeBlinkLeft", "eyeBlinkRight"],
  ["jawOpen"], ["mouthFunnel"], ["mouthPucker"], ["mouthSmileLeft", "mouthSmileRight"],
  ["mouthPressLeft", "mouthPressRight"], ["mouthRollLower", "mouthRollUpper"],
  ["mouthStretchLeft", "mouthStretchRight"], ["mouthClose"], ["mouthUpperUpLeft", "mouthUpperUpRight"],
  ["mouthLowerDownLeft", "mouthLowerDownRight"], ["cheekPuff"],
];
const FACE_YAW = 17, FACE_ROLL = 19;
/** blend: blendshape scores by name; landmarks: Face Landmarker points (image coords).
 * Yaw/roll are not mirrored here (clipFeatures mirrors them with the hands). */
export function faceRow(blend: Record<string, number> | null, landmarks: { x: number; y: number }[] | null, width: number, height: number): number[] {
  if (!blend || !landmarks || landmarks.length <= 454) return new Array<number>(WORD_FACE).fill(0);
  const row = FACE_GROUPS.map((g) => g.reduce((a, n) => a + (blend[n] ?? 0), 0) / g.length);
  const m = Math.max(width, height);
  const P = (i: number) => [(landmarks[i].x * width) / m, (landmarks[i].y * height) / m];
  const [nx, ny] = P(1), [lx, ly] = P(234), [rx, ry] = P(454), [tx, ty] = P(10), [cx, cy] = P(152), [ax, ay] = P(33), [bx, by] = P(263);
  const fw = Math.max(Math.hypot(rx - lx, ry - ly), 1e-4), fh = Math.max(Math.hypot(cx - tx, cy - ty), 1e-4);
  return [...row, ((nx - (lx + rx) / 2) / fw) * 2, ((ny - (ty + cy) / 2) / fh) * 2, Math.atan2(by - ay, bx - ax), 1];
}

type Hand = number[][]; // 21 x [X, Y, Z]
const palm = (h: Hand) => Math.hypot(h[9][0] - h[0][0], h[9][1] - h[0][1], h[9][2] - h[0][2]);
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/** `poses` (optional, one per frame, MediaPipe Pose landmarks; [] = not found)
 * adds WORD_BODY channels: where each hand is relative to shoulders, nose, mouth. */
export function clipFeatures(frames: HandPoint[][][], width: number, height: number, poses?: PosePoint[][], faces?: (number[] | null)[]): number[][] | null {
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
  const pose = poses?.slice(withHand[0], withHand[withHand.length - 1] + 1);
  const face = faces?.slice(withHand[0], withHand[withHand.length - 1] + 1);
  let mirror = 1;
  const path = (k: number) => {
    const w = clip.map((r) => r[k]).filter((h): h is Hand => !!h).map((h) => h[0]);
    if (!w.length) return -1;
    let sum = 0;
    for (let i = 1; i < w.length; i++) sum += Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]);
    return sum;
  };
  if (path(1) > path(0)) {
    clip = clip.map((r) => [r[1], r[0]].map((h) => (h ? h.map((p) => [-p[0], p[1], p[2]]) : null)));
    mirror = -1;
  }
  const dom = clip.map((r) => r[0]).filter((h): h is Hand => !!h);
  if (!dom.length) return null;
  const scale = Math.max(median(dom.map(palm)), 1e-3);
  const origin = [median(dom.map((h) => h[0][0])), median(dom.map((h) => h[0][1]))];
  const rows = clip.map((r, t) => {
    const fb = WORD_CHANNELS + (poses ? WORD_BODY : 0);
    const out = new Array<number>(fb + (faces ? WORD_FACE : 0)).fill(0);
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
    if (poses) bodyRow(pose?.[t] ?? [], r, sx * mirror, sy).forEach((v, i) => (out[WORD_CHANNELS + i] = v));
    const fr = face?.[t];
    if (faces && fr && fr.length === WORD_FACE) fr.forEach((v, i) => (out[fb + i] = i === FACE_YAW || i === FACE_ROLL ? v * mirror : v));
    return out;
  });
  if (faces) {
    // Relative face (v6b, twin of word_features.py): subtract the signer's own
    // median expression/head pose in this clip; keep only the movement.
    const fb = WORD_CHANNELS + (poses ? WORD_BODY : 0), flag = fb + WORD_FACE - 1;
    const seen = rows.filter((o) => o[flag] > 0);
    if (seen.length)
      for (let c = fb; c < flag; c++) {
        const med = median(seen.map((o) => o[c]));
        for (const o of seen) o[c] -= med;
      }
  }
  return rows;
}

function bodyRow(p: PosePoint[], hands: (Hand | null)[], kx: number, ky: number): number[] {
  const row = new Array<number>(WORD_BODY).fill(0);
  if (p.length < 17 || (p[11].visibility ?? 1) < 0.5 || (p[12].visibility ?? 1) < 0.5) return row;
  const P = (i: number) => [p[i].x * kx, p[i].y * ky];
  const l = P(11), r = P(12), nose = P(0), m1 = P(9), m2 = P(10);
  const sm = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2], sw = Math.hypot(l[0] - r[0], l[1] - r[1]);
  if (sw < 1e-3) return row;
  const mouth = [(m1[0] + m2[0]) / 2, (m1[1] + m2[1]) / 2];
  hands.forEach((h, k) => {
    if (!h) return;
    const w = h[0];
    [sm, nose, mouth].forEach((o, j) => {
      row[k * 6 + j * 2] = (w[0] - o[0]) / sw;
      row[k * 6 + j * 2 + 1] = (w[1] - o[1]) / sw;
    });
  });
  row[12] = 1;
  return row;
}

/** Features in the layout `model` expects: hands only (v4) or hands + body
 * (v5; frames without a pose get the "body not found" row). */
export function modelFeatures(model: { channels: number }, frames: HandPoint[][][], width: number, height: number, poses?: PosePoint[][], faces?: (number[] | null)[]) {
  const body = model.channels > WORD_CHANNELS, face = model.channels >= WORD_CHANNELS + WORD_BODY + WORD_FACE;
  return clipFeatures(frames, width, height, body ? (poses ?? frames.map(() => [])) : undefined, face ? (faces ?? frames.map(() => null)) : undefined);
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
