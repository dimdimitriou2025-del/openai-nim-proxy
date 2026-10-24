#!/usr/bin/env python3
"""Validate both packs: JSON syntax, manifests and every cross-reference.

Usage: python3 tools/validate.py            (exit code 1 on errors)
"""
import glob
import json
import os
import re
import sys
import uuid

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BP = os.path.join(ROOT, "packs", "GreenLanternBP")
RP = os.path.join(ROOT, "packs", "GreenLanternRP")

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def rel(p):
    return os.path.relpath(p, ROOT)


def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        err(f"invalid JSON {rel(path)}: {e}")
        return None


def all_json(base):
    return sorted(glob.glob(os.path.join(base, "**", "*.json"), recursive=True))


def tex_exists(path_no_ext):
    return any(os.path.isfile(os.path.join(RP, path_no_ext + ext)) for ext in (".png", ".tga", ".jpg"))


# ---------------------------------------------------------------- JSON syntax
docs = {}
for base in (BP, RP):
    for p in all_json(base):
        d = load(p)
        if d is not None:
            docs[p] = d

# ---------------------------------------------------------------- manifests
bpm = docs.get(os.path.join(BP, "manifest.json"))
rpm = docs.get(os.path.join(RP, "manifest.json"))
uuids = []
for name, m in (("BP", bpm), ("RP", rpm)):
    if not m:
        err(f"{name} manifest missing")
        continue
    if m.get("format_version") != 2:
        err(f"{name} manifest format_version should be 2")
    uuids.append(m["header"]["uuid"])
    uuids += [mod["uuid"] for mod in m.get("modules", [])]
    if m["header"].get("min_engine_version") != [1, 26, 10]:
        warn(f"{name} min_engine_version is {m['header'].get('min_engine_version')}")
for u in uuids:
    try:
        uuid.UUID(u)
    except ValueError:
        err(f"invalid uuid {u}")
if len(uuids) != len(set(uuids)):
    err("duplicate UUIDs across manifests")
if bpm and rpm:
    dep_uuids = [d.get("uuid") for d in bpm.get("dependencies", []) if "uuid" in d]
    if rpm["header"]["uuid"] not in dep_uuids:
        err("BP does not depend on RP")
    if bpm["header"]["uuid"] not in [d.get("uuid") for d in rpm.get("dependencies", [])]:
        warn("RP does not depend on BP")
    mods = {d.get("module_name"): d.get("version") for d in bpm.get("dependencies", []) if "module_name" in d}
    if mods.get("@minecraft/server") != "2.6.0" or mods.get("@minecraft/server-ui") != "2.0.0":
        err(f"unexpected script module versions {mods}")
    for mod in bpm["modules"]:
        if mod["type"] == "script" and not os.path.isfile(os.path.join(BP, mod["entry"])):
            err(f"script entry missing: {mod['entry']}")

# ---------------------------------------------------------------- RP indexes
geometries = {}
for p in glob.glob(os.path.join(RP, "models", "**", "*.json"), recursive=True):
    d = docs.get(p) or {}
    for g in d.get("minecraft:geometry", []):
        ident = g["description"]["identifier"]
        if ident in geometries:
            err(f"duplicate geometry {ident}")
        geometries[ident] = (g, p)

animations = {}
for p in glob.glob(os.path.join(RP, "animations", "*.json")):
    animations.update(docs.get(p, {}).get("animations", {}))
controllers = {}
for p in glob.glob(os.path.join(RP, "animation_controllers", "*.json")):
    controllers.update(docs.get(p, {}).get("animation_controllers", {}))
render_ctrls = {}
for p in glob.glob(os.path.join(RP, "render_controllers", "*.json")):
    render_ctrls.update(docs.get(p, {}).get("render_controllers", {}))
item_tex = (docs.get(os.path.join(RP, "textures", "item_texture.json")) or {}).get("texture_data", {})
terrain_tex = (docs.get(os.path.join(RP, "textures", "terrain_texture.json")) or {}).get("texture_data", {})
for key, v in {**item_tex, **terrain_tex}.items():
    t = v["textures"] if isinstance(v["textures"], str) else v["textures"][0]
    if not tex_exists(t):
        err(f"atlas texture {key} -> {t} missing")
sound_defs = (docs.get(os.path.join(RP, "sounds", "sound_definitions.json")) or {}).get("sound_definitions", {})
for sid, sd in sound_defs.items():
    for s in sd["sounds"]:
        name = s["name"] if isinstance(s, dict) else s
        if not any(os.path.isfile(os.path.join(RP, name + e)) for e in (".ogg", ".wav", ".fsb")):
            err(f"sound file missing for {sid}: {name}")
