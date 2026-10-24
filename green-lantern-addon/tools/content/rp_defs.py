"""Resource-pack JSON: client entities, render controllers, animations, attachables."""
from content.game_data import CHARACTERS, CORPS, SUITS

# Texture arrays hold one entry per Corps in game_data.CORPS order, the same order the scripts
# use for the glc:corps entity property.  Corps that are not active yet reuse green textures,
# so activating one later never shifts the indices.
CORPS_IDS = [c["id"] for c in CORPS]
TEXTURED_CORPS = [c["id"] for c in CORPS if c["active"]]


def corps_variant(corps):
    return corps if corps in TEXTURED_CORPS else "green"


CT = "textures/glc/entity/constructs/"

# entity id -> (geometry key, style, extra animations)
CONSTRUCT_ENTITIES = {
    "fist": ("fist", "solid", ["pitch"]),
    "hammer": ("hammer", "solid", ["hammer_slam"]),
    "blade": ("blade", "solid", ["blade_swing"]),
    "cannon": ("cannon", "solid", ["pitch", "cannon_recoil"]),
    "drone": ("drone", "solid", ["drone_spin"]),
    "shield": ("shield", "glass", ["glass_pulse"]),
    "dome": ("dome", "glass", ["glass_pulse"]),
    "bubble": ("bubble", "glass", ["glass_pulse"]),
    "cage": ("cage", "solid", []),
    "drill": ("drill", "solid", ["pitch", "drill_spin"]),
    "claw": ("claw", "solid", ["pitch"]),
    "colossus": ("colossus", "solid", ["colossus_attack"]),
}
PROJECTILES = {"energy_bolt": "bolt", "missile": "missile"}


def construct_client(name, geo_key, style, extras):
    textures = {}
    for v in TEXTURED_CORPS:
        textures[v] = CT + (geo_key if v == "green" else f"{geo_key}_{v}")
        if style == "solid":
            textures[f"shimmer_{v}"] = CT + f"shimmer_{v}"
    anims = {
        "grow": "animation.glc.construct.grow",
        "dissolve": "animation.glc.construct.dissolve",
        "state": "controller.animation.glc.construct.state",
    }
    animate = ["state"]
    for e in extras:
        anims[e] = ANIM_ALIASES[e]
        animate.append(e)
    desc = {
        "identifier": f"glc:{name}",
        "materials": {"core": "entity_emissive_alpha", "glow": "charged_creeper"} if style == "solid"
        else {"core": "entity_beam_additive"},
        "textures": textures,
        "geometry": {"default": f"geometry.glc.{geo_key}"} | ({"glow": f"geometry.glc.{geo_key}_glow"} if style == "solid" else {}),
        "animations": anims,
        "scripts": {
            "pre_animation": [
                "v.size = q.property('glc:size');",
                "v.grow = math.min(q.life_time / 0.22, 1.0);",
                "v.grow = v.grow < 1.0 ? v.grow * (1.25 - 0.25 * v.grow) : 1.0;",
            ],
            "animate": animate,
            "should_update_bones_and_effects_offscreen": "1.0",
        },
        "render_controllers": ["controller.render.glc.construct_core"] +
                              (["controller.render.glc.construct_glow"] if style == "solid" else []),
    }
    if style == "glass":
        desc["render_controllers"] = ["controller.render.glc.construct_glass"]
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": desc}}


def projectile_client(name, geo_key):
    textures = {}
    for v in TEXTURED_CORPS:
        textures[v] = CT + (geo_key if v == "green" else f"{geo_key}_{v}")
        textures[f"shimmer_{v}"] = CT + f"shimmer_{v}"
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"glc:{name}",
        "materials": {"core": "entity_emissive_alpha", "glow": "charged_creeper"},
        "textures": textures,
        "geometry": {"default": f"geometry.glc.{geo_key}", "glow": f"geometry.glc.{geo_key}_glow"},
        "animations": {"face": "animation.glc.projectile.face"},
        "scripts": {"animate": ["face"]},
        "render_controllers": ["controller.render.glc.construct_core", "controller.render.glc.construct_glow"],
    }}}


