"""Use the presenter's Dreamina/Kling clips instead of the still + temporary voice.
  ml/rsl/.venv/bin/python -I promo-video/import_clips.py A=~/Downloads/a.mp4 B=... C=... D=... E=...
Each clip → build/pres/<id>/%05d.jpg (1080x1920, 30 fps, cropped to fill) and
build/pres-audio/<id>.wav (her voice). Then:
  node promo-video/render-vertical.mjs && ml/rsl/.venv/bin/python -I promo-video/audio_vertical.py  (+ ffmpeg mux)"""
import shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FF = str(next((ROOT / 'ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries').glob('ffmpeg-*')))
B = ROOT / 'promo-video/build'
for arg in sys.argv[1:]:
    line, path = arg.split('=', 1)
    src = Path(path).expanduser().resolve()
    out = B / 'pres' / line
    shutil.rmtree(out, ignore_errors=True); out.mkdir(parents=True)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(src), '-vf',
                    'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30', '-q:v', '3', str(out / '%05d.jpg')], check=True)
    (B / 'pres-audio').mkdir(exist_ok=True)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(src), '-vn', '-ac', '1', '-ar', '44100', str(B / 'pres-audio' / f'{line}.wav')], check=True)
    print('CLIP', line, len(list(out.iterdir())), 'frames')
