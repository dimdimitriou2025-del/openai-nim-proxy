"""Geometry for every hard-light construct.

All construct models are centred on the entity origin, face -Z (the direction
the construct travels / aims) and are painted with the "energy" style so the
additive material makes edges glow.  A root bone named "root" (pivot at origin)
lets animations scale, pitch and dissolve the whole construct.
"""
import math

from glc.geo import Geometry

EMB = {"emblem": {"up": "green"}}


def _root(g, pivot=(0, 0, 0)):
    g.bone("root", pivot=pivot)
    g.bone("pitch", parent="root", pivot=pivot)
    return "pitch"


def fist():
    g = Geometry("geometry.glc.fist", tex_w=128, tex_h=64, bounds_w=4, bounds_h=4,
                 bounds_offset=(0, 0, 0))
    p = _root(g)
    g.bone("hand", parent=p, pivot=(0, 0, 0))
    g.cube("hand", (-7, -3, -5), (14, 9, 9), paint={"pattern": "scan"})            # back of hand
    g.cube("hand", (-6, -6, -4), (12, 3, 7), paint={"pattern": "diag"})            # palm
    for x in (-6, -3, 0, 3):
        g.cube("hand", (x, 1, -9), (3, 5, 4), paint={"intensity": 1.08})           # knuckles
        g.cube("hand", (x, -3, -9), (3, 4, 3), paint={"pattern": "diag"})          # middle phalanges
        g.cube("hand", (x, -6, -7), (3, 3, 3), paint={"pattern": "none"})          # tucked tips
    g.cube("hand", (5, -4, -6), (3, 4, 6), paint={"intensity": 1.05})              # thumb base
    g.cube("hand", (-2, -4, -11), (10, 3, 3), paint={"intensity": 1.12})           # thumb across front
    g.cube("hand", (-5, -4, 4), (10, 8, 7), paint={"pattern": "scan"})             # wrist
    g.cube("hand", (-5, -4, 4), (10, 8, 2), inflate=0.6, paint={"intensity": 1.25})  # cuff band
    g.cube("hand", (-4, 6, -3), (8, 1, 7), paint={"emblem": {"up": "green"}, "pattern": "none"})
    g.pack()
    return g


def hammer():
    """Pivot at the grip (origin).  Rest pose: head straight up (+Y)."""
    g = Geometry("geometry.glc.hammer", tex_w=128, tex_h=128, bounds_w=6, bounds_h=6,
                 bounds_offset=(0, 1, 0))
    g.bone("root", pivot=(0, 0, 0))
    g.bone("swing", parent="root", pivot=(0, 0, 0))
    g.cube("swing", (-2, -2, -2), (4, 26, 4), paint={"pattern": "diag"})       # handle
    g.cube("swing", (-3, -3, -3), (6, 3, 6), paint={"intensity": 1.2})       # pommel
    g.cube("swing", (-3, 8, -3), (6, 2, 6), paint={"intensity": 1.2})        # grip ring
    g.cube("swing", (-10, 24, -6), (20, 12, 12),
           paint={"pattern": "hex", "emblem": {"north": "green", "south": "green"}})  # head
    g.cube("swing", (-11, 23, -7), (2, 14, 14), paint={"intensity": 1.3})     # face plate L
    g.cube("swing", (9, 23, -7), (2, 14, 14), paint={"intensity": 1.3})       # face plate R
    g.cube("swing", (-4, 36, -4), (8, 2, 8), paint={"intensity": 1.1})        # top cap
    g.pack()
    return g


def blade():
    """Grip at origin, blade along -Z, flat in the horizontal plane."""
    g = Geometry("geometry.glc.blade", tex_w=128, tex_h=64, bounds_w=7, bounds_h=3,
                 bounds_offset=(0, 0, 0))
    g.bone("root", pivot=(0, 0, 0))
    g.bone("swing", parent="root", pivot=(0, 0, 0))
    g.cube("swing", (-1.5, -1.5, 0), (3, 3, 8), paint={"pattern": "diag"})          # grip
    g.cube("swing", (-7, -2, -2), (14, 4, 2), paint={"intensity": 1.2,
                                                      "emblem": {"north": "green"}})  # guard
    g.cube("swing", (-2.5, -0.5, -40), (5, 1, 38), paint={"pattern": "scan"})         # blade
    g.cube("swing", (-1.5, -0.5, -44), (3, 1, 4), paint={"intensity": 1.3})          # tip
    g.cube("swing", (-0.5, -1, -38), (1, 2, 34), paint={"intensity": 1.4, "rim": 0})  # fuller
    g.cube("swing", (-2, -2, 8), (4, 4, 2), paint={"intensity": 1.2})                 # pommel
    g.pack()
    return g


