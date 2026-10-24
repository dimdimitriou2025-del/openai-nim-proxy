// Small immutable vector helpers ({x, y, z} objects, Minecraft world space).

export const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });
export const UP = Object.freeze({ x: 0, y: 1, z: 0 });

export const v3 = (x, y, z) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const dist = (a, b) => len(sub(a, b));
export const distSq = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function norm(a) {
  const l = len(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
}

/** Unit horizontal direction for a yaw in degrees (Minecraft: 0 = south/+Z). */
export function forwardFromYaw(yaw) {
  const r = (yaw * Math.PI) / 180;
  return { x: -Math.sin(r), y: 0, z: Math.cos(r) };
}

/** Right-hand side direction for a yaw (degrees). */
export function rightFromYaw(yaw) {
  const r = (yaw * Math.PI) / 180;
  return { x: -Math.cos(r), y: 0, z: -Math.sin(r) };
}

/** Direction vector from yaw/pitch in degrees (pitch > 0 looks down). */
export function dirFromYawPitch(yaw, pitch) {
  const ry = (yaw * Math.PI) / 180;
  const rp = (pitch * Math.PI) / 180;
  return { x: -Math.sin(ry) * Math.cos(rp), y: -Math.sin(rp), z: Math.cos(ry) * Math.cos(rp) };
}

/** {yaw, pitch} in degrees that faces along dir. */
export function yawPitchFromDir(d) {
  const n = norm(d);
  const yaw = (Math.atan2(-n.x, n.z) * 180) / Math.PI;
  const pitch = (-Math.asin(clamp(n.y, -1, 1)) * 180) / Math.PI;
  return { yaw, pitch };
}

export function horizontal(d) {
  return norm({ x: d.x, y: 0, z: d.z });
}

/** Dominant axis of a direction as a unit vector (for grid-aligned constructs). */
export function dominantAxis(d, allowVertical = true) {
  const ax = Math.abs(d.x);
  const ay = allowVertical ? Math.abs(d.y) : 0;
  const az = Math.abs(d.z);
  if (ay >= ax && ay >= az) return { x: 0, y: Math.sign(d.y) || 1, z: 0 };
  if (ax >= az) return { x: Math.sign(d.x) || 1, y: 0, z: 0 };
  return { x: 0, y: 0, z: Math.sign(d.z) || 1 };
}

export const floor = (a) => ({ x: Math.floor(a.x), y: Math.floor(a.y), z: Math.floor(a.z) });
export const center = (b) => ({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 });

/** Distance from point p to the segment a-b, and the projection parameter t (0..1). */
export function pointSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 > 0 ? clamp(dot(sub(p, a), ab) / l2, 0, 1) : 0;
  return { d: dist(p, add(a, mul(ab, t))), t };
}
