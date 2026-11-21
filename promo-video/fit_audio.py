"""Fit the scene timings to the narration, render, and mux.
  python3 promo-video/fit_audio.py path/to/voice.mp3
Finds the 9 longest pauses (the blank lines between the 10 paragraphs of
narration.txt), starts each scene on its paragraph, renders and writes
promo-video/AI-Mentor-promo.mp4."""
import re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FF = str(next((ROOT / 'ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries').glob('ffmpeg-*')))
audio = Path(sys.argv[1]).resolve()
log = subprocess.run([FF, '-hide_banner', '-i', str(audio), '-af', 'silencedetect=noise=-35dB:d=0.25', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
h, m, sec = re.search(r'Duration: (\d+):(\d+):([\d.]+)', log).groups()
dur = int(h) * 3600 + int(m) * 60 + float(sec)
starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
pauses = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.3 and e < dur - 0.3]
pauses = sorted(sorted(pauses, reverse=True)[:9], key=lambda p: p[1])
if len(pauses) < 9:
    sys.exit(f'found only {len(pauses)} pauses; make the blank-line pauses longer')
lead = 0.6  # first words start after the opening line draws a little
cuts = [0.0] + [lead + (s + e) / 2 for _, s, e in pauses]
names = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10']
T = {n: round(c, 2) for n, c in zip(names, cuts)}
T['end'] = round(lead + dur + 2.0, 2)
print('timing', T)
html = ROOT / 'promo-video/build/scenes.html'
src = html.read_text()
src = re.sub(r'window\.T = \{[^}]*\};', 'window.T = ' + str(T).replace("'", '') + ';', src)
html.write_text(src)
subprocess.run(['node', str(ROOT / 'promo-video/render.mjs')], check=True)
out = ROOT / 'promo-video/AI-Mentor-promo.mp4'
subprocess.run([FF, '-y', '-loglevel', 'error', '-framerate', '30', '-i', str(ROOT / 'promo-video/build/frames/%05d.jpg'),
                '-itsoffset', str(lead), '-i', str(audio), '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-af', 'apad', '-shortest', '-movflags', '+faststart', str(out)], check=True)
print('VIDEO', out)
