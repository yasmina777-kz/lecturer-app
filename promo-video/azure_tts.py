"""Story voiceover with Azure Speech (neural voices, free F0 tier).
Reads AZURE_SPEECH_KEY / AZURE_SPEECH_REGION from the project's .env (never printed).
  ml/rsl/.venv/bin/python -I promo-video/azure_tts.py  → build/storyvo/<id>.wav + durations.json
Without a key it writes silent placeholders with estimated lengths (for timing only)."""
import json, re, urllib.request, wave
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'promo-video/build/storyvo'; OUT.mkdir(parents=True, exist_ok=True)
VOICES = {'narrator': ('ru-RU-SvetlanaNeural', '-4%', '-2%'), 'aigerim': ('ru-RU-DariyaNeural', '0%', '+2%')}
env = {}
for f in ('.env.local', '.env'):
    p = ROOT / f
    if p.exists():
        for line in p.read_text().splitlines():
            m = re.match(r'\s*(AZURE_SPEECH_KEY|AZURE_SPEECH_REGION)\s*=\s*(.*)\s*$', line)
            if m and m.group(2).strip() and m.group(1) not in env:
                env[m.group(1)] = m.group(2).strip().strip('"')
key, region = env.get('AZURE_SPEECH_KEY'), env.get('AZURE_SPEECH_REGION')
dur = {}
for l in json.loads((ROOT / 'promo-video/story-lines.json').read_text()):
    f = OUT / f"{l['id']}.wav"
    if key and region:
        name, rate, pitch = VOICES[l['voice']]
        body = escape(l['text']).replace('AI Mentor', '<sub alias="Эй Ай Ментор">AI Mentor</sub>')
        ssml = (f'<speak version="1.0" xml:lang="ru-RU"><voice name="{name}"><prosody rate="{rate}" pitch="{pitch}">'
                f'{body}</prosody></voice></speak>')
        req = urllib.request.Request(f'https://{region}.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml.encode(),
                                     headers={'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml',
                                              'X-Microsoft-OutputFormat': 'riff-48khz-16bit-mono-pcm', 'User-Agent': 'promo-video'})
        f.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    else:
        secs = 0.6 + len(l['text']) / 14.5
        with wave.open(str(f), 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(48000); w.writeframes(b'\0\0' * int(secs * 48000))
    with wave.open(str(f)) as w:
        dur[l['id']] = round(w.getnframes() / w.getframerate(), 2)
(OUT / 'durations.json').write_text(json.dumps(dur))
print('AZURE' if key and region else 'PLACEHOLDER (no Azure key in .env)', dur, round(sum(dur.values()), 1))
