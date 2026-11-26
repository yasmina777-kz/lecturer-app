// Silent product overview for the promo script (scenes 3–6): real platform,
// visible cursor with click ripples, no voice-over. The camera scene feeds a
// real RSL signer clip («Привет!», Slovo dataset) as the webcam, so the AI
// check you see is the actual in-browser recognition.
//   node promo-video/record-overview.mjs [sceneId ...]
// Needs frontend on :5173 and backend on :5050. Output: promo-video/AI-Mentor-overview-*.mp4
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const BUILD = ROOT + "promo-video/build/overview/";
const OUT = ROOT + "promo-video/";
const FFMPEG = ROOT + "ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0";
const BASE = "http://localhost:5173";
const FPS = 30;
const only = process.argv.slice(2);

const CURSOR = `
addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div');
  c.id = 'promo-cursor';
  c.style.cssText = 'position:fixed;left:-100px;top:-100px;width:28px;height:28px;margin:-4px 0 0 -4px;z-index:2147483647;pointer-events:none;transition:transform .12s;' +
    'background:url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path d=%22M3 2l7 19 2.5-7.5L20 11z%22 fill=%22%23111%22 stroke=%22white%22 stroke-width=%221.6%22 stroke-linejoin=%22round%22/></svg>") no-repeat center/contain';
  document.body.appendChild(c);
  addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => {
    c.style.transform = 'scale(.8)';
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;width:18px;height:18px;left:' + (e.clientX - 9) + 'px;top:' + (e.clientY - 9) + 'px;background:rgba(47,107,255,.45);transition:all .55s ease-out';
    document.body.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(4.5)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 650);
  }, true);
  addEventListener('mouseup', () => { c.style.transform = ''; }, true);
});`;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${BUILD}hello.y4m`,
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2, locale: "ru-RU" });
await ctx.grantPermissions(["camera"], { origin: BASE });
await ctx.addInitScript(CURSOR);
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("sign-language", "rsl");
    localStorage.setItem("rsl-player-mode-v1", "video");
  } catch {}
});
const page = await ctx.newPage();
// Fresh local demo account (local SQLite only).
await page.request.post(BASE + "/api/auth/register", {
  data: { fullName: "Айгерим", email: `overview-${Date.now()}@example.test`, password: "Overview-Pass-123" },
});
await page.request.patch(BASE + "/api/auth/language", { data: { language: "ru" } }).catch(() => {});

const sleep = (ms) => page.waitForTimeout(ms);
let mouse = { x: 800, y: 450 };
async function glide(x, y, ms = 650) {
  const steps = Math.max(10, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const u = i / steps, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    await page.mouse.move(mouse.x + (x - mouse.x) * e, mouse.y + (y - mouse.y) * e);
    await sleep(ms / steps);
  }
  mouse = { x, y };
}
async function clickOn(loc, ms = 650) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) throw new Error("not visible: " + loc);
  await glide(b.x + b.width / 2, b.y + b.height / 2, ms);
  await sleep(120);
  await page.mouse.down(); await sleep(80); await page.mouse.up();
}
async function hover(loc, ms = 650) {
  const b = await loc.boundingBox();
  if (b) await glide(b.x + b.width / 2, b.y + b.height / 2, ms);
}
async function scroll(dy, ms) {
  const steps = Math.round(ms / 30);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(30); }
}

const made = [];
async function record(id, length, prepare, act) {
  if (only.length && !only.includes(id)) return;
  await prepare();
  await page.mouse.move(mouse.x, mouse.y);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await act();
  const left = length * 1000 - (Date.now() / 1000 - t0) * 1000;
  if (left > 0) await sleep(left);
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  const dir = `${BUILD}rec-${id}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const total = Math.max(length, Date.now() / 1000 - t0);
  const n = Math.round(total * FPS);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / FPS;
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    writeFileSync(dir + String(i).padStart(5, "0") + ".jpg", Buffer.from(frames[k].data, "base64"));
  }
  const file = `${OUT}AI-Mentor-overview-${id}.mp4`;
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(FPS), "-i", dir + "%05d.jpg",
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=white",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
  made.push(file);
  console.log("REC", id, `${total.toFixed(1)}s`, n, "frames from", frames.length, "→", file);
}

