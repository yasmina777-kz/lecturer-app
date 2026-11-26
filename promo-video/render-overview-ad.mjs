// 9:16 site overview in the style of the vertical ad (light background, logo,
// two-line heading, a card with the real platform recording), without the dark
// problem intro and without narration. 30 s for the promo's 0:18–0:48.
// Uses the desktop recordings from record-overview.mjs (build/overview/rec-*).
//   node promo-video/render-overview-ad.mjs            → AI-Mentor-overview-ad-9x16.mp4
//   node promo-video/render-overview-ad.mjs preview 2,9,16,24
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const B = ROOT + "promo-video/build/";
const FFMPEG = ROOT + "ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0";

// rec: recording id · from: second inside it · zoom: [x, y, scale] start → end (fractions of the frame)
const PLAN = [
  { id: "langs", len: 7, rec: "4-start", from: 0, zoomAt: 0.6, zoom: [[0.19, 0.12, 1.36], [0.19, 0.12, 1.36]],
    h1: "Жестовый язык —", h2: "на русском и казахском", p: "Два отдельных курса: своя азбука, словарь и прогресс.",
    chips: ["РЖЯ · 33 буквы", "ҚЖЯ · 42 буквы", "1 600+ жестов"] },
  { id: "lesson", len: 8, rec: "5-practice", from: 0, zoomAt: 1.0, zoom: [[0.2, 0.18, 1.45], [0.22, 0.24, 1.6]],
    h1: "Открой урок —", h2: "смотри и повторяй", p: "Видео носителей языка: каждый жест можно пересмотреть и замедлить." },
  { id: "practice", len: 6, rec: "5-practice", from: 7.2, zoomAt: 1.0, zoom: [[0.2, 0.18, 1.45], [0.22, 0.24, 1.6]],
    h1: "Практикуйся —", h2: "проверь себя", p: "Узнай жест по видео — ответ проверится сразу." },
  { id: "ai", len: 9, rec: "6-ai", from: 0, zoomAt: 5.4, zoom: [[0.42, 0.02, 1.75], [0.45, 0.26, 2.0]],
    h1: "ИИ проверяет —", h2: "твой жест", p: "Покажи жест в камеру: ИИ распознаёт движение рук и сразу отвечает.",
    verdict: "Жест «Привет» узнан", verdictAt: 5.6 },
];
let t = 0;
const scenes = PLAN.map((s) => { const o = { ...s, start: t, end: t + s.len }; t += s.len; return o; });
const total = t;
const rec = Object.fromEntries([...new Set(PLAN.map((s) => s.rec))].map((id) => [id, readdirSync(`${B}overview/rec-${id}`).length]));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(([s, r]) => { window.SCENES = s; window.RECFRAMES = r; }, [scenes, rec]);
await page.goto("file://" + B + "overview-ad.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = (x) => page.evaluate(async (x) => { window.render(x); await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {})))); }, x);

if (process.argv[2] === "preview") {
  for (const x of process.argv[3].split(",").map(Number)) { await at(x); await page.screenshot({ path: `${B}ovad-${x}.jpg`, type: "jpeg", quality: 80 }); }
  console.log(scenes.map((s) => `${s.id}@${s.start}`).join(" "));
} else {
  const dir = B + "ovadframes/";
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
  const n = Math.round(total * 30);
  for (let i = 0; i < n; i++) { await at(i / 30); await page.screenshot({ path: `${dir}${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); }
  const out = ROOT + "promo-video/AI-Mentor-overview-ad-9x16.mp4";
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "30", "-i", dir + "%05d.jpg",
    "-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart", out]);
  console.log("VIDEO", out, total + "s");
}
await browser.close();
