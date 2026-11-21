// Render promo-video/build/scenes.html frame by frame (30 fps) → build/frames/*.jpg
//   node promo-video/render.mjs [preview t1,t2,...]
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
const BUILD = new URL("./build/", import.meta.url).pathname;
const preview = process.argv[2] === "preview" ? process.argv[3].split(",").map(Number) : null;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const hands = Object.fromEntries(["dom", "privet"].map((n) => [n, JSON.parse(readFileSync(`${BUILD}hands/${n}.json`, "utf8"))]));
await page.addInitScript((h) => { window.HANDS = h; }, hands);
await page.goto("file://" + BUILD + "scenes.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = async (t) => {
  await page.evaluate(async (t) => {
    window.render(t);
    await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {}))));
  }, t);
};
if (preview) {
  for (const t of preview) {
    await at(t);
    await page.screenshot({ path: `${BUILD}preview-${t}.jpg`, type: "jpeg", quality: 80 });
  }
} else {
  const end = await page.evaluate(() => window.T.end);
  rmSync(BUILD + "frames", { recursive: true, force: true });
  mkdirSync(BUILD + "frames");
  const n = Math.round(end * 30);
  for (let i = 0; i < n; i++) {
    await at(i / 30);
    await page.screenshot({ path: `${BUILD}frames/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
    if (i % 300 === 0) console.log("frame", i, "/", n);
  }
  console.log("FRAMES", n);
}
await browser.close();
