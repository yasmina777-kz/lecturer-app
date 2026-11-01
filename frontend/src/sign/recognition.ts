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
    features.length !== model.mean.length ||
    features.some((f) => !Number.isFinite(f))
  )
    return null;
  let standardized = features.map((v, i) => (v - model.mean[i]) / model.std[i]);
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
