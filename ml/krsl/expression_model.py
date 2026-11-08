"""Small supervised temporal classifier for a fixed list, not a translator."""
import numpy as np
import torch
from torch import nn

FRAMES = 32
FEATURES = 234


def normalize(rows):
    points = np.asarray(rows, dtype=np.float32).reshape(-1, 48, 3).copy()
    present = np.any(points != 0, axis=-1)
    shoulders = points[:, 42:44]
    center = shoulders.mean(1)
    width = np.linalg.norm(shoulders[:, 0, :2] - shoulders[:, 1, :2], axis=1)
    valid = present[:, 42] & present[:, 43] & (width > .025)
    width = np.maximum(width, .025)
    relative = points.copy()
    relative[:, :, :2] -= center[:, None, :2]
    for a, b in [(0, 21), (21, 42), (42, 48)]:
        relative[:, a:b, 2] -= points[:, a:a+1, 2]
    relative /= width[:, None, None]
    relative[~present] = 0
    relative[~valid] = 0
    parts = [np.clip(relative, -3, 3).reshape(-1, 144) / 3]
    # Finger shape is normalized independently of distance from the camera.
    for a in (0, 21):
        hand = points[:, a:a+21] - points[:, a:a+1]
        palm = np.linalg.norm(hand[:, 9], axis=1)
        hand /= np.maximum(palm, .005)[:, None, None]
        hand[~present[:, a]] = 0
        parts.append(np.clip(hand[:, :, :2], -3, 3).reshape(-1, 42) / 3)
    parts.append(present[:, [0, 21, 42, 43, 44, 45]].astype(np.float32))
    return np.concatenate(parts, axis=1)


def resample(x, length=FRAMES):
    old = np.linspace(0, 1, len(x))
    new = np.linspace(0, 1, length)
    return np.stack([np.interp(new, old, x[:, i]) for i in range(x.shape[1])], 1).astype(np.float32)


class ExpressionClassifier(nn.Module):
    def __init__(self, classes):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv1d(FEATURES, 96, 1), nn.ReLU(),
            nn.Conv1d(96, 96, 5, padding=2), nn.ReLU(), nn.Dropout(.2),
            nn.Conv1d(96, 96, 5, padding=2), nn.ReLU())
        self.output = nn.Sequential(nn.Linear(192, 96), nn.ReLU(), nn.Dropout(.25), nn.Linear(96, classes))

    def forward(self, x):
        z = self.encoder(x.transpose(1, 2))
        return self.output(torch.cat([z.mean(-1), z.amax(-1)], 1))
