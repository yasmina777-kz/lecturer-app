"""Kazakh fingerspelling silhouette CNN.
  ml/rsl/.venv/bin/python ml/ksl/train_ksl.py probe      # QazSL-only model, check render variants on Bukva *train* signers
  ml/rsl/.venv/bin/python ml/ksl/train_ksl.py final      # QazSL + Bukva-train renders, report on held-out data, export
"""
from __future__ import annotations
import json, sys, time, hashlib
from multiprocessing import Pool
from pathlib import Path
import numpy as np
import torch
from torch import nn
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'ml/ksl'))
import silhouette as S  # noqa: E402

D = np.load(ROOT / 'ml/rsl/data/qazsl/arrays.npz')
LABELS = [str(x) for x in D['labels']]
NC = len(LABELS)
dev = 'mps' if torch.backends.mps.is_available() else 'cpu'


class Net(nn.Module):
    def __init__(s, w=24):
        super().__init__()
        s.c1, s.c2, s.c3 = nn.Conv2d(1, w, 3, padding=1), nn.Conv2d(w, 2*w, 3, padding=1), nn.Conv2d(2*w, 4*w, 3, padding=1)
        s.b1, s.b2, s.b3 = nn.BatchNorm2d(w), nn.BatchNorm2d(2*w), nn.BatchNorm2d(4*w)
        s.fc1, s.fc2, s.drop = nn.Linear(4*w*6*6, 128), nn.Linear(128, NC), nn.Dropout(.3)
    def forward(s, x):
        return s.fc2(s.drop(s.features(x)))

    def features(s, x):
        x = F.max_pool2d(F.relu(s.b1(s.c1(x))), 2)
        x = F.max_pool2d(F.relu(s.b2(s.c2(x))), 2)
        x = F.max_pool2d(F.relu(s.b3(s.c3(x))), 2)
        return F.relu(s.fc1(x.flatten(1)))


class GradReverse(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, lam):
        ctx.lam = lam
        return x.view_as(x)

    @staticmethod
    def backward(ctx, g):
        return -ctx.lam * g, None


def rot3(rng, deg):
    a, b, c = np.radians(rng.uniform(-deg, deg, 3))
    Rx = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
    Ry = np.array([[np.cos(b), 0, np.sin(b)], [0, 1, 0], [-np.sin(b), 0, np.cos(b)]])
    Rz = np.array([[np.cos(c), -np.sin(c), 0], [np.sin(c), np.cos(c), 0], [0, 0, 1]])
    return Rx @ Ry @ Rz


def draw(args):
    pts, seed, deg = args
    rng = np.random.default_rng(seed)
    p = pts @ rot3(rng, deg).T if deg else pts
    base = (.12, .14, .35)
    k = rng.uniform(.8, 1.3) if deg else 1.
    S.R_FINGER, S.R_THUMB, S.R_ARM = (v * k for v in base)
    S.ARM_LEN = rng.uniform(.4, 1.2) if deg else .7
    return S.render(p[:, :2])


def render_many(P, deg=0, copies=1, seed=0):
    jobs = [(P[i], seed*10_000_000 + c*1_000_000 + i, deg) for c in range(copies) for i in range(len(P))]
    with Pool(8) as pool:
        return np.array(pool.map(draw, jobs, chunksize=256), np.uint8)


def augment_img(x, rng):
    """x: B×1×50×50 float tensor (on device). Random flip, affine, erode/dilate."""
    B = x.shape[0]
    flip = torch.from_numpy(rng.random(B) < .5).to(x.device)
    x = torch.where(flip[:, None, None, None], x.flip(-1), x)
    ang = torch.from_numpy(np.radians(rng.uniform(-15, 15, B))).float()
    sc = torch.from_numpy(rng.uniform(.88, 1.12, B)).float()
    tx, ty = (torch.from_numpy(rng.uniform(-.08, .08, B)).float() for _ in range(2))
    th = torch.stack([torch.stack([torch.cos(ang)/sc, -torch.sin(ang)/sc, tx], 1),
                      torch.stack([torch.sin(ang)/sc, torch.cos(ang)/sc, ty], 1)], 1).to(x.device)
    x = F.grid_sample(x, F.affine_grid(th, x.shape, align_corners=False), align_corners=False)
    m = rng.random()
    if m < .25:
        x = F.max_pool2d(x, 3, 1, 1)
    elif m < .5:
        x = -F.max_pool2d(-x, 3, 1, 1)
    return (x > .5).float()


