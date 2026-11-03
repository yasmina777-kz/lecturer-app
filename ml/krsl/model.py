"""Inference-only architecture compatible with dastan-issenov's KRSL checkpoint.

Parameter names and operations follow the pinned upstream Conformer specification;
no remote Python or training/optimizer state is executed. See README.md.
"""
import math
import torch
from torch import nn
from torch.nn import functional as F


class FeedForward(nn.Module):
    def __init__(self, d, expansion, dropout):
        super().__init__()
        self.norm = nn.LayerNorm(d)
        self.ff = nn.Sequential(nn.Linear(d, d * expansion), nn.SiLU(),
                                nn.Dropout(dropout), nn.Linear(d * expansion, d), nn.Dropout(dropout))

    def forward(self, x):
        return x + .5 * self.ff(self.norm(x))


class Attention(nn.Module):
    def __init__(self, d, heads, dropout):
        super().__init__()
        self.norm = nn.LayerNorm(d)
        self.attn = nn.MultiheadAttention(d, heads, dropout=dropout, batch_first=True)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, mask):
        q = self.norm(x)
        value, _ = self.attn(q, q, q, key_padding_mask=mask)
        return x + self.dropout(value)


class Convolution(nn.Module):
    def __init__(self, d, kernel, dropout):
        super().__init__()
        self.norm = nn.LayerNorm(d)
        self.pw_conv1 = nn.Conv1d(d, 2 * d, 1)
        self.dw_conv = nn.Conv1d(d, d, kernel, padding=kernel // 2, groups=d)
        self.lnorm = nn.LayerNorm(d)
        self.pw_conv2 = nn.Conv1d(d, d, 1)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        y = F.glu(self.pw_conv1(self.norm(x).transpose(1, 2)), dim=1)
        y = self.lnorm(F.silu(self.dw_conv(y)).transpose(1, 2))
        return x + self.dropout(self.pw_conv2(y.transpose(1, 2)).transpose(1, 2))


class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        d, p = cfg['d_model'], cfg['dropout']
        self.ff1 = FeedForward(d, cfg['ff_expansion'], p)
        self.mhsa = Attention(d, cfg['n_heads'], p)
        self.conv = Convolution(d, cfg['conv_kernel'], p)
        self.ff2 = FeedForward(d, cfg['ff_expansion'], p)
        self.norm = nn.LayerNorm(d)

    def forward(self, x, mask):
        return self.norm(self.ff2(self.conv(self.mhsa(self.ff1(x), mask))))


class Position(nn.Module):
    def __init__(self, d, dropout):
        super().__init__()
        pe = torch.zeros(4096, d)
        pos = torch.arange(4096).unsqueeze(1).float()
        div = torch.exp(torch.arange(0, d, 2).float() * (-math.log(10000.) / d))
        pe[:, 0::2], pe[:, 1::2] = torch.sin(pos * div), torch.cos(pos * div)
        self.register_buffer('pe', pe.unsqueeze(0))
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        return self.dropout(x + self.pe[:, :x.shape[1]])


class Recognizer(nn.Module):
    def __init__(self, vocab_size, cfg):
        super().__init__()
        d = cfg['d_model']
        self.input_proj = nn.Linear(180, d)
        self.pos_enc = Position(d, cfg['dropout'])
        self.encoder = nn.ModuleList([Block(cfg) for _ in range(cfg['n_layers'])])
        self.ctc_head = nn.Linear(d, vocab_size)
        self.ve_head = nn.Linear(d, vocab_size)  # checkpoint compatibility, unused at inference

    def forward(self, x, lengths):
        mask = torch.arange(x.shape[1], device=x.device)[None] >= lengths[:, None]
        x = self.pos_enc(self.input_proj(x))
        for block in self.encoder:
            x = block(x, mask)
        return self.ctc_head(x)


def decode_ctc(logits, idx_to_token, blank=0):
    """Collapse adjacent repeats BEFORE removing blanks; keep unknowns explicit."""
    ids = logits.argmax(-1).tolist()
    tokens, previous = [], None
    for token in ids:
        if token != previous and token != blank:
            label = idx_to_token[str(token)]
            tokens.append('[неизвестный жест]' if label.upper() == '<UNK>' else label)
        previous = token
    return tokens
