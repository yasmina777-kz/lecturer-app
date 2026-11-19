"""torch version of seqnet.reference_forward for evaluation scripts (same weights, batched)."""
import numpy as np
import torch
from seqnet import _decode

torch.set_num_threads(8)
_cache = {}


def _build(exported):
    key = id(exported)
    if key in _cache:
        return _cache[key]
    mean = torch.tensor(_decode(exported['mean']))
    std = torch.tensor(_decode(exported['std']))
    layers = []
    for l in exported['layers']:
        if l['type'] == 'conv':
            w = torch.tensor(_decode(l['weights'], (l['outputs'], l['inputs'], l['kernel'])))
            layers.append(('conv', w, torch.tensor(_decode(l['bias'])), l['dilation'], l['residual']))
        else:
            w = torch.tensor(_decode(l['weights'], (l['outputs'], l['inputs'])))
            layers.append(('dense', w, torch.tensor(_decode(l['bias'])), l['relu'], None))
    _cache[key] = (mean, std, layers)
    return _cache[key]


@torch.no_grad()
def forward_batch(exported, xs):
    """xs: [batch, time, channels] numpy -> probabilities [batch, classes]."""
    mean, std, layers = _build(exported)
    h = ((torch.tensor(np.asarray(xs, dtype=np.float32)) - mean) / std).transpose(1, 2)
    pooled = False
    for kind, w, b, a, c in layers:
        if kind == 'conv':
            k = w.shape[2]
            y = torch.relu(torch.nn.functional.conv1d(h, w, b, padding=a * (k - 1) // 2, dilation=a))
            h = h + y if c else y
        else:
            if not pooled:
                h = torch.cat([h.mean(2), h.amax(2)], 1)
                pooled = True
            h = h @ w.T + b
            if a:
                h = torch.relu(h)
    return torch.softmax(h, 1).numpy()


def forward(exported, x):
    return forward_batch(exported, x[None])[0]
