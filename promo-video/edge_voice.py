"""Voiceover with Microsoft neural voice ru-RU-SvetlanaNeural via the free Edge
read-aloud service (edge-tts; no key, unofficial — fine for a study / non-commercial
video, for paid ads use an official Azure Speech key).
  promo-video/.venv/bin/python promo-video/edge_voice.py ad2-lines.json build/ad2vo"""
import json, os, subprocess, sys, time, wave
from pathlib import Path

D = Path(__file__).resolve().parent
lines = json.loads((D / sys.argv[1]).read_text())
out = D / sys.argv[2]; out.mkdir(parents=True, exist_ok=True)
FF = str(next((D.parent / 'ml/rsl/.venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries').glob('ffmpeg-*')))
dur = {}
for l in lines:
    mp3, wav = out / f"{l['id']}.mp3", out / f"{l['id']}.wav"
    for attempt in range(6):
        subprocess.run([str(D / '.venv/bin/edge-tts'), '--voice', os.environ.get('VOICE', 'ru-RU-SvetlanaNeural'), f"--rate={os.environ.get('RATE', '-4%')}", f"--pitch={os.environ.get('PITCH', '-4Hz')}",
                        '--text', l['say'], '--write-media', str(mp3)], capture_output=True)
        if mp3.exists() and mp3.stat().st_size > 2000:
            break
        time.sleep(3 + 2 * attempt)
    else:
        sys.exit(f"no audio for {l['id']}")
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(mp3), '-ac', '1', '-ar', '48000', str(wav)], check=True)
    with wave.open(str(wav)) as w:
        dur[l['id']] = round(w.getnframes() / w.getframerate(), 2)
    time.sleep(1.5)
(out / 'durations.json').write_text(json.dumps(dur))
print(dur, round(sum(dur.values()), 1))
