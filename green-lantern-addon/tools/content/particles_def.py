"""Custom particle effects.

Every effect is tinted by `variable.color.{r,g,b}` which scripts always set
(Corps colour), so one definition serves every Lantern Corps.  Line effects use
`variable.beam.{speed,direction_x,direction_y,direction_z}` (length + direction),
set with MolangVariableMap.setSpeedAndDirection("variable.beam", length, dir).
Particles are placed with parametric motion so shapes are deterministic.
"""
from glc.io import rp, write_json

TEX = "textures/glc/particle/"
FADE = "(1 - variable.particle_age / variable.particle_lifetime)"
T = "(variable.particle_age / variable.particle_lifetime)"


def _effect(ident, texture, comps, material="particles_add"):
    return {
        "format_version": "1.10.0",
        "particle_effect": {
            "description": {
                "identifier": ident,
                "basic_render_parameters": {"material": material, "texture": TEX + texture},
            },
            "components": comps,
        },
    }


def _uv(size):
    return {"texture_width": size, "texture_height": size, "uv": [0, 0], "uv_size": [size, size]}


def _tint(alpha=FADE, boost=1.0):
    def ch(c):
        return f"math.min(1, variable.color.{c} * {boost})" if boost != 1.0 else f"variable.color.{c}"
    return {"minecraft:particle_appearance_tinting": {"color": [ch("r"), ch("g"), ch("b"), alpha]}}


def _billboard(size, tex_size, mode="lookat_xyz", direction=None):
    d = {"size": [size, size] if not isinstance(size, list) else size,
         "facing_camera_mode": mode, "uv": _uv(tex_size)}
    if direction:
        d["direction"] = direction
    return {"minecraft:particle_appearance_billboard": d}


def sphere_point(radius_expr, t_expr):
    """Parametric point on a random sphere direction at radius * t."""
    th = "variable.particle_random_1 * 360"
    ph = "(variable.particle_random_2 * 180 - 90)"
    return [f"math.cos({ph}) * math.cos({th}) * {radius_expr} * {t_expr}",
            f"math.sin({ph}) * {radius_expr} * {t_expr}",
            f"math.cos({ph}) * math.sin({th}) * {radius_expr} * {t_expr}"]


EFFECTS = {}


def effect(name):
    def deco(fn):
        EFFECTS[name] = fn
        return fn
    return deco


@effect("glc:spark")
def spark():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 12},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.15, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.25, 0.55)"},
        "minecraft:particle_initial_speed": "math.random(3, 7)",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -4, 0], "linear_drag_coefficient": 4},
    }
    c.update(_billboard(f"0.16 * {FADE} + 0.03", 16, "lookat_direction",
                        {"mode": "derive_from_velocity", "min_speed_threshold": 0.05}))
    c.update(_tint(boost=1.2))
    return _effect("glc:spark", "spark", c)


@effect("glc:impact")
def impact():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.28},
    }
    c.update(_billboard(f"0.4 + 1.6 * {T}", 32))
    c.update(_tint(alpha=f"{FADE} * {FADE}", boost=1.4))
    return _effect("glc:impact", "glow", c)


@effect("glc:shockwave")
def shockwave():
    # variable.radius: final ring radius (blocks)
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.55},
    }
    c.update(_billboard(f"0.3 + variable.radius * 2.1 * math.sqrt({T})", 64, "emitter_transform_xz"))
    c.update(_tint(alpha=f"{FADE}", boost=1.3))
    return _effect("glc:shockwave", "ring", c)


@effect("glc:beam")
def beam():
    # variable.beam.speed = length, variable.beam.direction_* = unit dir, variable.width = size scale
    L = "variable.beam.speed"
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": f"math.clamp({L} * 5, 4, 220)"},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.18, 0.32)"},
        "minecraft:particle_motion_parametric": {
            "relative_position": [
                f"variable.beam.direction_x * variable.particle_random_1 * {L} + (variable.particle_random_2 - 0.5) * 0.06 * variable.width",
                f"variable.beam.direction_y * variable.particle_random_1 * {L} + (variable.particle_random_3 - 0.5) * 0.06 * variable.width",
                f"variable.beam.direction_z * variable.particle_random_1 * {L} + (variable.particle_random_4 - 0.5) * 0.06 * variable.width",
            ]
        },
    }
    c.update(_billboard(f"(0.18 + variable.particle_random_2 * 0.08) * variable.width * (0.4 + 0.6 * {FADE})", 32))
    c.update(_tint(alpha=FADE, boost=1.3))
    return _effect("glc:beam", "glow", c)


