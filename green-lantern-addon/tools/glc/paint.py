"""Procedural texture painting helpers (PIL + numpy).

All artwork in the add-on is generated here from code: energy-construct faces,
metal parts, Lantern emblems and recolouring for other Corps.
"""
import colorsys
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Corps palettes: (core rgb, bright rim rgb, deep rgb, hue in degrees)
CORPS = {
    "green": {"core": (36, 220, 92), "rim": (190, 255, 200), "deep": (6, 74, 30), "hue": 135},
    "yellow": {"core": (255, 214, 40), "rim": (255, 250, 200), "deep": (90, 64, 4), "hue": 50},
}


def rgba(c, a=255):
    return (int(c[0]), int(c[1]), int(c[2]), int(a))


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def new(w, h, color=(0, 0, 0, 0)):
    return Image.new("RGBA", (w, h), color)


def _rect_px(rect):
    u, v, w, h = rect
    x0, y0 = int(round(u)), int(round(v))
    x1, y1 = int(round(u + w)), int(round(v + h))
    return x0, y0, x1, y1


def energy_face(img, rect, corps="green", seed=0, pattern="scan", rim=1, alpha=255,
                intensity=1.0, mode="glass"):
    """Hard-light face: bright rim, gradient towards the rim, faint scanlines.

    mode "glass": for additive materials (black = invisible, bright = glow).
    mode "solid": for entity_emissive_alpha cores - brighter interior and partial
    alpha everywhere (partial alpha == emissive, still opaque; alpha 0 == hole).
    """
    pal = CORPS[corps]
    x0, y0, x1, y1 = _rect_px(rect)
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    px = img.load()
    rnd = random.Random(seed)
    solid = mode == "solid"
    lo = mix(pal["deep"], pal["core"], 0.45) if solid else pal["deep"]
    for j in range(h):
        for i in range(w):
            dist = min(i, j, w - 1 - i, h - 1 - j)
            a = alpha
            if dist < rim:
                c = pal["rim"]
                a = 110 if solid else alpha
            elif dist < rim + 1:
                c = mix(pal["core"], pal["rim"], 0.35)
                a = 140 if solid else alpha
            elif dist < rim + 2:
                c = mix(lo, pal["core"], 0.75)
                a = 170 if solid else alpha
            else:
                t = (0.40 if solid else 0.30) + 0.10 * rnd.random()
                if pattern == "scan" and (j % 4 == 1):
                    t += 0.18
                elif pattern == "hex":
                    t += 0.25 * _hex_line(i, j)
                elif pattern == "diag" and ((i + j) % 6 == 0):
                    t += 0.22
                c = mix(lo, pal["core"], min(t, 1.0))
                a = 190 if solid else alpha
            c = tuple(min(255, int(ch * intensity)) for ch in c)
            px[x0 + i, y0 + j] = rgba(c, a)


