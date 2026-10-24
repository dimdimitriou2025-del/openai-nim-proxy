"""2D artwork: item icons, menu icons, HUD glyphs, particle textures, pack icons."""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from glc import paint, render
from glc.geo import glow_shell

GREEN = (60, 235, 110)
BRIGHT = (200, 255, 210)
DARK = (8, 40, 20)


# ------------------------------------------------------------------ helpers
def neon(draw_fn, size=64, color=GREEN, core=BRIGHT, glow=0.9, ss=4):
    """Draw white shapes with draw_fn(ImageDraw, scale) then turn them into a neon icon."""
    big = Image.new("L", (size * ss, size * ss), 0)
    draw_fn(ImageDraw.Draw(big), ss)
    mask = big.resize((size, size), Image.LANCZOS)
    m = np.asarray(mask).astype(float) / 255.0
    blur = np.asarray(mask.filter(ImageFilter.GaussianBlur(size / 18))).astype(float) / 255.0
    a_glow = np.clip(blur * 1.6 * glow, 0, 1)
    col = np.array(color, float)
    core_col = np.array(core, float) * 0.55 + col * 0.45
    rgb = col[None, None, :] * (1 - m[..., None]) + core_col[None, None, :] * m[..., None]
    alpha = np.clip(np.maximum(m, a_glow * 0.85), 0, 1)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255])
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def model_icon(geo, tex, size=64, yaw=150, pitch=24, style="solid", pose=None, zoom=1.0):
    """Render a construct model into a transparent icon with a soft glow."""
    if style == "solid":
        core = render.render(geo, tex, size=size * 2, yaw=yaw, pitch=pitch, pose=pose,
                             material_of=lambda b: "emissive", transparent=True, extra_scale=zoom)
        shell = render.render(glow_shell(geo), paint.seamless_streaks(64).resize((geo.tex_w, geo.tex_h)),
                              size=size * 2, yaw=yaw, pitch=pitch, pose=pose, extra_scale=zoom,
                              material_of=lambda b: "additive", transparent=True)
        base = Image.new("RGBA", core.size, (0, 0, 0, 0))
        base.alpha_composite(shell)
        base.alpha_composite(core)
    else:
        base = render.render(geo, tex, size=size * 2, yaw=yaw, pitch=pitch, pose=pose, extra_scale=zoom,
                             material_of=lambda b: "additive", transparent=True)
    img = base.resize((size, size), Image.LANCZOS)
    return with_glow(img)


def with_glow(img, color=GREEN, strength=0.7):
    a = img.split()[3]
    blur = a.filter(ImageFilter.GaussianBlur(img.size[0] / 16))
    glow = Image.new("RGBA", img.size, (*color, 0))
    glow.putalpha(blur.point(lambda v: int(v * strength)))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(img)
    return out


def compose(*layers, size=64):
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for layer, (x, y) in layers:
        out.alpha_composite(layer, (int(x), int(y)))
    return out


def emblem_icon(size=64, kind="green", color=GREEN):
    m = paint.emblem_mask(int(size * 0.8), kind)
    big = Image.new("L", (size, size), 0)
    arr = (m * 255).astype(np.uint8)
    big.paste(Image.fromarray(arr, "L"), (int(size * 0.1), int(size * 0.1)))
    def draw(d, ss):
        d.bitmap((0, 0), big.resize((size * ss, size * ss), Image.LANCZOS), fill=255)
    return neon(draw, size, color)


