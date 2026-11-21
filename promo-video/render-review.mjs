// Render the review video frames from build/review.html.
//   node promo-video/render-review.mjs [preview t1,t2,...]
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const BUILD = new URL("./build/", import.meta.url).pathname;
const LINES = JSON.parse(readFileSync(new URL("./review-lines.json", import.meta.url), "utf8"));
const DUR = JSON.parse(readFileSync(BUILD + "vo/durations.json", "utf8"));
const REC_IDS = ["home", "letters", "words", "grammar", "translate"];
const VO_AT = 0.35, TAIL = 0.75;
let t = 0;
const scenes = LINES.map((l) => {
  const s = { id: l.id, kind: REC_IDS.includes(l.id) ? "rec" : "graphic", text: l.text, start: t, vo: VO_AT, voDur: DUR[l.id] };
  t += VO_AT + DUR[l.id] + TAIL + (l.id === "outro" ? 1.2 : 0);
  s.end = t;
  return s;
});
writeFileSync(BUILD + "review-timeline.json", JSON.stringify(scenes));
const rec = Object.fromEntries(REC_IDS.map((id) => [id, readdirSync(`${BUILD}rec/${id}`).length]));
const hands = { privet: JSON.parse(readFileSync(BUILD + "hands/privet.json", "utf8")) };
const preview = process.argv[2] === "preview" ? process.argv[3].split(",").map(Number) : null;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(([s, r, h]) => { window.SCENES = s; window.RECFRAMES = r; window.HANDS = h; }, [scenes, rec, hands]);
await page.goto("file://" + BUILD + "review.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = (x) => page.evaluate(async (x) => {
  window.render(x);
  await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {}))));
}, x);
if (preview) {
  for (const x of preview) { await at(x); await page.screenshot({ path: `${BUILD}rv-${x}.jpg`, type: "jpeg", quality: 80 }); }
} else {
  rmSync(BUILD + "rframes", { recursive: true, force: true });
  mkdirSync(BUILD + "rframes");
  const n = Math.round(t * 30);
  for (let i = 0; i < n; i++) {
    await at(i / 30);
    await page.screenshot({ path: `${BUILD}rframes/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
    if (i % 300 === 0) console.log("frame", i, "/", n);
  }
  console.log("FRAMES", n, "duration", t.toFixed(2));
}
await browser.close();
