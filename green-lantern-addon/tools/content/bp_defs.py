"""Behavior-pack JSON: entities, items, blocks, recipes, loot tables."""
from content.game_data import CHARACTERS, SUITS

FMT_ENTITY = "1.26.0"
FMT_ITEM = "1.26.0"
FMT_BLOCK = "1.26.0"

CONSTRUCT_PROPS = {
    "glc:state": {"type": "int", "range": [0, 3], "default": 0, "client_sync": True},
    "glc:corps": {"type": "int", "range": [0, 8], "default": 0, "client_sync": True},
    "glc:size": {"type": "float", "range": [0.1, 16.0], "default": 1.0, "client_sync": True},
    "glc:pitch": {"type": "float", "range": [-90.0, 90.0], "default": 0.0, "client_sync": True},
}

BANDWIDTH = {"minecraft:conditional_bandwidth_optimization": {
    "default_values": {"max_optimized_distance": 80.0, "max_dropped_ticks": 0, "use_motion_prediction_hints": True}}}


def _despawn_events(lifetime):
    return (
        {"glc:despawn": {"minecraft:instant_despawn": {}}},
        {"minecraft:timer": {"looping": False, "time": lifetime, "randomInterval": False,
                             "time_down_event": {"event": "glc:despawn", "target": "self"}}},
        {"glc:despawn": {"add": {"component_groups": ["glc:despawn"]}}},
    )


def construct_entity(name, lifetime=60, box=(0.4, 0.4)):
    """Script-driven hard-light construct: no physics, invulnerable, self-despawning."""
    groups, timer, events = _despawn_events(lifetime)
    comps = {
        "minecraft:type_family": {"family": ["glc_construct", "inanimate"]},
        "minecraft:collision_box": {"width": box[0], "height": box[1]},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        "minecraft:health": {"value": 1000, "max": 1000},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:fire_immune": {},
        "minecraft:breathable": {"breathes_air": True, "breathes_water": True, "breathes_solids": True,
                                 "suffocate_time": -1, "total_supply": 15},
        **timer,
        **BANDWIDTH,
    }
    return {"format_version": FMT_ENTITY, "minecraft:entity": {
        "description": {"identifier": f"glc:{name}", "is_spawnable": False, "is_summonable": True,
                        "properties": CONSTRUCT_PROPS},
        "component_groups": groups,
        "components": comps,
        "events": events,
    }}


def projectile_entity(name, damage, power=2.0, lifetime=6):
    groups, timer, events = _despawn_events(lifetime)
    on_hit = {"remove_on_hit": {}}
    if damage:
        on_hit["impact_damage"] = {"damage": {"min": damage, "max": damage}, "knockback": True,
                                   "apply_knockback_to_blocking_targets": True}
    return {"format_version": FMT_ENTITY, "minecraft:entity": {
        "description": {"identifier": f"glc:{name}", "is_spawnable": False, "is_summonable": True,
                        "properties": {"glc:corps": CONSTRUCT_PROPS["glc:corps"]}},
        "component_groups": groups,
        "components": {
            "minecraft:type_family": {"family": ["glc_projectile", "projectile"]},
            "minecraft:collision_box": {"width": 0.3, "height": 0.3},
            "minecraft:projectile": {
                "on_hit": on_hit,
                "power": power, "gravity": 0.0, "inertia": 1.0, "liquid_inertia": 1.0,
                "uncertainty_base": 0.5, "uncertainty_multiplier": 0.0,
                "anchor": 1, "offset": [0, -0.1, 0], "reflect_on_hurt": False,
            },
            "minecraft:physics": {},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            **timer,
            **BANDWIDTH,
        },
        "events": events,
    }}


