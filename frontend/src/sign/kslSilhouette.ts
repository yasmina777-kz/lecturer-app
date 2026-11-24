/** Kazakh fingerspelling (42 letters) recognizer for the browser.
 *
 * Twin of ml/ksl/silhouette.py + the CNN in ml/ksl/train_ksl.py: the 21 hand
 * world landmarks are drawn as a 50×50 hand silhouette (palm polygon, finger
 * capsules, forearm stub cut by the frame), then a small CNN trained on QazSL
 * silhouettes (CC BY 4.0) and Bukva landmark tracks classifies it. Both files
 * must draw the same pixels; ksl-v1-fixtures.json checks that. */

export const KSL_N = 50;
const FINGERS: [number, number][] = [
  [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17], [0, 1],
];
const PALM = [0, 1, 2, 5, 9, 13, 17];
const R_FINGER = 0.12, R_THUMB = 0.14, R_ARM = 0.35, ARM_LEN = 0.7, MARGIN = 1;
type P = [number, number];

function hull(points: P[]): P[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (seq: P[]) => {
    const h: P[] = [];
    for (const q of seq) {
      while (h.length >= 2) {
        const a = h[h.length - 2], b = h[h.length - 1];
        if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) <= 0) h.pop();
        else break;
      }
      h.push(q);
    }
    return h;
  };
  const lo = half(pts), up = half([...pts].reverse());
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** xy: 21 points (y down, any scale; left hands already mirrored). Returns 0/1 pixels. */
export function renderSilhouette(xy: P[]): Float32Array {
  const out = new Float32Array(KSL_N * KSL_N);
  const s = Math.hypot(xy[0][0] - xy[9][0], xy[0][1] - xy[9][1]);
  if (s < 1e-6) return out;
  const p = xy.map(([x, y]) => [(x - xy[0][0]) / s, (y - xy[0][1]) / s] as P);
  const caps: [P, P, number][] = FINGERS.map(([a, b]) => [p[a], p[b], a <= 4 && b <= 4 ? R_THUMB : R_FINGER]);
  let dx = p[0][0] - p[9][0], dy = p[0][1] - p[9][1];
  const dl = Math.max(Math.hypot(dx, dy), 1e-6);
  dx /= dl; dy /= dl;
  const arm: [P, P, number] = [p[0], [p[0][0] + dx * ARM_LEN, p[0][1] + dy * ARM_LEN], R_ARM];
  const H = hull(PALM.map((i) => p[i]));
  // Crop box: hand only (the forearm leaves the frame).
  let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity, rmax = 0;
  for (const [a, b, r] of caps) {
    for (const q of [a, b]) {
      lx = Math.min(lx, q[0]); ly = Math.min(ly, q[1]); hx = Math.max(hx, q[0]); hy = Math.max(hy, q[1]);
    }
    rmax = Math.max(rmax, r);
  }
  for (const q of H) {
    lx = Math.min(lx, q[0]); ly = Math.min(ly, q[1]); hx = Math.max(hx, q[0]); hy = Math.max(hy, q[1]);
  }
  lx -= rmax; ly -= rmax; hx += rmax; hy += rmax;
  const scale = (KSL_N - 2 * MARGIN) / Math.max(hx - lx, hy - ly);
  const ox = (KSL_N - (hx - lx) * scale) / 2 - lx * scale;
  const oy = (KSL_N - (hy - ly) * scale) / 2 - ly * scale;
  const all = [...caps, arm];
  for (let row = 0; row < KSL_N; row++) {
    for (let col = 0; col < KSL_N; col++) {
      const qx = (col + 0.5 - ox) / scale, qy = (row + 0.5 - oy) / scale;
      let inside = true;
      for (let i = 0; i < H.length && inside; i++) {
        const A = H[i], B = H[(i + 1) % H.length];
        if ((B[0] - A[0]) * (qy - A[1]) - (B[1] - A[1]) * (qx - A[0]) < 0) inside = false;
      }
      if (!inside) {
        for (const [a, b, r] of all) {
          const abx = b[0] - a[0], aby = b[1] - a[1];
          const t = Math.min(1, Math.max(0, ((qx - a[0]) * abx + (qy - a[1]) * aby) / Math.max(abx * abx + aby * aby, 1e-9)));
          if (Math.hypot(qx - (a[0] + t * abx), qy - (a[1] + t * aby)) <= r) { inside = true; break; }
        }
      }
      if (inside) out[row * KSL_N + col] = 1;
    }
  }
  return out;
}

type Layer = { shape: number[]; w: Float32Array; b: Float32Array };
type PackedLayer = { shape: number[]; w16: string; b16: string };
export type KslModel = { version: string; labels: string[]; conv: Layer[]; fc: Layer[]; report?: unknown };

