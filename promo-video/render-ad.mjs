// Vertical ad in the style of the reference (dark problem intro → logo → light
// sections with heading + real platform UI). Voice: build/advo (Silero).
//   node promo-video/render-ad.mjs [preview t1,t2,...]
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const B = new URL("./build/", import.meta.url).pathname;
const LINES = JSON.parse(readFileSync(new URL("./ad-lines.json", import.meta.url), "utf8"));
const DUR = JSON.parse(readFileSync(B + "advo/durations.json", "utf8"));
const clean = (s) => s.replace(/Эй Ай М\+ентор/g, "AI Mentor").replace(/пэ дэ эф/g, "PDF").replace(/\+/g, "");
let t = 0;
const scenes = LINES.map((l) => {
  const s = { ...l, sub: clean(l.say), start: t, vo: 0.4, voDur: DUR[l.id] };
  t += 0.4 + DUR[l.id] + (l.id === "problem" ? 0.5 : 0.75) + (l.id === "outro" ? 2.2 : 0);
  s.end = t;
  return s;
});
writeFileSync(B + "ad-timeline.json", JSON.stringify({ lines: scenes.map(({ id, start, vo }) => ({ id, start, vo })), end: t }));
const rec = Object.fromEntries(["home", "letters", "words", "grammar", "translate"].map((id) => [id, readdirSync(`${B}rec/${id}`).length]));
const hands = { privet: JSON.parse(readFileSync(B + "hands/privet.json", "utf8")) };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(([s, r, h]) => { window.SCENES = s; window.RECFRAMES = r; window.HANDS = h; }, [scenes, rec, hands]);
await page.goto("file://" + B + "ad.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = (x) => page.evaluate(async (x) => { window.render(x); await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {})))); }, x);
if (process.argv[2] === "preview") {
  for (const x of process.argv[3].split(",").map(Number)) { await at(x); await page.screenshot({ path: `${B}ad-${x}.jpg`, type: "jpeg", quality: 80 }); }
  console.log(scenes.map((s) => `${s.id}@${s.start.toFixed(1)}`).join(" "));
} else {
  rmSync(B + "adframes", { recursive: true, force: true }); mkdirSync(B + "adframes");
  const n = Math.round(t * 30);
  for (let i = 0; i < n; i++) { await at(i / 30); await page.screenshot({ path: `${B}adframes/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); }
  console.log("FRAMES", n, "duration", t.toFixed(2));
}
await browser.close();