def training_target():
    groups, timer, events = _despawn_events(120)
    return {"format_version": FMT_ENTITY, "minecraft:entity": {
        "description": {"identifier": "glc:training_target", "is_spawnable": False, "is_summonable": True},
        "component_groups": groups,
        "components": {
            "minecraft:type_family": {"family": ["glc_training", "inanimate"]},
            "minecraft:collision_box": {"width": 1.0, "height": 1.7},
            "minecraft:health": {"value": 24, "max": 24},
            "minecraft:physics": {"has_gravity": False, "has_collision": True},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:knockback_resistance": {"value": 1.0},
            "minecraft:fire_immune": {},
            "minecraft:damage_sensor": {"triggers": [
                {"cause": "fall", "deals_damage": "no"},
                {"cause": "suffocation", "deals_damage": "no"},
                {"cause": "drowning", "deals_damage": "no"},
            ]},
            "minecraft:breathable": {"breathes_air": True, "breathes_water": True, "suffocate_time": -1},
            **timer,
            **BANDWIDTH,
        },
        "events": events,
    }}


def central_battery():
    return {"format_version": FMT_ENTITY, "minecraft:entity": {
        "description": {"identifier": "glc:central_battery", "is_spawnable": False, "is_summonable": True},
        "components": {
            "minecraft:type_family": {"family": ["glc_battery", "inanimate"]},
            "minecraft:collision_box": {"width": 2.6, "height": 3.2},
            "minecraft:health": {"value": 500, "max": 500},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
            "minecraft:physics": {"has_gravity": True, "has_collision": True},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:knockback_resistance": {"value": 1.0},
            "minecraft:persistent": {},
            "minecraft:fire_immune": {},
            "minecraft:is_collidable": {},
            "minecraft:breathable": {"breathes_air": True, "breathes_water": True, "suffocate_time": -1},
            "minecraft:interact": {"interactions": [{
                "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"},
                                "event": "glc:battery_interact", "target": "self"},
                "interact_text": "action.interact.glc.battery",
                "swing": True,
            }]},
        },
        "events": {"glc:battery_interact": {}},
    }}


