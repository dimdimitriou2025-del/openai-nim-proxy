"""Bedrock geometry builder with automatic box-UV packing.

Models are authored in Bedrock JSON model space (16 units = 1 block, the model's
front faces -Z, the model's right side is -X).  Cubes either get a box-UV net that
is packed automatically into the texture atlas, or explicit per-face UVs (used for
panels that should all share one texture tile).

Rotation convention (verified against vanilla models, see DECISIONS.md):
JSON rotation [rx, ry, rz] == standard right-handed Rz(-rz) * Ry(ry) * Rx(-rx).
Multi-axis rotations are expressed with nested bones so Euler order never matters.
"""
import math

FACES = ("north", "south", "east", "west", "up", "down")


def _num(v):
    """Round floats for compact, stable JSON output."""
    if isinstance(v, float):
        r = round(v, 4)
        return int(r) if r == int(r) else r
    return v


def _vec(v):
    return [_num(float(x)) for x in v]


class Cube:
    def __init__(self, bone, origin, size, inflate=0.0, rotation=None, pivot=None,
                 mirror=False, paint=None, face_uv=None, faces=None, uv=None):
        self.bone = bone
        self.origin = [float(x) for x in origin]
        self.size = [float(x) for x in size]
        self.inflate = float(inflate)
        self.rotation = rotation
        self.pivot = pivot
        self.mirror = mirror
        self.paint = paint or {}
        # face_uv: {face: (u, v, w, h)} explicit per-face mapping
        self.face_uv = face_uv
        # faces: restrict rendered faces (only with per-face UV)
        self.faces = faces
        self.uv = uv  # box uv [u, v] (auto-assigned by pack())

    # Box-UV net footprint (integer texels)
    def net_size(self):
        w, h, d = (int(math.ceil(s - 1e-6)) for s in self.size)
        return 2 * (w + d), d + h

    def face_rects(self):
        """Texture rectangles (u, v, w, h) for each face."""
        if self.face_uv:
            return dict(self.face_uv)
        u, v = self.uv
        w, h, d = self.size
        return {
            "north": (u + d, v + d, w, h),           # front (-Z)
            "east": (u, v + d, d, h),                # model right side (-X)
            "west": (u + d + w, v + d, d, h),        # model left side (+X)
            "south": (u + 2 * d + w, v + d, w, h),   # back (+Z)
            "up": (u + d, v, w, d),
            "down": (u + d + w, v, w, d),
        }

    def to_dict(self):
        d = {"origin": _vec(self.origin), "size": _vec(self.size)}
        if self.inflate:
            d["inflate"] = _num(self.inflate)
        if self.rotation:
            d["rotation"] = _vec(self.rotation)
            d["pivot"] = _vec(self.pivot if self.pivot else self.center())
        if self.mirror:
            d["mirror"] = True
        if self.face_uv:
            uvd = {}
            for f, (u, v, w, h) in self.face_uv.items():
                uvd[f] = {"uv": _vec([u, v]), "uv_size": _vec([w, h])}
            d["uv"] = uvd
        else:
            d["uv"] = _vec(self.uv)
        return d

    def center(self):
        return [self.origin[i] + self.size[i] / 2 for i in range(3)]


class Bone:
    def __init__(self, name, parent=None, pivot=(0, 0, 0), rotation=None, binding=None,
                 locators=None):
        self.name = name
        self.parent = parent
        self.pivot = [float(x) for x in pivot]
        self.rotation = rotation
        self.binding = binding
        self.locators = locators or {}
        self.cubes = []

    def to_dict(self):
        d = {"name": self.name}
        if self.parent:
            d["parent"] = self.parent
        d["pivot"] = _vec(self.pivot)
        if self.rotation:
            d["rotation"] = _vec(self.rotation)
        if self.binding:
            d["binding"] = self.binding
        if self.locators:
            d["locators"] = {k: _vec(v) for k, v in self.locators.items()}
        if self.cubes:
            d["cubes"] = [c.to_dict() for c in self.cubes]
        return d


