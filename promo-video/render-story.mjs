// Story video «Пекарня напротив» (16:9). Voice: build/storyvo (Azure, see azure_tts.py).
//   node promo-video/render-story.mjs [preview t1,t2,...]
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const B = new URL("./build/", import.meta.url).pathname;
const LINES = JSON.parse(readFileSync(new URL("./story-lines.json", import.meta.url), "utf8"));
const DUR = JSON.parse(readFileSync(B + "storyvo/durations.json", "utf8"));
const EXTRA = { s1: 0.8, s2: 0.4, s3: 0.3, s9: 0.4, s10: 1.8, s11: 0.8, s12: 2.6 };
let t = 0;
const scenes = LINES.map((l) => {
  const s = { ...l, start: t, vo: 0.5, voDur: DUR[l.id] };
  t += 0.5 + DUR[l.id] + 0.7 + (EXTRA[l.id] ?? 0);
  s.end = t;
  return s;
});
writeFileSync(B + "story-timeline.json", JSON.stringify({ lines: scenes.map(({ id, start, vo }) => ({ id, start, vo })), end: t }));
const rec = Object.fromEntries(["home", "letters", "words", "translate"].map((id) => [id, readdirSync(`${B}rec/${id}`).length]));
const hands = { privet: JSON.parse(readFileSync(B + "hands/privet.json", "utf8")) };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(([s, r, h]) => { window.SCENES = s; window.RECFRAMES = r; window.HANDS = h; }, [scenes, rec, hands]);
await page.goto("file://" + B + "story.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = (x) => page.evaluate(async (x) => { window.render(x); await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {})))); }, x);
if (process.argv[2] === "preview") {
  for (const x of process.argv[3].split(",").map(Number)) { await at(x); await page.screenshot({ path: `${B}st-${x}.jpg`, type: "jpeg", quality: 80 }); }
  console.log(scenes.map((s) => `${s.id}@${s.start.toFixed(1)}`).join(" "), "end", t.toFixed(1));
} else {
  rmSync(B + "stframes", { recursive: true, force: true }); mkdirSync(B + "stframes");
  const n = Math.round(t * 30);
  for (let i = 0; i < n; i++) { await at(i / 30); await page.screenshot({ path: `${B}stframes/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); }
  console.log("FRAMES", n, "duration", t.toFixed(2));
}
await browser.close();
