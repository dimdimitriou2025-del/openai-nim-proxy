"""Non-construct models: power batteries, ring attachable, Lantern NPCs, suits."""
import math

from glc.geo import Geometry

METAL = {"style": "solid", "base": (42, 56, 50), "noise": 7}
METAL_DARK = {"style": "solid", "base": (28, 36, 33), "noise": 6}
TRIM = {"style": "energy", "intensity": 1.15, "pattern": "none"}
CORE = {"style": "energy", "intensity": 1.25, "pattern": "hex"}


def power_battery_block():
    """The personal Power Battery (green lantern). Block geometry <= 30px."""
    g = Geometry("geometry.glc.power_battery", tex_w=64, tex_h=64, bounds_w=2, bounds_h=2,
                 bounds_offset=(0, 0.6, 0))
    g.bone("lantern", pivot=(0, 0, 0))
    g.cube("lantern", (-6, 0, -6), (12, 2, 12), paint=METAL)
    g.cube("lantern", (-5, 2, -5), (10, 1, 10), paint=TRIM)
    for x, z in ((-5, -5), (3, -5), (-5, 3), (3, 3)):
        g.cube("lantern", (x, 3, z), (2, 10, 2), paint=METAL_DARK)
    g.cube("lantern", (-4, 3, -4), (8, 10, 8), paint={**CORE, "emblem": {f: "green" for f in ("north", "south", "east", "west")}})
    g.cube("lantern", (-5, 13, -5), (10, 1, 10), paint=TRIM)
    g.cube("lantern", (-6, 14, -6), (12, 2, 12), paint=METAL)
    g.cube("lantern", (-4, 16, -4), (8, 1, 8), paint=METAL_DARK)
    g.cube("lantern", (-4, 17, -1), (1, 3, 2), paint=METAL)
    g.cube("lantern", (3, 17, -1), (1, 3, 2), paint=METAL)
    g.cube("lantern", (-4, 20, -1), (8, 1, 2), paint=METAL)
    g.pack()
    return g


def _ring(g, prefix, parent, y, radius, segments=8, thickness=2, depth=1.5, paint=None):
    seg_len = 2 * radius * math.tan(math.pi / segments) + 0.4
    names = []
    for k in range(segments):
        bn = f"{prefix}_{k}"
        g.bone(bn, parent=parent, pivot=(0, y, 0), rotation=(0, k * 360 / segments, 0))
        g.cube(bn, (-seg_len / 2, y - thickness / 2, -radius - depth / 2), (seg_len, thickness, depth),
               paint=paint or {"style": "energy", "intensity": 1.3, "pattern": "none"})
        names.append(bn)
    return names