@effect("glc:stream")
def stream():
    # particles flow from the emitter to emitter + dir * length over their lifetime
    L = "variable.beam.speed"
    swirl = f"math.sin(variable.particle_age * 900 + variable.particle_random_1 * 360) * 0.25 * {FADE}"
    swirl2 = f"math.cos(variable.particle_age * 900 + variable.particle_random_1 * 360) * 0.25 * {FADE}"
    c = {
        "minecraft:emitter_rate_steady": {"spawn_rate": 40, "max_particles": 60},
        "minecraft:emitter_lifetime_once": {"active_time": 0.5},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.6},
        "minecraft:particle_motion_parametric": {
            "relative_position": [
                f"variable.beam.direction_x * {L} * {T} + {swirl}",
                f"variable.beam.direction_y * {L} * {T} + {swirl2}",
                f"variable.beam.direction_z * {L} * {T} + {swirl}",
            ]
        },
    }
    c.update(_billboard("0.14 + variable.particle_random_3 * 0.08", 32))
    c.update(_tint(alpha="1", boost=1.2))
    return _effect("glc:stream", "glow", c)


@effect("glc:form")
def form():
    # converging motes: construct forming from light. variable.radius = start radius
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 18},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.22, 0.36)"},
        "minecraft:particle_motion_parametric": {"relative_position": sphere_point("variable.radius", FADE)},
    }
    c.update(_billboard(f"0.10 + 0.12 * {T}", 16))
    c.update(_tint(alpha=f"0.4 + 0.6 * {T}", boost=1.2))
    return _effect("glc:form", "spark", c)


@effect("glc:dissipate")
def dissipate():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 16},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.4, 0.8)"},
        "minecraft:particle_motion_parametric": {
            "relative_position": [
                f"math.cos(variable.particle_random_2 * 180 - 90) * math.cos(variable.particle_random_1 * 360) * variable.radius * (0.3 + {T})",
                f"math.sin(variable.particle_random_2 * 180 - 90) * variable.radius * (0.3 + {T}) + {T} * 0.6",
                f"math.cos(variable.particle_random_2 * 180 - 90) * math.sin(variable.particle_random_1 * 360) * variable.radius * (0.3 + {T})",
            ]
        },
    }
    c.update(_billboard(f"0.14 * {FADE} + 0.02", 16))
    c.update(_tint(alpha=FADE))
    return _effect("glc:dissipate", "spark", c)


@effect("glc:charge")
def charge():
    # spiralling inward energy (ring charging). variable.radius = start radius
    ang = "variable.particle_random_1 * 360 + variable.particle_age * 720"
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 8},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
        "minecraft:particle_motion_parametric": {
            "relative_position": [
                f"math.cos({ang}) * variable.radius * {FADE}",
                f"(variable.particle_random_2 - 0.5) * variable.radius * {FADE}",
                f"math.sin({ang}) * variable.radius * {FADE}",
            ]
        },
    }
    c.update(_billboard(f"0.08 + 0.12 * {T}", 16))
    c.update(_tint(alpha=f"0.3 + 0.7 * {T}", boost=1.3))
    return _effect("glc:charge", "spark", c)


@effect("glc:trail")
def trail():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 2},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.18, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.35, 0.6)"},
        "minecraft:particle_initial_speed": 0.15,
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 1.5},
    }
    c.update(_billboard(f"0.16 * {FADE} + 0.02", 32))
    c.update(_tint(alpha=FADE))
    return _effect("glc:trail", "glow", c)


@effect("glc:aura")
def aura():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 3},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": "variable.radius", "surface_only": True, "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.9)"},
        "minecraft:particle_initial_speed": "math.random(0.3, 0.8)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.8},
    }
    c.update(_billboard(f"0.07 + 0.05 * {FADE}", 16))
    c.update(_tint(alpha=FADE))
    return _effect("glc:aura", "spark", c)


