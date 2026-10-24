#!/usr/bin/env python3
"""Validate pack files against Mojang's official JSON schemas.

The schemas ship in Mojang's bedrock-samples repository (metadata/json_schemas):

    git clone --depth 1 --filter=blob:none --sparse https://github.com/Mojang/bedrock-samples.git
    cd bedrock-samples && git sparse-checkout set metadata/json_schemas

Usage: python3 tools/schema_check.py /path/to/bedrock-samples/metadata/json_schemas
Requires: pip install jsonschema
"""
import glob
import json
import os
import sys
import urllib.parse

from jsonschema import Draft7Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT7

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BP = os.path.join(ROOT, "packs", "GreenLanternBP")
RP = os.path.join(ROOT, "packs", "GreenLanternRP")


def ambiguous_only(e):
    """True if an error is only caused by the official schema's ambiguous filter oneOf.

    Mojang's filter schema lets a single test object match both "Filter Group Map"
    and "Filter Test", so oneOf rejects it ("is valid under each of"); vanilla files
    such as the snow golem fail the same way.  Such errors are reported separately.
    """
    leaves = []

    def walk(x):
        if x.context:
            for c in x.context:
                walk(c)
        else:
            leaves.append(x)

    walk(e)
    return any("is valid under each of" in l.message for l in leaves) and "filters" in json.dumps(list(e.absolute_path) + [l.message for l in leaves])


def main(schema_root):
    def retrieve(uri):
        path = urllib.parse.unquote(urllib.parse.urlparse(uri).path).lstrip("/")
        with open(os.path.join(schema_root, path), encoding="utf-8") as f:
            return Resource.from_contents(json.load(f), default_specification=DRAFT7)

    registry = Registry(retrieve=retrieve)

    def validator(rel):
        with open(os.path.join(schema_root, rel), encoding="utf-8") as f:
            schema = json.load(f)
        return Draft7Validator(schema, registry=registry)

    targets = [
        ("server/entity/1.26.0/ActorDocument.json", glob.glob(os.path.join(BP, "entities", "**", "*.json"), recursive=True), "minecraft:entity"),
        ("server/item/1.26.30/ItemDocument.json", glob.glob(os.path.join(BP, "items", "**", "*.json"), recursive=True), "minecraft:item"),
        ("client/particles/1.21.10/particle_effect component.json", [], None),
    ]
    block_doc = None
    for cand in sorted(glob.glob(os.path.join(schema_root, "server", "block", "*", "Blocks.json"))):
        with open(cand, encoding="utf-8") as f:
            d = json.load(f)
        if d.get("title") == "BlockDefinitionDocument":
            block_doc = os.path.relpath(cand, schema_root)
    if block_doc:
        targets.append((block_doc, glob.glob(os.path.join(BP, "blocks", "**", "*.json"), recursive=True), "minecraft:block"))
    part_doc = os.path.join("client", "particles", "1.21.10", "Particle Effect Data.json")
    targets[2] = (part_doc, glob.glob(os.path.join(RP, "particles", "**", "*.json"), recursive=True), "particle_effect")

    problems = 0
    checked = 0
    for schema_rel, files, key in targets:
        if not os.path.isfile(os.path.join(schema_root, schema_rel)):
            print(f"skip: schema {schema_rel} not found")
            continue
        v = validator(schema_rel)
        for p in files:
            with open(p, encoding="utf-8") as f:
                doc = json.load(f)
            body = doc.get(key, doc) if key else doc
            errs = sorted(v.iter_errors(body), key=lambda e: list(e.path))
            checked += 1
            for e in errs[:8]:
                if ambiguous_only(e):
                    print(f"note: {os.path.relpath(p, ROOT)}: {'/'.join(str(x) for x in e.path)}: known schema filter ambiguity (vanilla files fail identically)")
                    continue
                problems += 1
                loc = "/".join(str(x) for x in e.path)
                print(f"{os.path.relpath(p, ROOT)}: {loc}: {e.message[:200]}")
    print(f"\nschema-checked {checked} files: {problems} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