def lantern_npc(char):
    cid = char["id"]
    ally = char["ally"]
    corps = char["corps"]
    groups = {"glc:despawn": {"minecraft:instant_despawn": {}}}
    events = {"glc:despawn": {"add": {"component_groups": ["glc:despawn"]}}, "glc:npc_interact": {}}
    comps = {
        "minecraft:type_family": {"family": ["glc_lantern", f"lantern_{corps}", "mob"]},
        "minecraft:health": {"value": 60, "max": 60},
        "minecraft:collision_box": {"width": 0.6, "height": 1.8},
        "minecraft:movement": {"value": 0.3},
        "minecraft:flying_speed": {"value": 0.16},
        "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_pass_doors": True,
                                       "can_path_from_air": True, "avoid_water": True,
                                       "avoid_damage_blocks": True, "avoid_sun": False},
        "minecraft:movement.hover": {},
        "minecraft:can_fly": {},
        "minecraft:jump.static": {},
        "minecraft:physics": {"has_gravity": False},
        "minecraft:follow_range": {"value": 32},
        "minecraft:attack": {"damage": 6},
        "minecraft:shooter": {"def": "glc:energy_bolt"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.ranged_attack": {
            "priority": 3, "speed_multiplier": 1.15, "burst_shots": 2, "burst_interval": 0.25,
            "attack_interval": {"min": 1.2, "max": 2.2}, "attack_range": {"min": 0.0, "max": 18.0},
        },
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 4, "must_see": True, "reselect_targets": True, "within_radius": 22,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "monster"}, "max_dist": 22}],
        },
        "minecraft:behavior.random_hover": {"priority": 9, "xz_dist": 8, "y_dist": 4, "y_offset": -1,
                                            "interval": 1, "hover_height": [1, 4]},
        "minecraft:behavior.look_at_player": {"priority": 10, "look_distance": 8},
        "minecraft:behavior.random_look_around": {"priority": 11},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
        "minecraft:persistent": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:knockback_resistance": {"value": 0.4},
        "minecraft:interact": {"interactions": [{
            "on_interact": {"filters": {"test": "is_family", "subject": "other", "value": "player"},
                            "event": "glc:npc_interact", "target": "self"},
            "interact_text": "action.interact.glc.talk",
        }]},
        **BANDWIDTH,
    }
    if ally:
        # allies: never hurt by players (prevents friendly fire from constructs), follow owner once bound
        comps["minecraft:damage_sensor"] = {"triggers": [
            {"cause": "fall", "deals_damage": "no"},
            {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "player"}}, "deals_damage": "no"},
            {"on_damage": {"filters": {"test": "is_family", "subject": "other", "value": "glc_lantern"}}, "deals_damage": "no"},
        ]}
        comps["minecraft:behavior.hurt_by_target"] = {
            "priority": 2, "entity_types": {"filters": {"all_of": [
                {"test": "is_family", "subject": "other", "operator": "!=", "value": "player"},
                {"test": "is_family", "subject": "other", "operator": "!=", "value": "glc_lantern"}]}}}
        groups["glc:wild"] = {"minecraft:tameable": {"probability": 1.0, "tame_items": "minecraft:structure_void",
                                                     "tame_event": {"event": "glc:on_tame", "target": "self"}}}
        groups["glc:tamed"] = {
            "minecraft:is_tamed": {},
            "minecraft:behavior.follow_owner": {"priority": 6, "speed_multiplier": 1.3, "start_distance": 9,
                                                "stop_distance": 3, "can_teleport": True, "ignore_vibration": True},
            "minecraft:behavior.owner_hurt_by_target": {"priority": 1},
            "minecraft:behavior.owner_hurt_target": {"priority": 2},
        }
        events["minecraft:entity_spawned"] = {"add": {"component_groups": ["glc:wild"]}}
        events["glc:on_tame"] = {"remove": {"component_groups": ["glc:wild"]}, "add": {"component_groups": ["glc:tamed"]}}
    else:
        comps["minecraft:damage_sensor"] = {"triggers": [{"cause": "fall", "deals_damage": "no"}]}
        comps["minecraft:behavior.hurt_by_target"] = {"priority": 1}
    return {"format_version": FMT_ENTITY, "minecraft:entity": {
        "description": {"identifier": f"glc:{cid}", "is_spawnable": True, "is_summonable": True,
                        "properties": {"glc:casting": {"type": "bool", "default": False, "client_sync": True}}},
        "component_groups": groups,
        "components": comps,
        "events": events,
    }}


# ------------------------------------------------------------------ items
def item(ident, icon, category="equipment", group=None, extra=None, stack=1):
    desc = {"identifier": f"glc:{ident}", "menu_category": {"category": category}}
    if group:
        desc["menu_category"]["group"] = group
    comps = {
        "minecraft:icon": icon,
        "minecraft:display_name": {"value": f"item.glc:{ident}.name"},
        "minecraft:max_stack_size": stack,
    }
    comps.update(extra or {})
    return {"format_version": FMT_ITEM, "minecraft:item": {"description": desc, "components": comps}}


def items():
    out = {
        "power_ring": item("power_ring", "glc_power_ring", extra={
            "minecraft:allow_off_hand": True,
            "minecraft:hand_equipped": False,
            "minecraft:rarity": "epic",
            "minecraft:interact_button": "action.interact.glc.use_ring",
            "minecraft:fire_resistant": {"value": True},
            "minecraft:tags": {"tags": ["glc:power_ring"]},
            "glc:power_ring": {},
        }),
        "central_battery": item("central_battery", "glc_central_battery", category="items", extra={
            "minecraft:rarity": "epic",
            "minecraft:entity_placer": {"entity": "glc:central_battery"},
        }),
        "book_of_oa": item("book_of_oa", "glc_book_of_oa", category="items", extra={
            "minecraft:rarity": "rare",
            "glc:book_of_oa": {},
        }),
    }
    for s in SUITS:
        out[s["id"]] = item(s["id"], f"glc_{s['id']}", extra={
            "minecraft:wearable": {"slot": "slot.armor.chest", "protection": 3},
            "minecraft:rarity": "rare",
            "minecraft:tags": {"tags": ["glc:suit"]},
        })
    return out


