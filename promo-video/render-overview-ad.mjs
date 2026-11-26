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
  { id: "intro", len: 2.6 },
  { id: "langs", len: 3.8, rec: "courses", from: 1.2,
    h1: "Жестовый язык —", h2: "на русском и казахском", p: "Два отдельных курса: своя азбука, словарь и прогресс.",
    chips: ["РЖЯ · 33 буквы", "ҚЖЯ · 42 буквы"] },
  { id: "rsl", len: 4.2, rec: "rsl-course", from: 1.0,
    h1: "Курс РЖЯ —", h2: "48 уроков от A1 до B1", p: "Знакомство, семья, числа, кафе, здоровье — каждая тема с видео носителей." },
  { id: "ksl", len: 4.2, rec: "ksl-alphabet", from: 0.8,
    h1: "Курс ҚЖЯ —", h2: "казахская азбука", p: "42 буквы: каждую показывает носитель казахского жестового языка." },
  { id: "dict", len: 4.2, rec: "ksl-dict", from: 1.0,
    h1: "Словарь —", h2: "751 жест по 27 темам", p: "Семья, числа, еда, транспорт — с видео носителей SURDO.KZ." },
  { id: "lesson", len: 5.5, rec: "lesson2", from: 1.6,
    h1: "Урок —", h2: "смотри и проверяй себя", p: "Новые жесты на видео, потом тест: узнай жест — ответ проверится сразу." },
  { id: "avatar", len: 4.2, rec: "avatar1", from: 4.0,
    h1: "Аватар покажет —", h2: "слово жестами", p: "Напиши «Привет» — 3D-аватар покажет жест." },
  { id: "ai", len: 6, rec: "ai", from: 1.2,
    h1: "ИИ проверяет —", h2: "твой жест", p: "Покажи жест в камеру: ИИ распознаёт движение рук и сразу отвечает.",
    verdict: "Жест «Привет» узнан", verdictAt: 3.7 },
  { id: "outro", len: 3.4 },
];
// SHORT=1: the four key sections only, no logo opener/ending (for the voiced promo).
const SHORT = process.env.SHORT === "1";
const PLAN_SHORT = [
  { ...PLAN.find((p) => p.id === "langs"), len: 3.3, from: 1.3 },
  { ...PLAN.find((p) => p.id === "lesson"), len: 4.2, from: 2.9 },
  { ...PLAN.find((p) => p.id === "avatar"), len: 3.6, from: 4.0 },
  { ...PLAN.find((p) => p.id === "ai"), len: 5.0, from: 1.2, verdictAt: 3.4 },
];
const USE = SHORT ? PLAN_SHORT : PLAN;
let t = 0;
const scenes = USE.map((s) => { const o = { ...s, start: t, end: t + s.len }; t += s.len; return o; });
const total = t;
const rec = Object.fromEntries([...new Set(USE.filter((s) => s.rec).map((s) => s.rec))].map((id) => [id, readdirSync(`${B}overview/rec-ad-${id}`).length]));

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
  const dir = B + (SHORT ? "ovadshort/" : "ovadframes/");
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
  const n = Math.round(total * 30);
  for (let i = 0; i < n; i++) { await at(i / 30); await page.screenshot({ path: `${dir}${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); }
  const out = ROOT + (SHORT ? "promo-video/build/overview-short.mp4" : "promo-video/AI-Mentor-overview-ad-9x16.mp4");
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "30", "-i", dir + "%05d.jpg",
    "-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart", out]);
  console.log("VIDEO", out, total + "s");
}
await browser.close();
