#!/usr/bin/env python3
"""
Builds the customer login sound effects (no downloads, no licence questions).

  python3 scripts/generate-login-sounds.py

Writes 22 kHz mono WAV files to assets/sounds/:
  ignition.wav  key turn "klik" when the OTP is sent
  tick.wav      odometer tick for each OTP digit
  stall.wav     engine sputter for a wrong OTP
  engine.wav    starter crank + "vroom" on the Engine ON screen
"""
import math
import os
import random
import struct
import wave

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sounds')
random.seed(7)


def write(name, samples, gain=0.8):
    peak = max(1e-9, max(abs(s) for s in samples))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = b''.join(struct.pack('<h', int(max(-1, min(1, s / peak * gain)) * 32767)) for s in samples)
        w.writeframes(frames)
    print(f'{path}  {len(samples) / RATE:.2f}s')


def n(sec):
    return int(sec * RATE)


def click(t, freq, decay):
    """Short metallic click: resonant sine + noise, fast exponential decay."""
    env = math.exp(-t * decay)
    return env * (0.7 * math.sin(2 * math.pi * freq * t) + 0.3 * (random.random() * 2 - 1))


def ignition():
    out = []
    for i in range(n(0.32)):
        t = i / RATE
        s = click(t, 2300, 60)                      # key hits the lock
        if t > 0.12:
            s += 0.8 * click(t - 0.12, 1700, 45)    # key turns
        out.append(s)
    return out


def tick():
    return [click(i / RATE, 3200, 160) for i in range(n(0.06))]


def saw(phase):
    return 2 * (phase - math.floor(phase + 0.5))


def engine_tone(freqs, noise=0.25):
    """Rough engine: sawtooth + 2nd/3rd harmonic + noise, following a frequency curve."""
    out, ph = [], 0.0
    for f in freqs:
        ph += f / RATE
        s = 0.6 * saw(ph) + 0.25 * math.sin(2 * math.pi * 2 * ph) + 0.15 * math.sin(2 * math.pi * 3 * ph)
        s += noise * (random.random() * 2 - 1)
        out.append(s)
    return out


def stall():
    total = n(0.62)
    freqs = [55 - 25 * (i / total) for i in range(total)]
    base = engine_tone(freqs, noise=0.35)
    out = []
    for i, s in enumerate(base):
        t = i / RATE
        chop = 1.0 if (int(t / 0.09) % 2 == 0) else 0.15   # cough-cough-cough
        out.append(s * chop * math.exp(-t * 2.2))
    return out


def engine():
    out = []
    # Starter crank: three quick whirrs.
    crank = n(0.42)
    for i in range(crank):
        t = i / RATE
        whirr = 0.5 * math.sin(2 * math.pi * 180 * t) * (0.5 + 0.5 * math.sin(2 * math.pi * 7 * t))
        out.append(0.45 * whirr + 0.1 * (random.random() * 2 - 1))
    # Catch + rev up and settle into idle.
    rev = n(1.25)
    freqs = []
    for i in range(rev):
        p = i / rev
        if p < 0.35:
            f = 45 + (120 - 45) * (p / 0.35) ** 0.7     # vroom up
        else:
            f = 120 - (120 - 70) * ((p - 0.35) / 0.65) ** 0.5  # settle to idle
        freqs.append(f)
    tone = engine_tone(freqs, noise=0.2)
    for i, s in enumerate(tone):
        p = i / rev
        env = min(1.0, p / 0.04) * (1.0 if p < 0.7 else max(0.0, 1 - (p - 0.7) / 0.3))
        out.append(s * env)
    return out


if __name__ == '__main__':
    write('ignition.wav', ignition(), 0.7)
    write('tick.wav', tick(), 0.45)
    write('stall.wav', stall(), 0.7)
    write('engine.wav', engine(), 0.75)