def _hex_line(i, j, s=6):
    """1.0 on hexagon grid edges (approximation good enough for pixel art)."""
    row = j // s
    off = (s // 2) if row % 2 else 0
    ii = (i + off) % s
    jj = j % s
    return 1.0 if (jj == 0 or ii == 0) else 0.0


def solid_face(img, rect, base, edge=None, noise=10, seed=0, bevel=True):
    """Opaque face with subtle noise and a darker bevel edge."""
    x0, y0, x1, y1 = _rect_px(rect)
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    rnd = random.Random(seed)
    edge = edge or tuple(max(0, int(c * 0.6)) for c in base)
    px = img.load()
    for j in range(h):
        for i in range(w):
            n = rnd.randint(-noise, noise)
            c = tuple(max(0, min(255, base[k] + n)) for k in range(3))
            if bevel and (i == 0 or j == 0 or i == w - 1 or j == h - 1):
                c = edge
            elif bevel and (i == 1 or j == 1):
                c = tuple(min(255, int(ch * 1.12)) for ch in c)
            px[x0 + i, y0 + j] = rgba(c)


def fill(img, rect, color):
    x0, y0, x1, y1 = _rect_px(rect)
    if x1 > x0 and y1 > y0:
        ImageDraw.Draw(img).rectangle([x0, y0, x1 - 1, y1 - 1], fill=rgba(color) if len(color) == 3 else color)


def supersample_mask(w, h, fn, ss=4):
    """Anti-aliased mask from an implicit function fn(x, y) -> bool (in pixel units)."""
    ys, xs = np.mgrid[0:h * ss, 0:w * ss]
    xs = (xs + 0.5) / ss
    ys = (ys + 0.5) / ss
    m = fn(xs, ys).astype(float)
    m = m.reshape(h, ss, w, ss).mean(axis=(1, 3))
    return m


def emblem_mask(size, kind="green", ss=6):
    """Lantern Corps emblem as an anti-aliased mask (0..1) of size x size."""
    s = float(size)
    cx = cy = s / 2

    def green(x, y):
        r = np.hypot(x - cx, y - cy)
        ring = (r <= s * 0.30) & (r >= s * 0.17)
        bar_w = s * 0.40
        top = (np.abs(x - cx) <= bar_w) & (y >= s * 0.10) & (y <= s * 0.22)
        bot = (np.abs(x - cx) <= bar_w) & (y >= s * 0.78) & (y <= s * 0.90)
        # bars connect to the ring at the centre line
        stem_t = (np.abs(x - cx) <= s * 0.07) & (y >= s * 0.20) & (y <= s * 0.30)
        stem_b = (np.abs(x - cx) <= s * 0.07) & (y >= s * 0.70) & (y <= s * 0.80)
        return ring | top | bot | stem_t | stem_b

    def yellow(x, y):
        r = np.hypot(x - cx, y - cy)
        ring = (r <= s * 0.27) & (r >= s * 0.15)
        bot = (np.abs(x - cx) <= s * 0.30) & (y >= s * 0.80) & (y <= s * 0.90)
        # two fangs rising from the top bar
        top = (np.abs(x - cx) <= s * 0.42) & (y >= s * 0.14) & (y <= s * 0.24)
        fang_l = (y <= s * 0.14) & (y >= s * 0.02) & (np.abs(x - (cx - s * 0.30)) <= (s * 0.14 - (s * 0.14 - y) * 0.9))
        fang_r = (y <= s * 0.14) & (y >= s * 0.02) & (np.abs(x - (cx + s * 0.30)) <= (s * 0.14 - (s * 0.14 - y) * 0.9))
        stem = (np.abs(x - cx) <= s * 0.06) & (((y >= s * 0.22) & (y <= s * 0.33)) | ((y >= s * 0.67) & (y <= s * 0.81)))
        return ring | bot | top | fang_l | fang_r | stem

    def kyle(x, y):
        r = np.hypot(x - cx, y - cy)
        ring = (r <= s * 0.24) & (r >= s * 0.13)
        # wedge "wings" left/right forming the stylised mask emblem
        dy = np.abs(y - cy)
        wing = (dy <= (s * 0.16 - np.abs(x - cx) * 0.25)) & (np.abs(x - cx) >= s * 0.20) & (np.abs(x - cx) <= s * 0.48)
        cut = (dy <= s * 0.04) & (np.abs(x - cx) >= s * 0.24)
        top = (np.abs(x - cx) <= s * 0.10) & (y >= s * 0.08) & (y <= s * 0.25)
        bot = (np.abs(x - cx) <= s * 0.10) & (y >= s * 0.75) & (y <= s * 0.92)
        return ring | (wing & ~cut) | top | bot

    fn = {"green": green, "yellow": yellow, "kyle": kyle}[kind]
    return supersample_mask(size, size, fn, ss)


def stamp_mask(img, mask, x0, y0, color, alpha_scale=1.0, mode="over"):
    """Composite a 0..1 mask onto img at (x0, y0) with colour."""
    h, w = mask.shape
    px = img.load()
    W, H = img.size
    for j in range(h):
        for i in range(w):
            a = mask[j, i] * alpha_scale
            if a <= 0.02:
                continue
            X, Y = x0 + i, y0 + j
            if not (0 <= X < W and 0 <= Y < H):
                continue
            r, g, b, al = px[X, Y]
            if mode == "add":
                px[X, Y] = (min(255, int(r + color[0] * a)), min(255, int(g + color[1] * a)),
                            min(255, int(b + color[2] * a)), max(al, int(255 * min(1, a))))
            else:
                px[X, Y] = (int(r + (color[0] - r) * a), int(g + (color[1] - g) * a),
                            int(b + (color[2] - b) * a), max(al, int(255 * min(1.0, a + al / 255))))


def emblem_on_face(img, rect, kind="green", color=(235, 255, 235), bg=None, margin=0.12,
                   ring_bg=None):
    """Draw an emblem centered inside a face rectangle."""
    x0, y0, x1, y1 = _rect_px(rect)
    w, h = x1 - x0, y1 - y0
    size = int(min(w, h) * (1 - 2 * margin))
    if size < 5:
        return
    if bg is not None:
        cx, cy = x0 + w / 2, y0 + h / 2
        disc = supersample_mask(size, size, lambda x, y: np.hypot(x - size / 2, y - size / 2) <= size * 0.47)
        stamp_mask(img, disc, int(cx - size / 2), int(cy - size / 2), bg)
    m = emblem_mask(size, kind)
    stamp_mask(img, m, int(x0 + (w - size) / 2), int(y0 + (h - size) / 2), color)


def recolor_hue(img, target_hue, src_hue=135, sat_scale=1.0, val_scale=1.0):
    """Rotate hues of an RGBA image (keeps alpha) e.g. green -> yellow."""
    arr = np.asarray(img.convert("RGBA")).astype(float) / 255.0
    out = arr.copy()
    shift = ((target_hue - src_hue) % 360) / 360.0
    flat = arr.reshape(-1, 4)
    res = out.reshape(-1, 4)
    for k in range(flat.shape[0]):
        r, g, b, a = flat[k]
        if a == 0 and r == 0 and g == 0 and b == 0:
            continue
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        h = (h + shift) % 1.0
        s = min(1.0, s * sat_scale)
        v = min(1.0, v * val_scale)
        res[k, :3] = colorsys.hsv_to_rgb(h, s, v)
    return Image.fromarray((out * 255).astype(np.uint8), "RGBA")


def glow_blob(size, color=(255, 255, 255), falloff=2.2, core=0.0):
    """Radial soft glow (white for particle tinting)."""
    s = size
    ys, xs = np.mgrid[0:s, 0:s]
    r = np.hypot(xs + 0.5 - s / 2, ys + 0.5 - s / 2) / (s / 2)
    a = np.clip(1 - r, 0, 1) ** falloff
    if core:
        a = np.maximum(a, (r < core).astype(float))
    arr = np.zeros((s, s, 4))
    arr[..., 0], arr[..., 1], arr[..., 2] = color
    arr[..., 3] = a * 255
    rgb = arr[..., :3] * a[..., None]
    arr[..., :3] = rgb
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def ring_blob(size, inner=0.70, outer=0.92, soft=0.10):
    s = size
    ys, xs = np.mgrid[0:s, 0:s]
    r = np.hypot(xs + 0.5 - s / 2, ys + 0.5 - s / 2) / (s / 2)
    a = np.clip(1 - np.abs(r - (inner + outer) / 2) / ((outer - inner) / 2 + soft), 0, 1) ** 1.6
    arr = np.zeros((s, s, 4))
    arr[..., :3] = 255 * a[..., None]
    arr[..., 3] = 255 * a
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def seamless_streaks(size=64, corps="green", seed=7):
    """Tileable energy shimmer used by the scrolling (uv_anim) overlay pass."""
    pal = CORPS[corps]
    ys, xs = np.mgrid[0:size, 0:size].astype(float)
    t = 2 * math.pi / size
    v = (np.sin((xs + ys) * t * 2) ** 16) * 0.8
    v += (np.sin((xs * 3 - ys) * t) ** 24) * 0.5
    v += (np.sin(ys * t * 4 + np.sin(xs * t) * 2) ** 30) * 0.35
    rnd = np.random.RandomState(seed)
    for _ in range(size // 3):
        x, y = rnd.randint(0, size, 2)
        v[y % size, x % size] += 0.9
    v = np.clip(v, 0, 1)
    arr = np.zeros((size, size, 4))
    rim = np.array(pal["rim"], dtype=float)
    core = np.array(pal["core"], dtype=float)
    col = core[None, None, :] * v[..., None] + (rim - core)[None, None, :] * (v[..., None] ** 3)
    arr[..., :3] = np.clip(col, 0, 255)
    arr[..., 3] = 255
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def paint_geometry(geo, img, corps="green", default=None):
    """Paint every cube according to its .paint spec.

    paint spec keys: style ("energy"|"solid"|"none"), pattern, base, edge, rim,
    intensity, faces: {face: spec override}, emblem: {face: kind}.
    """
    default = default or {"style": "energy"}
    for idx, c in enumerate(geo.cubes()):
        spec = dict(default)
        spec.update(c.paint or {})
        rects = c.face_rects()
        for fname, rect in rects.items():
            fs = dict(spec)
            fs.update((spec.get("faces") or {}).get(fname, {}))
            style = fs.get("style", "energy")
            seed = idx * 7 + hash(fname) % 97
            if style == "energy":
                energy_face(img, rect, corps=fs.get("corps", corps), seed=seed,
                            pattern=fs.get("pattern", "scan"), rim=fs.get("rim", 1),
                            intensity=fs.get("intensity", 1.0), mode=fs.get("mode", "solid"))
            elif style == "solid":
                solid_face(img, rect, fs.get("base", (60, 64, 70)), fs.get("edge"),
                           noise=fs.get("noise", 8), seed=seed, bevel=fs.get("bevel", True))
            elif style == "flat":
                fill(img, rect, fs.get("base", (255, 255, 255)))
            emb = (spec.get("emblem") or {}).get(fname)
            if emb:
                kind = emb if isinstance(emb, str) else emb.get("kind", "green")
                ecol = (255, 255, 255) if isinstance(emb, str) else emb.get("color", (255, 255, 255))
                emblem_on_face(img, rect, kind=kind, color=ecol)
    return img