# ------------------------------------------------------------------ particles
def particle_textures():
    tex = {
        "glow": paint.glow_blob(32, falloff=1.8, core=0.12),
        "spark": paint.glow_blob(16, falloff=2.6, core=0.18),
        "ring": paint.ring_blob(64, 0.78, 0.94, 0.06),
    }
    # emblem: white emblem with soft halo (tinted by the particle colour)
    m = paint.emblem_mask(52, "green")
    em = Image.new("L", (64, 64), 0)
    em.paste(Image.fromarray((m * 255).astype(np.uint8), "L"), (6, 6))
    halo = em.filter(ImageFilter.GaussianBlur(3))
    a = np.maximum(np.asarray(em, float), np.asarray(halo, float) * 0.8)
    arr = np.zeros((64, 64, 4), np.uint8)
    arr[..., :3] = 255
    arr[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
    tex["emblem"] = Image.fromarray(arr, "RGBA")
    # hexagon outline
    hx = Image.new("L", (128, 128), 0)
    d = ImageDraw.Draw(hx)
    pts = [(64 + 54 * math.cos(math.radians(60 * k + 30)), 64 + 54 * math.sin(math.radians(60 * k + 30))) for k in range(6)]
    d.polygon(pts, outline=255, width=10)
    d.polygon([(64 + (x - 64) * 0.55, 64 + (y - 64) * 0.55) for x, y in pts], outline=140, width=6)
    hx = hx.resize((32, 32), Image.LANCZOS)
    hb = hx.filter(ImageFilter.GaussianBlur(1.2))
    a = np.maximum(np.asarray(hx, float), np.asarray(hb, float))
    arr = np.zeros((32, 32, 4), np.uint8)
    arr[..., :3] = 255
    arr[..., 3] = np.clip(a, 0, 255).astype(np.uint8)
    tex["hex"] = Image.fromarray(arr, "RGBA")
    # vertical streak
    st = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = max(0.0, 1 - abs(x - 7.5) / 3.0) * (1 - abs(y - 7.5) / 8.5)
            st[y, x] = (255, 255, 255, int(255 * max(0, v) ** 1.2))
    tex["streak"] = Image.fromarray(st, "RGBA")
    return tex


# ------------------------------------------------------------------ blocks
def hardlight_texture(corps="green"):
    pal = paint.CORPS[corps]
    img = Image.new("RGBA", (16, 16))
    px = img.load()
    for y in range(16):
        for x in range(16):
            dist = min(x, y, 15 - x, 15 - y)
            if dist == 0:
                c, a = pal["rim"], 235
            elif dist == 1:
                c, a = paint.mix(pal["core"], pal["rim"], 0.4), 170
            else:
                t = 0.35 + (0.2 if (x + y) % 5 == 0 else 0) + (0.1 if y % 4 == 2 else 0)
                c, a = paint.mix(pal["deep"], pal["core"], t), 96
            px[x, y] = (*c, a)
    return img


# ------------------------------------------------------------------ item icons
def power_ring_icon():
    S = 32
    ss = 8
    big = Image.new("RGBA", (S * ss, S * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    cx, cy = 16 * ss, 21 * ss
    # band (back)
    d.ellipse([cx - 11 * ss, cy - 7 * ss, cx + 11 * ss, cy + 7 * ss], fill=(10, 60, 28, 255))
    d.ellipse([cx - 10 * ss, cy - 6 * ss, cx + 10 * ss, cy + 6 * ss], fill=(40, 190, 85, 255))
    d.ellipse([cx - 8 * ss, cy - 4.5 * ss, cx + 8 * ss, cy + 4.5 * ss], fill=(10, 60, 28, 255))
    d.ellipse([cx - 7 * ss, cy - 3.5 * ss, cx + 7 * ss, cy + 3.5 * ss], fill=(0, 0, 0, 0))
    # band highlight
    d.arc([cx - 10 * ss, cy - 6 * ss, cx + 10 * ss, cy + 6 * ss], 200, 330, fill=(170, 255, 190, 255), width=ss)
    # bezel
    bx, by = 16 * ss, 11 * ss
    d.ellipse([bx - 8 * ss, by - 8 * ss, bx + 8 * ss, by + 8 * ss], fill=(8, 50, 24, 255))
    d.ellipse([bx - 7 * ss, by - 7 * ss, bx + 7 * ss, by + 7 * ss], fill=(36, 200, 90, 255))
    d.ellipse([bx - 5.5 * ss, by - 5.5 * ss, bx + 5.5 * ss, by + 5.5 * ss], fill=(16, 120, 56, 255))
    img = big.resize((S, S), Image.LANCZOS)
    m = paint.emblem_mask(11, "green")
    paint.stamp_mask(img, m, 16 - 5, 11 - 5, (235, 255, 235))
    px = img.load()
    for x, y in ((11, 6), (12, 5), (13, 5)):
        px[x, y] = (230, 255, 235, 255)
    return with_glow(img, strength=0.55)


def lantern_icon(size=32, corps="green"):
    pal = paint.CORPS[corps]
    S = size
    ss = 8
    k = S / 32
    big = Image.new("RGBA", (S * ss, S * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)

    def R(x0, y0, x1, y1, c):
        d.rectangle([x0 * k * ss, y0 * k * ss, x1 * k * ss - 1, y1 * k * ss - 1], fill=c)
    metal, dark = (52, 70, 62, 255), (24, 32, 30, 255)
    R(9, 1, 11, 6, metal); R(21, 1, 23, 6, metal); R(9, 1, 23, 3, metal)          # handle
    R(5, 6, 27, 9, metal); R(7, 9, 25, 10, (*pal["rim"], 255))                   # cap + trim
    R(10, 10, 22, 25, (*pal["core"], 255))                                       # core
    R(7, 10, 10, 25, dark); R(22, 10, 25, 25, dark)                              # posts
    R(7, 25, 25, 26, (*pal["rim"], 255)); R(5, 26, 27, 30, metal); R(5, 30, 27, 31, dark)
    img = big.resize((S, S), Image.LANCZOS)
    m = paint.emblem_mask(int(10 * k), corps if corps == "green" else "yellow")
    paint.stamp_mask(img, m, int(11 * k), int(12 * k), (240, 255, 240))
    return with_glow(img, color=pal["core"], strength=0.6)


def book_icon(size=32):
    S, ss = size, 8
    big = Image.new("RGBA", (S * ss, S * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    d.rounded_rectangle([5 * ss, 3 * ss, 27 * ss, 29 * ss], 2 * ss, fill=(14, 70, 34, 255))
    d.rectangle([24 * ss, 4 * ss, 27 * ss, 28 * ss], fill=(236, 230, 200, 255))      # page edges
    d.rectangle([5 * ss, 3 * ss, 8 * ss, 29 * ss], fill=(8, 44, 22, 255))            # spine
    d.rounded_rectangle([9 * ss, 6 * ss, 23 * ss, 26 * ss], ss, outline=(90, 230, 120, 255), width=ss)
    img = big.resize((S, S), Image.LANCZOS)
    m = paint.emblem_mask(12, "green")
    paint.stamp_mask(img, m, 10, 10, (190, 255, 200))
    return img


def suit_icon(char_tex, size=32):
    """Uniform icon assembled from the character texture (torso + arms front)."""
    body = char_tex.crop((20, 20, 28, 32))
    rarm = char_tex.crop((44, 20, 48, 32))
    larm = char_tex.crop((36, 52, 40, 64))
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.alpha_composite(body.resize((16, 24), Image.NEAREST), (8, 4))
    img.alpha_composite(rarm.resize((6, 22), Image.NEAREST), (2, 5))
    img.alpha_composite(larm.resize((6, 22), Image.NEAREST), (24, 5))
    return with_glow(img, strength=0.35)


# ------------------------------------------------------------------ menu icons
def _line(d, ss, pts, w):
    d.line([(x * ss, y * ss) for x, y in pts], fill=255, width=int(w * ss), joint="curve")


def icon_beam():
    def f(d, ss):
        _line(d, ss, [(10, 54), (52, 12)], 5)
        d.ellipse([4 * ss, 48 * ss, 16 * ss, 60 * ss], outline=255, width=3 * ss)
        for a in range(0, 360, 45):
            x, y = 52 + math.cos(math.radians(a)) * 9, 12 + math.sin(math.radians(a)) * 9
            _line(d, ss, [(52, 12), (x, y)], 2.2)
    return neon(f)


def icon_lance():
    def f(d, ss):
        _line(d, ss, [(14, 50), (58, 6)], 11)
        d.ellipse([2 * ss, 38 * ss, 26 * ss, 62 * ss], fill=255)
    return neon(f, glow=1.2)


def icon_wall():
    def f(d, ss):
        for r in range(3):
            for c in range(5):
                x0, y0 = 4 + c * 11.5, 16 + r * 12
                d.rectangle([x0 * ss, y0 * ss, (x0 + 10) * ss, (y0 + 10) * ss], outline=255, width=2 * ss)
    return neon(f)


def icon_platform():
    def f(d, ss):
        cx, cy = 32, 36
        for i in range(-1, 2):
            for j in range(-1, 2):
                x, y = cx + (i - j) * 10, cy + (i + j) * 5.5
                pts = [(x, y - 5.5), (x + 10, y), (x, y + 5.5), (x - 10, y)]
                d.polygon([(px * ss, py * ss) for px, py in pts], outline=255, width=2 * ss)
        _line(d, ss, [(32, 6), (32, 20)], 3)
        d.polygon([(26 * ss, 16 * ss), (38 * ss, 16 * ss), (32 * ss, 24 * ss)], fill=255)
    return neon(f)


def icon_bridge():
    def f(d, ss):
        for k in range(6):
            x0 = 4 + k * 10
            y0 = 48 - k * 6
            d.rectangle([x0 * ss, y0 * ss, (x0 + 9) * ss, (y0 + 7) * ss], outline=255, width=2 * ss)
    return neon(f)


def icon_flight():
    def f(d, ss):
        d.polygon([(32 * ss, 4 * ss), (48 * ss, 30 * ss), (36 * ss, 26 * ss), (36 * ss, 50 * ss),
                   (28 * ss, 50 * ss), (28 * ss, 26 * ss), (16 * ss, 30 * ss)], fill=255)
        for x in (18, 32, 46):
            _line(d, ss, [(x, 54), (x, 62)], 2)
    return neon(f)


def icon_gear():
    def f(d, ss):
        cx = cy = 32
        for k in range(8):
            a = math.radians(k * 45)
            x, y = cx + math.cos(a) * 22, cy + math.sin(a) * 22
            d.ellipse([(x - 6) * ss, (y - 6) * ss, (x + 6) * ss, (y + 6) * ss], fill=255)
        d.ellipse([(cx - 20) * ss, (cy - 20) * ss, (cx + 20) * ss, (cy + 20) * ss], fill=255)
        d.ellipse([(cx - 8) * ss, (cy - 8) * ss, (cx + 8) * ss, (cy + 8) * ss], fill=0)
    return neon(f)


def icon_power():
    def f(d, ss):
        d.arc([10 * ss, 12 * ss, 54 * ss, 56 * ss], -60, 240, fill=255, width=6 * ss)
        _line(d, ss, [(32, 6), (32, 32)], 6)
    return neon(f)


def icon_scroll():
    def f(d, ss):
        d.rounded_rectangle([12 * ss, 8 * ss, 52 * ss, 56 * ss], 4 * ss, outline=255, width=3 * ss)
        for y in (20, 28, 36, 44):
            _line(d, ss, [(20, y), (44, y)], 2.5)
        d.ellipse([6 * ss, 2 * ss, 20 * ss, 14 * ss], outline=255, width=3 * ss)
        d.ellipse([44 * ss, 50 * ss, 58 * ss, 62 * ss], outline=255, width=3 * ss)
    return neon(f)


def icon_status():
    def f(d, ss):
        for k, h in enumerate((14, 26, 38, 50)):
            x0 = 8 + k * 13
            d.rectangle([x0 * ss, (58 - h) * ss, (x0 + 9) * ss, 58 * ss], fill=255)
    return neon(f)


def icon_back():
    def f(d, ss):
        d.polygon([(8 * ss, 32 * ss), (30 * ss, 12 * ss), (30 * ss, 24 * ss), (56 * ss, 24 * ss),
                   (56 * ss, 40 * ss), (30 * ss, 40 * ss), (30 * ss, 52 * ss)], fill=255)
    return neon(f)


def icon_lock():
    def f(d, ss):
        d.rounded_rectangle([12 * ss, 28 * ss, 52 * ss, 58 * ss], 4 * ss, fill=255)
        d.arc([18 * ss, 6 * ss, 46 * ss, 44 * ss], 180, 360, fill=255, width=6 * ss)
        d.ellipse([28 * ss, 36 * ss, 36 * ss, 44 * ss], fill=0)
    return neon(f, color=(120, 140, 130), core=(200, 210, 205), glow=0.4)


def icon_rank(n):
    def f(d, ss):
        for k in range(n):
            y = 50 - k * 9
            d.line([(12 * ss, y * ss), (32 * ss, (y - 10) * ss), (52 * ss, y * ss)], fill=255, width=5 * ss)
    return neon(f, color=(255, 214, 80) if n == 5 else GREEN)


def icon_wrench():
    def f(d, ss):
        _line(d, ss, [(14, 52), (40, 26)], 8)
        d.ellipse([34 * ss, 8 * ss, 58 * ss, 32 * ss], outline=255, width=6 * ss)
    return neon(f)


def icon_people(portraits):
    out = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    for k, p in enumerate(portraits[:3]):
        p2 = p.resize((30, 30), Image.LANCZOS)
        out.alpha_composite(p2, (2 + k * 16, 8 + (k % 2) * 18))
    return out


# ------------------------------------------------------------------ glyphs
GLYPH_BITMAPS = {
    # '#' = main colour, '+' = highlight; an outline is added automatically
    "emblem": ["................",
               "................",
               "...##########...",
               "...##########...",
               ".......##.......",
               ".....######.....",
               "....##....##....",
               "....#......#....",
               "....#......#....",
               "....##....##....",
               ".....######.....",
               ".......##.......",
               "...##########...",
               "...##########...",
               "................",
               "................"],
    "flight": ["................",
               ".......##.......",
               "......####......",
               ".....######.....",
               "....##.##.##....",
               "...##..##..##...",
               ".......##.......",
               ".......##.......",
               ".......##.......",
               ".......##.......",
               "....+..##..+....",
               "....+......+....",
               "....+..++..+....",
               ".......++.......",
               "................",
               "................"],
}


def _bitmap_glyph(rows, color, hi=(230, 255, 235), outline=(6, 30, 14)):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = img.load()
    pts = {(x, y): ch for y, row in enumerate(rows) for x, ch in enumerate(row) if ch != "."}
    for (x, y) in pts:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in pts and 0 <= q[0] < 16 and 0 <= q[1] < 16:
                px[q] = (*outline, 255)
    for (x, y), ch in pts.items():
        px[x, y] = (*(hi if ch == "+" else color), 255)
    return img


def _rank_glyph(n, color):
    rows = [["."] * 16 for _ in range(16)]
    for k in range(n):
        base = 13 - k * 3
        for x in range(2, 14):
            y = base - (6 - abs(x - 7.5)) // 2
            yy = int(y)
            if 0 <= yy < 16:
                rows[yy][x] = "#"
            if 0 <= yy + 1 < 16:
                rows[yy + 1][x] = "#"
    return _bitmap_glyph(["".join(r) for r in rows], color)


def glyph_sheet():
    """font/glyph_EC.png : 16x16 cells -> \\uEC00 + index."""
    sheet = Image.new("RGBA", (256, 256), (0, 0, 0, 0))

    def cell(idx, img):
        sheet.alpha_composite(img, ((idx % 16) * 16, (idx // 16) * 16))

    def seg(fill_frac, color, w=6):
        img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 4, w, 12], fill=(16, 30, 22, 255))
        if fill_frac > 0:
            h = round(7 * fill_frac)
            d.rectangle([1, 12 - h, w - 1, 11], fill=(*color, 255))
            d.line([(1, 12 - h), (w - 1, 12 - h)], fill=(220, 255, 225, 255))
        return img

    cell(0, _bitmap_glyph(GLYPH_BITMAPS["emblem"], (70, 235, 115)))
    cell(1, seg(1.0, (60, 230, 110)))
    cell(2, seg(0.75, (60, 230, 110)))
    cell(3, seg(0.5, (60, 230, 110)))
    cell(4, seg(0.25, (60, 230, 110)))
    cell(5, seg(0.0, (60, 230, 110)))
    cell(6, seg(1.0, (210, 255, 220)))
    cell(7, _bitmap_glyph(GLYPH_BITMAPS["flight"], (90, 240, 130)))
    bolt = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    ImageDraw.Draw(bolt).polygon([(9, 1), (3, 9), (7, 9), (5, 15), (13, 6), (9, 6), (11, 1)], fill=(120, 255, 150, 255))
    cell(8, bolt)
    hg = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    ImageDraw.Draw(hg).polygon([(3, 2), (12, 2), (8, 8), (12, 14), (3, 14), (7, 8)], outline=(200, 220, 210, 255))
    cell(9, hg)
    lock = ["................", "................", ".....######.....", "....#......#....", "....#......#....",
            "....#......#....", "...##########...", "...##########...", "...####++####...", "...####++####...",
            "...##########...", "...##########...", "................", "................", "................",
            "................"]
    cell(10, _bitmap_glyph(lock, (160, 170, 165)))
    cell(11, _bitmap_glyph(GLYPH_BITMAPS["emblem"], (255, 214, 60), hi=(255, 245, 200), outline=(40, 30, 0)))
    for n in range(1, 6):
        cell(15 + n, _rank_glyph(n, (255, 214, 80) if n == 5 else (80, 235, 120)))
    return sheet


GLYPH_INDEX = {"emblem": 0, "seg_full": 1, "seg_3q": 2, "seg_half": 3, "seg_1q": 4, "seg_empty": 5,
               "seg_over": 6, "flight": 7, "bolt": 8, "cooldown": 9, "lock": 10, "emblem_yellow": 11,
               "rank1": 16, "rank2": 17, "rank3": 18, "rank4": 19, "rank5": 20}


# ------------------------------------------------------------------ pack icons
def pack_icon(label):
    S = 256
    img = Image.new("RGBA", (S, S), (6, 14, 10, 255))
    arr = np.asarray(img).astype(float)
    ys, xs = np.mgrid[0:S, 0:S]
    r = np.hypot(xs - S / 2, ys - S / 2) / (S / 2)
    glow = np.clip(1 - r, 0, 1) ** 1.6
    arr[..., 0] += 20 * glow
    arr[..., 1] += 120 * glow
    arr[..., 2] += 50 * glow
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    em = emblem_icon(200)
    img.alpha_composite(em, (28, 22))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([4, 4, S - 5, S - 5], 24, outline=(70, 240, 120, 255), width=6)
    d.text((S - 44, S - 30), label, fill=(200, 255, 210, 255))
    return img
