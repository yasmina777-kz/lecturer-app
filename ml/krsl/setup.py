#!/usr/bin/env python3
"""Download pinned public weights; verify hashes; never execute upstream code."""
import concurrent.futures
import hashlib
from pathlib import Path
import time
import requests

DATA = Path(__file__).resolve().parent / 'data'
REVISION = 'af4819927e58079f6aad5f3e62a140bb1cdbbb7b'
BASE = f'https://huggingface.co/dastan-issenov/krsl-cslr-checkpoints/resolve/{REVISION}'
FILES = {
    'checkpoint.pt': (f'{BASE}/conformer_best_stage5_aug.pt', '8856e88bdfcf0516873245f1e09a6023377021ce2d7b4055843b90ea8895abc6', 162946470),
    'vocab.json': (f'{BASE}/processed/vocab.json', '3e602c21655359d8557931dd86e6270112dfc2afd31911b519fa0560c3f6c543', 91990),
    'holistic_landmarker.task': ('https://storage.googleapis.com/mediapipe-models/holistic_landmarker/holistic_landmarker/float16/1/holistic_landmarker.task', 'e2dab61191e2dcd0a15f943d8e3ed1dce13c82dfa597b9dd39f562975a50c3f8', None),
}


def valid(path, digest):
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == digest


def download(name, url, digest, size):
    target = DATA / name
    if valid(target, digest):
        print(f'{name}: verified', flush=True)
        return
    if size and size > 8 * 1024 * 1024:
        parts = DATA / f'{name}.parts'
        parts.mkdir(exist_ok=True)
        chunk_size = 4 * 1024 * 1024
        def part(index):
            start = index * chunk_size
            end = min(size, start + chunk_size) - 1
            path = parts / str(index)
            if path.exists() and path.stat().st_size == end - start + 1:
                return path
            for attempt in range(8):
                try:
                    response = requests.get(url, headers={'Range': f'bytes={start}-{end}'}, timeout=(20, 60))
                    response.raise_for_status()
                    if response.status_code != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{size}':
                        raise ValueError('Incorrect download range')
                    if len(response.content) != end - start + 1:
                        raise ValueError('Truncated download')
                    temp = path.with_suffix('.tmp'); temp.write_bytes(response.content); temp.replace(path)
                    print(f'{name}: part {index + 1}/{(size + chunk_size - 1) // chunk_size}', flush=True)
                    return path
                except (requests.RequestException, ValueError):
                    if attempt == 7: raise
                    time.sleep(min(2 ** attempt, 10))
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            paths = list(executor.map(part, range((size + chunk_size - 1) // chunk_size)))
        temp = target.with_suffix('.download')
        with temp.open('wb') as file:
            for path in paths: file.write(path.read_bytes())
    else:
        response = requests.get(url, timeout=(20, 120)); response.raise_for_status()
        temp = target.with_suffix('.download'); temp.write_bytes(response.content)
    if not valid(temp, digest):
        raise RuntimeError(f'Hash mismatch for {name}; file not installed. Remove its .parts folder and retry.')
    temp.replace(target)
    print(f'{name}: verified', flush=True)


if __name__ == '__main__':
    DATA.mkdir(exist_ok=True)
    for name, (url, digest, size) in FILES.items(): download(name, url, digest, size)
    print('Ready. Run ml/krsl/.venv/bin/python ml/krsl/server.py')
