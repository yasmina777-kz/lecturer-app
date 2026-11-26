// Final 9:16 promo with a voice-over: filmed hallway scene → generated scenes
// (she signs, phone answer, he wonders, opens the course) → platform overview
// (voiced per section) → he practises → «несколько занятий спустя» greeting → logo.
// Voice: ru-RU-SvetlanaNeural (edge_voice.py final-lines.json build/finalvo).
//   node promo-video/render-final2.mjs                → AI-Mentor-promo-voice-9x16.mp4
//   node promo-video/render-final2.mjs preview 3,20,40
import { chromium } from "../frontend/node_modules/playwright/index.mjs";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url).pathname;
const B = ROOT + "promo-video/build/";
const FFMPEG = ROOT + "ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0";
const PY = ROOT + "ml/rsl/.venv/bin/python";
const LINES = JSON.parse(readFileSync(ROOT + "promo-video/final-lines.json", "utf8"));
const DUR = JSON.parse(readFileSync(B + "finalvo/trimmed.json", "utf8"));
const text = (id) => LINES.find((l) => l.id === id).say.replace(/Эй Ай Ментор/g, "AI Mentor").replace("Трёхмерный", "3D-");

const ovTotal = readdirSync(B + "ovadframes").length;
const ovCut = Math.round(34.7 * 30);
// beats
const TL = { B: 8, C: 12.5, D: 17 };
TL.E = TL.D + 0.3 + DUR.think + 0.5;
TL.F = TL.E + 0.2 + DUR.intro + 0.4;
TL.G = TL.F + ovCut / 30;
TL.H = TL.G + 0.2 + DUR.practice + 0.4;
TL.I = TL.H + 4.2;
const END = TL.I + Math.max((ovTotal - ovCut) / 30 + 1.2, 0.2 + DUR.outro + 1.0);
// voice-over placement (overview lines follow its section starts, never overlap)
const plan = [
  ["think", TL.D + 0.3], ["intro", TL.E + 0.2],
  ["langs", TL.F + 2.75], ["rsl", TL.F + 6.55], ["ksl", TL.F + 10.75], ["dict", TL.F + 14.95],
  ["lesson", TL.F + 19.15], ["avatar", TL.F + 24.65], ["ai", TL.F + 28.85],
  ["practice", TL.G + 0.2], ["meet", TL.H + 0.6], ["outro", TL.I + 0.2],
];
let prevEnd = 0;
const vo = plan.map(([id, at]) => {
  const s = Math.max(at, prevEnd + 0.12);
  prevEnd = s + DUR[id];
  return { id, at: +s.toFixed(2), dur: DUR[id], text: text(id) };
});
Object.assign(TL, { ovCut, ovTotal, END, vo, wa1: readdirSync(B + "final/wa1").length });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.addInitScript((tl) => { window.TL = tl; }, TL);
await page.goto("file://" + B + "final2.html");
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
const at = (x) => page.evaluate(async (x) => { window.render(x); await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => {})))); }, x);

if (process.argv[2] === "preview") {
  for (const x of process.argv[3].split(",").map(Number)) { await at(x); await page.screenshot({ path: `${B}final2-${x}.jpg`, type: "jpeg", quality: 80 }); }
  console.log(JSON.stringify({ ...TL, vo: vo.map((v) => `${v.id}@${v.at}+${v.dur}`) }));
  await browser.close();
  process.exit(0);
}
const dir = B + "final2frames/";
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
const n = Math.round(END * 30);
for (let i = 0; i < n; i++) { await at(i / 30); await page.screenshot({ path: `${dir}${String(i).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 }); }
await browser.close();

execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", B + "final/wa1.mp4", "-t", "8", "-ac", "1", "-ar", "44100", B + "final/speech.wav"]);
execFileSync(PY, ["-c", `
import sys, json, numpy as np, wave, subprocess
sys.path.insert(0, ${JSON.stringify(ROOT + "promo-video")})
from musicbed import music_bed, SR
END=${END}; T=${JSON.stringify(TL)}
def read(p):
    raw=subprocess.run([${JSON.stringify(FFMPEG)},'-loglevel','error','-i',p,'-ac','1','-ar',str(SR),'-f','s16le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768
n=int(END*SR); music,_=music_bed(n, END); t=np.arange(n)/SR
voice=np.zeros(n)
sp=read(${JSON.stringify(B + "final/speech.wav")}); voice[:len(sp)]+=sp
for l in T['vo']:
    a=read(${JSON.stringify(B + "finalvo/")}+l['id']+'.t.wav'); s=int(l['at']*SR); e=min(n,s+len(a)); voice[s:e]+=a[:e-s]*1.15
# music level by section, ducked under any voice
g=np.where(t<T['F'],.11,.16); g=np.where(t>=T['G'],.13,g); g=np.where(t>=T['I'],.18,g)
env=np.convolve((np.abs(voice)>.02).astype(float),np.ones(int(.3*SR))/int(.3*SR),'same')
g=g*(1-.55*np.clip(env*3,0,1))
g=g*np.clip(t/1.0,0,1)*np.clip((END-t)/2.2,0,1)
mix=music*g+voice
mix/=max(1.0,np.abs(mix).max()/0.95)
with wave.open(${JSON.stringify(B + "final/mix2.wav")},'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes())
print('audio', END)
`], { stdio: "inherit" });

const out = ROOT + "promo-video/AI-Mentor-promo-voice-9x16.mp4";
execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-framerate", "30", "-i", dir + "%05d.jpg", "-i", B + "final/mix2.wav",
  "-vf", "scale=in_range=full:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-color_range", "tv",
  "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
console.log("VIDEO", out, END.toFixed(1) + "s");
