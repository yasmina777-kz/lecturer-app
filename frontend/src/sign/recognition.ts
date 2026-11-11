export type Point3 = { x: number; y: number; z: number };
export type SignClassifier = {
  labels: string[];
  mean: number[];
  std: number[];
  layers?: { weights: number[][]; bias: number[]; activation: "relu" }[];
  weights: number[][];
  bias: number[];
  threshold: number;
  margin: number;
};

const validatedModels = new WeakSet<object>();
/** Validate downloaded weights once, before trusting their dimensions or scores. */
export function validClassifier(value: unknown): value is SignClassifier {
  if (!value || typeof value !== "object") return false;
  if (validatedModels.has(value)) return true;
  const m = value as SignClassifier;
  const vector = (v: unknown, length: number): v is number[] =>
    Array.isArray(v) && v.length === length && v.every(Number.isFinite);
  const matrix = (v: unknown, rows: number, columns: number) =>
    Array.isArray(v) &&
    v.length === rows &&
    v.every((row) => vector(row, columns));
  if (
    !Array.isArray(m.labels) ||
    m.labels.length < 2 ||
    m.labels.length > 1024 ||
    m.labels.some((label) => typeof label !== "string" || !label.trim()) ||
    new Set(m.labels).size !== m.labels.length ||
    !Array.isArray(m.mean) ||
    !m.mean.length ||
    m.mean.length > 8192 ||
    !m.mean.every(Number.isFinite) ||
    !vector(m.std, m.mean.length) ||
    m.std.some((s) => s <= 0) ||
    !Number.isFinite(m.threshold) ||
    m.threshold < 0 ||
    m.threshold > 1 ||
    !Number.isFinite(m.margin) ||
    m.margin < 0 ||
    m.margin > 1 ||
    (m.layers !== undefined &&
      (!Array.isArray(m.layers) || m.layers.length > 16))
  )
    return false;
  let width = m.mean.length;
  for (const layer of m.layers ?? []) {
    if (
      !layer ||
      layer.activation !== "relu" ||
      !Array.isArray(layer.bias) ||
      !layer.bias.length ||
      layer.bias.length > 8192 ||
      !layer.bias.every(Number.isFinite) ||
      !matrix(layer.weights, layer.bias.length, width)
    )
      return false;
    width = layer.bias.length;
  }
  if (
    !vector(m.bias, m.labels.length) ||
    !matrix(m.weights, m.labels.length, width)
  )
    return false;
  validatedModels.add(value);
  return true;
}
export function handFeatures(points: Point3[]): number[] | null {
  if (
    points.length !== 21 ||
    points.some((p) => !Number.isFinite(p.x + p.y + p.z))
  )
    return null;
  const distance = (a: number, b: number) =>
    Math.hypot(
      points[a].x - points[b].x,
      points[a].y - points[b].y,
      points[a].z - points[b].z,
    );
  const scale = distance(0, 9);
  if (scale < 1e-6) return null;
  const result: number[] = [];
  for (let a = 0; a < 21; a++)
    for (let b = a + 1; b < 21; b++) result.push(distance(a, b) / scale);
  return result;
}
export function classifyFeatures(features: number[], model: SignClassifier) {
  if (
    !validClassifier(model) ||
    features.length !== model.mean.length ||
    features.some((f) => !Number.isFinite(f))
  )
    return null;
  let standardized = features.map((v, i) => (v - model.mean[i]) / model.std[i]);
  if (standardized.some((v) => !Number.isFinite(v))) return null;
  for (const layer of model.layers ?? []) {
    standardized = layer.weights.map((row, k) =>
      Math.max(
        0,
        row.reduce((sum, w, i) => sum + w * standardized[i], layer.bias[k]),
      ),
    );
  }
  const logits = model.weights.map((row, k) =>
    row.reduce((sum, w, i) => sum + w * standardized[i], model.bias[k]),
  );
  if (logits.some((v) => !Number.isFinite(v))) return null;
  const max = Math.max(...logits),
    exps = logits.map((v) => Math.exp(v - max)),
    sum = exps.reduce((a, b) => a + b, 0);
  const probabilities = exps.map((v) => v / sum),
    order = probabilities.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  return {
    label: model.labels[order[0].i],
    confidence: order[0].p,
    probabilities,
    accepted:
      order[0].p >= model.threshold && order[0].p - order[1].p >= model.margin,
  };
}
