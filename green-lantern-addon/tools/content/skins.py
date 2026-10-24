"""Pixel-art character textures (64x128): standard skin layout + extras.

The same texture is used by the Lantern NPC (geometry.glc.lantern) and by the
matching wearable suit (geometry.glc.suit).  Pixels with alpha 0 are hidden;
alpha ~120 marks glowing pixels for the entity_emissive_alpha material.
"""
from PIL import Image

from content.other_models import extras_layout

GLOW = 120  # alpha used for emissive pixels

# colour ramps
G = [(14, 104, 46), (26, 160, 70), (70, 214, 110), (150, 255, 175)]
K = [(12, 13, 16), (28, 30, 36), (50, 54, 62)]
W = [(186, 192, 198), (228, 232, 236), (255, 255, 255)]
Y = [(170, 120, 8), (230, 182, 26), (255, 226, 96)]

FACE_SHADE = {"front": 1.0, "back": 0.80, "right": 0.88, "left": 0.88, "top": 1.06, "bottom": 0.68}

# face rects (u, v, w, h) of each part in the standard 64x64 skin layout
def _box(u, v, w, h, d):
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
            "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
            "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h)}


PARTS = {
    "head": _box(0, 0, 8, 8, 8), "hat": _box(32, 0, 8, 8, 8),
    "body": _box(16, 16, 8, 12, 4), "jacket": _box(16, 32, 8, 12, 4),
    "rightArm": _box(40, 16, 4, 12, 4), "rightSleeve": _box(40, 32, 4, 12, 4),
    "leftArm": _box(32, 48, 4, 12, 4), "leftSleeve": _box(48, 48, 4, 12, 4),
    "rightLeg": _box(0, 16, 4, 12, 4), "rightPants": _box(0, 32, 4, 12, 4),
    "leftLeg": _box(16, 48, 4, 12, 4), "leftPants": _box(0, 48, 4, 12, 4),
}

# 6x6 chest emblem bitmaps: 1 = emblem colour, 0 = disc colour, . = transparent
EMBLEM_GL = [".0000.", "011110", "001100", "010010", "001100", ".1111."]
EMBLEM_SC = ["1....1", "011110", "001100", "010010", "001100", ".0110."]
EMBLEM_KR = [".0000.", "001100", "110011", "011110", "001100", ".0110."]


def shade(c, f):
    return tuple(max(0, min(255, int(ch * f))) for ch in c[:3])


class Painter:
    def __init__(self):
        self.img = Image.new("RGBA", (64, 128), (0, 0, 0, 0))
        self.px = self.img.load()

    def part(self, name, fn, shading=True):
        for face, (u, v, w, h) in PARTS[name].items():
            for j in range(h):
                for i in range(w):
                    c = fn(face, i, j, w, h)
                    if c is None:
                        continue
                    a = c[3] if len(c) == 4 else 255
                    rgb = shade(c, FACE_SHADE[face]) if shading else c[:3]
                    if face in ("front", "back", "right", "left") and h >= 8 and shading:
                        rgb = shade(rgb, 1.04 - 0.08 * (j / max(1, h - 1)))
                    self.px[u + i, v + j] = (*rgb, a)

    def rects(self, rect_list, fn):
        for rects in rect_list:
            for face, (u, v, w, h) in rects.items():
                u0, v0 = int(round(u)), int(round(v))
                w0, h0 = int(round(w)), int(round(h))
                for j in range(h0):
                    for i in range(w0):
                        c = fn(face, i, j, w0, h0)
                        if c is not None:
                            a = c[3] if len(c) == 4 else 255
                            self.px[u0 + i, v0 + j] = (*shade(c, FACE_SHADE.get(_canon(face), 1.0)), a)


def _canon(f):
    return {"north": "front", "south": "back", "east": "right", "west": "left", "up": "top", "down": "bottom"}.get(f, f)


