"""Bounded, resumable acquisition from the published YouTube-SL-25 RSL index.

Discovery saves metadata, never marks subtitle/sign meaning as reviewed. Media
download requires an explicit selected ID list. All assets stay in ignored data/.
"""
import argparse
import concurrent.futures
import csv
import json
import random
from pathlib import Path

import yt_dlp

ROOT = Path(__file__).resolve().parent / 'data/sources/youtube-sl-25'


class QuietLogger:
    def debug(self, *_): pass
    def warning(self, *_): pass
    def error(self, *_): pass


def indexed_ids(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return sorted({r[0] for r in csv.reader(stream) if len(r) == 2 and r[1] == 'rsl'})


def inspect(video_id):
    options = dict(quiet=True, logger=QuietLogger(), skip_download=True, noplaylist=True,
                   socket_timeout=12, retries=1, extractor_retries=1)
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
        return dict(video_id=video_id, url=f'https://www.youtube.com/watch?v={video_id}',
                    title=info.get('title'), channel_id=info.get('channel_id'),
                    channel=info.get('channel'), duration=info.get('duration'),
                    originalRussianSubtitles=bool(info.get('subtitles', {}).get('ru')),
                    automaticRussianCaptions=bool(info.get('automatic_captions', {}).get('ru')),
                    license=info.get('license'), status='metadata_only')
    except Exception as exc:
        return dict(video_id=video_id, status='unavailable', error=str(exc)[:350])


def main(args):
    ids = indexed_ids(args.metadata)
    if args.command == 'scan':
        args.output.parent.mkdir(parents=True, exist_ok=True)
        existing = {json.loads(line)['video_id'] for line in args.output.read_text().splitlines()} if args.output.exists() else set()
        random.Random(args.seed).shuffle(ids)
        pending = [i for i in ids if i not in existing][:args.count]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            tasks = [pool.submit(inspect, i) for i in pending]
            with args.output.open('a', encoding='utf-8') as out:
                for task in concurrent.futures.as_completed(tasks):
                    row = task.result()
                    out.write(json.dumps(row, ensure_ascii=False) + '\n'); out.flush()
                    print(json.dumps(row, ensure_ascii=False), flush=True)
    else:
        selected = json.loads(args.selection.read_text())
        if isinstance(selected, dict):
            selected = list(selected)  # Explicit source catalog keys are also a selection.
        if not isinstance(selected, list) or not all(isinstance(i, str) and i in ids for i in selected):
            raise ValueError('Select video IDs from the RSL index only')
        if len(selected) != len(set(selected)):
            raise ValueError('Duplicate selected ID')
        args.destination.mkdir(parents=True, exist_ok=True)
        options = dict(noplaylist=True, writesubtitles=True, subtitleslangs=['ru'],
                       subtitlesformat='vtt', writeinfojson=True, writeautomaticsub=False,
                       format='bestvideo[height<=360]', max_filesize=150*1024*1024,
                       socket_timeout=15, retries=2, fragment_retries=2,
                       http_chunk_size=4*1024*1024, noprogress=True,
                       outtmpl=str(args.destination / '%(id)s.%(ext)s'),
                       download_archive=str(args.destination / 'download-archive.txt'))
        with yt_dlp.YoutubeDL(options) as ydl:
            for video_id in selected:
                try:
                    ydl.download([f'https://www.youtube.com/watch?v={video_id}'])
                except yt_dlp.utils.DownloadError as exc:
                    print(json.dumps(dict(video_id=video_id, status='download_failed', error=str(exc)[:300])), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata', type=Path, default=ROOT / 'metadata.csv')
    subs = parser.add_subparsers(dest='command', required=True)
    scan = subs.add_parser('scan')
    scan.add_argument('--count', type=int, default=48)
    scan.add_argument('--seed', type=int, default=20261105)
    scan.add_argument('--output', type=Path, default=ROOT / 'expansion/discovery.jsonl')
    download = subs.add_parser('download')
    download.add_argument('--selection', type=Path, required=True)
    download.add_argument('--destination', type=Path, default=ROOT / 'expansion/media')
    main(parser.parse_args())
