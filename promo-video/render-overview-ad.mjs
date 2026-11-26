// 9:16 site overview in the style of the vertical ad (light background, logo,
// two-line heading, a card with the whole page recording, never cropped), without
// the dark problem intro and without narration: logo → five features → ending.
// Uses the clips from record-ad-clips.mjs (build/overview/rec-ad-*).
//   node promo-video/render-overview-ad.mjs            → AI-Mentor-overview-ad-9x16.mp4
//   node promo-video/render-overview-ad.mjs preview 2,9,16,24
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const B = ROOT + "promo-video/build/";
const FFMPEG = ROOT + "ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0";

// rec: recording id · from: second inside it · zoom: [x, y, scale] start → end (fractions of the frame)
const PLAN = [
  { id: "intro", len: 4.3 },
  { id: "langs", len: 6, rec: "courses", from: 0,
    h1: "Жестовый язык —", h2: "на русском и казахском", p: "Два отдельных курса: своя азбука, словарь и прогресс.",
    chips: ["РЖЯ · 33 буквы", "ҚЖЯ · 42 буквы"] },
  { id: "lesson", len: 7, rec: "lesson", from: 0,
    h1: "Открой урок —", h2: "смотри и повторяй", p: "Видео носителей языка: каждый жест можно пересмотреть и замедлить." },
  { id: "practice", len: 6, rec: "practice", from: 0.3,
    h1: "Практикуйся —", h2: "проверь себя", p: "Узнай жест по видео — ответ проверится сразу." },
  { id: "avatar", len: 6.5, rec: "avatar", from: 4.25,
    inset: { at: 1.0, left: 640, top: 1120, w: 400, h: 528, crop: [0.6, 0.19, 0.27, 0.57], tag: "3D-АВАТАР" },
    h1: "Аватар покажет —", h2: "слово жестами", p: "Напиши «Привет» — 3D-аватар покажет жест." },
  { id: "ai", len: 8, rec: "ai", from: 0.4,
    inset: { at: 1.6, left: 620, top: 1100, w: 420, h: 560, cam: true, tag: "● КАМЕРА" },
    h1: "ИИ проверяет —", h2: "твой жест", p: "Покажи жест в камеру: ИИ распознаёт движение рук и сразу отвечает.",
    verdict: "Жест «Привет» узнан", verdictAt: 4.8 },
  { id: "outro", len: 4.6 },
];
let t = 0;
const scenes = PLAN.map((s) => { const o = { ...s, start: t, end: t + s.len }; t += s.len; return o; });
const total = t;
const rec = Object.fromEntries([...new Set(PLAN.filter((s) => s.rec).map((s) => s.rec))].map((id) => [id, readdirSync(`${B}overview/rec-ad-${id}`).length]));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const handsData = { privet: JSON.parse(readFileSync(B + "hands/privet.json", "utf8")) };
const camFrames = readdirSync(B + "overview/cam").length;
await page.addInitScript(([s, r, h, c]) => { window.SCENES = s; window.RECFRAMES = r; window.HANDS = h; window.CAMFRAMES = c; }, [scenes, rec, handsData, camFrames]);
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