def cannon():
    g = Geometry("geometry.glc.cannon", tex_w=128, tex_h=64, bounds_w=3, bounds_h=3,
                 bounds_offset=(0, 0, 0))
    p = _root(g)
    g.bone("barrel", parent=p, pivot=(0, 0, 0))
    g.cube("barrel", (-3, -3, -18), (6, 6, 18), paint={"pattern": "scan"})
    g.cube("barrel", (-4, -4, -21), (8, 8, 3), paint={"intensity": 1.3})       # muzzle
    g.cube("barrel", (-1, 3, -16), (2, 2, 10), paint={"intensity": 1.2})        # sight rail
    g.cube(p, (-5, -5, 0), (10, 10, 9), paint={"pattern": "hex", "emblem": {"west": "green", "east": "green"}})
    g.cube(p, (-3, -8, 2), (6, 3, 5), paint={"pattern": "diag"})                # mount
    g.cube(p, (-6, -2, 3), (12, 4, 2), inflate=0.3, paint={"intensity": 1.3})   # coil
    g.pack()
    return g


def bolt():
    g = Geometry("geometry.glc.bolt", tex_w=64, tex_h=32, bounds_w=1.5, bounds_h=1.5,
                 bounds_offset=(0, 0, 0))
    g.bone("body", pivot=(0, 0, 0))
    g.cube("body", (-1, -1, -5), (2, 2, 10), paint={"intensity": 1.5, "rim": 0})
    g.cube("body", (-2, -2, -2), (4, 4, 4), paint={"intensity": 0.9})
    g.pack()
    return g


def missile():
    g = Geometry("geometry.glc.missile", tex_w=64, tex_h=64, bounds_w=2, bounds_h=2,
                 bounds_offset=(0, 0, 0))
    g.bone("body", pivot=(0, 0, 0))
    g.cube("body", (-1.5, -1.5, -6), (3, 3, 11), paint={"pattern": "scan"})
    g.cube("body", (-1, -1, -8), (2, 2, 2), paint={"intensity": 1.4})            # nose
    for fx, fy, sx, sy in ((-4, -0.5, 3, 1), (1, -0.5, 3, 1), (-0.5, -4, 1, 3), (-0.5, 1, 1, 3)):
        g.cube("body", (fx, fy, 2), (sx, sy, 3), paint={"intensity": 1.2})       # fins
    g.cube("body", (-2, -2, 5), (4, 4, 2), paint={"intensity": 1.5, "rim": 0})   # exhaust
    g.pack()
    return g


def drone():
    g = Geometry("geometry.glc.drone", tex_w=64, tex_h=64, bounds_w=2, bounds_h=2,
                 bounds_offset=(0, 0, 0))
    g.bone("root", pivot=(0, 0, 0))
    g.bone("ring", parent="root", pivot=(0, 0, 0))
    g.cube("root", (-3, -2, -3), (6, 4, 6), paint={"pattern": "hex", "emblem": {"up": "green"}})
    g.cube("root", (-1, -1, -4), (2, 2, 1), paint={"intensity": 1.6, "rim": 0})  # lens
    g.cube("root", (-0.5, 2, -0.5), (1, 3, 1), paint={"intensity": 1.2})          # antenna
    for k in range(4):
        a = k * 90
        g.bone(f"arm{k}", parent="ring", pivot=(0, 0, 0), rotation=(0, a, 0))
        g.cube(f"arm{k}", (-1, -0.5, -9), (2, 1, 6), paint={"intensity": 1.1})
        g.cube(f"arm{k}", (-2, -1, -11), (4, 2, 2), paint={"intensity": 1.3})
    g.pack()
    return g


def shield():
    g = Geometry("geometry.glc.shield", tex_w=128, tex_h=128, bounds_w=4, bounds_h=4,
                 bounds_offset=(0, 0, 0))
    g.bone("root", pivot=(0, 0, 0))
    g.cube("root", (-9, -14, -1), (18, 28, 1),
           paint={"pattern": "hex", "mode": "glass", "emblem": {"north": "green"}})
    for side, sgn in (("l", 1), ("r", -1)):
        g.bone(f"wing_{side}", parent="root", pivot=(9 * sgn, 0, -1), rotation=(0, -28 * sgn, 0))
        x0 = 9 if sgn > 0 else -21
        g.cube(f"wing_{side}", (x0, -12, -1), (12, 24, 1), paint={"pattern": "hex", "mode": "glass"})
        g.cube(f"wing_{side}", (x0 + (11 if sgn > 0 else 0), -12, -1.5), (1, 24, 2), paint={"intensity": 1.3, "mode": "glass"})
    g.cube("root", (-9, 13, -1.5), (18, 1, 2), paint={"intensity": 1.3, "mode": "glass"})
    g.cube("root", (-9, -14, -1.5), (18, 1, 2), paint={"intensity": 1.3, "mode": "glass"})
    g.pack()
    return g


