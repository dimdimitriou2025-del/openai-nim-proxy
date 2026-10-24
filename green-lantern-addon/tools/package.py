#!/usr/bin/env python3
"""Package the add-on: dist/GreenLantern-v<version>.mcaddon (+ individual .mcpack files).

Usage: python3 tools/package.py [--tag preview]
The version is read from the behavior pack manifest.  Existing packages in dist/
are kept as backups (a new version never overwrites an older one).
"""
import argparse
import json
import os
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PACKS = {"GreenLanternBP": os.path.join(ROOT, "packs", "GreenLanternBP"),
         "GreenLanternRP": os.path.join(ROOT, "packs", "GreenLanternRP")}
DIST = os.path.join(ROOT, "dist")
SKIP_DIRS = {"node_modules", "__pycache__", ".git"}


def pack_files(base):
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for f in sorted(filenames):
            if f.startswith(".") or f.endswith((".pyc", ".md")):
                continue
            full = os.path.join(dirpath, f)
            yield full, os.path.relpath(full, base)


def write_zip(path, entries):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for full, arc in entries:
            info = zipfile.ZipInfo(arc.replace(os.sep, "/"), date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            with open(full, "rb") as f:
                z.writestr(info, f.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="", help="suffix such as 'preview'")
    args = ap.parse_args()
    with open(os.path.join(PACKS["GreenLanternBP"], "manifest.json")) as f:
        version = ".".join(str(v) for v in json.load(f)["header"]["version"])
    name = f"GreenLantern-v{version}{('-' + args.tag) if args.tag else ''}"
    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, f"{name}.mcaddon")
    if os.path.exists(out):
        raise SystemExit(f"{out} already exists - bump the version or use --tag (backups are never overwritten)")
    entries = []
    for pname, base in PACKS.items():
        files = list(pack_files(base))
        write_zip(os.path.join(DIST, f"{name}-{pname}.mcpack"), files)
        entries += [(full, f"{pname}/{arc}") for full, arc in files]
    write_zip(out, entries)
    with zipfile.ZipFile(out) as z:
        bad = z.testzip()
        assert bad is None, f"corrupt entry {bad}"
        names = z.namelist()
    assert "GreenLanternBP/manifest.json" in names and "GreenLanternRP/manifest.json" in names
    print(f"{out}: {len(names)} files, {os.path.getsize(out) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