def central_battery():
    """The Central Power Battery landmark (approx 2.75 x 3.25 blocks)."""
    g = Geometry("geometry.glc.central_battery", tex_w=256, tex_h=128, bounds_w=5, bounds_h=5,
                 bounds_offset=(0, 1.8, 0))
    g.bone("root", pivot=(0, 0, 0))
    g.bone("metal_base", parent="root", pivot=(0, 0, 0))
    g.cube("metal_base", (-22, 0, -22), (44, 4, 44), paint=METAL)
    g.cube("metal_base", (-18, 4, -18), (36, 3, 36), paint=METAL_DARK)
    g.bone("glow_trim", parent="root", pivot=(0, 0, 0))
    g.cube("glow_trim", (-19, 3.5, -19), (38, 1, 38), paint=TRIM)
    g.cube("glow_trim", (-16, 7, -16), (32, 1, 32), paint=TRIM)
    g.cube("glow_trim", (-16, 34, -16), (32, 1, 32), paint=TRIM)
    g.bone("metal_pillars", parent="root", pivot=(0, 0, 0))
    r = 14
    for k in range(8):
        a = math.radians(k * 45)
        x, z = math.sin(a) * r, -math.cos(a) * r
        g.cube("metal_pillars", (round(x) - 2, 8, round(z) - 2), (4, 26, 4), paint=METAL_DARK)
    g.bone("core_inner", parent="root", pivot=(0, 20, 0))
    g.cube("core_inner", (-8, 9, -8), (16, 24, 16), paint={**CORE, "mode": "glass", "intensity": 1.5})
    g.bone("core_outer", parent="root", pivot=(0, 20, 0))
    g.cube("core_outer", (-11, 11, -11), (22, 20, 22), paint={**CORE, "mode": "glass", "intensity": 0.9})
    g.bone("glow_emblem", parent="root", pivot=(0, 0, 0))
    g.cube("glow_emblem", (-6, 15, -16), (12, 12, 1), paint={"style": "energy", "pattern": "none", "emblem": {"north": "green"}})
    g.cube("glow_emblem", (-6, 15, 15), (12, 12, 1), paint={"style": "energy", "pattern": "none", "emblem": {"south": "green"}})
    g.bone("metal_top", parent="root", pivot=(0, 0, 0))
    g.cube("metal_top", (-18, 35, -18), (36, 3, 36), paint=METAL)
    g.cube("metal_top", (-14, 38, -14), (28, 3, 28), paint=METAL_DARK)
    g.cube("metal_top", (-12, 41, -1), (3, 8, 2), paint=METAL)
    g.cube("metal_top", (9, 41, -1), (3, 8, 2), paint=METAL)
    g.cube("metal_top", (-12, 49, -1), (24, 3, 2), paint=METAL)
    g.bone("ring_a", parent="root", pivot=(0, 17, 0))
    ring_a = _ring(g, "ring_a_seg", "ring_a", 17, 19)
    g.bone("ring_b", parent="root", pivot=(0, 27, 0))
    ring_b = _ring(g, "ring_b_seg", "ring_b", 27, 16)
    g.pack()
    g.groups = {
        "metal": ["metal_base", "metal_pillars", "metal_top"],
        "glow": ["glow_trim", "glow_emblem"],
        "energy": ["core_inner", "core_outer"] + ring_a + ring_b,
    }
    return g


def ring_held():
    """Power ring attachable: a small floating, slowly spinning ring at the hand."""
    g = Geometry("geometry.glc.ring_held", tex_w=32, tex_h=32, bounds_w=1, bounds_h=1,
                 bounds_offset=(0, 0, 0))
    g.bone("ring", pivot=(0, 0, 0), binding="q.item_slot_to_bone_name(c.item_slot)")
    g.bone("ring_float", parent="ring", pivot=(0, 0, 0))
    for k in range(8):
        bn = f"band_{k}"
        g.bone(bn, parent="ring_float", pivot=(0, 0, 0), rotation=(0, 0, k * 45))
        g.cube(bn, (-1, 2.0, -0.5), (2, 1, 1), paint={"style": "energy", "intensity": 1.1, "pattern": "none"})
    g.cube("ring_float", (-1.5, 3.0, -1.5), (3, 1, 3), paint={"style": "energy", "intensity": 1.2, "pattern": "none"})
    g.cube("ring_float", (-1, 4.0, -1), (2, 1, 2), paint={"style": "energy", "intensity": 1.5, "pattern": "none", "rim": 0})
    g.pack()
    return g


# ---------------------------------------------------------------- humanoids
SKIN_UV = {
    "head": (0, 0), "hat": (32, 0), "body": (16, 16), "jacket": (16, 32),
    "rightArm": (40, 16), "rightSleeve": (40, 32), "leftArm": (32, 48), "leftSleeve": (48, 48),
    "rightLeg": (0, 16), "rightPants": (0, 32), "leftLeg": (16, 48), "leftPants": (0, 48),
}


