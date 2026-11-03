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