particles = {}
for p in glob.glob(os.path.join(RP, "particles", "**", "*.json"), recursive=True):
    pe = docs.get(p, {}).get("particle_effect", {})
    ident = pe.get("description", {}).get("identifier")
    particles[ident] = p
    t = pe.get("description", {}).get("basic_render_parameters", {}).get("texture")
    if t and not tex_exists(t):
        err(f"particle {ident} texture missing {t}")
lang = {}
lang_path = os.path.join(RP, "texts", "en_US.lang")
for line in open(lang_path, encoding="utf-8"):
    if "=" in line and not line.startswith("#"):
        k, v = line.rstrip("\n").split("=", 1)
        lang[k] = v


def bones_of(geo_id):
    g = geometries.get(geo_id)
    return {b["name"] for b in g[0]["bones"]} if g else set()


def check_anim_bones(anim_id, geo_ids, owner):
    a = animations.get(anim_id)
    if not a:
        return
    known = set().union(*[bones_of(g) for g in geo_ids]) if geo_ids else set()
    for bone in a.get("bones", {}):
        if known and bone not in known:
            warn(f"{owner}: animation {anim_id} targets bone '{bone}' not in its geometry")


def check_render_controller(rc_id, desc, owner):
    rc = render_ctrls.get(rc_id)
    if rc is None:
        err(f"{owner}: render controller {rc_id} missing")
        return
    blob = json.dumps(rc)
    for kind, field in (("Geometry", "geometry"), ("Texture", "textures"), ("Material", "materials")):
        for key in set(re.findall(rf"{kind}\.(\w+)", blob)):
            if key not in desc.get(field, {}):
                err(f"{owner}: {rc_id} uses {kind}.{key} not defined in {field}")


def check_client_desc(desc, owner):
    for key, geo in desc.get("geometry", {}).items():
        if geo not in geometries:
            err(f"{owner}: geometry {geo} missing")
    for key, tex in desc.get("textures", {}).items():
        if not tex_exists(tex):
            err(f"{owner}: texture {tex} missing")
    geo_ids = list(desc.get("geometry", {}).values())
    for key, anim in desc.get("animations", {}).items():
        if anim.startswith("controller."):
            c = controllers.get(anim)
            if not c:
                err(f"{owner}: animation controller {anim} missing")
                continue
            for st in c["states"].values():
                for a in st.get("animations", []):
                    names = [a] if isinstance(a, str) else list(a.keys())
                    for n in names:
                        if n not in desc["animations"]:
                            err(f"{owner}: controller {anim} references '{n}' not in animations map")
        elif anim not in animations:
            err(f"{owner}: animation {anim} missing")
        else:
            check_anim_bones(anim, geo_ids, owner)
    scripts = desc.get("scripts", {})
    for a in scripts.get("animate", []):
        names = [a] if isinstance(a, str) else list(a.keys())
        for n in names:
            if n not in desc.get("animations", {}):
                err(f"{owner}: scripts.animate '{n}' not in animations")
    for rc in desc.get("render_controllers", []):
        check_render_controller(rc if isinstance(rc, str) else list(rc.keys())[0], desc, owner)


client_ids = set()
for p in glob.glob(os.path.join(RP, "entity", "**", "*.json"), recursive=True):
    desc = docs[p]["minecraft:client_entity"]["description"]
    client_ids.add(desc["identifier"])
    check_client_desc(desc, rel(p))
    egg = desc.get("spawn_egg", {}).get("texture")
    if egg and egg not in item_tex:
        err(f"{rel(p)}: spawn egg texture {egg} not in item_texture.json")
for p in glob.glob(os.path.join(RP, "attachables", "**", "*.json"), recursive=True):
    desc = docs[p]["minecraft:attachable"]["description"]
    check_client_desc(desc, rel(p))

# ---------------------------------------------------------------- geometry sanity
for gid, (g, p) in geometries.items():
    desc = g["description"]
    tw, th = desc["texture_width"], desc["texture_height"]
    for b in g["bones"]:
        if b.get("parent") and b["parent"] not in {x["name"] for x in g["bones"]}:
            err(f"{gid}: bone {b['name']} parent {b['parent']} missing")
        for c in b.get("cubes", []):
            uv = c.get("uv")
            if isinstance(uv, list):
                w, h, dd = c["size"]
                if uv[0] + 2 * (w + dd) > tw + 0.01 or uv[1] + dd + h > th + 0.01:
                    err(f"{gid}: cube uv {uv} size {c['size']} exceeds texture {tw}x{th}")
            elif isinstance(uv, dict):
                for face, fu in uv.items():
                    if fu["uv"][0] + fu["uv_size"][0] > tw + 0.01 or fu["uv"][1] + fu["uv_size"][1] > th + 0.01:
                        err(f"{gid}: face {face} uv out of texture")
    if "/models/blocks/" in p.replace("\\", "/"):
        xs, ys, zs = [], [], []
        for b in g["bones"]:
            for c in b.get("cubes", []):
                o, s = c["origin"], c["size"]
                xs += [o[0], o[0] + s[0]]
                ys += [o[1], o[1] + s[1]]
                zs += [o[2], o[2] + s[2]]
        for axis, vals in (("x", xs), ("y", ys), ("z", zs)):
            if max(vals) - min(vals) > 30:
                err(f"block geometry {gid} exceeds 30px on {axis}")

