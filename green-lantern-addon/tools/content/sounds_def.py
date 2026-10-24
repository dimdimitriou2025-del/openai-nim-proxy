"""Procedurally synthesised sound effects (original audio, generated from code).

Each recipe returns a mono float signal at SR; the build writes WAV, encodes
it to OGG Vorbis with ffmpeg and registers it in sound_definitions.json.
"""
import math
import os
import subprocess
import tempfile
import wave

import numpy as np

from glc.io import rp, write_json, WRITTEN

SR = 44100
RNG = np.random.RandomState(1959)  # Showcase #22 :)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def osc(freq, dur, kind="sine", phase=0.0):
    """Oscillator with (possibly time-varying) frequency array or scalar."""
    n = int(dur * SR)
    f = np.full(n, float(freq)) if np.isscalar(freq) else np.asarray(freq, dtype=float)[:n]
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    if kind == "sine":
        return np.sin(ph)
    if kind == "saw":  # mild band-limiting via 6 harmonics
        return sum(np.sin(ph * k) / k for k in range(1, 7)) * 0.6
    if kind == "square":
        return sum(np.sin(ph * k) / k for k in range(1, 9, 2)) * 0.9
    if kind == "tri":
        return sum(((-1) ** ((k - 1) // 2)) * np.sin(ph * k) / (k * k) for k in range(1, 9, 2)) * 0.8
    raise ValueError(kind)


def sweep(f0, f1, dur, curve="exp"):
    t = t_axis(dur) / dur
    if curve == "exp":
        return f0 * (f1 / f0) ** t
    return f0 + (f1 - f0) * t


def noise(dur):
    return RNG.uniform(-1, 1, int(dur * SR))


def env(dur, a=0.01, d=0.1, s=0.7, r=0.2):
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.zeros(n)
    rel_start = max(dur - r, a + d)
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    dmask = (t >= a) & (t < a + d)
    e = np.where(dmask, 1 - (1 - s) * (t - a) / max(d, 1e-6), e)
    e = np.where((t >= a + d) & (t < rel_start), s, e)
    e = np.where(t >= rel_start, s * np.clip(1 - (t - rel_start) / max(r, 1e-6), 0, 1), e)
    return e


def decay(dur, rate):
    return np.exp(-t_axis(dur) * rate)


def fade_in(dur, power=2.0):
    return (t_axis(dur) / dur) ** power


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (sweeping filter)."""
    c = np.full(len(x), float(cutoff)) if np.isscalar(cutoff) else np.asarray(cutoff)[:len(x)]
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def bandpass(x, center, q=1.5):
    lo = np.asarray(center) * (1 + 1 / (2 * q)) if not np.isscalar(center) else center * (1 + 1 / (2 * q))
    hi = np.asarray(center) / (1 + 1 / (2 * q)) if not np.isscalar(center) else center / (1 + 1 / (2 * q))
    return highpass(lowpass(x, lo), hi)


def reverb(x, mix=0.25, room=0.35):
    out = x.copy()
    for delay_ms, gain in ((29.7, 0.5), (37.1, 0.45), (41.1, 0.4), (43.7, 0.37), (61.3, 0.3)):
        d = int(SR * delay_ms / 1000 * (1 + room))
        y = np.zeros(len(x) + d * 8)
        y[:len(x)] = x
        for k in range(1, 8):
            seg = x * (gain ** k)
            y[d * k:d * k + len(x)] += seg
        out = out + y[:len(x)] * mix / 5
    return out


def metal(freqs, dur, rate=6.0):
    return sum(osc(f, dur) * decay(dur, rate * (1 + i * 0.35)) / (1 + i * 0.4) for i, f in enumerate(freqs))


def place(base, sig, at):
    i = int(at * SR)
    end = min(len(base), i + len(sig))
    base[i:end] += sig[:end - i]
    return base


def norm(x, peak=0.89):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


# ------------------------------------------------------------------ recipes
SOUNDS = {}


def sound(name, category="player", volume=1.0, max_distance=32, pitch=1.0):
    def deco(fn):
        SOUNDS[name] = {"fn": fn, "category": category, "volume": volume,
                        "max_distance": max_distance, "pitch": pitch}
        return fn
    return deco


@sound("ring_activate", volume=0.9)
def s_ring_activate():
    d = 1.7
    out = np.zeros(int(d * SR))
    for i, f in enumerate((523.25, 659.25, 783.99, 1046.5)):
        tone = osc(f, d) * fade_in(d, 0.6) * decay(d, 1.2) * (1 + 0.3 * np.sin(2 * np.pi * 7 * t_axis(d)))
        out += tone * (0.5 - i * 0.07)
    wh = bandpass(noise(d), sweep(300, 6000, d), 2) * fade_in(d, 1.5) * decay(d, 2.0) * 0.6
    out += wh
    out = place(out, metal((2093, 2960, 3520), 0.9, 5) * 0.5, 0.75)
    return reverb(out, 0.3)


@sound("ring_equip", volume=0.7)
def s_ring_equip():
    d = 0.6
    out = np.zeros(int(d * SR))
    out = place(out, metal((783.99, 1567.98, 2351), 0.5, 7) * 0.6, 0.0)
    out = place(out, metal((1046.5, 2093, 3139), 0.45, 7) * 0.6, 0.12)
    return reverb(out, 0.25)


@sound("ring_low", volume=0.8, category="ui")
def s_ring_low():
    d = 0.6
    out = np.zeros(int(d * SR))
    b = 0.16
    out = place(out, lowpass(osc(880, b, "square"), 3000) * env(b, 0.005, 0.05, 0.6, 0.05) * 0.5, 0.0)
    out = place(out, lowpass(osc(698.46, b, "square"), 3000) * env(b, 0.005, 0.05, 0.6, 0.05) * 0.5, 0.22)
    return out


@sound("ring_empty", volume=0.9)
def s_ring_empty():
    d = 1.0
    f = sweep(900, 60, d)
    out = lowpass(osc(f, d, "saw"), sweep(4000, 200, d)) * decay(d, 2.5)
    crackle = (RNG.uniform(0, 1, len(out)) > 0.995) * RNG.uniform(-1, 1, len(out))
    out += lowpass(crackle, 3000) * 2 * decay(d, 3)
    return reverb(out, 0.2)


@sound("oath_success", volume=1.0, max_distance=48)
def s_oath_success():
    d = 3.8
    t = t_axis(d)
    out = np.zeros(len(t))
    drone = (osc(65.41, d, "saw") + osc(98.0, d, "saw") * 0.7)
    drone = lowpass(drone, sweep(150, 1800, d)) * fade_in(d, 1.2) * 0.6
    out += drone
    chord = sum(lowpass(osc(f * (1 + det), d, "saw"), 2400) for f in (261.63, 329.63, 392.0, 523.25)
                for det in (-0.003, 0.0, 0.004)) / 6
    out += chord * np.clip((t - 1.0) / 1.2, 0, 1) * np.where(t > 3.2, np.clip(1 - (t - 3.2) / 0.6, 0, 1), 1)
    boom_t = 2.2
    boom = osc(sweep(90, 30, 1.4), 1.4) * decay(1.4, 2.5) * 1.6 + lowpass(noise(1.4), 400) * decay(1.4, 4) * 1.2
    out = place(out, boom, boom_t)
    sparkle = np.zeros(len(t))
    for k in range(24):
        st = RNG.uniform(0.3, 3.4)
        f = RNG.choice([1046.5, 1318.5, 1568.0, 2093.0, 2637.0])
        sparkle = place(sparkle, osc(f, 0.25) * decay(0.25, 18) * 0.25, st)
    out += sparkle
    return reverb(out, 0.35, 0.6)


@sound("oath_fail", volume=0.85)
def s_oath_fail():
    d = 0.8
    f = sweep(220, 140, d)
    out = lowpass(osc(f, d, "saw") + osc(f * 1.06, d, "saw"), 1200) * env(d, 0.01, 0.2, 0.6, 0.3)
    return out * 0.6


@sound("menu_open", volume=0.6, category="ui")
def s_menu_open():
    d = 0.35
    out = osc(sweep(600, 1250, d), d) * env(d, 0.005, 0.1, 0.5, 0.2) * 0.6
    out += osc(sweep(1200, 2500, d), d) * env(d, 0.005, 0.1, 0.3, 0.2) * 0.2
    return reverb(out, 0.2)


@sound("menu_select", volume=0.6, category="ui")
def s_menu_select():
    d = 0.15
    out = osc(1500, d) * decay(d, 35) * 0.6 + lowpass(noise(d), 6000) * decay(d, 90) * 0.4
    return out


@sound("construct_form", volume=0.85)
def s_construct_form():
    d = 0.6
    out = bandpass(noise(d), sweep(400, 7000, d), 2) * fade_in(d, 2.2) * 0.9
    out += sum(osc(f, d) for f in (1318.5, 1975.5, 2637.0)) * fade_in(d, 3) * 0.12
    thoom = osc(sweep(140, 60, 0.25), 0.25) * decay(0.25, 14) * 0.9
    out = np.concatenate([out, np.zeros(int(0.2 * SR))])
    out = place(out, thoom, d - 0.05)
    return reverb(out, 0.2)


@sound("construct_dissipate", volume=0.7)
def s_construct_dissipate():
    d = 0.7
    out = osc(sweep(1600, 300, d), d) * decay(d, 5) * 0.3
    crackle = (RNG.uniform(0, 1, int(d * SR)) > 0.985) * RNG.uniform(-1, 1, int(d * SR))
    out += highpass(crackle, 1500) * decay(d, 4) * 1.2
    out += lowpass(noise(d), sweep(5000, 300, d)) * decay(d, 6) * 0.3
    return reverb(out, 0.25)


@sound("beam_fire", volume=0.75)
def s_beam_fire():
    d = 0.45
    f = sweep(2600, 260, d)
    mod = 1 + 0.15 * np.sin(2 * np.pi * 55 * t_axis(d))
    out = osc(f * mod, d, "saw") * decay(d, 9) * 0.5 + osc(f * 0.5, d) * decay(d, 7) * 0.4
    out += highpass(noise(d), 2000) * decay(d, 30) * 0.4
    return reverb(out, 0.15)


@sound("impact", volume=0.8)
def s_impact():
    d = 0.4
    out = osc(sweep(110, 40, d), d) * decay(d, 12) * 0.9 + lowpass(noise(d), 2500) * decay(d, 30) * 0.7
    return out


@sound("hammer_slam", volume=1.0, max_distance=48)
def s_hammer_slam():
    d = 1.3
    out = osc(sweep(70, 28, d), d) * decay(d, 3.5) * 1.2
    out += lowpass(noise(d), sweep(3000, 150, d)) * decay(d, 5) * 0.9
    out += metal((220, 371, 498, 777), d, 4) * 0.35
    return reverb(out, 0.3, 0.6)


@sound("blade_swing", volume=0.75)
def s_blade_swing():
    d = 0.35
    c = np.concatenate([sweep(300, 2600, d * 0.45), sweep(2600, 700, d * 0.55 + 1 / SR)])
    out = bandpass(noise(d), c[:int(d * SR)], 3) * np.sin(np.pi * t_axis(d) / d) * 1.4
    out += osc(sweep(3000, 1800, d), d) * np.sin(np.pi * t_axis(d) / d) * 0.08
    return out


@sound("cannon_fire", volume=0.8)
def s_cannon_fire():
    d = 0.3
    out = lowpass(osc(sweep(1300, 180, d), d, "square"), 3500) * decay(d, 12) * 0.5
    out += osc(sweep(120, 45, d), d) * decay(d, 14) * 0.7 + lowpass(noise(d), 3000) * decay(d, 35) * 0.5
    return out


@sound("missile_launch", volume=0.8)
def s_missile_launch():
    d = 0.7
    out = bandpass(noise(d), sweep(500, 4000, d), 2) * env(d, 0.05, 0.2, 0.7, 0.3) * 1.2
    out += osc(sweep(300, 900, d), d, "saw") * env(d, 0.02, 0.2, 0.4, 0.3) * 0.15
    return out


@sound("explosion", volume=1.0, max_distance=56)
def s_explosion():
    d = 1.4
    out = lowpass(noise(d), sweep(6000, 120, d)) * decay(d, 3.2) * 1.3
    out += osc(sweep(80, 25, d), d) * decay(d, 3) * 1.1
    crackle = (RNG.uniform(0, 1, int(d * SR)) > 0.992) * RNG.uniform(-1, 1, int(d * SR))
    out += highpass(crackle, 2000) * decay(d, 2) * 1.5
    return reverb(out, 0.3, 0.7)


@sound("shield_up", volume=0.8)
def s_shield_up():
    d = 0.8
    out = lowpass(osc(sweep(90, 220, d), d, "saw"), sweep(300, 2000, d)) * env(d, 0.05, 0.3, 0.6, 0.3) * 0.6
    out = place(out, metal((1567.98, 2349.3, 3136), 0.6, 6) * 0.35, 0.18)
    return reverb(out, 0.25)


@sound("shield_hit", volume=0.75)
def s_shield_hit():
    d = 0.4
    out = metal((1200, 1690, 2310, 3050), d, 9) * 0.5 + lowpass(noise(d), 4000) * decay(d, 40) * 0.4
    return reverb(out, 0.2)


@sound("charge", volume=0.85)
def s_charge():
    d = 1.6
    t = t_axis(d)
    f = sweep(180, 1700, d)
    trem = 1 + 0.5 * np.sin(2 * np.pi * (4 + 22 * t / d) * t)
    out = (osc(f, d, "saw") * 0.35 + osc(f * 2, d) * 0.2) * fade_in(d, 1.4) * trem
    crackle = (RNG.uniform(0, 1, len(t)) > 0.993) * RNG.uniform(-1, 1, len(t))
    out += highpass(crackle, 2500) * fade_in(d, 1) * 1.2
    return lowpass(out, 6000)


@sound("lance_fire", volume=1.0, max_distance=56)
def s_lance_fire():
    d = 1.5
    out = osc(sweep(3000, 200, d), d, "saw") * decay(d, 3) * 0.45
    out += lowpass(osc(55, d, "saw") + osc(82.4, d, "saw"), 900) * decay(d, 2.2) * 0.7
    out += lowpass(noise(d), sweep(8000, 400, d)) * decay(d, 2.6) * 0.8
    return reverb(out, 0.35, 0.6)


@sound("flight_start", volume=0.75)
def s_flight_start():
    d = 0.8
    out = bandpass(noise(d), sweep(250, 3500, d), 2) * env(d, 0.05, 0.3, 0.5, 0.35) * 1.4
    out += osc(sweep(220, 660, d), d) * env(d, 0.05, 0.3, 0.3, 0.3) * 0.2
    return reverb(out, 0.2)


@sound("flight_stop", volume=0.7)
def s_flight_stop():
    d = 0.55
    out = bandpass(noise(d), sweep(3000, 300, d), 2) * env(d, 0.02, 0.2, 0.4, 0.3) * 1.3
    return out


@sound("battery_charge", volume=0.9, max_distance=40)
def s_battery_charge():
    d = 2.3
    t = t_axis(d)
    base = sum(osc(f, d, "saw") / (i + 1) for i, f in enumerate((55, 110, 165, 220)))
    out = lowpass(base, sweep(120, 3000, d)) * fade_in(d, 0.8) * 0.5
    out *= np.where(t > 2.0, np.clip(1 - (t - 2.0) / 0.3, 0, 1), 1)
    for k in range(16):
        out = place(out, osc(RNG.choice([1318.5, 1568, 2093, 2637]), 0.2) * decay(0.2, 20) * 0.2, RNG.uniform(0.2, 2.0))
    out = place(out, metal((1046.5, 2093, 3139), 0.8, 5) * 0.6, 1.95)
    return reverb(out, 0.3, 0.5)


@sound("drone_fire", volume=0.55)
def s_drone_fire():
    d = 0.2
    return osc(sweep(1900, 600, d), d) * decay(d, 16) * 0.6 + highpass(noise(d), 3000) * decay(d, 60) * 0.2


@sound("colossus_rise", volume=1.0, max_distance=64)
def s_colossus_rise():
    d = 2.2
    out = lowpass(noise(d), sweep(100, 900, d)) * fade_in(d, 1.2) * 1.4
    out += lowpass(osc(sweep(40, 70, d), d, "saw") + osc(sweep(60, 105, d), d, "saw"), 700) * fade_in(d, 1.5) * 0.7
    return reverb(out, 0.35, 0.7)


@sound("colossus_slam", volume=1.0, max_distance=72)
def s_colossus_slam():
    d = 2.0
    out = osc(sweep(55, 20, d), d) * decay(d, 2.2) * 1.4
    out += lowpass(noise(d), sweep(2500, 80, d)) * decay(d, 2.6) * 1.2
    out += metal((150, 233, 341, 512), d, 2.5) * 0.4
    return reverb(out, 0.4, 0.8)


@sound("rank_up", volume=0.95, max_distance=40)
def s_rank_up():
    d = 2.3
    out = np.zeros(int(d * SR))
    notes = [(0.0, 523.25), (0.18, 659.25), (0.36, 783.99), (0.54, 1046.5)]
    for st, f in notes:
        ln = d - st
        tone = lowpass(osc(f, ln, "saw") + osc(f * 1.005, ln, "saw"), 2800) * env(ln, 0.02, 0.2, 0.55, 0.9) * 0.3
        out = place(out, tone, st)
    for k in range(18):
        out = place(out, osc(RNG.choice([2093, 2637, 3136]), 0.2) * decay(0.2, 22) * 0.15, RNG.uniform(0.5, 2.0))
    return reverb(out, 0.3, 0.5)


@sound("grapple_fire", volume=0.75)
def s_grapple_fire():
    d = 0.4
    out = osc(sweep(3200, 800, d), d) * decay(d, 12) * 0.4
    out += bandpass(noise(d), 2500, 2) * decay(d, 6) * 0.6
    return out


@sound("cage_lock", volume=0.8)
def s_cage_lock():
    d = 0.55
    out = np.zeros(int(d * SR))
    out = place(out, metal((523, 821, 1213), 0.4, 10) * 0.6, 0.0)
    out = place(out, metal((659, 1033, 1490), 0.4, 10) * 0.6, 0.12)
    out += lowpass(osc(110, d, "saw"), 600) * env(d, 0.05, 0.2, 0.5, 0.2) * 0.25
    return reverb(out, 0.2)


@sound("drill", volume=0.8)
def s_drill():
    d = 1.1
    t = t_axis(d)
    out = lowpass(osc(130, d, "saw") * (1 + 0.5 * np.sin(2 * np.pi * 30 * t)), 2500) * env(d, 0.05, 0.2, 0.8, 0.2) * 0.5
    out += bandpass(noise(d), 1800, 1.5) * env(d, 0.05, 0.2, 0.8, 0.2) * 0.7
    return out


@sound("bubble_pop", volume=0.75)
def s_bubble_pop():
    d = 0.4
    return osc(sweep(380, 1000, d), d) * decay(d, 14) * 0.7 + highpass(noise(d), 4000) * decay(d, 50) * 0.3


@sound("training_start", volume=0.85, category="ui")
def s_training_start():
    d = 0.9
    out = np.zeros(int(d * SR))
    out = place(out, lowpass(osc(587.33, 0.3, "saw"), 2000) * env(0.3, 0.01, 0.1, 0.6, 0.1) * 0.5, 0.0)
    out = place(out, lowpass(osc(880, 0.5, "saw"), 2400) * env(0.5, 0.01, 0.1, 0.6, 0.3) * 0.5, 0.32)
    return out


@sound("target_hit", volume=0.75)
def s_target_hit():
    d = 0.3
    return metal((1760, 2640, 3520), d, 12) * 0.6


def encode_ogg(sig, out_path):
    sig = np.clip(norm(sig), -1, 1)
    pcm = (sig * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    try:
        with wave.open(wav_path, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "libvorbis",
                        "-q:a", "4", "-map_metadata", "-1", out_path], check=True)
    finally:
        os.unlink(wav_path)
    WRITTEN.append(out_path)


def build(skip_audio=False):
    defs = {}
    for name, meta in SOUNDS.items():
        rel = f"sounds/glc/{name}"
        if not skip_audio or not os.path.exists(rp(rel + ".ogg")):
            encode_ogg(meta["fn"](), rp(rel + ".ogg"))
        else:
            WRITTEN.append(rp(rel + ".ogg"))
        defs[f"glc.{name}"] = {
            "category": meta["category"],
            "min_distance": 1.0,
            "max_distance": float(meta["max_distance"]),
            "sounds": [{"name": rel, "volume": meta["volume"], "pitch": meta["pitch"], "load_on_low_memory": True}],
        }
    write_json(rp("sounds", "sound_definitions.json"), {"format_version": "1.14.0", "sound_definitions": defs})
    return sorted(defs.keys())
