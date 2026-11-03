"""Private motion-tracking inputs. Web URLs remain provenance, not runtime dependencies."""
from pathlib import Path
import hashlib
import json
import shutil
ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / 'ml/rsl/data/reference-videos'
PUBLIC = ROOT / 'frontend/public'


def source_path(url):
    relative = Path(url.lstrip('/'))
    if '..' in relative.parts or not str(relative).startswith('research/rsl/'):
        raise ValueError('Expected a local RSL reference path')
    private = STORE / relative
    return private if private.exists() else PUBLIC / relative


def archive():
    records = []
    for source in sorted((PUBLIC / 'research/rsl').rglob('*.mp4')):
        relative = source.relative_to(PUBLIC)
        target = STORE / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            shutil.copy2(source, target)
        records.append({'source': '/' + str(relative), 'sha256': digest,
                        'privatePath': str(target.relative_to(STORE))})
    STORE.mkdir(parents=True, exist_ok=True)
    (STORE / 'manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2))
    print(f'Archived {len(records)} reference videos outside the web root.')


if __name__ == '__main__': archive()
