import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";

// MediaPipe's 21 anatomical landmarks, with a separate chain for every finger.
const chains = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [5, 9, 10, 11, 12],
  [9, 13, 14, 15, 16],
  [13, 17, 18, 19, 20],
  [0, 17],
];
export function drawHandOverlay(
  canvas: HTMLCanvasElement,
  source: HTMLVideoElement,
  result: HandLandmarkerResult,
  includeImage = false,
) {
  const width = source.videoWidth,
    height = source.videoHeight;
  if (!width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (includeImage) ctx.drawImage(source, 0, 0, width, height);
  for (const [index, points] of result.landmarks.entries()) {
    ctx.strokeStyle = index === 0 ? "#53efbd" : "#ffcc70";
    ctx.lineWidth = Math.max(2, width / 220);
    ctx.lineCap = "round";
    for (const chain of chains) {
      ctx.beginPath();
      chain.forEach((id, i) => {
        const p = points[id];
        if (i === 0) ctx.moveTo(p.x * width, p.y * height);
        else ctx.lineTo(p.x * width, p.y * height);
      });
      ctx.stroke();
    }
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(
        p.x * width,
        p.y * height,
        Math.max(3, width / 130),
        0,
        2 * Math.PI,
      );
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.strokeStyle = "#162b36";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
