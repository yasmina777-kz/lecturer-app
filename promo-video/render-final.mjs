// Final 9:16 promo: the filmed hallway scene → she answers in sign / on the
// phone → «А ты смог бы ответить?» → the platform overview → «несколько
// занятий спустя» he greets her in sign → logo. Original synthesised music
// (musicbed.py) under the scene's own speech.
//   node promo-video/render-final.mjs                 → AI-Mentor-promo-9x16.mp4
//   node promo-video/render-final.mjs preview 3,10,16
// Needs build/final/{wa1,male}/ frames (see promo-video/README in the commit) and
// build/ovadframes from render-overview-ad.mjs.
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const B = ROOT + "promo-video/build/";
const FFMPEG = ROOT + "ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0";
const PY = ROOT + "ml/rsl/.venv/bin/python";

const ovTotal = readdirSync(B + "ovadframes").length; // 38.1 s overview
const ovCut = Math.round(34.7 * 30); // where its logo ending starts
const TL = { B: 8, C: 14, D: 19.5, E: 25 };
TL.F = TL.E + ovCut / 30;
TL.G = TL.F + 6;
const END = TL.G + (ovTotal - ovCut) / 30 + 1.6;
Object.assign(TL, { ovCut, ovTotal, END, wa1: readdirSync(B + "final/wa1").length, male: readdirSync(B + "final/male").length });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const hands = { privet: JSON.parse(readFileSync(B + "hands/privet.json", "utf8")) };
await page.addInitScript(([tl, h]) => { window.TL = tl; window.HANDS = h; }, [TL, hands]);
await page.goto("file://" + B + "final.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = (x) => page.evaluate(async (x) => { window.render(x); await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {})))); }, x);

if (process.argv[2] === "preview") {
  for (const x of process.argv[3].split(",").map(Number)) { await at(x); await page.screenshot({ path: `${B}final-${x}.jpg`, type: "jpeg", quality: 80 }); }
  console.log(JSON.stringify(TL));
  await browser.close();
  process.exit(0);
}
const dir = B + "finalframes/";
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
const n = Math.round(END * 30);
for (let i = 0; i < n; i++) { await at(i / 30); await page.screenshot({ path: `${dir}${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); }
await browser.close();

// Audio: hallway speech (0–8 s) over a quiet bed; the bed rises for the overview.
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", B + "final/wa1.mp4", "-t", "8", "-ac", "1", "-ar", "44100", B + "final/speech.wav"]);
execFileSync(PY, ["-c", `
import sys, numpy as np, wave
sys.path.insert(0, ${JSON.stringify(ROOT + "promo-video")})
from musicbed import music_bed, SR
END=${END}; T=${JSON.stringify(TL)}
n=int(END*SR); music,_=music_bed(n, END)
t=np.arange(n)/SR
def ramp(a,b,v0,v1): return np.clip((t-a)/(b-a),0,1)*(v1-v0)+v0
g=np.full(n,.10)
g=np.where(t<5.2, .05, g)                                   # under the spoken line
g=np.where((t>=T['D'])&(t<T['E']), ramp(T['D'],T['E'],.12,.26), g)
g=np.where((t>=T['E'])&(t<T['F']), .28, g)
g=np.where((t>=T['F'])&(t<T['G']), .16, g)
g=np.where(t>=T['G'], .28*np.clip((END-t)/2.0,0,1), g)
g=np.where(t<1, g*t, g)
mix=music*g
with wave.open(${JSON.stringify(B + "final/speech.wav")}) as w:
    sp=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
mix[:len(sp)] += sp*1.0
mix/=max(1.0,np.abs(mix).max()/0.95)
out=(mix*32767).astype(np.int16)
with wave.open(${JSON.stringify(B + "final/mix.wav")},'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('audio', END)
`], { stdio: "inherit" });

const out = ROOT + "promo-video/AI-Mentor-promo-9x16.mp4";
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "30", "-i", dir + "%05d.jpg", "-i", B + "final/mix.wav",
  "-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-color_range", "tv",
  "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
console.log("VIDEO", out, END.toFixed(1) + "s");