class Lantern:
    """Base Lantern design; subclasses override palette and details."""
    skin = (234, 186, 148)
    skin2 = (212, 158, 122)
    hair = (96, 62, 36)
    hair_style = "short"
    eye = "white"          # "white" (mask lenses), "pupil", "glow"
    mask = "domino"        # None, "domino", "kyle", "uniform"
    mouth = (176, 110, 96)
    emblem = EMBLEM_GL
    emblem_fg = (40, 220, 110)
    emblem_bg = W[2]
    ring = G[3]
    show_head = True
    extras_on = ()         # e.g. ("bowl",)
    mustache = False

    # ----- palette hooks
    def torso(self, face, i, j, w, h):
        return G[1]

    def arm(self, side, face, i, j, w, h):
        return G[1]

    def leg(self, side, face, i, j, w, h):
        return G[1]

    # ----- head
    def head(self, face, i, j, w, h):
        if not self.show_head:
            return self.uniform_mask(face, i, j)
        s, s2, hc = self.skin, self.skin2, self.hair
        if face == "top":
            return hc
        if face == "bottom":
            return s2
        hr = self.hair_rows(face, i, j)
        if hr:
            return hc if hr is True else hr
        if face == "front":
            m = self.mask_px(i, j)
            if m:
                return m
            if j == 4 and self.eye == "pupil" and i in (1, 2, 5, 6):
                return W[2] if i in (1, 6) else K[0]
            if j == 4 and self.eye == "glow" and i in (1, 2, 5, 6):
                return (*G[3], GLOW)
            if j == 3 and self.eye in ("pupil", "glow") and i in (1, 2, 5, 6):
                return shade(hc, 0.9)
            if self.mustache and j == 5 and 2 <= i <= 5:
                return K[0]
            if j == 5 and i in (3, 4):
                return s2
            if j == 6 and i in (3, 4):
                return self.mouth
            if j == 7:
                return s2
            return s
        if face in ("right", "left"):
            front_edge = 7 if face == "right" else 0
            if self.mask and j in (3, 4) and abs(i - front_edge) <= 1:
                return G[1] if self.mask != "kyle" else G[2]
            if j in (4, 5) and i in (3, 4):
                return s2
            return s
        if face == "back":
            return s
        return s

    def hair_rows(self, face, i, j):
        st = self.hair_style
        if face == "front":
            if st == "short":
                return j == 0 or (j == 1 and i in (0, 1, 6, 7)) or (j == 1 and i == 5)
            if st == "flat":
                return j == 0 and 1 <= i <= 6
            if st == "bowl":
                return j <= 1
            if st == "spiky":
                return j == 0 or (j == 1 and i in (0, 2, 5, 7))
            if st == "widow":
                return j == 0 and i in (0, 3, 4, 7)  # peak tip; forehead continues on the brow extra
        if face in ("right", "left"):
            back_half = (i <= 3) if face == "right" else (i >= 4)
            lim = {"short": 2, "flat": 1, "bowl": 4, "spiky": 2, "widow": 2}[st]
            return j < lim or (j == lim and back_half)
        if face == "back":
            lim = {"short": 5, "flat": 3, "bowl": 6, "spiky": 5, "widow": 4}[st]
            return j < lim or (st == "spiky" and j == lim and i % 2 == 0)
        return False

    def mask_px(self, i, j):
        if self.mask == "domino":
            if j == 3:
                return G[1]
            if j == 4:
                return (*W[2], GLOW) if i in (1, 2, 5, 6) else G[1]
        if self.mask == "kyle":
            if j == 2 and 2 <= i <= 5:
                return G[2]
            if j == 3:
                return G[1]
            if j == 4:
                return (*W[2], GLOW) if i in (1, 2, 5, 6) else G[1]
            if j == 5 and i in (0, 1, 6, 7):
                return G[1]
        return None

    def uniform_mask(self, face, i, j):
        """Generic uniform: only a domino mask; eye holes stay transparent."""
        if face == "front":
            if j == 3:
                return G[1]
            if j == 4 and i not in (1, 2, 5, 6):
                return G[1]
        if face in ("right", "left"):
            front_edge = 7 if face == "right" else 0
            if j in (3, 4) and abs(i - front_edge) <= 1:
                return G[1]
        return None

    def hat(self, face, i, j, w, h):
        if not self.show_head or self.hair_style in ("flat", "bowl", "widow"):
            return None
        hc = shade(self.hair, 1.08)
        if face == "top":
            return hc if (i + j) % 3 else None
        if face == "front":
            return hc if j == 0 and i % 2 == 0 else None
        if face == "back":
            return hc if j <= 2 else None
        if face in ("right", "left"):
            return hc if j == 0 else None
        return None

    # ----- extras
    def extra(self, slot, face, i, j, w, h):
        if slot == "ring":
            return (*self.ring, GLOW)
        if slot == "emblem":
            if _canon(face) == "front" and w >= 6 and h >= 6:
                ch = self.emblem[j][i] if j < 6 and i < 6 else "."
                if ch == "1":
                    return (*self.emblem_fg, GLOW)
                if ch == "0":
                    return (*self.emblem_bg, 200)
                return None
            return self.emblem_bg
        if slot in self.extras_on:
            return self.extra_color(slot, face, i, j)
        return None

    def extra_color(self, slot, face, i, j):
        return self.hair

    # ----- assemble
    def paint(self):
        p = Painter()
        p.part("head", self.head)
        p.part("hat", self.hat)
        p.part("body", self.torso)
        p.part("rightArm", lambda f, i, j, w, h: self.arm("right", f, i, j, w, h))
        p.part("leftArm", lambda f, i, j, w, h: self.arm("left", f, i, j, w, h))
        p.part("rightLeg", lambda f, i, j, w, h: self.leg("right", f, i, j, w, h))
        p.part("leftLeg", lambda f, i, j, w, h: self.leg("left", f, i, j, w, h))
        # chest emblem painted on the skin too (hidden behind the 3D badge)
        u, v, w, h = PARTS["body"]["front"]
        for jj, row in enumerate(self.emblem):
            for ii, ch in enumerate(row):
                if ch == "1":
                    p.px[u + 1 + ii, v + 3 + jj] = (*self.emblem_fg, 255)
                elif ch == "0":
                    p.px[u + 1 + ii, v + 3 + jj] = (*self.emblem_bg, 255)
        lay = extras_layout()
        for slot, rects in lay.items():
            p.rects(rects, lambda f, i, j, w, h, s=slot: self.extra(s, f, i, j, w, h))
        return p.img