def _panel_sphere(g, parent, radius, rings, segments=12, tile=(0, 0, 32, 32), overlap=1.08,
                  shell=False):
    """Faceted sphere (or dome) of thin panels sharing one texture tile.

    rings: list of (elevation_mid_deg, elevation_span_deg).
    """
    u, v, tw, th = tile
    for s in range(segments):
        az = s * 360.0 / segments
        bn = f"seg{s}"
        g.bone(bn, parent=parent, pivot=(0, 0, 0), rotation=(0, az, 0))
        for el, span in rings:
            h = radius * math.radians(span) * overlap
            w = 2 * math.pi * radius * math.cos(math.radians(el)) / segments * overlap
            if w < 0.5:
                continue
            c = g.cube(bn, (-w / 2, -h / 2, -radius), (w, h, 0),
                       rotation=(-el, 0, 0), pivot=(0, 0, 0),
                       face_uv={"north": (u, v, tw, th), "south": (u + tw, v, tw, th)})
            c.paint = {"style": "none"}


def dome():
    g = Geometry("geometry.glc.dome", tex_w=64, tex_h=32, bounds_w=12, bounds_h=8,
                 bounds_offset=(0, 2, 0))
    g.bone("root", pivot=(0, 0, 0))
    rings = [(9.0, 18.0), (27.0, 18.0), (45.0, 18.0), (63.0, 18.0), (79.0, 14.0)]
    _panel_sphere(g, "root", 24, rings)
    cap = g.cube("root", (-5, 23.6, -5), (10, 0, 10),
                 face_uv={"up": (0, 0, 32, 32), "down": (32, 0, 32, 32)})
    cap.paint = {"style": "none"}
    return g


def bubble():
    g = Geometry("geometry.glc.bubble", tex_w=64, tex_h=32, bounds_w=4, bounds_h=4,
                 bounds_offset=(0, 0, 0))
    g.bone("root", pivot=(0, 0, 0))
    rings = [(-70.0, 20.0), (-50.0, 20.0), (-30.0, 20.0), (-10.0, 20.0),
             (10.0, 20.0), (30.0, 20.0), (50.0, 20.0), (70.0, 20.0)]
    _panel_sphere(g, "root", 20, rings, segments=12)
    for y, face in ((19.6, "up"), (-19.6, "down")):
        cap = g.cube("root", (-4, y, -4), (8, 0, 8),
                     face_uv={"up": (0, 0, 32, 32), "down": (32, 0, 32, 32)})
        cap.paint = {"style": "none"}
    return g


def cage():
    g = Geometry("geometry.glc.cage", tex_w=128, tex_h=64, bounds_w=3, bounds_h=3,
                 bounds_offset=(0, 1, 0))
    g.bone("root", pivot=(0, 0, 0))
    S, H = 10, 30
    for x in (-S, S - 2):
        for z in (-S, S - 2):
            g.cube("root", (x, 0, z), (2, H, 2), paint={"intensity": 1.3})
    for x in (-5, -1, 3):
        g.cube("root", (x, 1, -S), (1, H - 2, 1), paint={"intensity": 1.0})
        g.cube("root", (x, 1, S - 1), (1, H - 2, 1), paint={"intensity": 1.0})
        g.cube("root", (-S, 1, x), (1, H - 2, 1), paint={"intensity": 1.0})
        g.cube("root", (S - 1, 1, x), (1, H - 2, 1), paint={"intensity": 1.0})
    for y in (0, H - 2):
        g.cube("root", (-S, y, -S), (2 * S, 2, 2), paint={"intensity": 1.2})
        g.cube("root", (-S, y, S - 2), (2 * S, 2, 2), paint={"intensity": 1.2})
        g.cube("root", (-S, y, -S + 2), (2, 2, 2 * S - 4), paint={"intensity": 1.2})
        g.cube("root", (S - 2, y, -S + 2), (2, 2, 2 * S - 4), paint={"intensity": 1.2})
    g.cube("root", (-3, 12, -S - 1), (6, 6, 1), paint={"emblem": {"north": "green"}, "pattern": "none"})
    g.pack()
    return g


def drill():
    g = Geometry("geometry.glc.drill", tex_w=128, tex_h=64, bounds_w=4, bounds_h=4,
                 bounds_offset=(0, 0, 0))
    p = _root(g)
    g.bone("spin", parent=p, pivot=(0, 0, 0))
    sizes = [(12, 4), (10, 4), (8, 4), (6, 4), (4, 4), (2, 3)]
    z = -2
    for i, (s, d) in enumerate(sizes):
        g.cube("spin", (-s / 2, -s / 2, z - d), (s, s, d), paint={"pattern": "diag", "intensity": 1.0 + i * 0.06})
        z -= d
    for k in range(3):
        g.bone(f"flute{k}", parent="spin", pivot=(0, 0, 0), rotation=(0, 0, k * 120))
        g.cube(f"flute{k}", (-0.5, 4, -24), (1, 2, 22), paint={"intensity": 1.4})
    g.cube(p, (-8, -8, -2), (16, 16, 8), paint={"pattern": "hex", "emblem": {"up": "green"}})
    g.cube(p, (-6, -6, 6), (12, 12, 4), paint={"pattern": "scan"})
    g.pack()
    return g


