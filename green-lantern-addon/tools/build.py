#!/usr/bin/env python3
"""Build every generated asset of the Green Lantern add-on.

Usage:  python3 tools/build.py [--skip-audio] [--no-previews] [--version 1.0.0]

Hand-written files (the gameplay scripts in packs/GreenLanternBP/scripts/,
except scripts/data/) are never touched.  Everything else in both packs is
regenerated from tools/content/*.
"""
import argparse
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from glc import io, paint, render  # noqa: E402
from glc.geo import geometry_file, glow_shell  # noqa: E402
from content import (art, bp_defs, construct_models as cm, game_data as gd, other_models as om,  # noqa: E402
                     particles_def, rp_defs, skins, sounds_def)

BP_UUID = "ddd42aa2-e145-40c9-95a3-e27b9b7046e5"
BP_DATA_UUID = "71b68b61-e6f2-448f-9b8c-29a6e5aff068"
BP_SCRIPT_UUID = "23ebdbcf-1406-431a-8612-cefb26f0d869"
RP_UUID = "04c07b79-0fe8-4a1b-9a44-221130a61b68"
RP_RES_UUID = "86175f8b-3e46-4195-9c14-b87c46c24018"
MIN_ENGINE = [1, 26, 10]
SERVER_VERSION = "2.6.0"
SERVER_UI_VERSION = "2.0.0"

BP_GENERATED = ["entities", "items", "blocks", "recipes", "loot_tables", "texts", "scripts/data",
                "manifest.json", "pack_icon.png"]
PREVIEWS = os.path.join(io.ROOT, "docs", "previews")


def clean():
    if os.path.isdir(io.RP):
        shutil.rmtree(io.RP)
    for rel in BP_GENERATED:
        p = io.bp(rel)
        if os.path.isdir(p):
            shutil.rmtree(p)
        elif os.path.isfile(p):
            os.remove(p)


def tex_for(geo, corps="green", glass=False):
    img = paint.new(geo.tex_w, geo.tex_h)
    paint.paint_geometry(geo, img, corps=corps)
    if geo.identifier.endswith((".dome", ".bubble")):
        paint.energy_face(img, (0, 0, 32, 32), corps=corps, pattern="hex", mode="glass")
        paint.energy_face(img, (32, 0, 32, 32), corps=corps, pattern="hex", mode="glass", intensity=0.7)
    return img


def build_models():
    """Construct + other models with matching textures. Returns dict for icons/previews."""
    out = {}
    ct = "textures/glc/entity/constructs/"
    for name, fn in cm.ALL.items():
        geo = fn()
        style = cm.STYLE.get(name, "solid")
        green = tex_for(geo)
        io.save_png(green, io.rp(ct + name + ".png"))
        yellow = paint.recolor_hue(green, paint.CORPS["yellow"]["hue"], paint.CORPS["green"]["hue"])
        io.save_png(yellow, io.rp(ct + name + "_yellow.png"))
        geos = [geo]
        if style == "solid":
            geos.append(glow_shell(geo))
        io.write_json(io.rp("models", "entity", "glc", f"{name}.geo.json"), geometry_file(*geos))
        out[name] = (geo, green, style)
    for corps in ("green", "yellow"):
        io.save_png(paint.seamless_streaks(64, corps), io.rp(ct + f"shimmer_{corps}.png"))

    # personal power battery (block)
    blk = om.power_battery_block()
    btex = tex_for(blk)
    io.save_png(btex, io.rp("textures/glc/blocks/power_battery.png"))
    io.write_json(io.rp("models", "blocks", "glc", "power_battery.geo.json"), geometry_file(blk))
    out["power_battery"] = (blk, btex, "block")
    io.save_png(art.hardlight_texture(), io.rp("textures/glc/blocks/hardlight.png"))

    # central power battery (entity)
    cb = om.central_battery()
    cbt = tex_for(cb)
    io.save_png(cbt, io.rp("textures/glc/entity/central_battery.png"))
    io.write_json(io.rp("models", "entity", "glc", "central_battery.geo.json"), geometry_file(cb))
    out["central_battery"] = (cb, cbt, "battery")

    # ring attachable
    ring = om.ring_held()
    rtex = tex_for(ring)
    io.save_png(rtex, io.rp("textures/glc/attachables/power_ring.png"))
    io.write_json(io.rp("models", "entity", "glc", "ring_held.geo.json"), geometry_file(ring))
    out["ring_held"] = (ring, rtex, "solid")

    # humanoids
    npc, suit = om.lantern_npc(), om.suit()
    io.write_json(io.rp("models", "entity", "glc", "lantern.geo.json"), geometry_file(npc))
    io.write_json(io.rp("models", "entity", "glc", "suit.geo.json"), geometry_file(suit))
    chars = {}
    for cid in skins.DESIGNS:
        t = skins.paint(cid)
        io.save_png(t, io.rp(f"textures/glc/entity/lanterns/{cid}.png"))
        chars[cid] = t
    out["_chars"] = chars
    out["_npc"], out["_suit"] = npc, suit
    return out