def _outer(side, face):
    return (side == "right" and face == "right") or (side == "left" and face == "left")


def _inner(side, face):
    return (side == "right" and face == "left") or (side == "left" and face == "right")


class Hal(Lantern):
    hair_style = "short"

    def torso(self, face, i, j, w, h):
        if face in ("right", "left"):
            return K[1]
        if face == "top":
            return K[1] if i <= 1 or i >= 6 else G[1]
        if face == "bottom":
            return G[0]
        if j <= 1 and (i <= 1 or i >= 6):
            return K[1]
        if face == "front" and j == 0 and 2 <= i <= 5:
            return G[0]
        return G[0] if j >= 10 else G[1]

    def arm(self, side, face, i, j, w, h):
        if face == "top":
            return K[1]
        if face == "bottom":
            return W[1]
        if j <= 5:
            return K[1]
        if j <= 8:
            return G[1]
        return W[0] if j == 11 else W[1]

    def leg(self, side, face, i, j, w, h):
        if face == "bottom":
            return G[0]
        if face == "top":
            return G[1]
        if j == 8:
            return G[2]
        if j > 8:
            return G[0]
        if _outer(side, face):
            return K[1]
        return G[1]


class John(Lantern):
    skin = (122, 82, 56)
    skin2 = (102, 66, 44)
    hair = (16, 14, 14)
    hair_style = "flat"
    eye = "glow"
    mask = None
    mouth = (86, 52, 40)
    emblem_fg = (60, 230, 120)
    emblem_bg = K[0]
    extras_on = ("flattop",)

    def torso(self, face, i, j, w, h):
        if face == "top":
            return G[1]
        if face == "bottom":
            return K[1]
        if face == "front" and j <= 6 and abs(i - 3.5) <= 4 - j * 0.55:
            return G[1] if j > 0 else G[2]
        if face == "back" and j <= 2 and abs(i - 3.5) <= 4 - j * 1.2:
            return G[1]
        return K[1]

    def arm(self, side, face, i, j, w, h):
        if face == "top":
            return G[1]
        if face == "bottom":
            return G[1]
        if j <= 1:
            return G[1]
        if j == 9:
            return G[2]
        if j >= 10:
            return G[1]
        return K[1]

    def leg(self, side, face, i, j, w, h):
        if face == "bottom":
            return G[0]
        if j == 8:
            return G[2]
        if j > 8:
            return G[1]
        return K[1]

    def extra_color(self, slot, face, i, j):
        return self.hair if _canon(face) == "top" else shade(self.hair, 1.3)