def target_client():
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "glc:training_target",
        "materials": {"core": "entity_emissive_alpha", "glow": "charged_creeper"},
        "textures": {k: v for c in TEXTURED_CORPS
                     for k, v in ((c, CT + "training_target"), (f"shimmer_{c}", CT + "shimmer_green"))},
        "geometry": {"default": "geometry.glc.training_target", "glow": "geometry.glc.training_target_glow"},
        "animations": {"bob": "animation.glc.target.bob"},
        "scripts": {"animate": ["bob"]},
        "render_controllers": ["controller.render.glc.construct_core", "controller.render.glc.construct_glow"],
    }}}


def central_battery_client(groups):
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "glc:central_battery",
        "materials": {"metal": "entity_alphatest", "glow": "entity_emissive_alpha", "energy": "entity_beam_additive"},
        "textures": {"default": "textures/glc/entity/central_battery"},
        "geometry": {"default": "geometry.glc.central_battery"},
        "animations": {"idle": "animation.glc.central_battery.idle"},
        "scripts": {"animate": ["idle"], "should_update_bones_and_effects_offscreen": "1.0"},
        "render_controllers": ["controller.render.glc.battery_metal", "controller.render.glc.battery_glow",
                               "controller.render.glc.battery_energy"],
    }}}


def lantern_client(char):
    cid = char["id"]
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"glc:{cid}",
        "materials": {"default": "entity_emissive_alpha"},
        "textures": {"default": f"textures/glc/entity/lanterns/{cid}"},
        "geometry": {"default": "geometry.glc.lantern"},
        "spawn_egg": {"texture": f"glc_egg_{cid}", "texture_index": 0},
        "animations": {
            "look": "animation.glc.lantern.look",
            "idle": "animation.glc.lantern.idle",
            "walk": "animation.glc.lantern.walk",
            "fly": "animation.glc.lantern.fly",
            "hover": "animation.glc.lantern.hover",
            "cast": "animation.glc.lantern.cast",
            "pose": "controller.animation.glc.lantern.pose",
        },
        "scripts": {
            "pre_animation": ["v.casting = q.property('glc:casting');"],
            "animate": ["look", "pose"],
        },
        "render_controllers": ["controller.render.glc.lantern"],
        "enable_attachables": False,
    }}}


def render_controllers(battery_groups):
    arr_core = {"Array.core": [f"Texture.{corps_variant(c)}" for c in CORPS_IDS]}
    arr_glow = {"Array.glow": [f"Texture.shimmer_{corps_variant(c)}" for c in CORPS_IDS]}
    idx = f"math.clamp(q.property('glc:corps'), 0, {len(CORPS_IDS) - 1})"
    rc = {
        "controller.render.glc.construct_core": {
            "arrays": {"textures": arr_core},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.core"}],
            "textures": [f"Array.core[{idx}]"],
            "ignore_lighting": True,
        },
        "controller.render.glc.construct_glow": {
            "arrays": {"textures": arr_glow},
            "geometry": "Geometry.glow",
            "materials": [{"*": "Material.glow"}],
            "textures": [f"Array.glow[{idx}]"],
            "uv_anim": {"offset": ["q.life_time * 0.31", "q.life_time * 0.19"], "scale": [1.0, 1.0]},
            "ignore_lighting": True,
        },
        "controller.render.glc.construct_glass": {
            "arrays": {"textures": arr_core},
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.core"}],
            "textures": [f"Array.core[{idx}]"],
            "ignore_lighting": True,
        },
        "controller.render.glc.lantern": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
        },
        "controller.render.glc.suit": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
        },
        "controller.render.glc.ring_held": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "textures": ["Texture.default"],
            "ignore_lighting": True,
        },
    }
    for group, mat, lit in (("metal", "Material.metal", False), ("glow", "Material.glow", True),
                            ("energy", "Material.energy", True)):
        vis = [{"*": False}] + [{b: True} for b in battery_groups[group]]
        entry = {
            "geometry": "Geometry.default",
            "materials": [{"*": mat}],
            "textures": ["Texture.default"],
            "part_visibility": vis,
        }
        if lit:
            entry["ignore_lighting"] = True
        rc[f"controller.render.glc.battery_{group}"] = entry
    return {"format_version": "1.10.0", "render_controllers": rc}


def kf(d):
    return {f"{float(k):.2f}".rstrip("0").rstrip(".") if float(k) != int(float(k)) else f"{float(k):.1f}": v
            for k, v in d.items()}


