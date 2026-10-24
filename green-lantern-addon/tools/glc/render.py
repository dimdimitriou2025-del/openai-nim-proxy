"""Tiny software renderer for Bedrock geometry previews (contact sheets).

It reproduces Bedrock's box-UV face orientation and the model->world mirror
(model front -Z ends up facing the viewer), so textures and UV layouts can be
checked visually without the game.  Materials per bone: "alpha" (alpha test),
"additive" (glowing energy) or "blend".
"""
import math
import numpy as np
from PIL import Image, ImageDraw


def _rx(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=float)


def _ry(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=float)


def _rz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=float)


def bedrock_rot(rot):
    """JSON rotation (degrees) -> 3x3 matrix in model space."""
    if not rot:
        return np.eye(3)
    rx, ry, rz = (math.radians(float(v)) for v in rot)
    return _rz(-rz) @ _ry(ry) @ _rx(-rx)


def _affine(R=None, t=None):
    M = np.eye(4)
    if R is not None:
        M[:3, :3] = R
    if t is not None:
        M[:3, 3] = t
    return M


def _about(pivot, R=None, S=None):
    p = np.array(pivot, dtype=float)
    M = _affine(t=p)
    if R is not None:
        M = M @ _affine(R)
    if S is not None:
        M = M @ np.diag([S[0], S[1], S[2], 1.0])
    return M @ _affine(t=-p)


# Face definitions: outward normal and the 4 corners matching texture
# (top-left, top-right, bottom-right, bottom-left) as (x?, y?, z?) picks of min/max.
# 0 -> min, 1 -> max per axis.
FACE_CORNERS = {
    "north": ((0, 0, -1), [(0, 1, 0), (1, 1, 0), (1, 0, 0), (0, 0, 0)]),
    "south": ((0, 0, 1), [(1, 1, 1), (0, 1, 1), (0, 0, 1), (1, 0, 1)]),
    "east": ((-1, 0, 0), [(0, 1, 1), (0, 1, 0), (0, 0, 0), (0, 0, 1)]),
    "west": ((1, 0, 0), [(1, 1, 0), (1, 1, 1), (1, 0, 1), (1, 0, 0)]),
    "up": ((0, 1, 0), [(0, 1, 1), (1, 1, 1), (1, 1, 0), (0, 1, 0)]),
    "down": ((0, -1, 0), [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)]),
}

SHADE = {"up": 1.0, "north": 0.9, "south": 0.75, "east": 0.8, "west": 0.8, "down": 0.6}


def bone_matrices(geo, pose=None):
    """World matrices per bone (model space). pose: {bone: {rotation, position, scale}}."""
    pose = pose or {}
    mats = {}
    order = list(geo.bones)
    remaining = order[:]
    guard = 0
    while remaining:
        guard += 1
        if guard > 10000:
            raise RuntimeError("bone hierarchy cycle")
        b = remaining.pop(0)
        if b.parent and b.parent not in mats:
            remaining.append(b)
            continue
        parent = mats[b.parent] if b.parent else np.eye(4)
        p = pose.get(b.name, {})
        rot = [0.0, 0.0, 0.0]
        if b.rotation:
            rot = [float(v) for v in b.rotation]
        if p.get("rotation"):
            rot = [rot[i] + float(p["rotation"][i]) for i in range(3)]
        S = p.get("scale")
        if isinstance(S, (int, float)):
            S = [S, S, S]
        local = _about(b.pivot, bedrock_rot(rot), S)
        if p.get("position"):
            px, py, pz = (float(v) for v in p["position"])
            local = _affine(t=[-px, py, pz]) @ local  # animation x is mirrored
        mats[b.name] = parent @ local
    return mats


def collect_faces(geo, pose=None, material_of=None):
    material_of = material_of or (lambda bone: "alpha")
    mats = bone_matrices(geo, pose)
    faces = []
    for b in geo.bones:
        M = mats[b.name]
        mode = material_of(b.name)
        for c in b.cubes:
            lo = np.array(c.origin) - c.inflate
            hi = np.array(c.origin) + np.array(c.size) + c.inflate
            Mc = M
            if c.rotation:
                piv = c.pivot if c.pivot else c.center()
                Mc = M @ _about(piv, bedrock_rot(c.rotation))
            rects = c.face_rects()
            for fname, (normal, corners) in FACE_CORNERS.items():
                if fname not in rects:
                    continue
                if c.faces and fname not in c.faces:
                    continue
                u, v, w, h = rects[fname]
                if abs(w) < 1e-6 or abs(h) < 1e-6:
                    pass  # zero-area UV still renders as a stretched texel line
                pts = []
                for pick in corners:
                    p = np.array([hi[i] if pick[i] else lo[i] for i in range(3)] + [1.0])
                    pts.append((Mc @ p)[:3])
                n = Mc[:3, :3] @ np.array(normal, dtype=float)
                uvs = [(u, v), (u + w, v), (u + w, v + h), (u, v + h)]
                faces.append((np.array(pts), n, uvs, mode, fname))
    return faces


