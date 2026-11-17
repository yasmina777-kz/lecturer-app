/** Dependency-free runtime for the temporal CNN exported by ml/rsl/seqnet.py.
 * Operations: 'same'-padded dilated Conv1d + ReLU (+ residual), mean||max time
 * pooling and dense layers. Weights are float16 little-endian base64. The
 * Python `reference_forward` mirrors this code and produces the test fixtures.
 */
export type SeqLayer =
  | { type: "conv"; kernel: number; dilation: number; inputs: number; outputs: number; residual: boolean; weights: string; bias: string }
  | { type: "dense"; inputs: number; outputs: number; relu: boolean; weights: string; bias: string };
export type SeqModelFile = {
  format: "seq-cnn-v1";
  labels: string[];
  channels: number;
  mean: string;
  std: string;
  layers: SeqLayer[];
  threshold: number;
  margin: number;
  frames?: number;
  courseLabels?: string[];
};
type DecodedLayer = SeqLayer & { w: Float32Array; b: Float32Array };
export type SeqModel = {
  labels: string[];
  channels: number;
  mean: Float32Array;
  std: Float32Array;
  layers: DecodedLayer[];
  threshold: number;
  margin: number;
  frames?: number;
  courseLabels?: string[];
};

function half(bits: number) {
  const sign = bits & 0x8000 ? -1 : 1,
    exp = (bits >> 10) & 0x1f,
    frac = bits & 0x3ff;
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024);
  if (exp === 31) return frac ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}
export function decodeHalf(text: string): Float32Array {
  const binary = atob(text);
  const out = new Float32Array(binary.length >> 1);
  for (let i = 0; i < out.length; i++)
    out[i] = half(binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8));
  return out;
}

/** Decode and validate shapes once; reject anything inconsistent. */
export function loadSeqModel(value: unknown): SeqModel | null {
  const m = value as SeqModelFile;
  if (!m || m.format !== "seq-cnn-v1" || !Array.isArray(m.layers) || !Array.isArray(m.labels) ||
      m.labels.length < 2 || !(m.channels > 0) || !Number.isFinite(m.threshold) || !Number.isFinite(m.margin))
    return null;
  try {
    const mean = decodeHalf(m.mean), std = decodeHalf(m.std);
    if (mean.length !== m.channels || std.length !== m.channels || std.some((s) => !(s > 0))) return null;
    let width = m.channels, pooled = false;
    const layers: DecodedLayer[] = [];
    for (const layer of m.layers) {
      const w = decodeHalf(layer.weights), b = decodeHalf(layer.bias);
      if (layer.inputs !== (layer.type === "dense" && !pooled ? 2 * width : width)) return null;
      if (layer.type === "conv") {
        if (pooled || w.length !== layer.outputs * layer.inputs * layer.kernel || layer.kernel % 2 !== 1 ||
            (layer.residual && layer.inputs !== layer.outputs)) return null;
      } else {
        if (w.length !== layer.outputs * layer.inputs) return null;
        pooled = true;
      }
      if (b.length !== layer.outputs || !w.every(Number.isFinite) || !b.every(Number.isFinite)) return null;
      width = layer.outputs;
      layers.push({ ...layer, w, b });
    }
    if (!pooled || width !== m.labels.length) return null;
    return { labels: m.labels, channels: m.channels, mean, std, layers, threshold: m.threshold, margin: m.margin, frames: m.frames,
      courseLabels: Array.isArray(m.courseLabels) ? m.courseLabels.filter((l) => m.labels.includes(l)) : undefined };
  } catch {
    return null;
  }
}

/** frames: [time][channels] raw features. Returns softmax probabilities. */
export function runSeqModel(model: SeqModel, frames: number[][]): number[] | null {
  const T = frames.length, C = model.channels;
  if (!T || frames.some((f) => f.length !== C || f.some((v) => !Number.isFinite(v)))) return null;
  let h: Float32Array[] = frames.map((f) => Float32Array.from(f, (v, c) => (v - model.mean[c]) / model.std[c]));
  let vector: Float32Array | null = null;
  for (const layer of model.layers) {
    if (layer.type === "conv") {
      const { kernel: K, dilation: d, inputs: I, outputs: O, w, b } = layer;
      const pad = (d * (K - 1)) / 2;
      const next = h.map(() => new Float32Array(O));
      for (let t = 0; t < T; t++) {
        const y = next[t];
        y.set(b);
        for (let k = 0; k < K; k++) {
          const src = t + k * d - pad;
          if (src < 0 || src >= T) continue;
          const x = h[src];
          for (let o = 0; o < O; o++) {
            let s = 0;
            const base = o * I * K + k;
            for (let i = 0; i < I; i++) s += w[base + i * K] * x[i];
            y[o] += s;
          }
        }
        for (let o = 0; o < O; o++) y[o] = Math.max(0, y[o]);
        if (layer.residual) for (let o = 0; o < O; o++) y[o] += h[t][o];
      }
      h = next;
    } else {
      if (!vector) {
        const width = h[0].length;
        vector = new Float32Array(2 * width);
        for (let c = 0; c < width; c++) {
          let sum = 0, max = -Infinity;
          for (let t = 0; t < T; t++) {
            sum += h[t][c];
            if (h[t][c] > max) max = h[t][c];
          }
          vector[c] = sum / T;
          vector[width + c] = max;
        }
      }
      const { inputs: I, outputs: O, w, b, relu } = layer;
      const out = new Float32Array(O);
      for (let o = 0; o < O; o++) {
        let s = b[o];
        for (let i = 0; i < I; i++) s += w[o * I + i] * vector[i];
        out[o] = relu ? Math.max(0, s) : s;
      }
      vector = out;
    }
  }
  if (!vector) return null;
  const max = Math.max(...vector);
  const exps = Array.from(vector, (v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const p = exps.map((v) => v / sum);
  return p.every(Number.isFinite) ? p : null;
}

export function classifySeq(model: SeqModel, frames: number[][]) {
  const probabilities = runSeqModel(model, frames);
  if (!probabilities) return null;
  const order = probabilities.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  return {
    label: model.labels[order[0].i],
    confidence: order[0].p,
    probabilities,
    top: order.slice(0, 5).map(({ p, i }) => ({ label: model.labels[i], p })),
    accepted: order[0].p >= model.threshold && order[0].p - order[1].p >= model.margin,
  };
}