ANIM_ALIASES = {
    "pitch": "animation.glc.construct.pitch",
    "hammer_slam": "animation.glc.hammer.slam",
    "blade_swing": "animation.glc.blade.swing",
    "cannon_recoil": "animation.glc.cannon.recoil",
    "drone_spin": "animation.glc.drone.spin",
    "drill_spin": "animation.glc.drill.spin",
    "glass_pulse": "animation.glc.glass.pulse",
    "colossus_attack": "animation.glc.colossus.attack",
}


def construct_animations():
    a = {
        "animation.glc.construct.grow": {"loop": True, "bones": {"root": {"scale": "v.size * v.grow"}}},
        "animation.glc.construct.dissolve": {
            "loop": "hold_on_last_frame", "animation_length": 0.4,
            "bones": {"root": {"scale": "v.size * math.max(0.0, 1.0 - q.anim_time * 2.8) * (1.0 + math.sin(q.anim_time * 2600.0) * 0.12)"}},
        },
        "animation.glc.construct.pitch": {"loop": True, "bones": {"pitch": {"rotation": ["q.property('glc:pitch')", 0, 0]}}},
        "animation.glc.hammer.slam": {
            "loop": "hold_on_last_frame", "animation_length": 0.6,
            "bones": {"swing": {"rotation": kf({"0.0": [0, 0, 0], "0.25": [-38, 0, 0], "0.4": [92, 0, 0],
                                                "0.46": [86, 0, 0], "0.55": [90, 0, 0]})}},
        },
        "animation.glc.blade.swing": {
            "loop": "hold_on_last_frame", "animation_length": 0.35,
            "bones": {"swing": {"rotation": kf({"0.0": [0, 85, 10], "0.22": [0, -85, -10], "0.35": [0, -95, -12]})}},
        },
        "animation.glc.cannon.recoil": {
            "loop": True, "animation_length": 0.25,
            "bones": {"barrel": {"position": kf({"0.0": [0, 0, 0], "0.04": [0, 0, 2.5], "0.25": [0, 0, 0]})}},
        },
        "animation.glc.drone.spin": {
            "loop": True,
            "bones": {"ring": {"rotation": [0, "q.life_time * 540", 0]},
                      "root": {"position": [0, "math.sin(q.life_time * 240) * 1.2", 0]}},
        },
        "animation.glc.drill.spin": {"loop": True, "bones": {"spin": {"rotation": [0, 0, "q.life_time * 1800"]}}},
        "animation.glc.glass.pulse": {
            "loop": True,
            "bones": {"root": {"scale": "v.size * v.grow * (1.0 + math.sin(q.life_time * 220) * 0.015)"}},
        },
        "animation.glc.colossus.attack": {
            "loop": "hold_on_last_frame", "animation_length": 2.6,
            "bones": {
                "root": {"position": kf({"0.0": [0, -48, 0], "0.8": [0, 0, 0]})},
                "rightArm": {"rotation": kf({"0.8": [0, 0, 0], "1.5": [-170, 0, -10], "1.75": [-175, 0, -10],
                                             "1.95": [-40, 0, 0], "2.6": [-45, 0, 0]})},
                "leftArm": {"rotation": kf({"0.8": [0, 0, 0], "1.5": [-170, 0, 10], "1.75": [-175, 0, 10],
                                            "1.95": [-40, 0, 0], "2.6": [-45, 0, 0]})},
                "body": {"rotation": kf({"0.8": [0, 0, 0], "1.6": [-8, 0, 0], "1.95": [24, 0, 0], "2.6": [20, 0, 0]})},
                "head": {"rotation": kf({"1.6": [-15, 0, 0], "1.95": [-10, 0, 0]})},
            },
        },
        "animation.glc.projectile.face": {
            "loop": True,
            "bones": {"body": {"rotation": ["-q.target_x_rotation", "-q.target_y_rotation", 0]}},
        },
        "animation.glc.target.bob": {
            "loop": True,
            "bones": {"disc": {"rotation": [0, "math.sin(q.life_time * 90) * 25", 0]},
                      "root": {"position": [0, "math.sin(q.life_time * 140) * 1.5", 0]}},
        },
        "animation.glc.central_battery.idle": {
            "loop": True,
            "bones": {
                "ring_a": {"rotation": [0, "q.life_time * 40", 0]},
                "ring_b": {"rotation": [0, "-q.life_time * 55", 0],
                           "position": [0, "math.sin(q.life_time * 60) * 1.5", 0]},
                "core_inner": {"scale": "1.0 + math.sin(q.life_time * 180) * 0.04"},
                "core_outer": {"scale": "1.0 + math.sin(q.life_time * 120 + 60) * 0.05"},
            },
        },
        "animation.glc.ring_held.float": {
            "loop": True,
            "bones": {
                "ring": {"position": ["c.is_first_person ? -2.0 : 0.0", "c.is_first_person ? 1.0 : -1.0",
                                      "c.is_first_person ? -3.0 : -1.5"],
                         "rotation": ["c.is_first_person ? 10.0 : 0.0", "c.is_first_person ? -30.0 : 0.0", 0.0]},
                "ring_float": {"rotation": [0, "q.life_time * 90", 0],
                               "position": [0, "math.sin(q.life_time * 160) * 0.4", 0]},
            },
        },
    }
    return {"format_version": "1.8.0", "animations": a}