def render(geo, texture, size=256, yaw=35.0, pitch=22.0, pose=None, material_of=None,
           background=(34, 36, 44), margin=0.08, extra_scale=1.0, transparent=False):
    """Render geometry to a PIL image (RGBA with transparent=True)."""
    tex = np.asarray(texture.convert("RGBA"), dtype=float) / 255.0
    th, tw = tex.shape[:2]
    faces = collect_faces(geo, pose, material_of)
    if not faces:
        return Image.new("RGBA" if transparent else "RGB", (size, size), background)
    # model -> world mirror (front -Z faces the viewer at +Z)
    mirror = np.diag([1.0, 1.0, -1.0])
    cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    cp, sp = math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    d = np.array([sy * cp, sp, cy * cp])  # towards camera
    f = -d
    r = np.cross(f, [0, 1, 0])
    r /= np.linalg.norm(r)
    up = np.cross(r, f)
    proj = []
    allp = []
    for pts, n, uvs, mode, fname in faces:
        wp = pts @ mirror.T
        wn = mirror @ n
        sxy = np.stack([wp @ r, wp @ up, wp @ d], axis=1)
        proj.append((sxy, wn, uvs, mode, fname))
        allp.append(sxy[:, :2])
    allp = np.concatenate(allp)
    mn, mx = allp.min(0), allp.max(0)
    span = max(mx - mn) or 1.0
    scale = size * (1 - 2 * margin) / span * extra_scale
    center = (mn + mx) / 2
    color = np.zeros((size, size, 3))
    color[:] = np.array(background) / 255.0 if not transparent else 0.0
    zbuf = np.full((size, size), -1e9)
    add = np.zeros((size, size, 3))
    cover = np.zeros((size, size))

    def raster(sxy, uvs, opaque, shade, additive):
        P = (sxy[:, :2] - center) * scale
        P[:, 0] += size / 2
        P[:, 1] = size / 2 - P[:, 1]
        Z = sxy[:, 2]
        for tri in ((0, 1, 2), (0, 2, 3)):
            a, b, c = (P[i] for i in tri)
            za, zb, zc = (Z[i] for i in tri)
            ua, ub, uc = (np.array(uvs[i]) for i in tri)
            x0 = max(int(math.floor(min(a[0], b[0], c[0]))), 0)
            x1 = min(int(math.ceil(max(a[0], b[0], c[0]))), size - 1)
            y0 = max(int(math.floor(min(a[1], b[1], c[1]))), 0)
            y1 = min(int(math.ceil(max(a[1], b[1], c[1]))), size - 1)
            if x1 < x0 or y1 < y0:
                continue
            den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(den) < 1e-9:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            l1 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
            l2 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
            l3 = 1 - l1 - l2
            inside = (l1 >= -1e-4) & (l2 >= -1e-4) & (l3 >= -1e-4)
            if not inside.any():
                continue
            z = l1 * za + l2 * zb + l3 * zc
            uu = l1 * ua[0] + l2 * ub[0] + l3 * uc[0]
            vv = l1 * ua[1] + l2 * ub[1] + l3 * uc[1]
            ti = np.clip((uu / geo.tex_w * tw).astype(int), 0, tw - 1)
            tj = np.clip((vv / geo.tex_h * th).astype(int), 0, th - 1)
            texel = tex[tj, ti]
            sub_z = zbuf[y0:y1 + 1, x0:x1 + 1]
            vis = inside & (z > sub_z - 1e-6)
            if opaque:
                vis &= texel[..., 3] >= (0.5 if shade is not None else 0.02)
                rgb = texel[..., :3] * (shade if shade is not None else 1.0)
                sub_c = color[y0:y1 + 1, x0:x1 + 1]
                sub_c[vis] = rgb[vis]
                sub_z[vis] = z[vis]
                cover[y0:y1 + 1, x0:x1 + 1][vis] = 1.0
            elif additive:
                sub_a = add[y0:y1 + 1, x0:x1 + 1]
                sub_a[vis] += texel[..., :3][vis] * 0.85
            else:
                alpha = texel[..., 3:4]
                sub_c = color[y0:y1 + 1, x0:x1 + 1]
                blended = sub_c * (1 - alpha) + texel[..., :3] * alpha
                sub_c[vis] = blended[vis]

    # opaque first (alpha test / emissive), then transparent sorted back to front
    opaque = [p for p in proj if p[3] in ("alpha", "emissive")]
    trans = [p for p in proj if p[3] not in ("alpha", "emissive")]
    for sxy, wn, uvs, mode, fname in opaque:
        if np.dot(wn, d) <= 1e-6:
            continue
        raster(sxy, uvs, True, None if mode == "emissive" else SHADE.get(fname, 0.8), False)
    trans.sort(key=lambda p: p[0][:, 2].mean())
    for sxy, wn, uvs, mode, fname in trans:
        if np.dot(wn, d) <= 1e-6:
            continue
        raster(sxy, uvs, False, 1.0, mode == "additive")
    out = np.clip(color + add, 0, 1)
    if transparent:
        alpha = np.clip(cover + add.max(axis=2) * 1.2, 0, 1)
        # un-premultiply additive glow so it composites correctly over any background
        rgb = np.where(cover[..., None] > 0, out, out / np.maximum(alpha[..., None], 1e-3))
        rgba_arr = np.dstack([np.clip(rgb, 0, 1), alpha])
        return Image.fromarray((rgba_arr * 255).astype(np.uint8), "RGBA")
    return Image.fromarray((out * 255).astype(np.uint8), "RGB")


def contact_sheet(items, cols=4, cell=256, title=None):
    """items: list of (label, PIL.Image)."""
    rows = (len(items) + cols - 1) // cols
    top = 28 if title else 0
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 18) + top), (18, 18, 22))
    dr = ImageDraw.Draw(sheet)
    if title:
        dr.text((8, 8), title, fill=(120, 255, 150))
    for i, (label, img) in enumerate(items):
        x, y = (i % cols) * cell, (i // cols) * (cell + 18) + top
        sheet.paste(img.resize((cell, cell), Image.NEAREST), (x, y))
        dr.text((x + 4, y + cell + 3), label, fill=(220, 230, 220))
    return sheet
