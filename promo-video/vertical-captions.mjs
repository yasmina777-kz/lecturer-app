// Burns the three labels («Изучай» → «Практикуйся» → «Получай помощь ИИ») onto the
// 9:16 overview. Run after record-vertical-overview.mjs.
//   node promo-video/vertical-captions.mjs
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const BUILD = ROOT + "promo-video/build/overview/";
const FFMPEG = ROOT + "ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0";
const { starts } = JSON.parse(readFileSync(BUILD + "vertical-timeline.json", "utf8"));
const labels = [
  { text: "Изучай", from: starts[1], to: starts[2] },
  { text: "Практикуйся", from: starts[2], to: starts[3] },
  { text: "Получай помощь ИИ", from: starts[3], to: 30 },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 240 }, deviceScaleFactor: 1 });
for (const [i, l] of labels.entries()) {
  await page.setContent(`<html><body style="margin:0;background:transparent;display:grid;place-items:center;height:240px;font-family:-apple-system,'SF Pro Display','Inter',system-ui,sans-serif">
    <div style="display:inline-flex;align-items:center;gap:22px;padding:26px 46px 26px 30px;border-radius:999px;background:rgba(14,18,28,.82);box-shadow:0 18px 50px rgba(0,0,0,.35);color:#fff;font-size:62px;font-weight:800;letter-spacing:-.5px">
      <span style="display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:#2f6bff;font-size:34px">${i + 1}</span>${l.text}
    </div></body></html>`);
  await page.screenshot({ path: `${BUILD}cap-${i}.png`, omitBackground: true });
}
await browser.close();

const inputs = ["-i", ROOT + "promo-video/AI-Mentor-overview-9x16.mp4"];
let chain = "", prev = "[0:v]";
labels.forEach((l, i) => {
  inputs.push("-loop", "1", "-t", "30", "-i", `${BUILD}cap-${i}.png`);
  const a = l.from + 0.25, b = l.to - 0.2;
  chain += `[${i + 1}:v]format=rgba,fade=t=in:st=${a.toFixed(2)}:d=0.35:alpha=1,fade=t=out:st=${(b - 0.35).toFixed(2)}:d=0.35:alpha=1[c${i}];`;
  chain += `${prev}[c${i}]overlay=x=(W-w)/2:y=260:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'[o${i}];`;
  prev = `[o${i}]`;
});
const out = ROOT + "promo-video/AI-Mentor-overview-9x16-captions.mp4";
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", chain.replace(/;$/, ""),
  "-map", prev, "-t", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
console.log("CAPTIONS", out);