def humanoid(identifier, overlay=True, inflate=0.0, bounds_h=3):
    """Humanoid with standard 64x64 skin UVs plus character extras packed below.

    Used for both Lantern NPCs (overlay layers, no inflate) and wearable suits
    (no overlay, inflated over the player).  Extras are packed identically in both,
    so one 64x128 character texture serves the NPC *and* the matching suit.
    Unused extras are simply transparent in a character's texture.
    """
    g = Geometry(identifier, tex_w=64, tex_h=128, bounds_w=2.5, bounds_h=bounds_h,
                 bounds_offset=(0, 1.2, 0))
    head_inf = inflate + (0.05 if inflate else 0.0)

    def part(bone, origin, size, key, layer_key=None, inf=inflate):
        g.cube(bone, origin, size, inflate=inf, uv=list(SKIN_UV[key]))
        if overlay and layer_key:
            g.cube(bone, origin, size, inflate=0.25 if key != "head" else 0.5, uv=list(SKIN_UV[layer_key]))

    g.bone("waist", pivot=(0, 12, 0))
    g.bone("body", parent="waist", pivot=(0, 24, 0))
    part("body", (-4, 12, -2), (8, 12, 4), "body", "jacket")
    g.bone("head", parent="body", pivot=(0, 24, 0))
    part("head", (-4, 24, -4), (8, 8, 8), "head", "hat", inf=head_inf)
    g.bone("rightArm", parent="body", pivot=(-5, 22, 0))
    part("rightArm", (-8, 12, -2), (4, 12, 4), "rightArm", "rightSleeve")
    g.bone("leftArm", parent="body", pivot=(5, 22, 0))
    part("leftArm", (4, 12, -2), (4, 12, 4), "leftArm", "leftSleeve")
    g.bone("rightLeg", parent="body", pivot=(-1.9, 12, 0))
    part("rightLeg", (-3.9, 0, -2), (4, 12, 4), "rightLeg", "rightPants")
    g.bone("leftLeg", parent="body", pivot=(1.9, 12, 0))
    part("leftLeg", (-0.1, 0, -2), (4, 12, 4), "leftLeg", "leftPants")
    if overlay:
        g.bone("rightItem", parent="rightArm", pivot=(-6, 15, 1))
    # --- extras (auto-packed below the skin area, y >= 64), identical order everywhere
    g.bone("glc_ring", parent="rightArm", pivot=(-6, 13, 0))
    g.cube("glc_ring", (-6.5, 12.5, -2.6 - inflate), (1, 1, 1), inflate=0.15, paint={"slot": "ring"})
    g.bone("glc_emblem", parent="body", pivot=(0, 18, -2))
    g.cube("glc_emblem", (-3, 15, -3 - inflate), (6, 6, 1), paint={"slot": "emblem"})
    g.bone("glc_fins", parent="head", pivot=(0, 28, 0))
    g.cube("glc_fins", (-7, 27, -4.4 - head_inf), (3, 2, 1), paint={"slot": "fin"})
    g.cube("glc_fins", (4, 27, -4.4 - head_inf), (3, 2, 1), paint={"slot": "fin"})
    g.bone("glc_bowl", parent="head", pivot=(0, 28, 0))
    g.cube("glc_bowl", (-4, 29, -4), (8, 4, 8), inflate=0.75 + head_inf, paint={"slot": "bowl"})
    g.bone("glc_brow", parent="head", pivot=(0, 32, 0))
    g.cube("glc_brow", (-4, 31, -4), (8, 2, 8), inflate=0.35 + head_inf, paint={"slot": "brow"})
    g.bone("glc_flattop", parent="head", pivot=(0, 32, 0))
    g.cube("glc_flattop", (-4, 31.5, -4), (8, 1, 8), inflate=0.55 + head_inf, paint={"slot": "flattop"})
    g.pack(start_y=64)
    return g


def lantern_npc():
    return humanoid("geometry.glc.lantern", overlay=True, inflate=0.0)


def suit():
    """Wearable uniform attachable; bones copy the player's skeleton by name."""
    return humanoid("geometry.glc.suit", overlay=False, inflate=0.3, bounds_h=2.5)


def extras_layout():
    """Slot name -> list of face-rect dicts (identical for NPC and suit)."""
    g = lantern_npc()
    out = {}
    for c in g.cubes():
        slot = (c.paint or {}).get("slot")
        if slot:
            out.setdefault(slot, []).append(c.face_rects())
    return out
