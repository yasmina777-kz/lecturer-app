"""Small visual encoder / character decoder, trained without a language-model API.

Research only: learns weak video/subtitle pairs, not CTC gloss labels. It has no
pretrained text model and must not replace the production recognizer unreviewed.
"""
import numpy as np
import torch
from torch import nn

from model import Position

PAD, BOS, EOS, UNK = 0, 1, 2, 3
NORMALIZATION_VERSION = 'body-relative-xy-group-relative-z-v1'


def normalize_landmarks(rows):
    """Keep missing landmarks zero; normalize position/scale, not finger shape."""
    points = np.asarray(rows, dtype=np.float32).reshape(-1, 60, 3).copy()
    present = np.any(points != 0, axis=-1)
    shoulders = points[:, 42:44]
    center = shoulders.mean(axis=1)
    scale = np.linalg.norm(shoulders[:, 0, :2] - shoulders[:, 1, :2], axis=-1)
    valid = present[:, 42] & present[:, 43] & (scale > .025)
    scale = np.maximum(scale, .025)
    # MediaPipe hand/face depth origins differ from pose depth. Do not subtract
    # shoulder z from hand z as though they belonged to the same coordinate space.
    for start, end in [(0, 21), (21, 42), (42, 48), (48, 60)]:
        points[:, start:end, 2] -= points[:, start:start+1, 2].copy()
    points[:, :, :2] -= center[:, None, :2]
    points /= scale[:, None, None]
    points[~present] = 0
    points[~valid] = 0
    return np.clip(points, -4, 4).reshape(-1, 180) / 4


class SubtitleTranslator(nn.Module):
    def __init__(self, vocab_size, d_model=128, layers=2, dropout=.15):
        super().__init__()
        self.config = dict(d_model=d_model, layers=layers, dropout=dropout)
        self.input = nn.Linear(360, d_model)
        self.position = Position(d_model, dropout)
        enc = nn.TransformerEncoderLayer(d_model, 4, d_model * 2, dropout,
                                         batch_first=True, norm_first=True)
        self.encoder = nn.TransformerEncoder(enc, layers, enable_nested_tensor=False)
        self.embedding = nn.Embedding(vocab_size, d_model, padding_idx=PAD)
        dec = nn.TransformerDecoderLayer(d_model, 4, d_model * 2, dropout,
                                         batch_first=True, norm_first=True)
        self.decoder = nn.TransformerDecoder(dec, layers)
        self.output = nn.Linear(d_model, vocab_size)

    def encode(self, x, lengths):
        delta = torch.cat([torch.zeros_like(x[:, :1]), x[:, 1:] - x[:, :-1]], dim=1)
        mask = torch.arange(x.shape[1], device=x.device)[None] >= lengths[:, None]
        return self.encoder(self.position(self.input(torch.cat([x, delta], -1))),
                            src_key_padding_mask=mask), mask

    def decode(self, memory, memory_mask, tokens):
        size = tokens.shape[1]
        causal = torch.ones(size, size, dtype=torch.bool, device=tokens.device).triu(1)
        hidden = self.decoder(self.position(self.embedding(tokens)), memory,
                              tgt_mask=causal, tgt_key_padding_mask=tokens == PAD,
                              memory_key_padding_mask=memory_mask)
        return self.output(hidden)

    def forward(self, x, lengths, tokens):
        return self.decode(*self.encode(x, lengths), tokens)

    @torch.inference_mode()
    def generate(self, x, lengths, max_chars=240):
        memory, mask = self.encode(x, lengths)
        tokens = torch.full((len(x), 1), BOS, dtype=torch.long, device=x.device)
        finished = torch.zeros(len(x), dtype=torch.bool, device=x.device)
        for _ in range(max_chars):
            logits = self.decode(memory, mask, tokens)[:, -1]
            logits[:, [PAD, BOS]] = -torch.inf
            nxt = logits.argmax(-1)
            nxt = torch.where(finished, EOS, nxt)
            tokens = torch.cat([tokens, nxt[:, None]], dim=1)
            finished |= nxt == EOS
            if bool(finished.all()):
                break
        return tokens[:, 1:]