def fit(X, y, epochs, seed=0, w=24, domain=None, dann=0.):
    torch.manual_seed(seed); rng = np.random.default_rng(seed)
    net = Net(w).to(dev)
    head = nn.Sequential(nn.Linear(128, 64), nn.ReLU(), nn.Linear(64, 1)).to(dev)
    opt = torch.optim.AdamW(list(net.parameters()) + list(head.parameters()), 2e-3, weight_decay=1e-4)
    dt = torch.from_numpy(domain.astype(np.float32)) if domain is not None else None
    steps = epochs * (len(X) // 256)
    sch = torch.optim.lr_scheduler.OneCycleLR(opt, 3e-3, total_steps=steps)
    Xt = torch.from_numpy(X).float()[:, None]; yt = torch.from_numpy(y.astype(np.int64))
    for ep in range(epochs):
        net.train(); perm = torch.randperm(len(X)); t0 = time.time(); tot = 0
        for i in range(0, len(X) - 255, 256):
            idx = perm[i:i+256]
            xb = augment_img(Xt[idx].to(dev), rng); yb = yt[idx].to(dev)
            if dann and dt is not None:
                f = net.features(xb)
                loss = F.cross_entropy(net.fc2(net.drop(f)), yb, label_smoothing=.05)
                lam = dann * min(1., (ep * len(X) + i) / (len(X) * 2))   # ramp up over 2 epochs
                loss = loss + F.binary_cross_entropy_with_logits(head(GradReverse.apply(f, lam))[:, 0], dt[idx].to(dev))
            else:
                loss = F.cross_entropy(net(xb), yb, label_smoothing=.05)
            opt.zero_grad(); loss.backward(); opt.step(); sch.step(); tot += loss.item()
        print(f'  epoch {ep+1}/{epochs} loss {tot/(len(X)//256):.3f} {time.time()-t0:.0f}s', flush=True)
    return net.eval()


@torch.no_grad()
def predict(net, X, flip_tta=True):
    out = []
    for i in range(0, len(X), 1024):
        xb = torch.from_numpy(X[i:i+1024]).float()[:, None].to(dev)
        p = F.softmax(net(xb), 1)
        if flip_tta:
            p = (p + F.softmax(net(xb.flip(-1)), 1)) / 2
        out.append(p.cpu().numpy())
    return np.concatenate(out)


def acc(p, y, mask=None):
    m = np.ones(len(y), bool) if mask is None else mask
    return float((p[m].argmax(1) == y[m]).mean()) if m.any() else float('nan')


def probe():
    qx, qy, qt = D['qx'], D['qy'].astype(int), D['qt']
    net = fit(qx[~qt], qy[~qt], 6)
    print('QazSL held-out block', acc(predict(net, qx[qt]), qy[qt]))
    bp, by, bt = D['bp'], D['by'].astype(int), D['bt']
    sel = np.flatnonzero(~bt)[::4]
    torch.save(net.state_dict(), ROOT / 'ml/rsl/data/qazsl/probe.pt')
    for stretch in (False, True):
        for arm in (True, False):
            for k in (.7, 1., 1.3):
                S.STRETCH, S.ARM_IN_BOX = stretch, arm
                S.R_FINGER, S.R_THUMB, S.R_ARM = .17*k, .2*k, .36*k
                imgs = np.array([S.render(p[:, :2]) for p in bp[sel]], np.uint8)
                pr = predict(net, imgs)
                print(f'stretch={stretch} arm_in_box={arm} radius×{k}: top1 {acc(pr, by[sel]):.3f} top3 {np.mean([y in np.argsort(-q)[:3] for q, y in zip(pr, by[sel])]):.3f}', flush=True)


def export(net, path, meta):
    sd = {k: v.detach().cpu().numpy() for k, v in net.state_dict().items()}
    def bn(c, b):  # fold BatchNorm into conv
        g = sd[f'{b}.weight'] / np.sqrt(sd[f'{b}.running_var'] + 1e-5)
        W = sd[f'{c}.weight'] * g[:, None, None, None]
        B = (sd[f'{c}.bias'] - sd[f'{b}.running_mean']) * g + sd[f'{b}.bias']
        return {'shape': list(W.shape), 'w': np.round(W.flatten(), 5).tolist(), 'b': np.round(B, 5).tolist()}
    fc = lambda n: {'shape': list(sd[f'{n}.weight'].shape), 'w': np.round(sd[f'{n}.weight'].flatten(), 5).tolist(),
                    'b': np.round(sd[f'{n}.bias'], 5).tolist()}
    json.dump({**meta, 'labels': LABELS, 'conv': [bn('c1', 'b1'), bn('c2', 'b2'), bn('c3', 'b3')],
               'fc': [fc('fc1'), fc('fc2')]}, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))