# texture size consistency for entity textures used with a geometry
for p in glob.glob(os.path.join(RP, "entity", "**", "*.json"), recursive=True):
    desc = docs[p]["minecraft:client_entity"]["description"]
    geo = geometries.get(desc.get("geometry", {}).get("default"))
    if not geo:
        continue
    gw, gh = geo[0]["description"]["texture_width"], geo[0]["description"]["texture_height"]
    for key, tex in desc.get("textures", {}).items():
        if "shimmer" in key:
            continue
        f = os.path.join(RP, tex + ".png")
        if os.path.isfile(f):
            w, h = Image.open(f).size
            if abs(w / h - gw / gh) > 1e-6:
                err(f"{rel(p)}: texture {tex} aspect {w}x{h} != geometry {gw}x{gh}")

# ---------------------------------------------------------------- BP checks
bp_entities = {}
for p in glob.glob(os.path.join(BP, "entities", "**", "*.json"), recursive=True):
    e = docs[p]["minecraft:entity"]
    ident = e["description"]["identifier"]
    bp_entities[ident] = e
    if ident not in client_ids:
        err(f"BP entity {ident} has no client entity")
    comps = json.dumps(e)
    for m in re.findall(r'"event":\s*"([^"]+)"', comps):
        if m not in e.get("events", {}) and not m.startswith("minecraft:"):
            err(f"{ident}: event {m} not defined")
    for grp in e.get("events", {}).values():
        for op in ("add", "remove"):
            for g in grp.get(op, {}).get("component_groups", []):
                if g not in e.get("component_groups", {}):
                    err(f"{ident}: component group {g} missing")
    if f"entity.{ident}.name" not in lang:
        warn(f"lang: entity.{ident}.name missing")
for ident in client_ids:
    if ident not in bp_entities:
        err(f"client entity {ident} has no BP entity")

bp_items = {}
custom_components = set()
for p in glob.glob(os.path.join(BP, "items", "**", "*.json"), recursive=True):
    it = docs[p]["minecraft:item"]
    ident = it["description"]["identifier"]
    bp_items[ident] = it
    comps = it["components"]
    icon = comps.get("minecraft:icon")
    icon_key = icon if isinstance(icon, str) else (icon or {}).get("textures", {}).get("default")
    if icon_key not in item_tex:
        err(f"item {ident}: icon {icon_key} not in item_texture.json")
    dn = comps.get("minecraft:display_name", {}).get("value")
    if dn and dn not in lang:
        err(f"item {ident}: display name key {dn} not in lang")
    ib = comps.get("minecraft:interact_button")
    if isinstance(ib, str) and ib not in lang:
        err(f"item {ident}: interact_button key {ib} not in lang")
    for k in comps:
        if not k.startswith("minecraft:"):
            custom_components.add(k)
    placer = comps.get("minecraft:entity_placer", {}).get("entity")
    if placer and placer not in bp_entities:
        err(f"item {ident}: entity_placer target {placer} missing")
    if "minecraft:wearable" in comps and not os.path.isfile(os.path.join(RP, "attachables", "glc", ident.split(":")[1] + ".json")):
        err(f"wearable {ident} has no attachable")

bp_blocks = {}
for p in glob.glob(os.path.join(BP, "blocks", "**", "*.json"), recursive=True):
    b = docs[p]["minecraft:block"]
    ident = b["description"]["identifier"]
    bp_blocks[ident] = b
    comps = b["components"]
    geo = comps.get("minecraft:geometry")
    geo_id = geo if isinstance(geo, str) else (geo or {}).get("identifier")
    if geo_id and not geo_id.startswith("minecraft:") and geo_id not in geometries:
        err(f"block {ident}: geometry {geo_id} missing")
    for inst in comps.get("minecraft:material_instances", {}).values():
        if isinstance(inst, dict) and inst.get("texture") not in terrain_tex:
            err(f"block {ident}: texture {inst.get('texture')} not in terrain_texture.json")
    methods = {i.get("render_method", "opaque") for i in comps.get("minecraft:material_instances", {}).values() if isinstance(i, dict)}
    if len(methods) > 1:
        err(f"block {ident}: mixed render methods {methods}")
    loot = comps.get("minecraft:loot")
    if loot and not os.path.isfile(os.path.join(BP, loot)):
        err(f"block {ident}: loot table {loot} missing")
    dn = comps.get("minecraft:display_name")
    if isinstance(dn, str) and dn not in lang:
        err(f"block {ident}: display name {dn} not in lang")
    for k in comps:
        if not k.startswith("minecraft:"):
            custom_components.add(k)
    if "minecraft:tick" in comps and not any(not k.startswith("minecraft:") for k in comps):
        warn(f"block {ident}: ticks but has no custom component")