/** base64 little-endian float16 → Float32Array (ml/ksl/pack_weights.py). */
function half(b64: string): Float32Array {
  const bin = atob(b64);
  const out = new Float32Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) {
    const h = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    out[i] = e === 0 ? s * 2 ** -14 * (f / 1024) : e === 31 ? (f ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + f / 1024);
  }
  return out;
}
export function unpackKslModel(raw: { version: string; labels: string[]; conv: PackedLayer[]; fc: PackedLayer[]; report?: unknown }): KslModel {
  const layer = (L: PackedLayer): Layer => ({ shape: L.shape, w: half(L.w16), b: half(L.b16) });
  return { ...raw, conv: raw.conv.map(layer), fc: raw.fc.map(layer) };
}

function conv(x: Float32Array, c: number, n: number, L: Layer): Float32Array {
  // Plane-wise 3×3 convolution with zero padding: for every (out, in, tap)
  // add a shifted input plane — tight loops without per-pixel branches.
  const [o] = L.shape;
  const nn = n * n;
  const y = new Float32Array(o * nn);
  for (let k = 0; k < o; k++) {
    const yb = k * nn;
    y.fill(L.b[k], yb, yb + nn);
    for (let ci = 0; ci < c; ci++) {
      const xb = ci * nn, wb = (k * c + ci) * 9;
      for (let di = -1; di <= 1; di++) {
        const i0 = Math.max(0, -di), i1 = Math.min(n, n - di);
        for (let dj = -1; dj <= 1; dj++) {
          const w = L.w[wb + (di + 1) * 3 + dj + 1];
          if (w === 0) continue;
          const j0 = Math.max(0, -dj), j1 = Math.min(n, n - dj);
          for (let i = i0; i < i1; i++) {
            const yr = yb + i * n, xr = xb + (i + di) * n + dj;
            for (let j = j0; j < j1; j++) y[yr + j] += w * x[xr + j];
          }
        }
      }
    }
    for (let q = yb; q < yb + nn; q++) if (y[q] < 0) y[q] = 0;
  }
  return y;
}

function pool(x: Float32Array, c: number, n: number): Float32Array {
  const m = Math.floor(n / 2);
  const y = new Float32Array(c * m * m);
  for (let k = 0; k < c; k++)
    for (let i = 0; i < m; i++)
      for (let j = 0; j < m; j++) {
        const b = k * n * n;
        y[(k * m + i) * m + j] = Math.max(
          x[b + 2 * i * n + 2 * j], x[b + 2 * i * n + 2 * j + 1],
          x[b + (2 * i + 1) * n + 2 * j], x[b + (2 * i + 1) * n + 2 * j + 1]);
      }
  return y;
}

function dense(x: Float32Array, L: Layer, relu: boolean): Float32Array {
  const [o, n] = L.shape;
  const y = new Float32Array(o);
  for (let k = 0; k < o; k++) {
    let s = L.b[k];
    for (let i = 0; i < n; i++) s += L.w[k * n + i] * x[i];
    y[k] = relu && s < 0 ? 0 : s;
  }
  return y;
}

function logits(model: KslModel, img: Float32Array): Float32Array {
  let x = img, c = 1, n = KSL_N;
  for (const L of model.conv) {
    x = pool(conv(x, c, n, L), L.shape[0], n);
    c = L.shape[0];
    n = Math.floor(n / 2);
  }
  return dense(dense(x, model.fc[0], true), model.fc[1], false);
}

const softmax = (z: Float32Array) => {
  const m = Math.max(...z);
  const e = Array.from(z, (v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
};

/** Class probabilities, averaged with the mirrored silhouette (as in training). */
export function classifySilhouette(model: KslModel, img: Float32Array): number[] {
  const flip = new Float32Array(img.length);
  for (let i = 0; i < KSL_N; i++) for (let j = 0; j < KSL_N; j++) flip[i * KSL_N + j] = img[i * KSL_N + KSL_N - 1 - j];
  const a = softmax(logits(model, img)), b = softmax(logits(model, flip));
  return a.map((v, k) => (v + b[k]) / 2);
}

/** World landmarks from MediaPipe → 21 xy points, mirrored for a left hand
 * exactly like the training features (extract_alphabet.frame_features). */
export function handPoints(world: { x: number; y: number }[], handedness: string): P[] {
  const flip = handedness === "Left" ? -1 : 1;
  return world.map((q) => [q.x * flip, q.y]);
}

let cached: Promise<KslModel> | null = null;
export function loadKslModel(): Promise<KslModel> {
  cached ??= fetch("/models/ksl/ksl-v1.json").then((r) => {
    if (!r.ok) throw new Error(`ksl model ${r.status}`);
    return r.json().then(unpackKslModel);
  });
  return cached;
}

export const KAZAKH_LETTERS = Array.from("АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЩЪЫІЬЭЮЯ");
export const KAZAKH_ONLY = Array.from("ӘҒҚҢӨҰҮҺІ");