def construct_controllers():
    return {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.glc.construct.state": {
            "initial_state": "active",
            "states": {
                "active": {"animations": ["grow"],
                           "transitions": [{"dissolving": "q.property('glc:state') == 2"}]},
                "dissolving": {"animations": ["dissolve"],
                               "transitions": [{"active": "q.property('glc:state') != 2"}]},
            },
        },
        "controller.animation.glc.lantern.pose": {
            "initial_state": "ground",
            "states": {
                "ground": {
                    "animations": [{"walk": "q.modified_move_speed"}, "idle", {"cast": "v.casting"}],
                    "transitions": [{"air": "!q.is_on_ground && !q.is_in_water"}],
                },
                "air": {
                    "animations": [{"fly": "q.modified_move_speed > 0.15"},
                                   {"hover": "q.modified_move_speed <= 0.15"}, {"cast": "v.casting"}],
                    "transitions": [{"ground": "q.is_on_ground || q.is_in_water"}],
                },
            },
        },
    }}


def lantern_animations():
    return {"format_version": "1.8.0", "animations": {
        "animation.glc.lantern.look": {
            "loop": True,
            "bones": {"head": {"rotation": ["q.target_x_rotation", "q.target_y_rotation", 0]}},
        },
        "animation.glc.lantern.idle": {
            "loop": True,
            "bones": {
                "rightArm": {"rotation": ["math.sin(q.life_time * 60) * 3", 0, "math.cos(q.life_time * 50) * 2 + 3"]},
                "leftArm": {"rotation": ["-math.sin(q.life_time * 60) * 3", 0, "-math.cos(q.life_time * 50) * 2 - 3"]},
            },
        },
        "animation.glc.lantern.walk": {
            "loop": True,
            "bones": {
                "rightArm": {"rotation": ["math.cos(q.modified_distance_moved * 38.17) * q.modified_move_speed * 57.3", 0, 0]},
                "leftArm": {"rotation": ["-math.cos(q.modified_distance_moved * 38.17) * q.modified_move_speed * 57.3", 0, 0]},
                "rightLeg": {"rotation": ["-math.cos(q.modified_distance_moved * 38.17) * q.modified_move_speed * 80.2", 0, 0]},
                "leftLeg": {"rotation": ["math.cos(q.modified_distance_moved * 38.17) * q.modified_move_speed * 80.2", 0, 0]},
            },
        },
        "animation.glc.lantern.fly": {
            "loop": True,
            "bones": {
                "waist": {"rotation": [70, 0, 0], "position": [0, 2, 0]},
                "head": {"rotation": [-55, 0, 0]},
                "rightArm": {"rotation": [-175, 0, -6]},
                "leftArm": {"rotation": ["-15 + math.sin(q.life_time * 200) * 4", 0, 8]},
                "rightLeg": {"rotation": ["4 + math.sin(q.life_time * 180) * 3", 0, 2]},
                "leftLeg": {"rotation": ["-2 - math.sin(q.life_time * 180) * 3", 0, -2]},
            },
        },
        "animation.glc.lantern.hover": {
            "loop": True,
            "bones": {
                "waist": {"position": [0, "math.sin(q.life_time * 120) * 0.8", 0]},
                "rightArm": {"rotation": [0, 0, 12]},
                "leftArm": {"rotation": [0, 0, -12]},
                "rightLeg": {"rotation": ["6 + math.sin(q.life_time * 90) * 4", 0, 4]},
                "leftLeg": {"rotation": ["-4 - math.sin(q.life_time * 90) * 4", 0, -4]},
            },
        },
        "animation.glc.lantern.cast": {
            "loop": True,
            "bones": {"rightArm": {"rotation": ["-90 + q.target_x_rotation", "q.target_y_rotation * 0.5", 0]}},
        },
    }}