known_items = set(bp_items) | set(bp_blocks)
for p in glob.glob(os.path.join(BP, "recipes", "**", "*.json"), recursive=True):
    r = docs[p]["minecraft:recipe_shaped"]
    res = r["result"]["item"]
    if res.startswith("glc:") and res not in known_items:
        err(f"recipe {rel(p)}: result {res} unknown")
    for k in r["key"].values():
        item = k["item"] if isinstance(k, dict) else k
        if item.startswith("glc:") and item not in known_items:
            err(f"recipe {rel(p)}: ingredient {item} unknown")
    letters = set("".join(r["pattern"])) - {" "}
    if letters - set(r["key"]):
        err(f"recipe {rel(p)}: pattern letters without key {letters - set(r['key'])}")

# ---------------------------------------------------------------- scripts
entity_events = {ev for e in bp_entities.values() for ev in e.get("events", {})}
script_files = glob.glob(os.path.join(BP, "scripts", "**", "*.js"), recursive=True)
src = {p: open(p, encoding="utf-8").read() for p in script_files}
main_src = src.get(os.path.join(BP, "scripts", "main.js"), "")
for cc in custom_components:
    if f'"{cc}"' not in main_src:
        err(f"custom component {cc} used in JSON but not registered in main.js")
for p, s in src.items():
    for pid in set(re.findall(r'"(glc:[a-z_]+)"', s)):
        if pid in entity_events:
            continue  # triggerEvent target
        if pid in particles or pid in bp_entities or pid in known_items or pid.startswith("glc:life") or pid in custom_components:
            continue
        if pid in ("glc:owner", "glc:data", "glc:state", "glc:corps", "glc:size", "glc:pitch", "glc:casting",
                   "glc:despawn", "glc:ring", "glc:oath", "glc:guide", "glc:fly", "glc:rank", "glc:recharge",
                   "glc:kit", "glc:reset", "glc:power_ring", "glc:book_of_oa",
                   "glc:cast", "glc:flight"):  # last two: runtime animation controllers
            continue
        err(f"{rel(p)}: unknown id {pid}")
    for an in set(re.findall(r'"(animation\.glc\.[a-z_.]+)"', s)):
        if an not in animations:
            err(f"{rel(p)}: animation {an} not defined")
    for sid in set(re.findall(r'"(glc\.[a-z_]+)"', s)):
        if sid not in sound_defs:
            err(f"{rel(p)}: sound {sid} not defined")
    for icon in set(re.findall(r'(textures/glc/[a-z_/]+)', s)):
        if icon.endswith("/"):
            continue
        if not tex_exists(icon):
            err(f"{rel(p)}: icon {icon} missing")
    for icon_name in set(re.findall(r'\$\{ICON\}([a-z_]+)', s)) | set(re.findall(r'ICON \+ "([a-z_]+)"', s)):
        if icon_name.endswith("_"):
            continue  # dynamic suffix (icon_${id}, portrait_${id}) - checked per construct/character below
        if not tex_exists("textures/glc/ui/" + icon_name):
            err(f"{rel(p)}: ui icon {icon_name} missing")
# every construct must have a ui icon
gd = src.get(os.path.join(BP, "scripts", "data", "game_data.js"), "")
for cid in re.findall(r'"id": "([a-z_]+)",\s*"name": "[^"]+",\s*"category"', gd):
    if not tex_exists(f"textures/glc/ui/icon_{cid}"):
        err(f"construct {cid} has no menu icon")
for ch in re.findall(r'"id": "([a-z_]+)",\s*"name": "[^"]+",\s*"corps"', gd):
    if not tex_exists(f"textures/glc/ui/portrait_{ch}"):
        err(f"character {ch} has no portrait")

# ---------------------------------------------------------------- report
for w in warnings:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print(f"\n{len(docs)} JSON files, {len(geometries)} geometries, {len(animations)} animations, "
      f"{len(particles)} particles, {len(sound_defs)} sounds, {len(bp_entities)} entities, "
      f"{len(bp_items)} items, {len(bp_blocks)} blocks, {len(script_files)} scripts")
print(f"{len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
