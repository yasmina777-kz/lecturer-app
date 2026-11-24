"""Kazakh sign dictionary of SURDO.KZ («Сурдосервер», supported by the Ministry
of Education of Kazakhstan). All entries are YouTube videos of native signers
on the channel youtube.com/user/surdoKazakhstan, grouped in one playlist per
topic (the same topics as on surdo.kz). The site embeds these videos, and so
do we; nothing is re-hosted. Output: frontend/public/research/ksl/surdo-catalog.json
  ml/rsl/.venv/bin/python ml/ksl/fetch_surdo.py
"""
from __future__ import annotations
import json, re, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
YTDLP = str(ROOT / 'ml/rsl/.venv/bin/yt-dlp')
OUT = ROOT / 'frontend/public/research/ksl/surdo-catalog.json'
CHANNEL = 'https://www.youtube.com/user/surdoKazakhstan'
SKIP = {'Тілашар', 'Қазақ әндер ым тілінде', 'Қазақ ертегілер ым тілінде', 'Қазақ мақал-мәтелдер ым тілінде',
        'Қазақстан Республикасының әнұраны ым тілінде'}


def flat(url):
    r = subprocess.run([YTDLP, '--flat-playlist', '-j', url], capture_output=True, text=True, stdin=subprocess.DEVNULL)
    return [json.loads(l) for l in r.stdout.splitlines() if l.strip()]


def clean(title: str) -> str:
    return re.sub(r'\s+', ' ', title).strip()


def main():
    slow = {}
    for d in flat(CHANNEL + '/videos'):
        m = re.fullmatch(r'(.+?)\s*\(Замедленная версия\)', d.get('title') or '')
        if m:
            slow[clean(m.group(1)).lower()] = d['id']
    entries, letters = [], []
    for pl in flat(CHANNEL + '/playlists'):
        topic = clean(pl['title'])
        if topic in SKIP:
            continue
        for d in flat(f"https://www.youtube.com/playlist?list={pl['id']}"):
            title = clean(d.get('title') or '')
            if not title or 'Замедленная версия' in title or d.get('title') in ('[Private video]', '[Deleted video]'):
                continue
            if topic == 'Әліппе':
                letters.append({'title': title, 'youtube': d['id'], 'duration': d.get('duration')})
                continue
            e = {'label': title, 'topic': topic, 'youtube': d['id']}
            if title.lower() in slow:
                e['slow'] = slow[title.lower()]
            entries.append(e)
    # every letter clip on the channel (front, right, left views) for the letter recognizer
    for d in flat(CHANNEL + '/videos'):
        t = clean(d.get('title') or '')
        if re.fullmatch(r'[^\W\d_]\s*(\((оң жақтан|сол жақтан|әріпі)\))?', t, re.I):
            letters.append({'title': t, 'youtube': d['id'], 'duration': d.get('duration')})
    seen, uniq = set(), []
    for e in entries:
        if e['youtube'] not in seen:
            seen.add(e['youtube']); uniq.append(e)
    lseen, luniq = set(), []
    for e in letters:
        if e['youtube'] not in lseen:
            lseen.add(e['youtube']); luniq.append(e)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    json.dump({'source': 'SURDO.KZ «Сурдосервер» (supported by the Ministry of Education of Kazakhstan)',
               'site': 'http://surdo.kz/rus/', 'channel': CHANNEL,
               'note': 'Videos are shown through the YouTube embed; they are not re-hosted.',
               'entries': uniq, 'letters': luniq}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(uniq), 'words;', sum('slow' in e for e in uniq), 'with slow version;', len(luniq), 'letter clips;',
          len({e['topic'] for e in uniq}), 'topics')


if __name__ == '__main__':
    main()
