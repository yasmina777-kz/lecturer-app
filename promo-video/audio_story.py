"""Audio for the story video: Azure voice lines (build/storyvo) + soft music bed → build/story-audio.wav
clip audio from build/pres-audio/<id>.wav when present, else build/vv/<id>.wav)
placed on the vertical timeline, plus the music bed.  → build/story-audio.wav"""
import json, sys, wave
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from musicbed import music_bed, SR

D = Path(__file__).resolve().parent / 'build'
tl = json.loads((D / 'story-timeline.json').read_text())
total = tl['end']
voice = np.zeros(int(total * SR) + SR)
for l in tl['lines']:
    f = D / 'storyvo' / f"{l['id']}.wav"
    
    with wave.open(str(f)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            x = x.reshape(-1, 2).mean(1)
        sr = w.getframerate()
    x = np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x)
    a = int((l['start'] + l['vo']) * SR)
    voice[a:a + len(x)] += x[:len(voice) - a]
voice *= 0.9 / max(1e-6, np.abs(voice).max())
music, t = music_bed(len(voice), total)
env = np.convolve(np.abs(voice), np.ones(int(.25 * SR)) / int(.25 * SR), 'same')
duck = 1 - .6 * np.clip(env / .05, 0, 1)
fade = np.minimum(1, t / 1.0) * np.minimum(1, (total - t) / 2.0).clip(0, 1)
mix = voice + .14 * music * duck * fade
mix /= max(1.0, np.abs(mix).max() / .95)
with wave.open(str(D / 'story-audio.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.stack([mix, mix], 1) * 32767).astype(np.int16).tobytes())
print('AUDIO', round(len(mix) / SR, 2))
