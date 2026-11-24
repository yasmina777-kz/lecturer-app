"""Hand silhouette 50×50 from 21 MediaPipe hand landmarks.

QazSL (Zenodo 22830162, CC BY 4.0) gives binary hand silhouettes, not
landmarks. To use it with the browser camera we draw the same kind of
silhouette from landmarks: a palm polygon, finger capsules and a short
forearm stub, fitted into 50×50 with the aspect ratio kept. The browser twin
is frontend/src/sign/kslSilhouette.ts; both must produce the same pixels.
"""
from __future__ import annotations
import numpy as np

N = 50
FINGERS = [(1, 2), (2, 3), (3, 4), (5, 6), (6, 7), (7, 8), (9, 10), (10, 11), (11, 12),
           (13, 14), (14, 15), (15, 16), (17, 18), (18, 19), (19, 20), (5, 9), (9, 13), (13, 17), (0, 1)]
PALM = [0, 1, 2, 5, 9, 13, 17]
# Chosen on Bukva *train* signers with a QazSL-only probe (see train_ksl.py probe).
R_FINGER, R_THUMB, R_ARM, ARM_LEN, MARGIN = .12, .14, .35, .7, 1
STRETCH = False     # keep aspect ratio
ARM_IN_BOX = False  # crop to the hand; the forearm leaves the frame like in QazSL


def _hull(p: np.ndarray) -> np.ndarray:
    pts = sorted(map(tuple, p))
    def half(seq):
        h = []
        for q in seq:
            while len(h) >= 2 and (h[-1][0]-h[-2][0])*(q[1]-h[-2][1]) - (h[-1][1]-h[-2][1])*(q[0]-h[-2][0]) <= 0:
                h.pop()
            h.append(q)
        return h
    lo, up = half(pts), half(pts[::-1])
    return np.array(lo[:-1] + up[:-1])


def segments(xy: np.ndarray):
    """xy: 21×2, y down. Returns capsules [(a, b, r)] and palm hull, in units of |p0-p9|."""
    s = float(np.linalg.norm(xy[0] - xy[9]))
    if s < 1e-6:
        return None
    p = (xy - xy[0]) / s
    caps = [(p[a], p[b], R_THUMB if a <= 4 and b <= 4 else R_FINGER) for a, b in FINGERS]
    d = p[0] - p[9]
    d = d / max(np.linalg.norm(d), 1e-6)
    caps.append((p[0], p[0] + d * ARM_LEN, R_ARM))
    return caps, _hull(p[PALM])


def render(xy: np.ndarray) -> np.ndarray:
    """21×2 landmarks (any scale, y down) → float32 50×50 in {0,1}."""
    out = np.zeros((N, N), np.float32)
    g = segments(np.asarray(xy, np.float64))
    if g is None:
        return out
    caps, hull = g
    box = caps if ARM_IN_BOX else caps[:-1]
    pts = np.vstack([np.vstack([a, b]) for a, b, _ in box] + [hull])
    rmax = max(r for *_, r in box)
    lo, hi = pts.min(0) - rmax, pts.max(0) + rmax
    if STRETCH:
        scale = (N - 2 * MARGIN) / np.maximum(hi - lo, 1e-6)
    else:
        scale = np.full(2, (N - 2 * MARGIN) / max(hi - lo))
    off = (N - (hi - lo) * scale) / 2 - lo * scale
    ys, xs = np.mgrid[0:N, 0:N] + .5
    P = np.stack([xs, ys], -1)
    inside = np.zeros((N, N), bool)
    for a, b, r in caps:
        # distance measured in hand units so capsules stretch with the box
        Q = (P - off) / scale
        ab = b - a
        t = np.clip(((Q - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
        dist = np.linalg.norm(Q - (a + t[..., None] * ab), axis=-1)
        inside |= dist <= r
    Q = (P - off) / scale
    ok = np.ones((N, N), bool)
    for i in range(len(hull)):  # counter-clockwise hull from monotone chain
        A, B = hull[i], hull[(i + 1) % len(hull)]
        ok &= (B[0]-A[0])*(Q[..., 1]-A[1]) - (B[1]-A[1])*(Q[..., 0]-A[0]) >= 0
    inside |= ok
    out[inside] = 1
    return out