DANN = 0.
SHARED = [c for c in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ']
KZ9 = 'ӘҒҚҢӨҰҮҺІ'


def top3(p, y):
    return float(np.mean([t in np.argsort(-q)[:3] for q, t in zip(p, y)])) if len(y) else float('nan')


def final():
    qx, qy, qt = D['qx'], D['qy'].astype(int), D['qt']
    bp, by, bt = D['bp'], D['by'].astype(int), D['bt']
    print('rendering …', flush=True)
    btr = render_many(bp[~bt], deg=20, copies=3, seed=1); btr_y = np.tile(by[~bt], 3)
    bte = render_many(bp[bt]); bte_y = by[bt]
    epochs = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    global DANN
    DANN = float(sys.argv[3]) if len(sys.argv) > 3 else 0.
    folds_only = len(sys.argv) > 4 and sys.argv[4] == 'folds'
    rep = {}
    # 1) Transfer check: letters seen in training ONLY as QazSL silhouettes,
    #    then tested on camera-landmark silhouettes of held-out Bukva signers.
    #    This is the situation of the 9 Kazakh-only letters.
    rng = np.random.default_rng(7)
    order = [LABELS.index(c) for c in SHARED if c != 'Ё']   # Ё is not in QazSL
    rng.shuffle(order)
    folds = [order[i::4] for i in range(4)]
    zs_p, zs_y, seen_p, seen_y = [], [], [], []
    for fi, held in enumerate(folds[:1] if folds_only else folds):
        keep = ~np.isin(btr_y, held)
        dom = np.r_[np.zeros((~qt).sum()), np.ones(keep.sum())]
        net = fit(np.concatenate([qx[~qt], btr[keep]]), np.concatenate([qy[~qt], btr_y[keep]]), epochs, seed=fi,
                  domain=dom, dann=DANN)
        pb = predict(net, bte)
        m = np.isin(bte_y, held)
        zs_p.append(pb[m]); zs_y.append(bte_y[m]); seen_p.append(pb[~m]); seen_y.append(bte_y[~m])
        print(f'fold {fi}: letters only from QazSL {acc(pb, bte_y, m):.3f} | letters with camera data {acc(pb, bte_y, ~m):.3f}', flush=True)
    zp, zy = np.concatenate(zs_p), np.concatenate(zs_y)
    rep['transfer_qazsl_only_letters'] = {'top1': acc(zp, zy), 'top3': top3(zp, zy), 'n': int(len(zy)),
        'per_letter': {LABELS[c]: round(acc(zp, zy, zy == c), 3) for c in sorted(set(zy))},
        'note': 'Bukva test signers; these letters had no landmark silhouettes in training'}
    sp, sy = np.concatenate(seen_p), np.concatenate(seen_y)
    rep['letters_with_camera_data'] = {'top1': acc(sp, sy), 'top3': top3(sp, sy), 'n': int(len(sy))}
    print('transfer', rep['transfer_qazsl_only_letters']['top1'], 'seen', rep['letters_with_camera_data']['top1'], flush=True)
    if folds_only:
        return
    # 2) Final model on everything.
    dom = np.r_[np.zeros((~qt).sum()), np.ones(len(btr))]
    net = fit(np.concatenate([qx[~qt], btr]), np.concatenate([qy[~qt], btr_y]), epochs, seed=11, domain=dom, dann=DANN)
    pq, pb = predict(net, qx[qt]), predict(net, bte)
    kz = np.isin(qy[qt], [LABELS.index(c) for c in KZ9])
    rep['final'] = {'bukva_test_signers_top1': acc(pb, bte_y), 'bukva_test_signers_top3': top3(pb, bte_y),
                    'qazsl_heldout_block_top1': acc(pq, qy[qt]), 'qazsl_heldout_kazakh9_top1': acc(pq, qy[qt], kz),
                    'qazsl_per_kazakh_letter': {c: round(acc(pq, qy[qt], qy[qt] == LABELS.index(c)), 3) for c in KZ9},
                    'bukva_per_letter': {LABELS[c]: round(acc(pb, bte_y, bte_y == c), 3) for c in sorted(set(bte_y))}}
    print(json.dumps({k: {a: b for a, b in v.items() if not isinstance(b, dict)} for k, v in rep.items()}, ensure_ascii=False, indent=1), flush=True)
    out = ROOT / 'frontend/public/models/ksl'
    out.mkdir(parents=True, exist_ok=True)
    meta = dict(version='ksl-v1', input='50x50 binary silhouette drawn from 21 hand world landmarks (kslSilhouette.ts)',
                sources=['QazSL: Beisov, Jotsov, Kerimbayev. Zenodo record 22830162, CC BY 4.0',
                         'Bukva (ai-forever): landmark tracks of 33 letters shared with the Kazakh alphabet'],
                split='QazSL: last 25% of each class folder (by file number) held out, no signer ids published; '
                      'Bukva: official signer-disjoint test flag (20 test signers)',
                report=rep)
    export(net, out / 'ksl-v1.json', meta)
    import subprocess
    subprocess.run([sys.executable, str(ROOT / 'ml/ksl/pack_weights.py'), str(out / 'ksl-v1.json')], check=True)
    json.dump(meta, open(ROOT / 'docs/ksl-v1-report.json', 'w'), ensure_ascii=False, indent=1)
    idx = np.flatnonzero(bt)[::540]
    fx = [{'points': bp[i][:, :2].round(6).tolist(), 'probs': np.round(predict(net, render_many(bp[i:i+1]), True)[0], 5).tolist()}
          for i in idx]
    json.dump(fx, open(out / 'ksl-v1-fixtures.json', 'w'))
    print('exported', flush=True)


def sausaq():
    """Adds the «Саусақтар сөйлейді» teacher (one signer, YouTube lessons) as camera data.
    Transfer check: shared letters whose Bukva data is removed are learned only from
    this teacher + QazSL, then tested on 20 unseen Bukva signers."""
    qx, qy, qt = D['qx'], D['qy'].astype(int), D['qt']
    bp, by, bt = D['bp'], D['by'].astype(int), D['bt']
    S_ = np.load(ROOT / 'ml/rsl/data/sausaq/landmarks.npz')
    sp = S_['points'][::2]; sy = np.array([LABELS.index(c) for c in S_['labels'][::2]])
    epochs = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    global DANN
    DANN = float(sys.argv[3]) if len(sys.argv) > 3 else 0.
    nfolds = int(sys.argv[4]) if len(sys.argv) > 4 else 4
    print('rendering …', flush=True)
    btr = render_many(bp[~bt], deg=20, copies=3, seed=1); btr_y = np.tile(by[~bt], 3)
    bte = render_many(bp[bt]); bte_y = by[bt]
    sr = render_many(sp, deg=20, copies=3, seed=2); sr_y = np.tile(sy, 3)
    print('teacher frames', len(sp), 'letters', len(set(sy)), flush=True)
    rng = np.random.default_rng(7)
    order = [LABELS.index(c) for c in SHARED if c != 'Ё']
    rng.shuffle(order)
    folds = [order[i::4] for i in range(4)]
    rep = {}
    zp, zy = [], []
    for fi, held in enumerate(folds[:nfolds]):
        keep = ~np.isin(btr_y, held)
        X = np.concatenate([qx[~qt], btr[keep], sr]); y = np.concatenate([qy[~qt], btr_y[keep], sr_y])
        dom = np.r_[np.zeros((~qt).sum()), np.ones(keep.sum() + len(sr))]
        net = fit(X, y, epochs, seed=fi, domain=dom, dann=DANN)
        pb = predict(net, bte); m = np.isin(bte_y, held)
        zp.append(pb[m]); zy.append(bte_y[m])
        print(f'fold {fi}: letters known only from QazSL + the teacher {acc(pb, bte_y, m):.3f} | others {acc(pb, bte_y, ~m):.3f}', flush=True)
    zp, zy = np.concatenate(zp), np.concatenate(zy)
    rep['transfer_teacher_plus_qazsl'] = {'top1': acc(zp, zy), 'top3': top3(zp, zy), 'n': int(len(zy)), 'folds': nfolds,
        'per_letter': {LABELS[c]: round(acc(zp, zy, zy == c), 3) for c in sorted(set(zy))},
        'note': 'Bukva test signers; these letters had camera data only from one YouTube teacher'}
    print('TEACHER TRANSFER', rep['transfer_teacher_plus_qazsl']['top1'], rep['transfer_teacher_plus_qazsl']['top3'], flush=True)
    if not (len(sys.argv) > 5 and sys.argv[5] == 'final'):
        return
    X = np.concatenate([qx[~qt], btr, sr]); y = np.concatenate([qy[~qt], btr_y, sr_y])
    dom = np.r_[np.zeros((~qt).sum()), np.ones(len(btr) + len(sr))]
    net = fit(X, y, epochs, seed=11, domain=dom, dann=DANN)
    pq, pb = predict(net, qx[qt]), predict(net, bte)
    kz = [LABELS.index(c) for c in KZ9]
    kzm = np.isin(qy[qt], kz)
    rep['final'] = {'bukva_test_signers_top1': acc(pb, bte_y), 'bukva_test_signers_top3': top3(pb, bte_y),
                    'qazsl_heldout_block_top1': acc(pq, qy[qt]), 'qazsl_heldout_kazakh9_top1': acc(pq, qy[qt], kzm),
                    'teacher_frames_per_letter': {LABELS[c]: int((sy == c).sum()) for c in sorted(set(sy))},
                    'bukva_per_letter': {LABELS[c]: round(acc(pb, bte_y, bte_y == c), 3) for c in sorted(set(bte_y))}}
    old = json.load(open(ROOT / 'docs/ksl-v1-report.json', encoding='utf-8'))['report']
    rep['v1_transfer_qazsl_only'] = old['transfer_qazsl_only_letters']
    print(json.dumps({k: {a: b for a, b in v.items() if not isinstance(b, dict)} for k, v in rep.items()}, ensure_ascii=False, indent=1), flush=True)
    out = ROOT / 'frontend/public/models/ksl'
    meta = dict(version='ksl-v2', input='50x50 binary silhouette drawn from 21 hand world landmarks (kslSilhouette.ts)',
                sources=['QazSL: Beisov, Jotsov, Kerimbayev. Zenodo record 22830162, CC BY 4.0',
                         'Bukva (ai-forever): landmark tracks of 33 letters shared with the Kazakh alphabet',
                         '«Саусақтар сөйлейді» (YouTube: Sausaqtarsoileidi, «Жас Өрен», Aktobe): hand landmarks from 37 letter lessons, videos not redistributed'],
                split='QazSL: last 25% of each class folder held out; Bukva: official signer-disjoint test flag (20 test signers); '
                      'transfer: shared letters with Bukva data removed, learned from the teacher + QazSL only',
                report=rep)
    export(net, out / 'ksl-v2.json', meta)
    import subprocess
    subprocess.run([sys.executable, str(ROOT / 'ml/ksl/pack_weights.py'), str(out / 'ksl-v2.json')], check=True)
    json.dump(meta, open(ROOT / 'docs/ksl-v2-report.json', 'w'), ensure_ascii=False, indent=1)
    idx = np.flatnonzero(bt)[::540]
    fx = [{'points': bp[i][:, :2].round(6).tolist(), 'probs': np.round(predict(net, render_many(bp[i:i+1]), True)[0], 5).tolist()} for i in idx]
    json.dump(fx, open(out / 'ksl-v2-fixtures.json', 'w'))
    print('exported', flush=True)


if __name__ == '__main__':
    {'probe': probe, 'final': final, 'sausaq': sausaq}[sys.argv[1]]()
