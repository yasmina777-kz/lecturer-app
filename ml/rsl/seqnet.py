"""Small temporal CNN shared by the v5 letter model and the v1 word model.

The architecture is deliberately limited to operations that the dependency-free
TypeScript runtime in frontend/src/sign/seqModel.ts reproduces exactly:
'same'-padded dilated Conv1d, ReLU, residual add, mean+max time pooling and
dense layers. Exported weights are float16 little-endian, base64 encoded.
"""
from __future__ import annotations

import base64

import numpy as np
import torch
from torch import nn


class Block(nn.Module):
    def __init__(self, cin: int, cout: int, kernel: int, dilation: int, dropout: float):
        super().__init__()
        self.conv = nn.Conv1d(cin, cout, kernel, padding=dilation * (kernel - 1) // 2, dilation=dilation)
        self.residual = cin == cout
        self.drop = nn.Dropout(dropout)

    def forward(self, x):
        y = torch.relu(self.conv(x))
        y = self.drop(y)
        return x + y if self.residual else y


class SeqNet(nn.Module):
    def __init__(self, channels: int, classes: int, width: int = 128, hidden: int = 256,
                 blocks: tuple[tuple[int, int], ...] = ((5, 1), (5, 2), (5, 4)), dropout: float = .2):
        super().__init__()
        self.spec = dict(channels=channels, classes=classes, width=width, hidden=hidden,
                         blocks=[list(b) for b in blocks], dropout=dropout)
        layers, cin = [], channels
        for kernel, dilation in blocks:
            layers.append(Block(cin, width, kernel, dilation, dropout))
            cin = width
        self.blocks = nn.ModuleList(layers)
        self.hidden = nn.Linear(2 * width, hidden)
        self.drop = nn.Dropout(dropout)
        self.out = nn.Linear(hidden, classes)

    def forward(self, x):  # x: [batch, time, channels], already standardized
        h = x.transpose(1, 2)
        for block in self.blocks:
            h = block(h)
        pooled = torch.cat([h.mean(2), h.amax(2)], 1)
        return self.out(self.drop(torch.relu(self.hidden(pooled))))


def _b64(array: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(array, dtype='<f2').tobytes()).decode()


def export(model: SeqNet, mean: np.ndarray, std: np.ndarray, labels: list[str], **extra) -> dict:
    """Serialize to the JSON layout read by seqModel.ts.

    The float16 rounding is applied here and `reference_forward` below uses the
    same rounded weights, so Python fixtures equal browser output up to float32
    accumulation order.
    """
    model = model.eval().cpu()
    layers = []
    for block in model.blocks:
        w = block.conv.weight.detach().numpy()  # [out, in, k]
        layers.append(dict(type='conv', kernel=int(w.shape[2]), dilation=int(block.conv.dilation[0]),
                           inputs=int(w.shape[1]), outputs=int(w.shape[0]), residual=bool(block.residual),
                           weights=_b64(w), bias=_b64(block.conv.bias.detach().numpy())))
    for name in ('hidden', 'out'):
        lin = getattr(model, name)
        w = lin.weight.detach().numpy()
        layers.append(dict(type='dense', inputs=int(w.shape[1]), outputs=int(w.shape[0]),
                           relu=name == 'hidden', weights=_b64(w), bias=_b64(lin.bias.detach().numpy())))
    return dict(format='seq-cnn-v1', labels=labels, channels=int(len(mean)),
                mean=_b64(mean), std=_b64(std), layers=layers, **extra)


def _decode(text: str, shape=None) -> np.ndarray:
    a = np.frombuffer(base64.b64decode(text), dtype='<f2').astype(np.float32)
    return a.reshape(shape) if shape else a


def reference_forward(exported: dict, x: np.ndarray) -> np.ndarray:
    """NumPy re-implementation of the browser runtime: [time, channels] -> probabilities."""
    mean, std = _decode(exported['mean']), _decode(exported['std'])
    h = ((x - mean) / std).astype(np.float32)
    for layer in exported['layers']:
        if layer['type'] == 'conv':
            k, d = layer['kernel'], layer['dilation']
            w = _decode(layer['weights'], (layer['outputs'], layer['inputs'], k))
            b = _decode(layer['bias'])
            pad = d * (k - 1) // 2
            padded = np.pad(h, ((pad, pad), (0, 0)))
            y = np.tile(b, (len(h), 1))
            for j in range(k):
                y += padded[j * d:j * d + len(h)] @ w[:, :, j].T
            y = np.maximum(y, 0)
            h = h + y if layer['residual'] else y
        else:
            if h.ndim == 2:
                h = np.concatenate([h.mean(0), h.max(0)])
            w = _decode(layer['weights'], (layer['outputs'], layer['inputs']))
            h = w @ h + _decode(layer['bias'])
            if layer['relu']:
                h = np.maximum(h, 0)
    e = np.exp(h - h.max())
    return e / e.sum()


def rotation(rng: np.random.Generator, degrees=(15, 15, 20)) -> np.ndarray:
    ax, ay, az = (np.radians(rng.uniform(-d, d)) for d in degrees)
    rx = np.array([[1, 0, 0], [0, np.cos(ax), -np.sin(ax)], [0, np.sin(ax), np.cos(ax)]])
    ry = np.array([[np.cos(ay), 0, np.sin(ay)], [0, 1, 0], [-np.sin(ay), 0, np.cos(ay)]])
    rz = np.array([[np.cos(az), -np.sin(az), 0], [np.sin(az), np.cos(az), 0], [0, 0, 1]])
    return (rz @ ry @ rx).astype(np.float32)