def build_rp_defs(models):
    for name, (geo_key, style, extras) in rp_defs.CONSTRUCT_ENTITIES.items():
        io.write_json(io.rp("entity", "glc", f"{name}.entity.json"),
                      rp_defs.construct_client(name, geo_key, style, extras))
    for name, geo_key in rp_defs.PROJECTILES.items():
        io.write_json(io.rp("entity", "glc", f"{name}.entity.json"), rp_defs.projectile_client(name, geo_key))
    io.write_json(io.rp("entity", "glc", "training_target.entity.json"), rp_defs.target_client())
    cb_geo = models["central_battery"][0]
    io.write_json(io.rp("entity", "glc", "central_battery.entity.json"), rp_defs.central_battery_client(cb_geo.groups))
    for ch in gd.CHARACTERS:
        io.write_json(io.rp("entity", "glc", f"{ch['id']}.entity.json"), rp_defs.lantern_client(ch))
    io.write_json(io.rp("render_controllers", "glc.render_controllers.json"), rp_defs.render_controllers(cb_geo.groups))
    io.write_json(io.rp("animations", "glc_constructs.animation.json"), rp_defs.construct_animations())
    io.write_json(io.rp("animations", "glc_lanterns.animation.json"), rp_defs.lantern_animations())
    io.write_json(io.rp("animations", "glc_player.animation.json"), rp_defs.player_animations())
    io.write_json(io.rp("animation_controllers", "glc.animation_controllers.json"), rp_defs.construct_controllers())
    io.write_json(io.rp("attachables", "glc", "power_ring.json"), rp_defs.ring_attachable())
    for s in gd.SUITS:
        io.write_json(io.rp("attachables", "glc", f"{s['id']}.json"), rp_defs.suit_attachable(s))


