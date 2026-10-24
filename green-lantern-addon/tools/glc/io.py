"""File output helpers shared by the build scripts."""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BP = os.path.join(ROOT, "packs", "GreenLanternBP")
RP = os.path.join(ROOT, "packs", "GreenLanternRP")

WRITTEN = []


def _ensure(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)


def write_json(path, data):
    _ensure(path)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    WRITTEN.append(path)


def write_text(path, text):
    _ensure(path)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    WRITTEN.append(path)


def save_png(img, path):
    _ensure(path)
    img.save(path, optimize=True)
    WRITTEN.append(path)


def rp(*parts):
    return os.path.join(RP, *parts)


def bp(*parts):
    return os.path.join(BP, *parts)
