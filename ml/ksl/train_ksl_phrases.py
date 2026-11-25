"""Kazakh words + everyday phrases (ksl-words-v2) for the camera check in the Kazakh
dialogues. Same recipe as ksl_words_probe.py (frozen RSL words-v5 body, 3 members,
Kazakh linear head), with the 14 «Оян, Qazaqstan» phrases added as classes
(extract_phrases.py: presenter + 3–5 people on the street per phrase). A phrase
whose text is already a SURDO.KZ word («Рахмет», «Сәлеметсізбе») joins that class.

  ml/rsl/.venv/bin/python -I ml/ksl/train_ksl_phrases.py eval   # leave-one-person-out on phrases
  ml/rsl/.venv/bin/python -I ml/ksl/train_ksl_phrases.py final  # → frontend/public/models/ksl/ksl-words-v2*.json
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parent))
import train_ksl_words as K  # noqa: E402
from train_ksl_words import ROOT, T, resample, score  # noqa: E402
from ksl_words_probe import MEMBERS, AUG, embed_raw, features, fit_head_xy  # noqa: E402
from import_word_recordings import load_own  # noqa: E402
from seqnet import export, reference_forward  # noqa: E402

PH = int(__import__('os').environ.get('PH', 3))  # extra augmented copies of the few phrase clips
PHRASES = ROOT / 'ml/rsl/data/ksl-words/phrases.npz'


def bare(s: str) -> str:
    return re.sub(r'[!?.,—–-]', '', s).strip()


def phrase_label(kk: str, labels: set[str]) -> str:
    """Dialogue/phrase text → model label (KazakhDialogues.tsx does the same)."""
    b = bare(kk)
    if b in labels:
        return b
    squeezed = {l.replace(' ', '').lower(): l for l in labels}
    return squeezed.get(b.replace(' ', '').lower(), b)


def dialogue_turns():
    src = (ROOT / 'frontend/src/pages/KazakhDialogues.tsx').read_text()
    for m in re.finditer(r'answer: "([^"]+)", distractors: \[([^\]]*)\]', src):
        yield m.group(1), re.findall(r'"([^"]+)"', m.group(2))


def head_on(Fw, Yw, Fp, Yp, classes, seed=0):
    """Linear head on all augmented copies of the words and (many more copies of) the phrases."""
    x = torch.from_numpy(np.concatenate(Fw + Fp)).float()
    y = torch.from_numpy(np.concatenate([Yw] * len(Fw) + [Yp] * len(Fp)))
    return fit_head_xy(x, y, classes, seed=seed)


def load_phrases():
    d = np.load(PHRASES)
    meta = json.loads(str(d['meta']))
    off = d['offsets']
    return [d['x'][off[i]:off[i + 1]].astype(np.float32) for i in range(len(meta))], meta


def main(mode):
    t0 = time.monotonic()
    clips, meta = K.load_data()
    base = sorted({m['label'] for m in meta if m['source'] == 'surdo'})
    own_x, own_meta = load_own()
    keep = [i for i, m in enumerate(own_meta) if m['label'] in set(base)]
    clips += [own_x[i] for i in keep]; meta += [own_meta[i] for i in keep]
    px, pm = load_phrases()
    for m in pm:
        m['text'] = m['label']
        m['label'] = phrase_label(m['label'], set(base))
    labels = sorted(set(base) | {m['label'] for m in pm})
    li = {l: i for i, l in enumerate(labels)}
    print('vocab', len(labels), 'new phrase classes', len(set(labels) - set(base)), 'phrase clips', len(px), flush=True)
    turns = [(phrase_label(a, set(labels)), [phrase_label(x, set(labels)) for x in ds]) for a, ds in dialogue_turns()]
    unknown = sorted({w for a, ds in turns for w in [a, *ds] if w not in li})
    print('dialogue turns', len(turns), 'words the model does not know:', unknown, flush=True)

    words = [i for i, m in enumerate(meta) if m['source'] in ('surdo', 'own', 'sausaq')]
    Xw, Yw = [clips[i] for i in words], np.array([li[meta[i]['label']] for i in words])
    Yp = np.array([li[m['label']] for m in pm])
    # fold = which person of the phrase is held out (shot order: presenter first, then the street)
    shots = {}
    for m in pm:
        shots.setdefault(m['text'], [])
        if m['signer'] not in shots[m['text']]:
            shots[m['text']].append(m['signer'])
    fold = np.array([shots[m['text']].index(m['signer']) % 4 for m in pm])

    if mode == 'eval':
        phrase_ids = sorted(set(Yp))
        P = np.zeros((len(px), len(labels)), np.float32)
        for path in MEMBERS:
            K.BASE = path
            net, mean, std = K.base_model(len(labels))
            Fw = features(net, mean, std, Xw, np.random.default_rng(0), AUG)
            Fp = features(net, mean, std, px, np.random.default_rng(1), AUG * PH)
            Ep = embed_raw(net, np.stack([(resample(c, T) - mean) / std for c in px]).astype(np.float32))
            for f in range(4):
                tr = fold != f
                head = head_on(Fw, Yw, [f[tr] for f in Fp], Yp[tr], len(labels))
                with torch.no_grad():
                    P[~tr] += torch.softmax(head(torch.from_numpy(Ep[~tr])), 1).numpy() / len(MEMBERS)
            print('member', path.name, round(time.monotonic() - t0), flush=True)
        among = np.mean([phrase_ids[int(np.argmax(P[i, phrase_ids]))] == Yp[i] for i in range(len(Yp))])
        top1 = np.mean(P.argmax(1) == Yp)
        dia = []
        for a, ds in turns:
            opts = [li[w] for w in [a, *ds] if w in li]
            for i in np.flatnonzero(Yp == li.get(a, -1)):
                dia.append(opts[int(np.argmax(P[i, opts]))] == Yp[i])
        res = dict(name='phrases, person held out (4 folds)', among_14_phrases=round(float(among), 3),
                   full_vocabulary_top1=round(float(top1), 3), dialogue_turn_3_choices=round(float(np.mean(dia)), 3),
                   dialogue_checks=len(dia), clips=len(px), chance_14=round(1 / len(phrase_ids), 3), chance_dialogue=.333)
        print('RESULT', res, flush=True)
        rep = json.loads((ROOT / 'docs/ksl-words-v1-eval.json').read_text())
        rep['phrases_v2'] = res
        (ROOT / 'docs/ksl-words-v1-eval.json').write_text(json.dumps(rep, ensure_ascii=False, indent=1))
        return

    for k, path in enumerate(MEMBERS):
        K.BASE = path
        net, mean, std = K.base_model(len(labels))
        Fw = features(net, mean, std, Xw, np.random.default_rng(0), AUG)
        Fp = features(net, mean, std, px, np.random.default_rng(1), AUG * PH)
        head = head_on(Fw, Yw, Fp, Yp, len(labels), seed=k)
        with torch.no_grad():
            net.out = nn.Linear(head.in_features, len(labels))
            net.out.weight.copy_(head.weight); net.out.bias.copy_(head.bias)
        ex = export(net, mean, std, labels, threshold=.5, margin=.2, frames=T,
                    source='Kazakh head on frozen RSL words-v5 (member %d); SURDO.KZ + «Саусақтар сөйлейді» + «Оян, Qazaqstan» phrases' % k)
        name = 'ksl-words-v2.json' if k == 0 else f'ksl-words-v2-m{k}.json'
        (K.OUT / name).write_text(json.dumps(ex, ensure_ascii=False))
        if k == 0:
            fx = [dict(frames=resample(c, T).round(5).tolist(), probs=reference_forward(ex, resample(c, T)).round(6).tolist()) for c in px[:2]]
            (K.OUT / 'ksl-words-v2-fixtures.json').write_text(json.dumps(fx))
        print('member', k, round(time.monotonic() - t0), flush=True)
    print('EXPORTED', len(labels), flush=True)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'eval')