// Scene 3 (0:16–0:24) — the site opens: landing → into the platform.
await record("3-open", 8, async () => { await page.goto(BASE + "/"); await sleep(3500); }, async () => {
  await glide(640, 380, 900);
  await sleep(600);
  await scroll(520, 1800);
  await sleep(700);
  await scroll(-520, 1200);
  await sleep(400);
  const cta = page.locator('a[href="/learn"]:visible, a[href="/dashboard"]:visible').first();
  await clickOn(cta, 800);
  await sleep(1800);
});

// Scene 4 (0:24–0:34) — choose the language course and open the first lesson.
await record("4-start", 11, async () => { await page.goto(BASE + "/learn"); await sleep(3000); }, async () => {
  await hover(page.locator(".sign-course-card.is-ksl"), 800);
  await sleep(700);
  await clickOn(page.locator(".sign-course-card.is-rsl"), 800);
  await sleep(1900);
  await clickOn(page.locator(".learning-intro-actions a.button.primary"), 750);
  await sleep(1900);
  await clickOn(page.locator('a[href="/course/1"]').first(), 800);
  await sleep(2200);
});

// Scene 5 (0:34–0:44) — watch the sign, switch words, take the quick check.
await record("5-practice", 11, async () => { await page.goto(BASE + "/course/1"); await sleep(3500); }, async () => {
  await hover(page.locator(".fs-player video"), 700);
  await sleep(1600);
  for (const w of ["ты", "имя"]) {
    await clickOn(page.locator(".course-chips button", { hasText: new RegExp(`^${w}$`, "i") }).first(), 650);
    await sleep(1500);
  }
  await clickOn(page.locator(".fs-answer button.primary", { hasText: "Проверить себя" }), 700);
  await sleep(1500);
  // Pick the right answer in the quiz (look up the playing video in the catalog).
  const label = await page.evaluate(async () => {
    const v = document.querySelector("video.test-video, .fs-round video");
    const src = v ? new URL(v.currentSrc || v.src).pathname : "";
    const list = await fetch("/research/rsl/words/catalog.json").then((r) => r.json());
    const hit = list.find((e) => e.video === src || e.displayVideo === src);
    return hit ? hit.label.replace(/[!?]$/, "") : "";
  });
  if (label) {
    const btn = page.locator(".fs-round button", { hasText: new RegExp(`^\\s*${label}[!?]?\\s*$`, "i") }).first();
    if (await btn.count()) await clickOn(btn, 700);
  }
  await sleep(1600);
});

// Scene 6 (0:44–0:56) — AI checks the sign through the camera.
await record("6-ai", 13, async () => {
  await page.goto(BASE + "/course/1");
  await sleep(2500);
  await page.locator(".course-steps button").nth(3).click();
  await sleep(2500);
  await page.evaluate(() => scrollTo(0, 0));
}, async () => {
  const start = page.locator(".word-practice button.primary", { hasText: "Включить камеру" });
  await start.waitFor({ timeout: 20000 });
  await clickOn(start, 800);
  await sleep(1200);
  await page.locator(".word-practice").scrollIntoViewIfNeeded().catch(() => {});
  await glide(1180, 560, 900);
  await page.locator(".word-practice", { hasText: "Верно" }).waitFor({ timeout: 11000 }).catch(() => console.log("no verdict in time"));
  await sleep(500);
  await scroll(260, 900);
  await glide(760, 640, 800);
  await sleep(2200);
});

// Extra (ad): the 3D avatar signs a ready phrase on the translate page.
await record("7-avatar", 8, async () => {
  await page.goto(BASE + "/text-to-sign?tab=phrases");
  await sleep(3000);
  await page.locator('[role="tab"]', { hasText: "Аватар" }).first().click();
  await sleep(4000);
}, async () => {
  await clickOn(page.locator(".sign-phrase-tiles button", { hasText: "Как тебя зовут?" }).first(), 700);
  await sleep(1200);
  await glide(1250, 300, 700);
  await sleep(5200);
});
await page.locator('[role="tab"]', { hasText: "Видео" }).first().click().catch(() => {});

await browser.close();

// One continuous overview with short white gaps between scenes.
if (made.length > 1) {
  const list = BUILD + "concat.txt";
  writeFileSync(list, made.map((f) => `file '${f}'`).join("\n"));
  const full = OUT + "AI-Mentor-overview-full.mp4";
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", full]);
  console.log("FULL", full);
}
console.log(readdirSync(OUT).filter((f) => f.startsWith("AI-Mentor-overview")));
