"""Canonical two-hand features for isolated word clips (Python twin of
frontend/src/sign/wordFeatures.ts). Input per frame: list of detected hands,
each 21 MediaPipe *image* landmarks (x, y in [0, 1], z relative depth), plus
the video width/height. No handedness label is needed (Slovo has none).

Steps (identical in TypeScript):
1. Aspect-correct: X = x*W/M, Y = y*H/M, Z = z*W/M with M = max(W, H).
2. Keep the two largest hands per frame; assign them to two tracks: with two
   hands, smaller wrist X -> track 0; a single hand goes to the track whose last
   wrist is nearer (an unseen track counts as infinitely far; ties -> 0), or by
   X < 0.5*W/M when no track has been seen.
3. Crop to the first..last frame containing any hand.
4. Dominant track = longer wrist path. If it is track 1, mirror X and swap, so
   the dominant hand is always track 0 (left-handed signers are canonicalized).
5. Reference scale = median palm length (wrist-middle MCP) of the dominant
   hand; origin = median dominant wrist position.
6. Per hand: 63 wrist-centred, palm-normalized shape coordinates, 2 wrist
   coordinates relative to origin / scale, 1 presence flag; then 2 values for
   the non-dominant minus dominant wrist when both are present. 134 channels.
"""
from __future__ import annotations

import numpy as np

CHANNELS = 134


def _palm(hand: np.ndarray) -> float:
    return float(np.linalg.norm(hand[9] - hand[0]))


def clip_features(frames: list[list[np.ndarray]], width: float, height: float) -> np.ndarray | None:
    m = max(width, height)
    sx, sy = width / m, height / m
    tracks = np.zeros((len(frames), 2, 21, 3), dtype=np.float64)
    present = np.zeros((len(frames), 2), dtype=bool)
    last = [None, None]
    for t, hands in enumerate(frames):
        scaled = []
        for h in hands:
            h = np.asarray(h, dtype=np.float64).reshape(21, 3)
            if not np.isfinite(h).all():
                continue
            s = h * np.array([sx, sy, sx])
            area = np.ptp(s[:, 0]) * np.ptp(s[:, 1])
            scaled.append((area, s))
        # Stable sort keeps detection order on ties, same as Array.prototype.sort.
        scaled = [s for _, s in sorted(scaled, key=lambda v: -v[0])][:2]
        if len(scaled) == 2:
            a, b = scaled
            pair = (a, b) if a[0, 0] <= b[0, 0] else (b, a)
            for k in range(2):
                tracks[t, k], present[t, k] = pair[k], True
                last[k] = pair[k][0, :2]
        elif len(scaled) == 1:
            s = scaled[0]
            if last[0] is None and last[1] is None:
                k = 0 if s[0, 0] < .5 * sx else 1
            else:
                d = [np.inf if l is None else float(np.linalg.norm(s[0, :2] - l)) for l in last]
                k = 0 if d[0] <= d[1] else 1
            tracks[t, k], present[t, k] = s, True
            last[k] = s[0, :2]
    any_hand = np.flatnonzero(present.any(1))
    if not len(any_hand):
        return None
    tracks = tracks[any_hand[0]:any_hand[-1] + 1]
    present = present[any_hand[0]:any_hand[-1] + 1]

    def path(k):
        idx = np.flatnonzero(present[:, k])
        if len(idx) < 2:
            return -1. if not len(idx) else 0.
        w = tracks[idx, k, 0, :2]
        return float(np.linalg.norm(np.diff(w, axis=0), axis=1).sum())

    if path(1) > path(0):
        tracks = tracks[:, ::-1].copy()
        present = present[:, ::-1].copy()
        tracks[..., 0] *= -1
    dom = np.flatnonzero(present[:, 0])
    if not len(dom):
        return None
    scale = max(float(np.median([_palm(tracks[t, 0]) for t in dom])), 1e-3)
    origin = np.median(tracks[dom, 0, 0, :2], axis=0)
    out = np.zeros((len(tracks), CHANNELS), dtype=np.float32)
    for t in range(len(tracks)):
        for k in range(2):
            if not present[t, k]:
                continue
            h = tracks[t, k]
            palm = max(_palm(h), 1e-3)
            base = k * 66
            out[t, base:base + 63] = ((h - h[0]) / palm).reshape(-1)
            out[t, base + 63:base + 65] = (h[0, :2] - origin) / scale
            out[t, base + 65] = 1
        if present[t].all():
            out[t, 132:134] = (tracks[t, 1, 0, :2] - tracks[t, 0, 0, :2]) / scale
    return out


def resample(features: np.ndarray, frames: int = 32) -> np.ndarray:
    n = len(features)
    return features[np.floor(np.arange(frames) * (n - 1) / (frames - 1)).astype(int)]
