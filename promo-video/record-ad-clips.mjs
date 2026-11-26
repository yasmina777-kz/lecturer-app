// Clips (16:10) for the 9:16 ad-style overview (render-overview-ad.mjs): real platform,
// visible cursor with click ripples, no voice-over. The camera scene feeds a
// real RSL signer clip («Привет!», Slovo dataset) as the webcam, so the AI
// check you see is the actual in-browser recognition.
//   node promo-video/record-ad-clips.mjs [sceneId ...]
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
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.2, locale: "ru-RU" });
await ctx.grantPermissions(["camera"], { origin: BASE });
await ctx.addInitScript(CURSOR);
await ctx.addInitScript(() => {
  try {
    if (!localStorage.getItem("sign-language")) localStorage.setItem("sign-language", "rsl");
    localStorage.setItem("rsl-player-mode-v1", "video");
  } catch {}
});
const page = await ctx.newPage();
// Fresh local demo account (local SQLite only).
await page.request.post(BASE + "/api/auth/register", {
  data: { fullName: "Айгерим", email: `overview-${Date.now()}@example.test`, password: "Overview-Pass-123" },
});
await page.request.patch(BASE + "/api/auth/language", { data: { language: "ru" } }).catch(() => {});

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
  const dir = `${BUILD}rec-ad-${id}/`;
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
  const file = `${BUILD}ad-clip-${id}.mp4`;
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

// Courses: both languages, then choose РЖЯ.
await record("courses", 6.5, async () => { await page.goto(BASE + "/learn"); await sleep(3000); }, async () => {
  await hover(page.locator(".sign-course-card.is-ksl"), 800);
  await sleep(900);
  await clickOn(page.locator(".sign-course-card.is-rsl"), 800);
  await sleep(2600);
});

// Lesson: the signer video «Привет», then the next word.
await record("lesson", 7.5, async () => { await page.goto(BASE + "/course/1"); await sleep(3500); }, async () => {
  await hover(page.locator(".fs-player video"), 700);
  await sleep(2200);
  await clickOn(page.locator(".course-chips button", { hasText: /^ты$/i }).first(), 650);
  await sleep(2400);
});

// Practice: quick check, answered right; the quiz video fully on screen.
await record("practice", 6.5, async () => {
  await page.goto(BASE + "/course/1"); await sleep(3500);
}, async () => {
  await clickOn(page.locator(".fs-answer button.primary", { hasText: "Проверить себя" }), 700);
  await page.locator(".fs-round video").waitFor({ timeout: 5000 }).catch(() => {});
  await sleep(600);
  const label = await page.evaluate(async () => {
    const v = document.querySelector(".fs-round video");
    const src = v ? new URL(v.currentSrc || v.src).pathname : "";
    const list = await fetch("/research/rsl/words/catalog.json").then((r) => r.json());
    const hit = list.find((e) => e.video === src || e.displayVideo === src);
    return hit ? hit.label.replace(/[!?]$/, "") : "";
  });
  await sleep(600);
  const btn = page.locator(".fs-round button", { hasText: new RegExp(`^\\s*${label}[!?]?\\s*$`, "i") }).first();
  if (label && (await btn.count())) await clickOn(btn, 650);
  await sleep(1800);
});

// Avatar: type «Привет» on the translate page, the 3D avatar signs it.
await record("avatar", 10, async () => {
  await page.goto(BASE + "/text-to-sign"); await sleep(1500);
  await page.evaluate(() => localStorage.setItem("rsl-player-mode-v2", "avatar"));
  await page.reload(); await sleep(5000);
}, async () => {
  await clickOn(page.locator("textarea").first(), 650);
  await page.keyboard.type("Привет", { delay: 120 });
  await sleep(300);
  await clickOn(page.locator("button.tts-go"), 650);
  // Slower, looping playback reads smoother on video.
  const speed = page.locator(".sign-sequence-controls select").first();
  await speed.waitFor({ timeout: 5000 }).catch(() => {});
  await speed.selectOption(".75").catch(() => {});
  await page.locator('.sign-sequence-controls input[type="checkbox"]').first().check().catch(() => {});
  await sleep(500);
  await glide(1150, 420, 700);
  await sleep(6200);
});
await page.evaluate(() => localStorage.setItem("rsl-player-mode-v2", "video"));

// AI: camera on, «Привет» recognised; camera and verdict both on screen.
await record("ai", 9, async () => {
  await page.goto(BASE + "/course/1");
  await sleep(2500);
  await page.locator(".course-steps button").nth(3).click();
  const cam = page.locator(".word-practice button.primary", { hasText: "Включить камеру" });
  await cam.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector(".word-practice button.primary")?.hasAttribute("disabled"), null, { timeout: 30000 });
  await page.evaluate(() => scrollTo(0, 0));
  await sleep(800);
}, async () => {
  await clickOn(page.locator(".word-practice button.primary", { hasText: "Включить камеру" }), 700);
  await sleep(700);
  await keepIn(page.locator(".word-practice"), 70);
  await glide(1250, 600, 700);
  await page.locator(".word-practice", { hasText: "Верно" }).waitFor({ timeout: 9000 }).catch(() => console.log("no verdict in time"));
  await sleep(2800);
});

