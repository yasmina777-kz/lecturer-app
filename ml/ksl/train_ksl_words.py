"""Kazakh sign *word* recognizer (ksl-words-v1) by transfer from the RSL word model.

Data: ml/rsl/data/ksl-words/features.npz (ml/ksl/extract_words.py):
* SURDO.KZ — one Kazakh signer per word, a normal and a slow clip;
* «Саусақтар сөйлейді» — two other Kazakh teachers, 58 words shared with SURDO.KZ
  (wide shot + close-up).
Honest test = the Sausaq teachers, who are never trained on in the evaluation
runs. Start point = RSL words-v5 (Slovo, 1000 words, hundreds of signers): the
temporal CNN already knows hand motion; the Kazakh head is learned on SURDO.KZ.

Modes:
  eval   — compare: prototypes on RSL features, fine-tune from RSL, train from scratch
  final  — fine-tune from RSL on SURDO.KZ + Sausaq → frontend/public/models/ksl/ksl-words-v1.json
  ml/rsl/.venv/bin/python -I ml/ksl/train_ksl_words.py eval|final
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml/rsl'))
from seqnet import SeqNet, export, reference_forward, _decode  # noqa: E402
import train_slovo_v2  # noqa: E402
from train_slovo_v2 import T  # noqa: E402
from train_slovo_v5 import augment  # noqa: E402
from word_features import resample  # noqa: E402

train_slovo_v2.CHANNELS = 147
BASE = ROOT / 'frontend/public/models/rsl/words-v5-classifier.json'
FEAT = ROOT / 'ml/rsl/data/ksl-words/features.npz'
OUT = ROOT / 'frontend/public/models/ksl'
LESSON = 8
torch.set_num_threads(8)


def window(clip: np.ndarray, rng) -> np.ndarray:
    """Clips are extracted at ~12.5 fps (every 2nd frame); the browser runs at ~10 fps."""
    if rng is None:
        return resample(clip, T)
    stride = int(rng.choice([1, 1, 1, 2]))
    clip = clip[int(rng.integers(0, stride)):][::stride]
    if len(clip) < 4:
        return resample(clip if len(clip) else np.zeros((1, 147), np.float32), T)
    n = len(clip)
    a = int(rng.integers(0, max(1, int(.12 * n)) + 1))
    b = n - int(rng.integers(0, max(1, int(.12 * n)) + 1))
    if b - a < 4:
        a, b = 0, n
    return resample(clip[a:b], T)


def load_data():
    d = np.load(FEAT)
    meta = json.loads(str(d['meta']))
    off = d['offsets']
    clips = [d['x'][off[i]:off[i + 1]].astype(np.float32) for i in range(len(meta))]
    return clips, meta


def lessons_of(labels):
    """Course lessons exactly like kslLessons() in KazakhCourse.tsx: label → lesson words."""
    cat = json.loads((ROOT / 'frontend/public/research/ksl/surdo-catalog.json').read_text())['entries']
    src = (ROOT / 'frontend/src/pages/KazakhCourse.tsx').read_text()
    order = json.loads('[' + src.split('const ORDER = [')[1].split('];')[0].strip().rstrip(',') + ']')
    topics = order + [t for t in dict.fromkeys(e['topic'] for e in cat) if t not in order]
    out = {}
    for t in topics:
        ws = [e['label'] for e in cat if e['topic'] == t]
        if not ws:
            continue
        parts = -(-len(ws) // LESSON)
        size = -(-len(ws) // parts)
        for p in range(parts):
            group = [w for w in ws[p * size:(p + 1) * size] if w in labels]
            for w in group:
                out.setdefault(w, group)
    return out


def base_model(classes: int) -> tuple[SeqNet, np.ndarray, np.ndarray]:
    m = json.loads(BASE.read_text())
    conv = [l for l in m['layers'] if l['type'] == 'conv']
    dense = [l for l in m['layers'] if l['type'] == 'dense']
    net = SeqNet(m['channels'], classes, width=conv[0]['outputs'], hidden=dense[0]['outputs'],
                 blocks=tuple((l['kernel'], l['dilation']) for l in conv), dropout=.3)
    with torch.no_grad():
        for blk, l in zip(net.blocks, conv):
            blk.conv.weight.copy_(torch.from_numpy(_decode(l['weights'], (l['outputs'], l['inputs'], l['kernel']))))
            blk.conv.bias.copy_(torch.from_numpy(_decode(l['bias'])))
        net.hidden.weight.copy_(torch.from_numpy(_decode(dense[0]['weights'], (dense[0]['outputs'], dense[0]['inputs']))))
        net.hidden.bias.copy_(torch.from_numpy(_decode(dense[0]['bias'])))
    return net, _decode(m['mean']), _decode(m['std'])


def embed(net: SeqNet, x: np.ndarray) -> np.ndarray:
    net.eval()
    with torch.no_grad():
        h = torch.from_numpy(x).transpose(1, 2)
        for b in net.blocks:
            h = b(h)
        e = torch.relu(net.hidden(torch.cat([h.mean(2), h.amax(2)], 1))).numpy()
    return e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-6)


def train(net, X, Y, mean, std, epochs, lr, rng, copies=6, freeze_epochs=0, log=''):
    opt = torch.optim.AdamW(net.parameters(), lr=lr, weight_decay=1e-3)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, lr, total_steps=epochs * (-(-len(X) * copies // 64)))
    loss_fn = nn.CrossEntropyLoss(label_smoothing=.1)
    idx = np.repeat(np.arange(len(X)), copies)
    for ep in range(epochs):
        frozen = ep < freeze_epochs
        for b in net.blocks:
            b.requires_grad_(not frozen)
        net.train()
        rng.shuffle(idx)
        tot = 0.
        for s in range(0, len(idx), 64):
            bi = idx[s:s + 64]
            xb = np.stack([augment(window(X[i], rng), rng) for i in bi])
            xb = torch.from_numpy(((xb - mean) / std).astype(np.float32))
            loss = loss_fn(net(xb), torch.from_numpy(Y[bi]))
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tot += float(loss) * len(bi)
        if ep % 10 == 9 or ep == epochs - 1:
            print(log, 'epoch', ep + 1, 'loss', round(tot / len(idx), 3), flush=True)
    return net


def probs(net, X, mean, std):
    net.eval()
    xs = np.stack([(resample(c, T) - mean) / std for c in X]).astype(np.float32)
    with torch.no_grad():
        return torch.softmax(net(torch.from_numpy(xs)), 1).numpy()


def score(P, y, labels, lessons, name):
    """Full vocabulary top-1/top-5 + lesson mode (rank only the 8 words of the lesson)."""
    top1 = float(np.mean(P.argmax(1) == y))
    top5 = float(np.mean([y[i] in np.argsort(P[i])[-5:] for i in range(len(y))]))
    li = {l: i for i, l in enumerate(labels)}
    les = []
    for i in range(len(y)):
        group = [li[w] for w in lessons[labels[y[i]]]]
        les.append(group[int(np.argmax(P[i, group]))] == y[i])
    r = dict(name=name, top1=round(top1, 3), top5=round(top5, 3), lesson=round(float(np.mean(les)), 3), n=len(y))
    print('RESULT', r, flush=True)
    return r


def main(mode: str):
    t0 = time.monotonic()
    clips, meta = load_data()
    labels = sorted({m['label'] for m in meta if m['source'] == 'surdo'})
    li = {l: i for i, l in enumerate(labels)}
    lessons = lessons_of(set(labels))
    tr = [i for i, m in enumerate(meta) if m['source'] == 'surdo']
    te = [i for i, m in enumerate(meta) if m['source'] == 'sausaq' and m['label'] in li]
    print('vocab', len(labels), 'train clips', len(tr), 'test clips', len(te), 'test words', len({meta[i]['label'] for i in te}), flush=True)
    Xtr, Ytr = [clips[i] for i in tr], np.array([li[meta[i]['label']] for i in tr])
    Xte, Yte = [clips[i] for i in te], np.array([li[meta[i]['label']] for i in te])
    chance = dict(top1=round(1 / len(labels), 4), lesson=round(float(np.mean([1 / len(lessons[labels[y]]) for y in Yte])), 3))
    print('chance', chance)
    results = []
    if mode == 'eval':
        # A. prototypes on frozen RSL features (no Kazakh training at all)
        rng = np.random.default_rng(0)
        net, mean, std = base_model(len(labels))
        norm = lambda X: np.stack([(c - mean) / std for c in X]).astype(np.float32)
        E = embed(net, norm([resample(c, T) for c in Xtr]))
        for _ in range(4):
            E = E + embed(net, norm([augment(window(c, rng), rng) for c in Xtr]))
        proto = np.zeros((len(labels), E.shape[1]), np.float32)
        np.add.at(proto, Ytr, E)
        proto /= np.linalg.norm(proto, axis=1, keepdims=True) + 1e-6
        S = embed(net, norm([resample(c, T) for c in Xte])) @ proto.T
        results.append(score(np.exp(S * 20) / np.exp(S * 20).sum(1, keepdims=True), Yte, labels, lessons, 'A: RSL features + SURDO.KZ prototypes'))
        # B. fine-tune from RSL on SURDO.KZ only
        for seed in (0, 1):
            torch.manual_seed(seed)
            net, mean, std = base_model(len(labels))
            train(net, Xtr, Ytr, mean, std, 60, 2e-3, np.random.default_rng(seed), freeze_epochs=10, log=f'B{seed}')
            results.append(score(probs(net, Xte, mean, std), Yte, labels, lessons, f'B: fine-tuned from RSL (seed {seed})'))
        # C. same network from scratch (no RSL)
        torch.manual_seed(0)
        _, mean, std = base_model(len(labels))
        net = SeqNet(147, len(labels), width=256, hidden=512, blocks=((5, 1), (5, 2), (5, 4), (5, 8)), dropout=.3)
        train(net, Xtr, Ytr, mean, std, 60, 2e-3, np.random.default_rng(0), log='C')
        results.append(score(probs(net, Xte, mean, std), Yte, labels, lessons, 'C: from scratch, no RSL'))
        rep = dict(vocabulary=len(labels), train_clips=len(tr), test_clips=len(te), test_words=len({meta[i]['label'] for i in te}),
                   test_signers='2 «Саусақтар сөйлейді» teachers, never in training', chance=chance, results=results,
                   seconds=round(time.monotonic() - t0))
        (ROOT / 'docs/ksl-words-v1-eval.json').write_text(json.dumps(rep, ensure_ascii=False, indent=1))
        return
    # final: SURDO.KZ + Sausaq
    torch.manual_seed(0)
    X = Xtr + Xte
    Y = np.concatenate([Ytr, Yte])
    net, mean, std = base_model(len(labels))
    train(net, X, Y, mean, std, 60, 2e-3, np.random.default_rng(0), freeze_epochs=10, log='final')
    ex = export(net, mean, std, labels, threshold=.5, margin=.2, frames=T,
                source='SURDO.KZ + «Саусақтар сөйлейді» (YouTube), fine-tuned from RSL words-v5')
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'ksl-words-v1.json').write_text(json.dumps(ex, ensure_ascii=False))
    fx = [dict(frames=resample(c, T).round(5).tolist(), probs=reference_forward(ex, resample(c, T)).round(6).tolist()[:5]) for c in Xte[:3]]
    (OUT / 'ksl-words-v1-fixtures.json').write_text(json.dumps(fx))
    print('EXPORTED', len(labels), round(time.monotonic() - t0), flush=True)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'eval')