class Geometry:
    def __init__(self, identifier, tex_w=64, tex_h=64, bounds_w=2.0, bounds_h=2.0,
                 bounds_offset=(0, 0.5, 0)):
        self.identifier = identifier
        self.tex_w = tex_w
        self.tex_h = tex_h
        self.bounds_w = bounds_w
        self.bounds_h = bounds_h
        self.bounds_offset = bounds_offset
        self.bones = []
        self._by_name = {}

    def bone(self, name, parent=None, pivot=(0, 0, 0), rotation=None, **kw):
        if name in self._by_name:
            raise ValueError(f"duplicate bone {name} in {self.identifier}")
        b = Bone(name, parent=parent, pivot=pivot, rotation=rotation, **kw)
        self.bones.append(b)
        self._by_name[name] = b
        return b

    def get(self, name):
        return self._by_name[name]

    def cube(self, bone, origin, size, **kw):
        if isinstance(bone, str):
            bone = self._by_name[bone]
        c = Cube(bone, origin, size, **kw)
        bone.cubes.append(c)
        return c

    def box(self, bone, center, size, **kw):
        """Add a cube by its center point."""
        origin = [center[i] - size[i] / 2 for i in range(3)]
        return self.cube(bone, origin, size, **kw)

    def cubes(self):
        for b in self.bones:
            for c in b.cubes:
                yield c

    def pack(self, pad=1, start_y=0, grow=True):
        """Shelf-pack box-UV nets for every cube without explicit UVs."""
        todo = [c for c in self.cubes() if c.uv is None and not c.face_uv]
        todo.sort(key=lambda c: (-c.net_size()[1], -c.net_size()[0]))
        x, y, shelf_h = 0, start_y, 0
        for c in todo:
            nw, nh = c.net_size()
            if nw + pad > self.tex_w:
                raise ValueError(f"{self.identifier}: cube net {nw}px wider than texture {self.tex_w}")
            if x + nw > self.tex_w:
                x = 0
                y += shelf_h + pad
                shelf_h = 0
            c.uv = [x, y]
            x += nw + pad
            shelf_h = max(shelf_h, nh)
        used_h = y + shelf_h
        if used_h > self.tex_h:
            if not grow:
                raise ValueError(f"{self.identifier}: needs {used_h}px texture height")
            h = self.tex_h
            while h < used_h:
                h *= 2
            self.tex_h = h
        return used_h

    def to_dict(self):
        return {
            "description": {
                "identifier": self.identifier,
                "texture_width": self.tex_w,
                "texture_height": self.tex_h,
                "visible_bounds_width": _num(float(self.bounds_w)),
                "visible_bounds_height": _num(float(self.bounds_h)),
                "visible_bounds_offset": _vec(self.bounds_offset),
            },
            "bones": [b.to_dict() for b in self.bones],
        }


def glow_shell(geo, inflate=0.45, suffix="_glow", skip_bones=()):
    """Inflated clone of a geometry used for the animated energy-aura pass.

    Same bones (so animations apply identically) and same UVs; every cube grows
    by `inflate` so the aura wraps the solid core without z-fighting.
    """
    shell = Geometry(geo.identifier + suffix, geo.tex_w, geo.tex_h, geo.bounds_w,
                     geo.bounds_h, geo.bounds_offset)
    for b in geo.bones:
        nb = shell.bone(b.name, parent=b.parent, pivot=b.pivot, rotation=b.rotation,
                        binding=b.binding, locators=dict(b.locators))
        if b.name in skip_bones:
            continue
        for c in b.cubes:
            if min(c.size) <= 0:
                continue  # planes get no aura
            nb.cubes.append(Cube(nb, c.origin, c.size, inflate=c.inflate + inflate,
                                 rotation=c.rotation, pivot=c.pivot, mirror=c.mirror,
                                 face_uv=c.face_uv, faces=c.faces, uv=list(c.uv) if c.uv else None))
    return shell


def geometry_file(*geos, fmt="1.12.0"):
    return {"format_version": fmt, "minecraft:geometry": [g.to_dict() for g in geos]}
