// Kazakh clips (16:10) for the Kazakh promo: ҚЖЯ course, Kazakh interface. A real
// (off-screen) Chrome window, because YouTube (SURDO.KZ videos) does not play headless.
// Based on record-ad-clips.mjs: real platform,
// visible cursor with click ripples, no voice-over. The camera scene feeds a
// real RSL signer clip («Привет!», Slovo dataset) as the webcam, so the AI
// check you see is the actual in-browser recognition.
//   node promo-video/record-kz-clips.mjs [sceneId ...]
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
  headless: false,
  args: [
    "--window-position=-3200,-3200",
    "--window-size=1600,1100",
    "--autoplay-policy=no-user-gesture-required",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${BUILD}hello.y4m`,
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.2, locale: "ru-RU" });
await ctx.grantPermissions(["camera"], { origin: BASE });
await ctx.addInitScript(CURSOR);
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("sign-language", "ksl");
    localStorage.setItem("lecturer-language", "kk");
    localStorage.setItem("rsl-player-mode-v1", "video");
  } catch {}
});
const page = await ctx.newPage();
// Fresh local demo account (local SQLite only).
await page.request.post(BASE + "/api/auth/register", {
  data: { fullName: "Айгерим", email: `overview-${Date.now()}@example.test`, password: "Overview-Pass-123" },
});
await page.request.patch(BASE + "/api/auth/language", { data: { language: "kk" } }).catch(() => {});

await page.goto(BASE + "/learn");
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
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1200, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await act();
  const left = length * 1000 - (Date.now() / 1000 - t0) * 1000;
  if (left > 0) await sleep(left);
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  const dir = `${BUILD}rec-kz-${id}/`;
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
  const file = `${BUILD}kz-clip-${id}.mp4`;
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(FPS), "-i", dir + "%05d.jpg",
    "-vf", "scale=1920:1200:force_original_aspect_ratio=decrease,pad=1920:1200:(ow-iw)/2:(oh-ih)/2:color=white",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
  made.push(file);
  console.log("REC", id, `${total.toFixed(1)}s`, n, "frames from", frames.length, "→", file);
}


const keepIn = async (loc, top = 90) => {
  // Scroll so the element's top sits `top` px below the viewport top (smoothly).
  const b = await loc.boundingBox();
  if (b) await scroll(b.y - top, 700);
};


const waitPlaying = (ms = 15000) => page.locator(".yt-clip-poster.is-hidden").first().waitFor({ timeout: ms }).catch(() => {});

// Courses page in Kazakh: both languages, choose ҚЖЯ.
await record("courses", 6.5, async () => { await page.goto(BASE + "/learn"); await sleep(3500); }, async () => {
  await hover(page.locator(".sign-course-card.is-rsl"), 800);
  await sleep(900);
  await clickOn(page.locator(".sign-course-card.is-ksl"), 800);
  await sleep(2600);
});

// ҚЖЯ from zero: levels A1 → A2 → B1 with topic cards.
await record("levels", 8, async () => {
  await page.goto(BASE + "/course?level=A1"); await sleep(4000);
  await page.evaluate(() => scrollTo(0, 0));
  await keepIn(page.locator(".ksl-levels").first(), 40);
  await sleep(500);
}, async () => {
  await hover(page.locator('.ksl-levels button[data-level="A1"]'), 600);
  await sleep(900);
  await clickOn(page.locator('.ksl-levels button[data-level="A2"]'), 650);
  await sleep(1700);
  await clickOn(page.locator('.ksl-levels button[data-level="B1"]'), 650);
  await sleep(2200);
});

// Kazakh alphabet: 42 letters with signer photos.
await record("alphabet", 6, async () => { await page.goto(BASE + "/learn?stage=1"); await sleep(4000); }, async () => {
  await glide(640, 420, 600);
  await sleep(400);
  await scroll(360, 1500);
  await hover(page.locator(".letter-tile", { hasText: "Ә" }).first(), 700);
  await sleep(1800);
});

// KSL lesson: SURDO.KZ signer video, then the quiz answered right.
await record("lesson", 11, async () => {
  await page.goto(BASE + "/course/kz/2"); await sleep(2500);
  await waitPlaying();
  await sleep(500);
}, async () => {
  await hover(page.locator(".fs-player .yt-clip"), 700);
  await sleep(2200);
  await clickOn(page.locator(".fs-answer button.primary").last(), 700);
  await waitPlaying();
  await sleep(1500);
  const label = await page.evaluate(async () => {
    const img = document.querySelector(".fs-player .yt-clip-poster");
    const id = (img?.getAttribute("src") ?? "").split("/vi/")[1]?.split("/")[0];
    const cat = await fetch("/research/ksl/surdo-catalog.json").then((r) => r.json());
    const hit = cat.entries.find((e) => e.youtube === id || e.slow === id);
    return hit ? hit.label.replace(/[!?]$/, "") : "";
  });
  const btn = page.locator(".vocab-choices button", { hasText: label }).first();
  if (label && (await btn.count())) await clickOn(btn, 700);
  await sleep(1800);
});

// Kazakh text → signs: «Сәлеметсіз бе» shown by SURDO.KZ.
await record("translate", 9, async () => { await page.goto(BASE + "/text-to-sign"); await sleep(3500); }, async () => {
  await clickOn(page.locator("textarea").first(), 600);
  await page.keyboard.type("Сәлеметсіз бе", { delay: 110 });
  await sleep(300);
  await clickOn(page.locator("button.tts-go, .ksl-tr-go, button.button.primary").first(), 600);
  await waitPlaying(12000);
  await glide(1150, 420, 700);
  await sleep(3500);
});

// AI check (camera): the course word «Сәлем» recognised.
await record("ai", 9, async () => {
  await page.goto(BASE + "/course/1");
  await sleep(2500);
  await page.locator(".course-steps button").nth(3).click();
  const cam = page.locator(".word-practice button.primary").first();
  await cam.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector(".word-practice button.primary")?.hasAttribute("disabled"), null, { timeout: 30000 });
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(800);
}, async () => {
  await clickOn(page.locator(".word-practice button.primary").first(), 700);
  await sleep(700);
  await keepIn(page.locator(".word-practice"), 70);
  await glide(1250, 600, 700);
  await page.locator(".word-practice-result.is-correct").waitFor({ timeout: 9000 }).catch(() => console.log("no verdict in time"));
  await sleep(2800);
});

await browser.close();
