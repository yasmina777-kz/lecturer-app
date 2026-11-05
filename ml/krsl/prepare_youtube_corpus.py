"""Index RSL sources and prepare subtitle-aligned samples for linguistic review.

This does NOT turn Russian subtitles into gloss labels or start model training.
Download original/manual ru captions (not --write-auto-subs) and silent video
with yt-dlp. Keep downloaded media and metadata under ignored data/sources/.
"""
import argparse
import csv
import hashlib
import html
import json
import math
import re
from pathlib import Path

STAMP = r'(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}'
TIMING = re.compile(rf'^({STAMP})\s+-->\s+({STAMP})(?:\s.*)?$')


def seconds(value):
    parts = [float(x) for x in value.split(':')]
    return sum(x * 60 ** i for i, x in enumerate(reversed(parts)))


def parse_vtt(text):
    if not text.lstrip('\ufeff').startswith('WEBVTT'):
        raise ValueError('Expected WebVTT captions')
    for block in re.split(r'\n\s*\n', text.replace('\r\n', '\n')):
        lines = block.strip().splitlines()
        if not lines or lines[0].startswith(('NOTE', 'STYLE', 'REGION')):
            continue
        for i, line in enumerate(lines):
            match = TIMING.fullmatch(line)
            if not match:
                continue
            start, end = map(seconds, match.groups())
            words = html.unescape(re.sub(r'<[^>]*>', '', ' '.join(lines[i + 1:])))
            words = ' '.join(words.split())
            if not 0 <= start < end or not words:
                raise ValueError('Invalid subtitle interval or empty text')
            yield {'start': start, 'end': end, 'translation': words}
            break


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def prepare(metadata, pilot, output):
    with metadata.open(encoding='utf-8-sig', newline='') as stream:
        ids = sorted({r[0] for r in csv.reader(stream) if len(r) == 2 and r[1] == 'rsl'})
    output.mkdir(parents=True, exist_ok=True)
    index = [{'video_id': v, 'url': f'https://www.youtube.com/watch?v={v}'} for v in ids]
    (output / 'rsl-index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2))
    sources, segments, rejected = [], [], []
    for path in sorted(pilot.glob('*.info.json')):
        info = json.loads(path.read_text())
        video_id = info['id']
        if video_id not in ids:
            raise ValueError(f'{video_id} is not labeled rsl in the source index')
        caption = pilot / f'{video_id}.ru.vtt'
        media = [pilot / f'{video_id}{ext}' for ext in ['.mp4', '.webm', '.mkv']]
        video = next((p for p in media if p.is_file()), None)
        if not info.get('subtitles', {}).get('ru') or not caption.exists() or video is None:
            rejected.append({'video_id': video_id, 'reason': 'Missing video or original Russian caption track'})
            continue
        duration = float(info['duration'])
        if not math.isfinite(duration) or duration <= 0:
            raise ValueError('Invalid video duration')
        source = dict(video_id=video_id, url=f'https://www.youtube.com/watch?v={video_id}',
                      title=info.get('title'), channel_id=info.get('channel_id'),
                      duration=duration, video=str(video.resolve()), videoSha256=digest(video),
                      captionSha256=digest(caption), sourceLicense=info.get('license'),
                      captionType='original Russian subtitle track; not verified gloss annotation')
        sources.append(source)
        for cue in parse_vtt(caption.read_text(encoding='utf-8-sig')):
            if cue['end'] > duration + 1:
                raise ValueError(f'{video_id}: subtitle extends beyond video')
            start, end = max(0, cue['start'] - .5), min(duration, cue['end'] + .5)
            segments.append(dict(video_id=video_id, **cue, reviewStart=start, reviewEnd=end,
                                 withinRuntimeLimit=1 <= end - start <= 20,
                                 reviewStatus='pending', glossTokens=None, signerGroup=None,
                                 split=None))
    report = dict(source='YouTube-SL-25', indexSha256=digest(metadata), indexedRslVideos=len(ids),
                  downloadedVideos=len(sources), downloadedMinutes=sum(s['duration'] for s in sources) / 60,
                  candidateSegments=len(segments), usableForTraining=0, rejected=rejected,
                  requiredReview=['Confirm signing language and visible signer',
                                  'Align full utterance boundaries; subtitle cues can split a phrase',
                                  'Annotate gesture glosses for CTC; translation is not a gloss sequence',
                                  'Assign signer-disjoint splits, not random clips from one channel'],
                  sources=sources)
    (output / 'review-segments.json').write_text(json.dumps(segments, ensure_ascii=False, indent=2))
    (output / 'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('metadata', type=Path)
    parser.add_argument('pilot', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    report = prepare(args.metadata, args.pilot, args.output)
    print(json.dumps({k: v for k, v in report.items() if k not in {'sources', 'requiredReview'}}, indent=2))
