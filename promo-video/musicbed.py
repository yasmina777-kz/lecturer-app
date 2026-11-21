"""Original music bed (synthesised, no third-party music): 104 bpm, C-G-Am-F."""
import numpy as np

SR = 44100


def music_bed(n, total):
    # music: 104 bpm, C – G – Am – F, soft plucks + pad + light beat
    bpm = 104
    beat = 60 / bpm
    t = np.arange(n) / SR
    music = np.zeros(n)
    chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
    f = lambda m: 440 * 2 ** ((m - 69) / 12)
    bar = 4 * beat
    for k in range(int(total / bar) + 1):
        ch = chords[k % 4]
        a = int(k * bar * SR); b = min(n, int((k + 1) * bar * SR))
        if a >= n:
            break
        tt = t[a:b] - t[a]
        pad = sum(np.sin(2 * np.pi * f(m) * tt) + .3 * np.sin(2 * np.pi * 2 * f(m) * tt) for m in ch) / 3
        music[a:b] += .18 * pad * np.minimum(1, tt / .4) * np.minimum(1, (bar - tt) / .3)
        for j in range(8):  # pluck arpeggio, eighth notes
            s0 = a + int(j * beat / 2 * SR)
            if s0 >= n:
                break
            m = ch[j % 3] + (12 if j % 4 == 3 else 0)
            L = min(n - s0, int(.45 * SR)); tt2 = np.arange(L) / SR
            music[s0:s0 + L] += .22 * np.sin(2 * np.pi * f(m + 12) * tt2) * np.exp(-tt2 * 7)
        for j in range(4):  # kick on every beat, hat off-beat
            s0 = a + int(j * beat * SR)
            if s0 >= n:
                break
            L = min(n - s0, int(.25 * SR)); tt2 = np.arange(L) / SR
            music[s0:s0 + L] += .35 * np.sin(2 * np.pi * (50 + 90 * np.exp(-tt2 * 30)) * tt2) * np.exp(-tt2 * 14)
            h0 = s0 + int(beat / 2 * SR); L = min(n - h0, int(.05 * SR))
            if L > 0:
                music[h0:h0 + L] += .05 * np.random.default_rng(j + k).normal(0, 1, L) * np.exp(-np.arange(L) / SR * 80)
    music /= max(1e-6, np.abs(music).max())
    return music, t
