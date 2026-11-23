import type { Landmark } from "./phraseCapture";
/** Draw only measured, visible points; never invent missing joints. */
export function drawBodyOverlay(canvas: HTMLCanvasElement, points: Landmark[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const valid = (i: number) => points[i] && (points[i].visibility ?? 1) >= 0.6;
  const w = canvas.width,
    h = canvas.height;
  ctx.strokeStyle = "#8ac6ff";
  ctx.fillStyle = "#8ac6ff";
  ctx.lineWidth = Math.max(2, w / 260);
  for (const [a, b] of [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
  ]) {
    if (!valid(a) || !valid(b)) continue;
    ctx.beginPath();
    ctx.moveTo(points[a].x * w, points[a].y * h);
    ctx.lineTo(points[b].x * w, points[b].y * h);
    ctx.stroke();
  }
  for (const i of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
    if (!valid(i)) continue;
    ctx.beginPath();
    ctx.arc(
      points[i].x * w,
      points[i].y * h,
      Math.max(3, w / 160),
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

import { FACE_CONTOURS, FACE_POINTS } from "./faceContours";
const FACE_INDEX = new Map(FACE_POINTS.map((p, i) => [p, i]));
/** Thin face contours (eyes, brows, lips, oval) from the worker's x,y list. */
export function drawFaceOverlay(canvas: HTMLCanvasElement, xy: number[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || xy.length !== FACE_POINTS.length * 2) return;
  const w = canvas.width, h = canvas.height;
  const at = (p: number) => {
    const i = FACE_INDEX.get(p)!;
    return [xy[i * 2] * w, xy[i * 2 + 1] * h] as const;
  };
  ctx.save();
  ctx.lineWidth = Math.max(1, w / 520);
  for (const [part, edges] of Object.entries(FACE_CONTOURS)) {
    ctx.strokeStyle = part === "oval" ? "rgba(255,255,255,.35)" : part === "lips" ? "rgba(255,170,190,.85)" : "rgba(150,230,255,.9)";
    ctx.beginPath();
    for (const [a, b] of edges) {
      const [x1, y1] = at(a), [x2, y2] = at(b);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,.8)";
  const r = Math.max(1.2, w / 700);
  for (let i = 0; i < xy.length; i += 2) {
    ctx.beginPath();
    ctx.arc(xy[i] * w, xy[i + 1] * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
