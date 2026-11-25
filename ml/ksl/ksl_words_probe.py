"""Kazakh words, part 2: keep the RSL network frozen (all 3 ensemble members of
words-v5) and learn only a Kazakh head on its 512-d features. With one SURDO.KZ
signer per word, a frozen RSL body generalises to new people better than
fine-tuning it. Same honest test as train_ksl_words.py (two Sausaq teachers).
  ml/rsl/.venv/bin/python -I ml/ksl/ksl_words_probe.py eval|final
final → frontend/public/models/ksl/ksl-words-v1.json (seq-cnn-v1 format: the
RSL conv layers + the RSL hidden layer + the Kazakh output layer, per member).
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).resolve().parent))
import train_ksl_words as K  # noqa: E402
from train_ksl_words import ROOT, T, augment, resample, score, window  # noqa: E402
from seqnet import export, reference_forward  # noqa: E402
from import_word_recordings import load_own  # noqa: E402

MEMBERS = [ROOT / f'frontend/public/models/rsl/{n}.json' for n in
           ('words-v5-classifier', 'words-v5-seed7-classifier', 'words-v5-seed1234-classifier')]
AUG = 24


def embed_raw(net, x):
    net.eval()
    with torch.no_grad():
        h = torch.from_numpy(x).transpose(1, 2)
        for b in net.blocks:
            h = b(h)
        return torch.relu(net.hidden(torch.cat([h.mean(2), h.amax(2)], 1))).numpy()


def unit(e):
    return e / (np.linalg.norm(e, axis=1, keepdims=True) + 1e-6)


def features(net, mean, std, X, rng, copies):
    norm = lambda W: np.stack([(w - mean) / std for w in W]).astype(np.float32)
    out = [embed_raw(net, norm([resample(c, T) for c in X]))]
    for _ in range(copies):
        out.append(embed_raw(net, norm([augment(window(c, rng), rng) for c in X])))
    return out  # list of [N, 512]; first = clean


def fit_head(F, Y, classes, epochs=40, seed=0):
    return fit_head_xy(torch.from_numpy(np.concatenate(F)).float(), torch.from_numpy(np.tile(Y, len(F))), classes, epochs, seed)


def fit_head_xy(x, y, classes, epochs=40, seed=0):
    torch.manual_seed(seed)
    head = nn.Linear(x.shape[1], classes)
    opt = torch.optim.AdamW(head.parameters(), 3e-3, weight_decay=1e-2)
    for _ in range(epochs):
        perm = torch.randperm(len(x))
        for s in range(0, len(x), 256):
            b = perm[s:s + 256]
            loss = nn.functional.cross_entropy(head(x[b]), y[b], label_smoothing=.1)
            opt.zero_grad(); loss.backward(); opt.step()
    return head


def main(mode):
    t0 = time.monotonic()
    clips, meta = K.load_data()
    labels = sorted({m['label'] for m in meta if m['source'] == 'surdo'})
    li = {l: i for i, l in enumerate(labels)}
    own_x, own_meta = load_own()  # recordings from /help-ksl (import_word_recordings.py)
    keep = [i for i, m in enumerate(own_meta) if m['label'] in li]
    clips += [own_x[i] for i in keep]
    meta += [own_meta[i] for i in keep]
    people = sorted({m['signer'] for m in meta if m['source'] == 'own'})
    print('own recordings', len(keep), 'people', len(people), flush=True)
    lessons = K.lessons_of(set(labels))
    tr = [i for i, m in enumerate(meta) if m['source'] in ('surdo', 'own')]
    te = [i for i, m in enumerate(meta) if m['source'] == 'sausaq' and m['label'] in li]
    if mode == 'final':
        tr = tr + te
    Xtr, Ytr = [clips[i] for i in tr], np.array([li[meta[i]['label']] for i in tr])
    Xte, Yte = [clips[i] for i in te], np.array([li[meta[i]['label']] for i in te])
    kinds = np.array([meta[i]['kind'] for i in te])
    nets, heads, Pproto, Phead, feats = [], [], [], [], []
    for path in MEMBERS:
        K.BASE = path
        net, mean, std = K.base_model(len(labels))
        F = features(net, mean, std, Xtr, np.random.default_rng(0), AUG)
        head = fit_head(F, Ytr, len(labels))
        nets.append((net, mean, std)); heads.append(head); feats.append(F)
        if mode == 'eval':
            E = embed_raw(net, np.stack([(resample(c, T) - mean) / std for c in Xte]).astype(np.float32))
            proto = np.zeros((len(labels), E.shape[1]), np.float32)
            for f in F:
                np.add.at(proto, Ytr, unit(f))
            proto /= np.linalg.norm(proto, axis=1, keepdims=True) + 1e-6
            s = unit(E) @ proto.T * 20
            Pproto.append(np.exp(s - s.max(1, keepdims=True)) / np.exp(s - s.max(1, keepdims=True)).sum(1, keepdims=True))
            with torch.no_grad():
                Phead.append(torch.softmax(head(torch.from_numpy(E)), 1).numpy())
        print('member', path.name, round(time.monotonic() - t0), flush=True)
    if mode == 'eval':
        tag = f' (+ own recordings: {len(people)} people)' if people else ''
        res = [
            score(Pproto[0], Yte, labels, lessons, 'D: prototypes, 1 RSL model' + tag),
            score(np.mean(Pproto, 0), Yte, labels, lessons, 'E: prototypes, 3 RSL models' + tag),
            score(Phead[0], Yte, labels, lessons, 'F: frozen RSL + Kazakh head, 1 model' + tag),
            score(np.mean(Phead, 0), Yte, labels, lessons, 'G: frozen RSL + Kazakh head, 3 models' + tag),
        ]
        P = np.mean(Phead, 0)
        for k in ('card', 'closeup'):
            res.append(score(P[kinds == k], Yte[kinds == k], labels, lessons, f'G on {k} shots' + tag))
        # Leave-one-person-out on own recordings: train without that person (+ Sausaq), test on them.
        for person in people:
            out = np.array([meta[tr[i]]['signer'] == person for i in range(len(tr))])
            test = [clips[tr[i]] for i in np.flatnonzero(out)]
            ytest = Ytr[out]
            Pp = []
            for (net, mean, std), F in zip(nets, feats):
                F2 = [f[~out] for f in F]
                E = embed_raw(net, np.stack([(resample(c, T) - mean) / std for c in test]).astype(np.float32))
                F2 = F2 + [embed_raw(net, np.stack([(resample(c, T) - mean) / std for c in Xte]).astype(np.float32))]
                Y2 = [Ytr[~out]] * (len(F2) - 1) + [Yte]
                x = torch.from_numpy(np.concatenate(F2)).float()
                y = torch.from_numpy(np.concatenate(Y2))
                h = fit_head_xy(x, y, len(labels))
                with torch.no_grad():
                    Pp.append(torch.softmax(h(torch.from_numpy(E)), 1).numpy())
            res.append(score(np.mean(Pp, 0), ytest, labels, lessons, f'G on own recordings of {person} (not trained on them)'))
        rep = json.loads((ROOT / 'docs/ksl-words-v1-eval.json').read_text()) if (ROOT / 'docs/ksl-words-v1-eval.json').exists() else {}
        rep['frozen_rsl' + ('_with_own' if people else '')] = res
        (ROOT / 'docs/ksl-words-v1-eval.json').write_text(json.dumps(rep, ensure_ascii=False, indent=1))
        return
    # export: each member = frozen RSL body + its Kazakh output layer
    K.OUT.mkdir(parents=True, exist_ok=True)
    for k, ((net, mean, std), head) in enumerate(zip(nets, heads)):
        with torch.no_grad():
            net.out = nn.Linear(head.in_features, len(labels))
            net.out.weight.copy_(head.weight)
            net.out.bias.copy_(head.bias)
        ex = export(net, mean, std, labels, threshold=.5, margin=.2, frames=T,
                    source='Kazakh head on frozen RSL words-v5 (member %d); SURDO.KZ + «Саусақтар сөйлейді»' % k)
        name = 'ksl-words-v1.json' if k == 0 else f'ksl-words-v1-m{k}.json'
        (K.OUT / name).write_text(json.dumps(ex, ensure_ascii=False))
        if k == 0:
            fx = [dict(frames=resample(c, T).round(5).tolist(), probs=reference_forward(ex, resample(c, T)).round(6).tolist()) for c in Xte[:2]]
            (K.OUT / 'ksl-words-v1-fixtures.json').write_text(json.dumps(fx))
    print('EXPORTED', round(time.monotonic() - t0), flush=True)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'eval')