class Guy(Lantern):
    skin = (242, 198, 162)
    skin2 = (220, 170, 134)
    hair = (204, 78, 34)
    hair_style = "bowl"
    mouth = (178, 104, 90)
    extras_on = ("bowl",)

    def head(self, face, i, j, w, h):
        c = super().head(face, i, j, w, h)
        if face == "front" and j == 6 and i in (3, 4):
            return self.skin2
        if face == "front" and ((j == 6 and i in (4, 5)) or (j == 5 and i == 6)):
            return self.mouth  # smirk
        return c

    def torso(self, face, i, j, w, h):
        if face in ("right", "left", "back"):
            return K[1] if not (face == "back" and j <= 1) else K[2]
        if face == "top":
            return K[2]
        if face == "bottom":
            return K[1]
        if j <= 1 and 1 <= i <= 6:
            return K[2] if j == 0 else G[0]  # high collar
        if i <= 1 or i >= 6:
            return K[1]  # open jacket
        return G[1]

    def arm(self, side, face, i, j, w, h):
        if face == "bottom":
            return G[1]
        if face == "top":
            return K[2]
        if j >= 9:
            return G[2] if j == 9 else G[1]
        return K[1]

    def leg(self, side, face, i, j, w, h):
        if face == "bottom":
            return G[0]
        if j >= 8:
            return G[2] if j == 8 else G[1]
        return K[1]

    def extra_color(self, slot, face, i, j):
        f = _canon(face)
        if f == "top":
            return self.hair
        if f == "bottom":
            return None
        return shade(self.hair, 0.92 if j % 2 else 1.0)


class Kyle(Lantern):
    skin = (236, 190, 156)
    skin2 = (214, 162, 128)
    hair = (20, 18, 22)
    hair_style = "spiky"
    mask = "kyle"
    emblem = EMBLEM_KR
    emblem_fg = (70, 235, 120)
    emblem_bg = K[0]
    extras_on = ("fin",)

    def torso(self, face, i, j, w, h):
        if face == "top":
            return G[1]
        if face == "bottom":
            return K[1]
        if face == "front" and j <= 3 and (i in (j, j + 1) or i in (7 - j, 6 - j)):
            return G[2]
        if face in ("right", "left") and i in (1, 2):
            return G[1]
        return K[1]

    def arm(self, side, face, i, j, w, h):
        if face == "top":
            return G[1]
        if face == "bottom":
            return K[0]
        if j in (1, 2):
            return G[1]
        if j >= 9:
            return K[0] if (j == 11 and face == "front") else G[1]
        return K[1]

    def leg(self, side, face, i, j, w, h):
        if face == "bottom":
            return K[0]
        if j in (5, 6):
            return G[1]
        if j >= 9:
            return G[2] if j == 9 else G[1]
        return K[1]

    def extra_color(self, slot, face, i, j):
        return (*G[2], 200) if _canon(face) == "front" else G[1]