# Player poses, played from scripts with Entity.playAnimation on their own runtime
# controllers (glc:cast, glc:flight).  Third person only: every channel is zero in
# first person and in the inventory paper doll.
_TP = "(v.is_first_person || v.is_paperdoll) ? 0 : "
_FLY = "math.clamp((q.ground_speed + math.abs(q.vertical_speed)) / 8, 0, 1)"


def _cast_arm(yaw):
    aim = [_TP + "-90 + q.target_x_rotation - this", _TP + f"{yaw} + q.target_y_rotation - this", 0]
    return {"rotation": {"0.0": [0, 0, 0], "0.1": aim, "0.45": aim, "0.65": [0, 0, 0]}}


def player_animations():
    a = _FLY
    return {"format_version": "1.8.0", "animations": {
        "animation.glc.player.cast_right": {"animation_length": 0.65, "bones": {"rightArm": _cast_arm(-5)}},
        "animation.glc.player.cast_left": {"animation_length": 0.65, "bones": {"leftArm": _cast_arm(5)}},
        # superhero pose: upright while hovering, leaning into the flight direction with speed
        "animation.glc.player.flight": {
            "loop": True,
            "bones": {
                "root": {
                    "rotation": [_TP + f"{a} * (90 + q.target_x_rotation - this)", 0, 0],
                    "position": [0, _TP + f"(math.sin(q.target_x_rotation) * 17 + 5) * {a}",
                                 _TP + f"math.cos(q.target_x_rotation) * 17 * {a}"],
                },
                "head": {"rotation": [_TP + f"{a} * (-55 - this)", 0, 0]},
                "rightArm": {"rotation": [_TP + f"{a} * (-172 - this)", 0, _TP + f"(1 - {a}) * 12"]},
                "leftArm": {"rotation": [_TP + f"{a} * (-10 - this)", 0, _TP + f"-(1 - {a}) * 12 - {a} * 6"]},
                "rightLeg": {"rotation": [_TP + f"{a} * (4 - this) + (1 - {a}) * math.sin(q.life_time * 90) * 4", 0, 0]},
                "leftLeg": {"rotation": [_TP + f"{a} * (-6 - this) - (1 - {a}) * math.sin(q.life_time * 90) * 4", 0, 0]},
            },
        },
        # played on the flight controller to end the pose
        "animation.glc.player.reset": {"animation_length": 0.05, "bones": {"root": {"rotation": [0, 0, 0]}}},
    }}

def ring_attachable():
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": "glc:power_ring",
        "materials": {"default": "entity_emissive_alpha"},
        "textures": {"default": "textures/glc/attachables/power_ring"},
        "geometry": {"default": "geometry.glc.ring_held"},
        "animations": {"float": "animation.glc.ring_held.float"},
        "scripts": {"animate": ["float"]},
        "render_controllers": ["controller.render.glc.ring_held"],
    }}}


def suit_attachable(suit):
    tex_char = suit["character"] or "corps_uniform"
    return {"format_version": "1.10.0", "minecraft:attachable": {"description": {
        "identifier": f"glc:{suit['id']}",
        "item": {f"glc:{suit['id']}": "query.owner_identifier == 'minecraft:player'"},
        "materials": {"default": "entity_emissive_alpha"},
        "textures": {"default": f"textures/glc/entity/lanterns/{tex_char}"},
        "geometry": {"default": "geometry.glc.suit"},
        "scripts": {"parent_setup": "variable.chest_layer_visible = 0.0; variable.leg_layer_visible = 0.0; "
                                    "variable.boot_layer_visible = 0.0;" +
                                    (" variable.helmet_layer_visible = 0.0;" if suit["character"] else "")},
        "render_controllers": ["controller.render.glc.suit"],
    }}}
