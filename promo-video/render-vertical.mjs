// Vertical presenter video: presenter (Dreamina clip in build/pres/<id>/ if present,
// else the kit still) + real-signer RSL window + subtitles.
//   node promo-video/render-vertical.mjs [preview t1,t2]
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const B = new URL("./build/", import.meta.url).pathname;
const FF = new URL("../ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0", import.meta.url).pathname;
const LINES = JSON.parse(readFileSync(new URL("./vertical-lines.json", import.meta.url), "utf8"));
const INS = JSON.parse(readFileSync(B + "insets/insets.json", "utf8"));
// WAV duration from its header (data bytes / byte rate)
const probe = (f) => { const b = readFileSync(f); let o = 12; let rate = 0; while (o < b.length - 8) { const id = b.toString("ascii", o, o + 4), size = b.readUInt32LE(o + 4); if (id === "fmt ") rate = b.readUInt32LE(o + 16); if (id === "data") return size / rate; o += 8 + size + (size % 2); } return 0; };
let t = 0; const lines = [];
for (const [id, l] of Object.entries(LINES)) {
  const pres = existsSync(`${B}pres/${id}`) ? readdirSync(`${B}pres/${id}`).length : 0;
  const voice = pres ? null : `${B}vv/${id}.wav`;
  const voDur = pres ? pres / 30 : probe(voice);
  const len = Math.max(voDur + .6, INS[id].duration + .5, pres / 30);
  lines.push({ id, start: t, end: t + len, vo: pres ? 0 : .3, voDur, text: l.text, pose: l.pose, insetFrames: readdirSync(`${B}vseq/${id}`).length, signs: INS[id].signs, presFrames: pres || undefined });
  t += len;
}
const END = t + 2.8;
writeFileSync(B + "vertical-timeline.json", JSON.stringify({ lines, end: END }));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript(([l, e]) => { window.LINES = l; window.END = e; }, [lines, END]);
await page.goto("file://" + B + "vertical.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = (x) => page.evaluate(async (x) => { window.render(x); await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {})))); }, x);
if (process.argv[2] === "preview") {
  for (const x of process.argv[3].split(",").map(Number)) { await at(x); await page.screenshot({ path: `${B}vt-${x}.jpg`, type: "jpeg", quality: 80 }); }
} else {
  rmSync(B + "vframes", { recursive: true, force: true }); mkdirSync(B + "vframes");
  const n = Math.round(END * 30);
  for (let i = 0; i < n; i++) { await at(i / 30); await page.screenshot({ path: `${B}vframes/${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); }
  console.log("FRAMES", n, "duration", END.toFixed(2));
}
await browser.close();
