"""Store ksl model weights as base64 float16 (≈9× smaller than JSON numbers).
  ml/rsl/.venv/bin/python ml/ksl/pack_weights.py frontend/public/models/ksl/ksl-v1.json"""
import base64, json, sys
import numpy as np


def pack(values) -> str:
    return base64.b64encode(np.asarray(values, np.float16).tobytes()).decode()


if __name__ == '__main__':
    p = sys.argv[1]
    m = json.load(open(p, encoding='utf-8'))
    for L in m['conv'] + m['fc']:
        if 'w' in L:
            L['w16'] = pack(L.pop('w'))
            L['b16'] = pack(L.pop('b'))
    json.dump(m, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
