// Screen recordings of the real platform for the review video (CDP screencast,
// visible cursor). Each scene → build/rec/<id>/%05d.jpg at 30 fps.
//   node promo-video/record.mjs [sceneId ...]
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const BUILD = new URL("./build/", import.meta.url).pathname;
const DUR = JSON.parse(readFileSync(BUILD + "vo/durations.json", "utf8"));
const BASE = "http://localhost:5173";
const only = process.argv.slice(2);

const CURSOR = `
addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div');
  c.id = 'promo-cursor';
  c.style.cssText = 'position:fixed;left:-100px;top:-100px;width:26px;height:26px;margin:-4px 0 0 -4px;z-index:2147483647;pointer-events:none;transition:transform .12s;' +
    'background:url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path d=%22M3 2l7 19 2.5-7.5L20 11z%22 fill=%22%23111%22 stroke=%22white%22 stroke-width=%221.6%22 stroke-linejoin=%22round%22/></svg>") no-repeat center/contain';
  document.body.appendChild(c);
  addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', (e) => {
    c.style.transform = 'scale(.8)';
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;width:16px;height:16px;left:' + (e.clientX - 8) + 'px;top:' + (e.clientY - 8) + 'px;background:rgba(255,92,138,.45);transition:all .5s ease-out';
    document.body.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(4.5)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 600);
  }, true);
  addEventListener('mouseup', () => { c.style.transform = ''; }, true);
});`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
await ctx.addInitScript(CURSOR);
const page = await ctx.newPage();
await page.request.post(BASE + "/api/auth/register", { data: { fullName: "Айгерим", email: `review-${Date.now()}@example.test`, password: "Test-Pass-123" } });
const sleep = (ms) => page.waitForTimeout(ms);
let mouse = { x: 720, y: 450 };
async function glide(x, y, ms = 600) {
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const u = i / steps, e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    await page.mouse.move(mouse.x + (x - mouse.x) * e, mouse.y + (y - mouse.y) * e);
    await sleep(ms / steps);
  }
  mouse = { x, y };
}
async function clickOn(loc, ms = 600) {
  const b = await loc.boundingBox();
  if (!b) return;
  await glide(b.x + b.width / 2, b.y + b.height / 2, ms);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
async function scroll(dy, ms) {
  const steps = Math.round(ms / 30);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, dy / steps); await sleep(30); }
}
const mode = (m) => page.evaluate((m) => localStorage.setItem("rsl-player-mode-v1", m), m);

async function record(id, prepare, act) {
  if (only.length && !only.includes(id)) return;
  await prepare();
  await page.mouse.move(mouse.x, mouse.y);
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 2160, maxHeight: 1350, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const length = DUR[id] + 1.2;
  await act();
  const left = length * 1000 - (Date.now() / 1000 - t0) * 1000;
  if (left > 0) await sleep(left);
  await cdp.send("Page.stopScreencast");
  await cdp.detach();
  const dir = `${BUILD}rec/${id}/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const n = Math.round(length * 30);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / 30;
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    writeFileSync(dir + String(i).padStart(5, "0") + ".jpg", Buffer.from(frames[k].data, "base64"));
  }
  console.log("REC", id, n, "frames from", frames.length, "screencast frames");
}

await page.goto(BASE + "/learn");
await mode("video");

await record("home", async () => { await page.goto(BASE + "/learn"); await sleep(3000); },
  async () => { await glide(400, 260, 700); await sleep(500); await scroll(700, 2400); await glide(520, 520, 600); await sleep(900); await scroll(-700, 1500); });

await record("letters", async () => { await mode("video"); await page.goto(BASE + "/practice"); await sleep(3500); },
  async () => {
    for (const l of ["А", "Б", "В"]) {
      await clickOn(page.locator("button", { hasText: new RegExp(`^${l}$`) }).first(), 650);
      await sleep(1100);
    }
  });

await record("words", async () => { await page.goto(BASE + "/vocab"); await sleep(3000); },
  async () => {
    await glide(700, 420, 700);
    await clickOn(page.locator("button, a", { hasText: "Урок 1" }).first(), 700);
    await sleep(2200);
    await glide(760, 520, 800);
    await sleep(1500);
  });

await record("grammar", async () => { await page.goto(BASE + "/grammar?track=rsl&lesson=order"); await sleep(3500); },
  async () => {
    for (const w of ["Я", "ВОДА", "ПИТЬ"]) {
      await clickOn(page.locator(".order-tiles button", { hasText: new RegExp(`^${w}$`, "i") }).first(), 550);
      await sleep(250);
    }
    await clickOn(page.locator(".grammar-task button", { hasText: "Проверить" }).first(), 550);
    await sleep(900);
    await clickOn(page.locator("button[role=tab]", { hasText: "КЖР" }), 700);
    await sleep(1500);
  });

await record("translate", async () => { await mode("avatar"); await page.goto(BASE + "/text-to-sign"); await sleep(3500); },
  async () => {
    await clickOn(page.locator("textarea"), 600);
    await page.keyboard.type("Привет", { delay: 110 });
    await sleep(300);
    await clickOn(page.locator("button", { hasText: "Показать жестами" }), 650);
    await sleep(3500);
  });

await mode("video");
await browser.close();
