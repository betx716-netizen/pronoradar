# Musique originale de la pub PronoRadar : afro-house / amapiano à 112 BPM, composée par code (aucun échantillon,
# aucun droit à payer). 11 mesures de 4 temps + une queue de 1,5 s : intro légère, groove, montée, final.
# Usage : python3 music.py sortie.wav
import sys
import wave

import numpy as np

SR = 44100
BPM = 112
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 11
LENGTH = BARS * BAR + 1.5
N = int(LENGTH * SR)
rng = np.random.default_rng(7)

mix = np.zeros((N, 2))


def add(sig, t, pan=0.0, gain=1.0):
    """Ajoute un son à l'instant t (s), panoramique -1 (gauche) à 1 (droite)."""
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    mix[i : i + len(sig), 0] += sig * (1 - max(pan, 0))
    mix[i : i + len(sig), 1] += sig * (1 + min(pan, 0))


def env(n, attack=0.002, decay=0.2):
    t = np.arange(n) / SR
    a = np.minimum(t / attack, 1)
    return a * np.exp(-t / decay)


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, 0.16) * 0.9


def log_drum(freq, dur=0.32):
    # Le « log drum » de l'amapiano : basse ronde qui glisse vers le bas, avec un peu de grain.
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t * 35))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    return np.tanh(1.6 * s) * env(n, 0.003, dur / 2.2) * 0.55


def shaker(dur=0.06):
    n = int(dur * SR)
    s = rng.standard_normal(n)
    s = np.diff(np.concatenate([[0], s]))  # passe-haut grossier
    return s * env(n, 0.002, 0.02) * 0.10


def clap():
    n = int(0.25 * SR)
    s = rng.standard_normal(n)
    s = np.diff(np.concatenate([[0], s]))
    e = env(n, 0.001, 0.07)
    for d in (0.008, 0.016):  # trois petites claques rapprochées
        k = int(d * SR)
        e[k:] += env(n - k, 0.001, 0.05) * 0.6
    return s * e * 0.18


def chord(freqs, dur):
    # Accord de piano doux (harmoniques qui s'éteignent) : couleur « deep » de l'amapiano.
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for h, a in ((1, 1), (2, 0.35), (3, 0.12), (4, 0.06)):
            s += a * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6.28)) * np.exp(-t * (1.2 + h))
    return s * env(n, 0.004, 0.9) * 0.07


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = rng.standard_normal(n)
    # Bruit filtré qui monte : moyenne glissante dont la fenêtre rétrécit.
    out = np.zeros(n)
    acc = 0.0
    for i in range(n):
        k = 0.02 + 0.6 * (i / n) ** 2
        acc += k * (s[i] - acc)
        out[i] = acc
    return out * (t / dur) ** 2 * 0.35


def note(n):
    return 440 * 2 ** ((n - 69) / 12)


# Progression : Am9 – Fmaj7 – Cmaj7 – G (une mesure chacun).
PROG = [[57, 60, 64, 67, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 67]]
ROOT = [45, 41, 48, 43]
# Rythme syncopé du log drum (en doubles-croches) et notes relatives à la fondamentale.
LOG = [(0, 0), (3, 0), (6, 7), (10, 0), (11, 12), (14, 7)]

for bar in range(BARS):
    t0 = bar * BAR
    k = bar % 4
    intro = bar < 1
    final = bar >= 9
    if final:
        continue
    for b in range(4):
        tb = t0 + b * BEAT
        if not intro:
            add(kick(), tb, 0, 0.9 if b in (0, 2) else 0.55)
        if b in (1, 3) and bar >= 2:
            add(clap(), tb, 0.1)
    for s in range(16):
        if bar >= 1 or s % 2 == 0:
            add(shaker(), t0 + s * BEAT / 4 + (0.012 if s % 2 else 0), -0.35 if s % 2 else 0.35, 0.7 if s % 4 else 1.1)
    if not intro:
        for s, iv in LOG:
            add(log_drum(note(ROOT[k] - 12 + iv)), t0 + s * BEAT / 4, 0, 1.0)
    add(chord([note(x) for x in PROG[k]], BAR * 1.05), t0, 0, 1.0 if not intro else 0.8)

# Montée vers le final (mesures 7 et 8), puis grand accord tenu sur le logo.
add(riser(2 * BAR), 7 * BAR, 0, 1.0)
tf = 9 * BAR
add(kick(), tf, 0, 1.1)
add(clap(), tf, 0, 1.2)
add(log_drum(note(33), 0.9), tf, 0, 1.1)
add(chord([note(x) for x in [57, 60, 64, 67, 71, 76]], 2 * BAR + 1.5) * 1.6, tf, 0, 1.0)

# Mixage : compression douce, fondu de sortie, normalisation.
mix = np.tanh(mix * 1.4) / 1.1
fade = int(1.2 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.max(np.abs(mix)) * 1.12
data = (mix * 32767).astype("<i2")
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print(f"{LENGTH:.2f} s, {BPM} BPM, mesure = {BAR:.3f} s")