def claw():
    g = Geometry("geometry.glc.claw", tex_w=64, tex_h=32, bounds_w=2, bounds_h=2,
                 bounds_offset=(0, 0, 0))
    p = _root(g)
    g.cube(p, (-2, -2, -1), (4, 4, 4), paint={"intensity": 1.2, "emblem": {"south": "green"}})
    for k in range(3):
        g.bone(f"prong{k}", parent=p, pivot=(0, 0, -1), rotation=(0, 0, k * 120))
        g.cube(f"prong{k}", (-0.5, 1, -5), (1, 1, 4), paint={"intensity": 1.4})
        g.cube(f"prong{k}", (-0.5, 2, -6), (1, 2, 1), paint={"intensity": 1.4})
    g.pack()
    return g


def target():
    g = Geometry("geometry.glc.training_target", tex_w=64, tex_h=64, bounds_w=2, bounds_h=3,
                 bounds_offset=(0, 1, 0))
    g.bone("root", pivot=(0, 16, 0))
    g.bone("disc", parent="root", pivot=(0, 16, 0))
    g.cube("disc", (-8, 8, -0.5), (16, 16, 1), paint={"pattern": "none", "emblem": {"north": "green", "south": "green"}})
    g.cube("disc", (-9, 7, -1), (18, 1, 2), paint={"intensity": 1.3})
    g.cube("disc", (-9, 24, -1), (18, 1, 2), paint={"intensity": 1.3})
    g.cube("root", (-1, 0, -1), (2, 7, 2), paint={"pattern": "diag"})
    g.cube("root", (-3, -1, -3), (6, 1, 6), paint={"intensity": 1.2})
    g.pack()
    return g


def colossus():
    """Giant construct, authored at 2x human size, scaled up by animation."""
    g = Geometry("geometry.glc.colossus", tex_w=256, tex_h=128, bounds_w=16, bounds_h=16,
                 bounds_offset=(0, 6, 0))
    g.bone("root", pivot=(0, 0, 0))
    g.bone("waist", parent="root", pivot=(0, 24, 0))
    g.bone("body", parent="waist", pivot=(0, 24, 0))
    g.cube("body", (-10, 24, -5), (20, 24, 10), paint={"pattern": "hex", "emblem": {"north": "green"}})
    g.cube("body", (-12, 44, -6), (24, 4, 12), paint={"intensity": 1.2})                 # shoulders
    g.bone("head", parent="body", pivot=(0, 48, 0))
    g.cube("head", (-7, 48, -7), (14, 14, 14), paint={"pattern": "scan"})
    g.cube("head", (-5, 54, -7.6), (10, 2, 1), paint={"intensity": 1.8, "rim": 0})          # visor eyes
    g.cube("head", (-1, 62, -4), (2, 4, 8), paint={"intensity": 1.3})                      # crest
    for side, sgn in (("right", -1), ("left", 1)):
        bn = f"{side}Arm"
        g.bone(bn, parent="body", pivot=(sgn * 14, 44, 0))
        x0 = -20 if sgn < 0 else 12
        g.cube(bn, (x0, 22, -4), (8, 24, 8), paint={"pattern": "scan"})
        g.cube(bn, (x0 - 1, 12, -5), (10, 10, 10), paint={"intensity": 1.15, "pattern": "diag"})  # fist
        g.cube(bn, (x0 - 1, 40, -5), (10, 6, 10), paint={"intensity": 1.2})                      # pauldron
        lb = f"{side}Leg"
        g.bone(lb, parent="root", pivot=(sgn * 5, 24, 0))
        lx = -10 if sgn < 0 else 1
        g.cube(lb, (lx, 0, -5), (9, 24, 10), paint={"pattern": "scan"})
        g.cube(lb, (lx - 1, 0, -7), (11, 5, 13), paint={"intensity": 1.2})
    g.pack()
    return g


# Render style per construct: "solid" = emissive core + animated glow shell,
# "glass" = see-through additive panels (no shell).
STYLE = {"shield": "glass", "dome": "glass", "bubble": "glass"}

ALL = {
    "fist": fist, "hammer": hammer, "blade": blade, "cannon": cannon, "bolt": bolt,
    "missile": missile, "drone": drone, "shield": shield, "dome": dome, "bubble": bubble,
    "cage": cage, "drill": drill, "claw": claw, "training_target": target,
    "colossus": colossus,
}