@effect("glc:pillar")
def pillar():
    # long-lived ceremony column of rising light (single call lasts 2.6 s)
    c = {
        "minecraft:emitter_rate_steady": {"spawn_rate": 70, "max_particles": 120},
        "minecraft:emitter_lifetime_once": {"active_time": 2.6},
        "minecraft:emitter_shape_disc": {"plane_normal": "y", "radius": 1.3, "direction": [0, 1, 0]},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.8, 1.4)"},
        "minecraft:particle_initial_speed": "math.random(3, 6)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 0.6},
    }
    c.update(_billboard(["0.08", f"0.45 * {FADE} + 0.1"], 16, "lookat_y"))
    c.update(_tint(alpha=FADE, boost=1.2))
    return _effect("glc:pillar", "streak", c)


@effect("glc:emblem")
def emblem():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 2.6},
        "minecraft:particle_motion_parametric": {"relative_position": [0, f"{T} * 0.8", 0]},
    }
    c.update(_billboard(f"1.4 + 0.3 * math.sin(variable.particle_age * 180)", 64))
    c.update(_tint(alpha=f"math.clamp(math.min({T} * 5, {FADE} * 2.5), 0, 1)", boost=1.2))
    return _effect("glc:emblem", "emblem", c)


@effect("glc:ring_burst")
def ring_burst():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 36},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_disc": {"plane_normal": "y", "radius": 0.3, "surface_only": True, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.5, 0.8)"},
        "minecraft:particle_initial_speed": "math.random(5, 8)",
        "minecraft:particle_motion_dynamic": {"linear_drag_coefficient": 3.5},
    }
    c.update(_billboard(f"0.18 * {FADE} + 0.04", 32))
    c.update(_tint(alpha=FADE, boost=1.2))
    return _effect("glc:ring_burst", "glow", c)


@effect("glc:shield_hit")
def shield_hit():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 1},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_point": {},
        "minecraft:particle_lifetime_expression": {"max_lifetime": 0.35},
    }
    c.update(_billboard(f"0.6 + 0.9 * {T}", 32))
    c.update(_tint(alpha=FADE, boost=1.4))
    return _effect("glc:shield_hit", "hex", c)


@effect("glc:low_power")
def low_power():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 5},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.25, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.3, 0.6)"},
        "minecraft:particle_initial_speed": 1.2,
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -6, 0]},
    }
    c.update(_billboard(f"0.06 * {FADE} + 0.02", 16))
    c.update(_tint(alpha=f"{FADE} * 0.7"))
    return _effect("glc:low_power", "spark", c)


@effect("glc:explosion")
def explosion():
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 34},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.35, 0.8)"},
        "minecraft:particle_initial_speed": "math.random(4, 11) * variable.radius * 0.5",
        "minecraft:particle_motion_dynamic": {"linear_acceleration": [0, -2, 0], "linear_drag_coefficient": 3},
    }
    c.update(_billboard(f"(0.25 + variable.particle_random_3 * 0.3) * {FADE} + 0.05", 32))
    c.update(_tint(alpha=FADE, boost=1.3))
    return _effect("glc:explosion", "glow", c)


@effect("glc:sphere_flash")
def sphere_flash():
    # brief glowing shell used by shields, bubbles and the dome when struck
    c = {
        "minecraft:emitter_rate_instant": {"num_particles": 24},
        "minecraft:emitter_lifetime_once": {"active_time": 0.05},
        "minecraft:emitter_shape_sphere": {"radius": "variable.radius", "surface_only": True, "direction": "outwards"},
        "minecraft:particle_lifetime_expression": {"max_lifetime": "math.random(0.25, 0.45)"},
        "minecraft:particle_initial_speed": 0.4,
    }
    c.update(_billboard(f"0.22 * {FADE} + 0.05", 32))
    c.update(_tint(alpha=FADE, boost=1.2))
    return _effect("glc:sphere_flash", "hex", c)


def build():
    for name, fn in EFFECTS.items():
        write_json(rp("particles", "glc", name.split(":")[1] + ".particle.json"), fn())
    return sorted(EFFECTS.keys())