const lang = (l) => page.evaluate((l) => localStorage.setItem("sign-language", l), l);

// RSL course: the lesson cards by level.
await record("rsl-course", 6.5, async () => { await page.goto(BASE + "/course?level=A1"); await sleep(3500); await page.evaluate(() => scrollTo(0, 0)); }, async () => {
  await glide(700, 380, 700);
  await sleep(500);
  await keepIn(page.locator(".course-units").first(), 120);
  await sleep(600);
  await hover(page.locator(".course-units .course-unit").nth(1), 700);
  await sleep(700);
  await hover(page.locator(".course-units .course-unit").nth(2), 600);
  await sleep(1200);
});

// Kazakh course: the 42-letter alphabet with signer photos.
await record("ksl-alphabet", 6.5, async () => {
  await lang("ksl");
  await page.goto(BASE + "/learn?stage=1"); await sleep(4000);
}, async () => {
  await glide(640, 420, 700);
  await sleep(600);
  await scroll(380, 1600);
  await sleep(400);
  await hover(page.locator(".letter-tile", { hasText: "Ә" }).first(), 700);
  await sleep(1600);
});

// Dictionary by topics: 27 topic cards with photos (751 SURDO.KZ signs).
await record("ksl-dict", 6.5, async () => { await lang("ksl"); await page.goto(BASE + "/vocab"); await sleep(4500); }, async () => {
  await glide(700, 520, 600);
  await sleep(300);
  await keepIn(page.locator(".ksl-topic-grid").first(), 150);
  await sleep(300);
  for (const t of ["Семья", "Числа", "Еда и быт"]) {
    await hover(page.locator(".ksl-topic-card", { hasText: t }).first(), 600);
    await sleep(500);
  }
  await scroll(260, 1200);
  await sleep(700);
});
await lang("rsl");

// RSL lesson: a different signer («имя»), then the quick check answered right.
await record("lesson2", 7.5, async () => { await page.goto(BASE + "/course/1"); await sleep(3500); }, async () => {
  await clickOn(page.locator(".course-chips button", { hasText: /^имя$/i }).first(), 650);
  await sleep(1700);
  await clickOn(page.locator(".fs-answer button.primary", { hasText: "Проверить себя" }), 650);
  await page.locator(".fs-round video").waitFor({ timeout: 5000 }).catch(() => {});
  await sleep(700);
  const label = await page.evaluate(async () => {
    const v = document.querySelector(".fs-round video");
    const src = v ? new URL(v.currentSrc || v.src).pathname : "";
    const list = await fetch("/research/rsl/words/catalog.json").then((r) => r.json());
    const hit = list.find((e) => e.video === src || e.displayVideo === src);
    return hit ? hit.label.replace(/[!?]$/, "") : "";
  });
  const btn = page.locator(".fs-round button", { hasText: new RegExp(`^\\s*${label}[!?]?\\s*$`, "i") }).first();
  if (label && (await btn.count())) await clickOn(btn, 650);
  await sleep(1500);
});

// Avatar: «Привет», signed once (0.75×, no repeat).
await record("avatar1", 9, async () => {
  await page.goto(BASE + "/text-to-sign"); await sleep(1500);
  await page.evaluate(() => localStorage.setItem("rsl-player-mode-v2", "avatar"));
  await page.reload(); await sleep(5000);
}, async () => {
  await clickOn(page.locator("textarea").first(), 600);
  await page.keyboard.type("Привет", { delay: 110 });
  await sleep(250);
  await clickOn(page.locator("button.tts-go"), 600);
  const speed = page.locator(".sign-sequence-controls select").first();
  await speed.waitFor({ timeout: 5000 }).catch(() => {});
  await speed.selectOption(".75").catch(() => {});
  await sleep(400);
  await glide(1150, 420, 700);
  await sleep(5200);
});
await page.evaluate(() => localStorage.setItem("rsl-player-mode-v2", "video"));

// Levels: learn from zero — A1 → A2 → B1 on the RSL course page.
await record("levels", 8, async () => {
  await lang("rsl");
  await page.goto(BASE + "/course?level=A1"); await sleep(3500);
  await page.evaluate(() => scrollTo(0, 0));
  await keepIn(page.locator(".course-levels").first(), 40);
  await sleep(400);
}, async () => {
  await hover(page.locator('.course-levels button[data-level="A1"]'), 600);
  await sleep(900);
  await clickOn(page.locator('.course-levels button[data-level="A2"]'), 650);
  await sleep(1700);
  await clickOn(page.locator('.course-levels button[data-level="B1"]'), 650);
  await sleep(2200);
});

await browser.close();
