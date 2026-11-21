"""Voice track (Piper lines placed on the review timeline) + a light original
music bed synthesised here (no third-party music), mixed to build/review-audio.wav.
  ml/rsl/.venv/bin/python -I promo-video/build_audio.py"""
import json, wave
from pathlib import Path
import sys
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from musicbed import music_bed

D = Path(__file__).resolve().parent / 'build'
SR = 44100
scenes = json.loads((D / 'review-timeline.json').read_text())
total = scenes[-1]['end']
voice = np.zeros(int(total * SR) + SR)
for s in scenes:
    with wave.open(str(D / 'vo' / f"{s['id']}.wav")) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        sr = w.getframerate()
    x = np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x)  # → 44.1 kHz
    a = int((s['start'] + s['vo']) * SR)
    voice[a:a + len(x)] += x[:len(voice) - a]
voice *= 0.9 / max(1e-6, np.abs(voice).max())

music, t = music_bed(len(voice), total)
# duck the music under the voice
env = np.convolve(np.abs(voice), np.ones(int(.25 * SR)) / int(.25 * SR), 'same')
duck = 1 - .6 * np.clip(env / .05, 0, 1)
fade = np.minimum(1, t / 1.0) * np.minimum(1, (total - t) / 2.0).clip(0, 1)
mix = voice + .22 * music * duck * fade
mix /= max(1.0, np.abs(mix).max() / .95)
out = (np.stack([mix, mix], 1) * 32767).astype(np.int16)
with wave.open(str(D / 'review-audio.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('AUDIO', round(len(mix) / SR, 2), 's')