def build_icons(models):
    """Item icons, menu icons, spawn eggs; returns item_texture entries."""
    items = {}

    def item_icon(key, img):
        io.save_png(img, io.rp(f"textures/glc/items/{key}.png"))
        items[f"glc_{key}"] = {"textures": f"textures/glc/items/{key}"}

    item_icon("power_ring", art.power_ring_icon())
    item_icon("central_battery", art.lantern_icon(32))
    item_icon("book_of_oa", art.book_icon())
    chars = models["_chars"]
    for s in gd.SUITS:
        item_icon(s["id"], art.suit_icon(chars[s["character"] or "corps_uniform"]))
    portraits = {}
    for ch in gd.CHARACTERS:
        frame = paint.CORPS[ch["corps"]]["core"]
        p32 = skins.portrait(chars[ch["id"]], frame=frame)
        io.save_png(p32, io.rp(f"textures/glc/items/egg_{ch['id']}.png"))
        items[f"glc_egg_{ch['id']}"] = {"textures": f"textures/glc/items/egg_{ch['id']}"}
        p64 = skins.portrait(chars[ch["id"]], frame=frame, size=32).resize((64, 64), 0)
        portraits[ch["id"]] = p64
        io.save_png(p64, io.rp(f"textures/glc/ui/portrait_{ch['id']}.png"))

    ui = {}
    views = {"fist": (160, 20), "hammer": (150, 15), "blade": (45, 70), "cannon": (140, 20), "shield": (160, 10),
             "dome": (150, 25), "bubble": (150, 20), "cage": (150, 20), "drill": (140, 20), "colossus": (160, 10),
             "drone": (150, 30), "claw": (150, 30), "missile": (130, 35), "training_target": (160, 10)}
    rend = {}
    for name, (yaw, pitch) in views.items():
        geo, tex, style = models[name]
        rend[name] = art.model_icon(geo, tex, yaw=yaw, pitch=pitch, style=style)

    def small(img, s):
        return img.resize((s, s), 1)

    ui["icon_beam"] = art.icon_beam()
    ui["icon_fist"] = rend["fist"]
    ui["icon_blade"] = rend["blade"]
    ui["icon_hammer"] = rend["hammer"]
    ui["icon_cannon"] = rend["cannon"]
    ui["icon_missiles"] = art.compose((small(rend["missile"], 34), (2, 26)), (small(rend["missile"], 34), (16, 8)),
                                      (small(rend["missile"], 34), (30, 22)))
    ui["icon_drones"] = art.compose((small(rend["drone"], 40), (0, 6)), (small(rend["drone"], 40), (24, 22)))
    ui["icon_shield"] = rend["shield"]
    ui["icon_wall"] = art.icon_wall()
    ui["icon_bubble"] = rend["bubble"]
    ui["icon_dome"] = rend["dome"]
    ui["icon_platform"] = art.icon_platform()
    ui["icon_bridge"] = art.icon_bridge()
    ui["icon_grapple"] = art.compose((art.icon_beam().rotate(0), (0, 0)), (small(rend["claw"], 34), (28, 0)))
    ui["icon_cage"] = rend["cage"]
    ui["icon_drill"] = rend["drill"]
    ui["icon_giant_fist"] = art.compose((art.icon_bridge().point(lambda v: v // 3), (0, 0)), (rend["fist"], (0, 0)))
    ui["icon_titan_hammer"] = art.compose((art.icon_platform(), (0, 10)), (small(rend["hammer"], 56), (4, 0)))
    ui["icon_lance"] = art.icon_lance()
    ui["icon_aegis"] = art.compose((rend["dome"], (0, 0)), (small(art.emblem_icon(64), 30), (17, 26)))
    ui["icon_colossus"] = rend["colossus"]
    ui["cat_offense"] = rend["fist"]
    ui["cat_defense"] = rend["shield"]
    ui["cat_utility"] = art.icon_platform()
    ui["cat_advanced"] = rend["colossus"]
    ui["ui_flight"] = art.icon_flight()
    ui["ui_status"] = art.icon_status()
    ui["ui_oath"] = art.icon_scroll()
    ui["ui_guide"] = art.book_icon().resize((64, 64), 0)
    ui["ui_settings"] = art.icon_gear()
    ui["ui_power"] = art.icon_power()
    ui["ui_recharge"] = art.lantern_icon(32).resize((64, 64), 0)
    ui["ui_training"] = rend["training_target"]
    ui["ui_allies"] = art.icon_people([portraits[c["id"]] for c in gd.CHARACTERS if c["ally"]])
    ui["ui_back"] = art.icon_back()
    ui["ui_locked"] = art.icon_lock()
    ui["ui_dismantle"] = art.icon_wrench()
    ui["ui_emblem"] = art.emblem_icon(64)
    ui["ui_emblem_yellow"] = art.emblem_icon(64, "yellow", (255, 214, 60))
    ui["ui_ring"] = art.power_ring_icon().resize((64, 64), 0)
    for n in range(1, 6):
        ui[f"ui_rank_{n}"] = art.icon_rank(n)
    for key, img in ui.items():
        io.save_png(img, io.rp(f"textures/glc/ui/{key}.png"))
    return items, ui, rend, portraits


def build_particles():
    for name, img in art.particle_textures().items():
        io.save_png(img, io.rp(f"textures/glc/particle/{name}.png"))
    return particles_def.build()


def lang_rp():
    L = ["pack.name=Green Lantern Corps (Resources)",
         "pack.description=Power Ring, oath, constructs, flight and Lanterns. Unofficial fan-made add-on.",
         "item.glc:power_ring.name=§aPower Ring",
         "item.glc:central_battery.name=§aCentral Power Battery",
         "item.glc:book_of_oa.name=§aBook of Oa",
         "tile.glc:power_battery.name=Power Battery",
         "tile.glc:hardlight.name=Hard-Light Construct",
         "action.interact.glc.battery=Recharge",
         "action.interact.glc.talk=Talk",
         "action.interact.glc.use_ring=Use Ring"]
    for s in gd.SUITS:
        L.append(f"item.glc:{s['id']}.name={s['name']}")
    for ch in gd.CHARACTERS:
        L.append(f"entity.glc:{ch['id']}.name={ch['name']}")
        L.append(f"item.spawn_egg.entity.glc:{ch['id']}.name=Summon {ch['name']}")
    for name in list(rp_defs.CONSTRUCT_ENTITIES) + list(rp_defs.PROJECTILES):
        L.append(f"entity.glc:{name}.name=Hard-Light {name.replace('_', ' ').title()}")
    L += ["entity.glc:training_target.name=Training Target",
          "entity.glc:central_battery.name=Central Power Battery"]
    return "\n".join(L) + "\n"


def write_rp_meta(items_tex, sound_ids, particle_ids, version):
    io.write_json(io.rp("manifest.json"), {
        "format_version": 2,
        "header": {"name": "pack.name", "description": "pack.description", "uuid": RP_UUID,
                   "version": version, "min_engine_version": MIN_ENGINE},
        "modules": [{"type": "resources", "uuid": RP_RES_UUID, "version": version}],
        "dependencies": [{"uuid": BP_UUID, "version": version}],
        "metadata": {"authors": ["Green Lantern add-on (unofficial fan creation)"]},
    })
    io.save_png(art.pack_icon("RP"), io.rp("pack_icon.png"))
    io.write_json(io.rp("textures", "item_texture.json"),
                  {"resource_pack_name": "glc", "texture_name": "atlas.items", "texture_data": items_tex})
    io.write_json(io.rp("textures", "terrain_texture.json"), {
        "resource_pack_name": "glc", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
        "texture_data": {"glc_power_battery": {"textures": "textures/glc/blocks/power_battery"},
                         "glc_hardlight": {"textures": "textures/glc/blocks/hardlight"}}})
    io.write_json(io.rp("blocks.json"), {"glc:power_battery": {"sound": "lantern"},
                                          "glc:hardlight": {"sound": "glass"}})
    io.save_png(art.glyph_sheet(), io.rp("font", "glyph_EC.png"))
    io.write_text(io.rp("texts", "en_US.lang"), lang_rp())
    io.write_json(io.rp("texts", "languages.json"), ["en_US"])


def write_bp(version):
    for name in rp_defs.CONSTRUCT_ENTITIES:
        life = {"drone": 40, "dome": 40, "colossus": 20, "shield": 30, "bubble": 30, "cage": 30}.get(name, 20)
        io.write_json(io.bp("entities", "glc", f"{name}.json"), bp_defs.construct_entity(name, lifetime=life))
    io.write_json(io.bp("entities", "glc", "energy_bolt.json"), bp_defs.projectile_entity("energy_bolt", 5, power=2.4))
    io.write_json(io.bp("entities", "glc", "missile.json"), bp_defs.projectile_entity("missile", 0, power=1.2, lifetime=8))
    io.write_json(io.bp("entities", "glc", "training_target.json"), bp_defs.training_target())
    io.write_json(io.bp("entities", "glc", "central_battery.json"), bp_defs.central_battery())
    for ch in gd.CHARACTERS:
        io.write_json(io.bp("entities", "glc", f"{ch['id']}.json"), bp_defs.lantern_npc(ch))
    for name, data in bp_defs.items().items():
        io.write_json(io.bp("items", "glc", f"{name}.json"), data)
    for name, data in bp_defs.blocks().items():
        io.write_json(io.bp("blocks", "glc", f"{name}.json"), data)
    for name, data in bp_defs.recipes().items():
        io.write_json(io.bp("recipes", "glc", f"{name}.json"), data)
    for name, data in bp_defs.loot_tables().items():
        io.write_json(io.bp("loot_tables", "glc", f"{name}.json"), data)
    io.write_json(io.bp("manifest.json"), {
        "format_version": 2,
        "header": {"name": "pack.name", "description": "pack.description", "uuid": BP_UUID,
                   "version": version, "min_engine_version": MIN_ENGINE},
        "modules": [
            {"type": "data", "uuid": BP_DATA_UUID, "version": version},
            {"type": "script", "language": "javascript", "entry": "scripts/main.js",
             "uuid": BP_SCRIPT_UUID, "version": version},
        ],
        "dependencies": [
            {"uuid": RP_UUID, "version": version},
            {"module_name": "@minecraft/server", "version": SERVER_VERSION},
            {"module_name": "@minecraft/server-ui", "version": SERVER_UI_VERSION},
        ],
        "metadata": {"authors": ["Green Lantern add-on (unofficial fan creation)"]},
    })
    io.save_png(art.pack_icon("BP"), io.bp("pack_icon.png"))
    io.write_text(io.bp("texts", "en_US.lang"),
                  "pack.name=Green Lantern Corps (Behavior)\n"
                  "pack.description=Power Ring, oath, constructs, flight and Lanterns. Requires the resource pack.\n")
    io.write_json(io.bp("texts", "languages.json"), ["en_US"])


def write_script_data(sound_ids, particle_ids, version):
    glyphs = {k: chr(0xEC00 + v) for k, v in art.GLYPH_INDEX.items()}
    data = {
        "VERSION": ".".join(str(v) for v in version),
        "CONSTRUCTS": gd.CONSTRUCTS, "CATEGORIES": gd.CATEGORIES, "RANKS": gd.RANKS,
        "FLIGHT_SPEEDS": gd.FLIGHT_SPEEDS, "CORPS": gd.CORPS, "CHARACTERS": gd.CHARACTERS,
        "SUITS": gd.SUITS, "SOUNDS": sound_ids, "PARTICLES": particle_ids, "GLYPHS": glyphs,
    }
    lines = ["// GENERATED by tools/build.py from tools/content/game_data.py - do not edit by hand.",
             "// (Edit the oath in ../oath_config.js instead.)", ""]
    for k, v in data.items():
        lines.append(f"export const {k} = {json.dumps(v, ensure_ascii=True, indent=2)};")
        lines.append("")
    io.write_text(io.bp("scripts", "data", "game_data.js"), "\n".join(lines))


def write_previews(models, ui, portraits):
    os.makedirs(PREVIEWS, exist_ok=True)
    items = []
    for name in cm.ALL:
        geo, tex, style = models[name]
        mat = (lambda b: "emissive") if style == "solid" else (lambda b: "additive")
        items.append((name, render.render(geo, tex, size=220, yaw=150, pitch=22, material_of=mat)))
    cb, cbt, _ = models["central_battery"]
    groups = cb.groups
    mat_cb = lambda b: "alpha" if b in groups["metal"] else ("emissive" if b in groups["glow"] else "additive")
    items.append(("central_battery", render.render(cb, cbt, size=220, yaw=150, pitch=18, material_of=mat_cb)))
    blk, bt, _ = models["power_battery"]
    items.append(("power_battery (block)", render.render(blk, bt, size=220, yaw=150, pitch=22, material_of=lambda b: "alpha")))
    ring, rt, _ = models["ring_held"]
    items.append(("power ring (held)", render.render(ring, rt, size=220, yaw=150, pitch=22, material_of=lambda b: "emissive")))
    render.contact_sheet(items, cols=4, cell=220, title="Green Lantern add-on - construct & structure models").save(
        os.path.join(PREVIEWS, "models.png"))
    chars = []
    for cid, tex in models["_chars"].items():
        geo = models["_suit"] if cid == "corps_uniform" else models["_npc"]
        chars.append((f"{cid} front", render.render(geo, tex, size=200, yaw=15, pitch=8, material_of=lambda b: "emissive")))
        chars.append((f"{cid} back", render.render(geo, tex, size=200, yaw=195, pitch=8, material_of=lambda b: "emissive")))
    render.contact_sheet(chars, cols=4, cell=200, title="Lantern characters (NPC) and Corps uniform").save(
        os.path.join(PREVIEWS, "characters.png"))
    cells = []
    from PIL import Image
    for key, img in ui.items():
        bg = Image.new("RGBA", (64, 64), (46, 48, 56, 255))
        bg.alpha_composite(img)
        cells.append((key, bg.convert("RGB")))
    render.contact_sheet(cells, cols=8, cell=96, title="Menu icons").save(os.path.join(PREVIEWS, "icons.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-audio", action="store_true", help="reuse existing .ogg files if present")
    ap.add_argument("--no-previews", action="store_true")
    ap.add_argument("--version", default="1.0.0")
    args = ap.parse_args()
    version = [int(x) for x in args.version.split(".")]
    keep_audio = {}
    if args.skip_audio and os.path.isdir(io.rp("sounds", "glc")):
        tmp = os.path.join(io.ROOT, ".audio_cache")
        shutil.rmtree(tmp, ignore_errors=True)
        shutil.copytree(io.rp("sounds", "glc"), tmp)
        keep_audio["dir"] = tmp
    clean()
    if keep_audio:
        shutil.copytree(keep_audio["dir"], io.rp("sounds", "glc"))
        shutil.rmtree(keep_audio["dir"])
    models = build_models()
    build_rp_defs(models)
    items_tex, ui, rend, portraits = build_icons(models)
    particle_ids = build_particles()
    sound_ids = sounds_def.build(skip_audio=args.skip_audio)
    write_rp_meta(items_tex, sound_ids, particle_ids, version)
    write_bp(version)
    write_script_data(sound_ids, particle_ids, version)
    if not args.no_previews:
        write_previews(models, ui, portraits)
    print(f"Generated {len(io.WRITTEN)} files (version {args.version}).")


if __name__ == "__main__":
    main()