# ------------------------------------------------------------------ blocks
def blocks():
    battery = {"format_version": FMT_BLOCK, "minecraft:block": {
        "description": {"identifier": "glc:power_battery",
                        "menu_category": {"category": "items"}},
        "components": {
            "minecraft:display_name": "tile.glc:power_battery.name",
            "minecraft:geometry": "geometry.glc.power_battery",
            "minecraft:material_instances": {"*": {"texture": "glc_power_battery", "render_method": "alpha_test"}},
            "minecraft:light_emission": 13,
            "minecraft:light_dampening": 0,
            "minecraft:collision_box": {"origin": [-6, 0, -6], "size": [12, 16, 12]},
            "minecraft:selection_box": {"origin": [-6, 0, -6], "size": [12, 16, 12]},
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 30},
            "minecraft:map_color": [40, 220, 100],
            "minecraft:tick": {"interval_range": [30, 60], "looping": True},
            "glc:power_battery": {},
        },
    }}
    hardlight = {"format_version": FMT_BLOCK, "minecraft:block": {
        "description": {"identifier": "glc:hardlight",
                        "menu_category": {"category": "none", "is_hidden_in_commands": False},
                        "states": {"glc:life": {"values": {"min": 0, "max": 15}}}},
        "components": {
            "minecraft:display_name": "tile.glc:hardlight.name",
            "minecraft:geometry": "minecraft:geometry.full_block",
            "minecraft:material_instances": {"*": {"texture": "glc_hardlight", "render_method": "blend"}},
            "minecraft:light_emission": 9,
            "minecraft:light_dampening": 0,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 0.25},
            "minecraft:destructible_by_explosion": {"explosion_resistance": 60},
            "minecraft:loot": "loot_tables/glc/empty.json",
            "minecraft:map_color": [60, 240, 120],
            "minecraft:tick": {"interval_range": [40, 40], "looping": True},
            "glc:hardlight": {},
        },
    }}
    return {"power_battery": battery, "hardlight": hardlight}


# ------------------------------------------------------------------ recipes
def recipes():
    def shaped(ident, pattern, key, result, unlock):
        return {"format_version": "1.20.10", "minecraft:recipe_shaped": {
            "description": {"identifier": f"glc:{ident}"},
            "tags": ["crafting_table"],
            "pattern": pattern,
            "key": {k: {"item": v} for k, v in key.items()},
            "unlock": [{"item": u} for u in unlock],
            "result": {"item": result, "count": 1},
        }}
    return {
        "power_ring": shaped("power_ring", [" E ", "G#G", " G "],
                             {"E": "minecraft:emerald", "#": "minecraft:ender_eye", "G": "minecraft:gold_ingot"},
                             "glc:power_ring", ["minecraft:emerald"]),
        "power_battery": shaped("power_battery", ["GEG", "ELE", "GEG"],
                                {"G": "minecraft:gold_ingot", "E": "minecraft:emerald", "L": "minecraft:lantern"},
                                "glc:power_battery", ["minecraft:emerald"]),
        "central_battery": shaped("central_battery", ["BGB", "GPG", "BGB"],
                                  {"B": "minecraft:emerald_block", "G": "minecraft:gold_block", "P": "glc:power_battery"},
                                  "glc:central_battery", ["glc:power_battery"]),
        "book_of_oa": shaped("book_of_oa", [" E ", "EBE", " E "],
                             {"E": "minecraft:emerald", "B": "minecraft:book"},
                             "glc:book_of_oa", ["minecraft:book"]),
    }


def loot_tables():
    return {"empty": {"pools": []}}