class Sinestro(Lantern):
    skin = (204, 86, 128)
    skin2 = (176, 62, 104)
    hair = (14, 12, 16)
    hair_style = "widow"
    eye = "pupil"
    mask = None
    mustache = True
    mouth = (130, 40, 70)
    emblem = EMBLEM_SC
    emblem_fg = Y[2]
    emblem_bg = K[0]
    ring = Y[2]
    extras_on = ("brow",)

    def torso(self, face, i, j, w, h):
        if face == "top":
            return Y[1] if i <= 1 or i >= 6 else K[1]
        if face == "bottom":
            return K[1]
        if face in ("front", "back") and j <= 1 and (i <= 1 or i >= 6):
            return Y[1]
        if face == "front" and j == 0:
            return Y[0]
        return K[1]

    def arm(self, side, face, i, j, w, h):
        if face == "top":
            return Y[1]
        if face == "bottom":
            return Y[1]
        if j <= 1:
            return Y[1]
        if j == 7:
            return Y[2]
        if j >= 8:
            return Y[1]
        return K[1]

    def leg(self, side, face, i, j, w, h):
        if face == "bottom":
            return K[0]
        if j == 6:
            return Y[2]
        if j > 6:
            return Y[1]
        return K[1]

    def extra_color(self, slot, face, i, j):
        f = _canon(face)
        if f in ("top", "back", "right", "left"):
            return self.hair if (f != "right" and f != "left") or j == 0 or j == 1 else self.skin
        if f == "front":
            if j == 0:
                return self.hair
            return self.hair if i in (0, 1, 3, 4, 6, 7) else self.skin  # widow's peak
        return self.skin


class Uniform(Hal):
    """Generic Green Lantern Corps uniform (suit only): mask over your own face."""
    show_head = False

    def arm(self, side, face, i, j, w, h):
        if face == "bottom":
            return G[1]
        if face == "top":
            return K[1]
        if j >= 9:
            return G[2] if j == 9 else G[1]
        return K[1]

    def leg(self, side, face, i, j, w, h):
        if face == "bottom":
            return K[0]
        if j >= 9:
            return K[2] if j == 9 else K[1]
        if _outer(side, face):
            return K[1]
        return G[1]

    def extra(self, slot, face, i, j, w, h):
        if slot == "ring":
            return None
        return super().extra(slot, face, i, j, w, h)


DESIGNS = {
    "hal_jordan": Hal, "john_stewart": John, "guy_gardner": Guy,
    "kyle_rayner": Kyle, "sinestro": Sinestro, "corps_uniform": Uniform,
}


def paint(char_id):
    return DESIGNS[char_id]().paint()


def portrait(tex, frame=(40, 220, 110), size=32):
    """Spawn-egg / menu portrait from the character's face."""
    face = tex.crop((8, 8, 16, 16)).convert("RGBA")
    hat = tex.crop((40, 8, 48, 16)).convert("RGBA")
    face.alpha_composite(hat)
    face = Image.fromarray(__import__("numpy").asarray(face)).convert("RGBA")
    arr = face.load()
    for y in range(8):
        for x in range(8):
            r, g, b, a = arr[x, y]
            if a:
                arr[x, y] = (r, g, b, 255)
    big = face.resize((24, 24), Image.NEAREST)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    from PIL import ImageDraw
    d = ImageDraw.Draw(out)
    d.ellipse([0, 0, size - 1, size - 1], fill=(16, 22, 20, 255), outline=(*frame, 255), width=2)
    out.alpha_composite(big, ((size - 24) // 2, (size - 24) // 2))
    return out
