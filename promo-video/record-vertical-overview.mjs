// 9:16 site overview for the 75-second promo (website part, 0:18–0:48 = 30 s).
// The real platform in its phone layout (1080×1920), a soft touch indicator,
// no voice-over. Four parts, crossfaded:
//   18–25  landing → Russian and Kazakh sign language side by side
//   25–34  open a real lesson, the signer example large   («Изучай»)
//   34–40  the practice task (quiz) answered              («Практикуйся»)
//   40–48  camera → the AI recognises the sign, held      («Получай помощь ИИ»)
// The camera part feeds a real RSL signer clip («Привет!», Slovo dataset) as the
// webcam, so the verdict on screen is the actual in-browser recognition.
//   node promo-video/record-vertical-overview.mjs
// Output: promo-video/AI-Mentor-overview-9x16.mp4 (+ -captions.mp4 with the three labels)
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const BUILD = ROOT + "promo-video/build/overview/";
const OUT = ROOT + "promo-video/";
const FFMPEG = ROOT + "ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0";
const BASE = "http://localhost:5173";
const FPS = 30;
const W = 405, H = 720, DSF = 1080 / 405; // → 1080×1920
const XF = 0.4;

const TOUCH = `
addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div');
  c.id = 'promo-touch';
  c.style.cssText = 'position:fixed;left:-100px;top:-100px;width:30px;height:30px;margin:-15px 0 0 -15px;z-index:2147483647;pointer-events:none;border-radius:50%;' +
    'background:rgba(255,255,255,.55);border:2px solid rgba(20,23,31,.55);box-shadow:0 4px 14px rgba(0,0,0,.25);transition:transform .12s, background .12s;';
  document.body.appendChild(c);
  addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => {
    c.style.transform = 'scale(.75)'; c.style.background = 'rgba(47,107,255,.55)';
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;width:22px;height:22px;left:' + (e.clientX - 11) + 'px;top:' + (e.clientY - 11) + 'px;background:rgba(47,107,255,.4);transition:all .55s ease-out';
    document.body.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(3.6)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 650);
  }, true);
  addEventListener('mouseup', () => { c.style.transform = ''; c.style.background = 'rgba(255,255,255,.55)'; }, true);
});`;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${BUILD}hello.y4m`],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: "ru-RU" });
await ctx.grantPermissions(["camera"], { origin: BASE });
await ctx.addInitScript(TOUCH);
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("sign-language", "rsl");
    localStorage.setItem("rsl-player-mode-v1", "video");
  } catch {}
});
const page = await ctx.newPage();
await page.request.post(BASE + "/api/auth/register", {
  data: { fullName: "Айгерим", email: `vertical-${Date.now()}@example.test`, password: "Overview-Pass-123" },
});
await page.request.patch(BASE + "/api/auth/language", { data: { language: "ru" } }).catch(() => {});

const sleep = (ms) => page.waitForTimeout(ms);
let pos = { x: W / 2, y: H * 0.7 };
async function glide(x, y, ms = 600) {
  const steps = Math.max(10, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const u = i / steps, e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    await page.mouse.move(pos.x + (x - pos.x) * e, pos.y + (y - pos.y) * e);
    await sleep(ms / steps);
  }
  pos = { x, y };
}
async function tap(loc, ms = 600) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("not visible: " + loc);
  await glide(b.x + b.width / 2, b.y + b.height / 2, ms);
  await sleep(120);
  await page.mouse.down(); await sleep(90); await page.mouse.up();
}
/** Smooth scroll of the page (window or the app's scrolling main) by dy px. */
async function scroll(dy, ms) {
  await page.evaluate(async ([dy, ms]) => {
    const main = document.querySelector(".main-content");
    const el = main && main.scrollHeight > main.clientHeight + 4 && getComputedStyle(main).overflowY !== "visible" ? main : document.scrollingElement;
    const from = el.scrollTop, t0 = performance.now();
    await new Promise((done) => {
      const step = (t) => {
        const u = Math.min(1, (t - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        el.scrollTop = from + dy * e;
        u < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, [dy, ms]);
}
async function scrollTo(loc, offset, ms) {
  const b = await loc.boundingBox();
  if (b) await scroll(b.y - offset, ms);
}
const jump = (y = 0) => page.evaluate((y) => { scrollTo(0, y); const m = document.querySelector(".main-content"); if (m) m.scrollTop = y; }, y);

const made = [];
async function record(id, length, prepare, act) {
  await prepare();
  await page.mouse.move(pos.x, pos.y);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  await act();
  const left = length * 1000 - (Date.now() / 1000 - t0) * 1000;
  if (left > 0) await sleep(left);
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  const dir = `${BUILD}v-${id}/`;
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
  const file = `${BUILD}vpart-${id}.mp4`;
  execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(FPS), "-i", dir + "%05d.jpg",
    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=white",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", file]);
  made.push({ file, length: total });
  console.log("REC", id, `${total.toFixed(1)}s`, n, "frames from", frames.length);
}

// 18–25 · two languages on the main page (≈7.4 s)
await record("a-languages", 7.4, async () => { await page.goto(BASE + "/"); await sleep(3500); await jump(0); }, async () => {
  await sleep(900);
  await scrollTo(page.locator("#languages"), 10, 1500);
  await sleep(1300);
  const ksl = page.locator("#languages .language-card").nth(1);
  if (await ksl.count()) await scrollTo(ksl, 120, 1500);
  else await scroll(420, 1500);
  await sleep(1200);
});

// 25–34 · open a real lesson; the sign example big on screen (≈9.4 s)
await record("b-lesson", 9.4, async () => { await page.goto(BASE + "/course"); await sleep(3500); await jump(0); }, async () => {
  const start = page.locator(".course-hero-actions a.button.primary").first();
  await scrollTo(start, 260, 700);
  await sleep(400);
  await tap(start, 600);
  await page.locator(".fs-player video").waitFor({ timeout: 8000 });
  await sleep(700);
  await scrollTo(page.locator(".fs-player"), 8, 900);
  await glide(W * 0.72, H * 0.62, 700);
  await sleep(3200);
});

// 34–40 · practice: the quick check, answered right (≈6.4 s)
await record("c-practice", 6.4, async () => {
  await page.goto(BASE + "/course/1"); await sleep(3200);
  await jump(0);
  await scrollTo(page.locator(".fs-answer button.primary", { hasText: "Проверить себя" }), H * 0.55, 10);
  await sleep(500);
}, async () => {
  await tap(page.locator(".fs-answer button.primary", { hasText: "Проверить себя" }), 600);
  await page.locator(".fs-round video").waitFor({ timeout: 5000 }).catch(() => {});
  await sleep(500);
  await jump(0);
  await scrollTo(page.locator(".fs-round video"), 70, 600);
  await sleep(700);
  const label = await page.evaluate(async () => {
    const v = document.querySelector(".fs-round video");
    const src = v ? new URL(v.currentSrc || v.src).pathname : "";
    const list = await fetch("/research/rsl/words/catalog.json").then((r) => r.json());
    const hit = list.find((e) => e.video === src || e.displayVideo === src);
    return hit ? hit.label.replace(/[!?]$/, "") : "";
  });
  const btn = page.locator(".fs-round button", { hasText: new RegExp(`^\\s*${label}[!?]?\\s*$`, "i") }).first();
  await scrollTo(btn, H - 210, 700);
  await sleep(300);
  if (label && (await btn.count())) await tap(btn, 550);
  await sleep(1300);
});

// 40–48 · AI checks the sign through the camera; the result is held (≈8.8 s)
await record("d-ai", 8.8, async () => {
  await page.goto(BASE + "/course/1");
  await sleep(2500);
  await page.locator(".course-steps button").nth(3).click();
  const cam = page.locator(".word-practice button.primary", { hasText: "Включить камеру" });
  await cam.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector(".word-practice button.primary")?.hasAttribute("disabled"), null, { timeout: 30000 });
  await jump(0);
  await cam.scrollIntoViewIfNeeded();
  await page.evaluate(() => { const m = document.querySelector(".main-content"); (m && m.scrollTop ? m : document.scrollingElement).scrollTop += 160; });
  await sleep(600);
}, async () => {
  await tap(page.locator(".word-practice button.primary", { hasText: "Включить камеру" }), 600);
  await sleep(500);
  await scrollTo(page.locator(".word-practice"), 6, 700);
  await glide(W * 0.8, H * 0.55, 600);
  await page.locator(".word-practice", { hasText: "Верно" }).waitFor({ timeout: 9000 }).catch(() => console.log("no verdict in time"));
  await sleep(250);
  const verdict = page.locator(".word-practice-result, .word-practice [class*=result], .word-practice [class*=verdict]").first();
  if (await verdict.count()) await scrollTo(verdict, H * 0.35, 800);
  else await scroll(300, 800);
  await sleep(2600);
});

await browser.close();

// Crossfade the four parts into exactly 30 s.
const inputs = made.flatMap((m) => ["-i", m.file]);
let chain = "", prev = "[0:v]", offset = 0;
for (let i = 1; i < made.length; i++) {
  offset += made[i - 1].length - XF;
  const out = i === made.length - 1 ? "[v]" : `[x${i}]`;
  chain += `${prev}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}${out};`;
  prev = out;
}
const clean = OUT + "AI-Mentor-overview-9x16.mp4";
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", chain.replace(/;$/, ""),
  "-map", "[v]", "-t", "30", "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", clean]);

// Part start times on the 30 s timeline (for the labels).
const starts = [0];
for (let i = 1; i < made.length; i++) starts.push(starts[i - 1] + made[i - 1].length - XF);
writeFileSync(BUILD + "vertical-timeline.json", JSON.stringify({ starts, lengths: made.map((m) => m.length) }, null, 2));
console.log("CLEAN", clean, "part starts", starts.map((s) => s.toFixed(2)));
