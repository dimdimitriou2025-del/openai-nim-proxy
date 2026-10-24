// Offensive and advanced attack constructs.
import { world } from "@minecraft/server";
import { Task, moveConstruct, registerConstruct, spawnConstruct } from "./registry.js";
import { CORPS } from "../data/game_data.js";
import {
  beam, impactFx, particle, shake, shockwave, sound,
} from "../lib/fx.js";
import {
  add, dist, forwardFromYaw, horizontal, len, lerp, mul, norm, rightFromYaw, sub, v3, yawPitchFromDir,
} from "../lib/vec.js";
import {
  centerOf, directionTo, groundBelow, nearestTarget, rayBlock, rayTargets, strike, targetsNear, valid,
} from "../lib/util.js";

/** Current aim of a caster (NPCs aim at their target). */
export function aimDir(ctx) {
  const c = ctx.caster;
  if (ctx.target && valid(ctx.target)) return directionTo(c.getHeadLocation(), centerOf(ctx.target));
  return c.getViewDirection();
}

export function handOf(caster, dir) {
  const eye = caster.getHeadLocation();
  const right = rightFromYaw(yawPitchFromDir(dir).yaw);
  return add(add(add(eye, v3(0, -0.45, 0)), mul(right, 0.38)), mul(dir, 0.6));
}

// ------------------------------------------------------------------ beam
registerConstruct("beam", (ctx) => {
  const { dim, eye, dir, hand, corps, caster, def } = ctx;
  const { hits, end, wall } = rayTargets(dim, eye, dir, def.range, caster, 0.45);
  const first = hits[0];
  const tip = first ? centerOf(first.entity) : end;
  beam(dim, hand, tip, corps, 1);
  particle(dim, "glc:impact", hand, corps);
  sound(dim, "glc.beam_fire", hand, 0.9, 0.95 + Math.random() * 0.15);
  if (first) {
    strike(caster, first.entity, def.damage * ctx.power, dir, 0.5, 0.18);
    impactFx(dim, tip, corps);
  } else if (wall) {
    impactFx(dim, wall.loc, corps);
  }
  return undefined;
});

// ------------------------------------------------------------------ fists
class FistTask extends Task {
  constructor(ctx, giant) {
    super(ctx, "fist");
    this.giant = giant;
    this.size = giant ? 3 : 1;
    this.speed = giant ? 0.95 : 0.85;
    this.maxT = Math.ceil(ctx.def.range / this.speed);
    this.radius = giant ? 3.2 : 1.35;
    this.dmg = ctx.def.damage * ctx.power;
    this.dir = ctx.dir;
    this.pos = add(ctx.eye, add(mul(ctx.dir, giant ? 2.8 : 1.5), v3(0, giant ? -1.0 : -0.35, 0)));
    this.hit = new Set();
    this.e = this.spawn("glc:fist", this.pos, ctx.yaw, ctx.pitch, this.size, 1.0);
  }

  step(t) {
    const { dim, corps, caster } = this.ctx;
    if (!valid(this.e)) return false;
    const wall = rayBlock(dim, this.pos, this.dir, this.speed + 0.45 * this.size);
    if (wall) {
      this.impact(wall.loc);
      return false;
    }
    this.pos = add(this.pos, mul(this.dir, this.speed));
    moveConstruct(this.e, this.pos, this.ctx.yaw);
    particle(dim, "glc:trail", sub(this.pos, mul(this.dir, 0.7 * this.size)), corps);
    for (const e of targetsNear(dim, this.pos, this.radius, caster, "any")) {
      if (this.hit.has(e.id)) continue;
      this.hit.add(e.id);
      strike(caster, e, this.dmg, this.dir, this.giant ? 2.3 : 1.5, this.giant ? 0.65 : 0.4);
      impactFx(dim, centerOf(e), corps);
      sound(dim, "glc.impact", e.location, 1, 0.9);
      if (!this.giant && this.hit.size >= 3) {
        this.impact(this.pos);
        return false;
      }
    }
    if (t >= this.maxT) {
      this.impact(this.pos);
      return false;
    }
    return true;
  }

  impact(loc) {
    const { dim, corps, caster } = this.ctx;
    impactFx(dim, loc, corps, this.giant);
    sound(dim, this.giant ? "glc.hammer_slam" : "glc.impact", loc, 1, this.giant ? 1.1 : 1.0);
    if (this.giant) {
      shockwave(dim, loc, corps, 3.5);
      shake(dim, loc, 14, 0.25, 0.35);
      for (const e of targetsNear(dim, loc, 3.5, caster, "hostile")) {
        if (!this.hit.has(e.id)) strike(caster, e, this.dmg * 0.5, directionTo(loc, e.location), 1.2, 0.5);
      }
    }
  }
}
registerConstruct("fist", (ctx) => new FistTask(ctx, false));
registerConstruct("giant_fist", (ctx) => new FistTask(ctx, true));

// ------------------------------------------------------------------ hammers
class HammerTask extends Task {
  constructor(ctx, titan) {
    super(ctx, "hammer");
    const { dim, eye, dir } = ctx;
    this.titan = titan;
    this.size = titan ? 3 : 1;
    this.radius = ctx.def.radius;
    this.dmg = ctx.def.damage * ctx.power;
    const range = titan ? 24 : 18;
    // land on the creature in the crosshair, else where the aim meets the ground
    const aimed = ctx.target ?? rayTargets(dim, eye, dir, range, ctx.caster, 0.7).hits[0]?.entity;
    const wall = rayBlock(dim, eye, dir, range);
    let impact = aimed ? aimed.location : wall ? wall.loc : add(eye, mul(dir, titan ? 12 : 9));
    impact = groundBelow(dim, add(impact, v3(0, 0.6, 0)), 30) ?? impact;
    this.impactAt = impact;
    let fwd = horizontal(dir);
    if (len(fwd) < 0.1) fwd = forwardFromYaw(ctx.yaw);
    const yaw = yawPitchFromDir(fwd).yaw;
    // the slam animation lands the head 1.875 * size blocks in front of the grip
    const pivot = add(sub(impact, mul(fwd, 1.875 * this.size)), v3(0, 0.375 * this.size, 0));
    this.e = this.spawn("glc:hammer", pivot, yaw, 0, this.size, 1.2);
    particle(dim, "glc:charge", add(impact, v3(0, 1, 0)), ctx.corps, { radius: 2 * this.size });
    this.hit = new Set();
  }

  step(t) {
    if (t === 8) this.smash(this.radius, 1);
    if (this.titan && t === 11) this.smash(this.radius * 1.3, 0.5);
    if (this.titan && t === 14) this.smash(this.radius * 1.6, 0.35);
    return t < (this.titan ? 24 : 16);
  }

  smash(radius, mult) {
    const { dim, corps, caster } = this.ctx;
    const at = this.impactAt;
    shockwave(dim, at, corps, radius);
    if (mult === 1) {
      impactFx(dim, at, corps, true);
      sound(dim, "glc.hammer_slam", at, 1, this.titan ? 0.75 : 1.0);
      shake(dim, at, this.titan ? 24 : 14, this.titan ? 0.5 : 0.3, 0.45);
    }
    for (const e of targetsNear(dim, at, radius, caster, "hostile")) {
      if (mult < 1 && this.hit.has(e.id)) continue;
      this.hit.add(e.id);
      const falloff = 1 - Math.min(0.5, dist(e.location, at) / radius * 0.5);
      strike(caster, e, this.dmg * falloff * mult, directionTo(at, e.location), 0.7 * mult, (this.titan ? 1.1 : 0.75) * mult);
    }
  }
}
registerConstruct("hammer", (ctx) => new HammerTask(ctx, false));
registerConstruct("titan_hammer", (ctx) => new HammerTask(ctx, true));

// ------------------------------------------------------------------ blade
class BladeTask extends Task {
  constructor(ctx) {
    super(ctx, "blade");
    this.dmg = ctx.def.damage * ctx.power;
    this.e = this.spawn("glc:blade", this.place(), this.yaw(), 0, 1, 1.0);
  }

  yaw() {
    return this.ctx.target ? yawPitchFromDir(aimDir(this.ctx)).yaw : this.ctx.caster.getRotation().y;
  }

  place() {
    const c = this.ctx.caster;
    return add(add(c.location, v3(0, 1.15, 0)), mul(forwardFromYaw(this.yaw()), 0.45));
  }

  step(t) {
    const { dim, corps, caster } = this.ctx;
    const yaw = this.yaw();
    const chest = this.place();
    moveConstruct(this.e, chest, yaw);
    if (t === 2) sound(dim, "glc.blade_swing", chest, 1, 0.9 + Math.random() * 0.2);
    if (t >= 2 && t <= 6) {
      for (const k of [0, 0.5]) {
        const a = 80 - (t - 2 + k) * 40;
        const p = add(chest, mul(forwardFromYaw(yaw + a), 2.4));
        particle(dim, "glc:trail", p, corps);
      }
    }
    if (t === 3) {
      const fwd = forwardFromYaw(yaw);
      for (const e of targetsNear(dim, chest, 4.8, caster, "any")) {
        const to = sub(e.location, chest);
        if (Math.abs(to.y) > 2.6) continue;
        const h = horizontal(to);
        if (h.x * fwd.x + h.z * fwd.z < Math.cos((75 * Math.PI) / 180)) continue;
        strike(caster, e, this.dmg, h, 0.9, 0.25);
        impactFx(dim, centerOf(e), corps);
      }
    }
    return t < 8;
  }
}
registerConstruct("blade", (ctx) => new BladeTask(ctx));

// ------------------------------------------------------------------ cannon
const CORPS_IDS = CORPS.map((c) => c.id);

export function fireProjectile(dim, type, from, velocity, owner, corpsIndex) {
  const yp = yawPitchFromDir(velocity);
  const p = spawnConstruct(dim, type, from, yp.yaw, 0, 1, corpsIndex);
  if (!p) return undefined;
  try {
    const proj = p.getComponent("minecraft:projectile");
    if (proj) {
      if (valid(owner)) proj.owner = owner;
      proj.shoot(velocity, { uncertainty: 0.35 });
    }
  } catch (e) {
    console.warn(`[GLC] shoot: ${e}`);
  }
  return p;
}

class CannonTask extends Task {
  constructor(ctx) {
    super(ctx, "cannon");
    this.shots = 0;
    const { pos } = this.mount();
    this.e = this.spawn("glc:cannon", pos, ctx.yaw, ctx.pitch, 1, 1.0);
  }

  mount() {
    const c = this.ctx.caster;
    const dir = aimDir(this.ctx);
    const yp = yawPitchFromDir(dir);
    const pos = add(add(add(c.getHeadLocation(), mul(rightFromYaw(yp.yaw), 0.62)), v3(0, 0.05, 0)), mul(dir, 0.25));
    return { pos, dir, yp };
  }

  step(t) {
    const { dim, corps, caster, def } = this.ctx;
    const { pos, dir, yp } = this.mount();
    moveConstruct(this.e, pos, yp.yaw, yp.pitch);
    if (t >= 6 && (t - 6) % 5 === 0 && this.shots < def.shots) {
      this.shots++;
      const muzzle = add(pos, mul(dir, 1.4));
      fireProjectile(dim, "glc:energy_bolt", muzzle, mul(dir, 2.4), caster, this.ctx.corpsIndex);
      particle(dim, "glc:impact", muzzle, corps);
      sound(dim, "glc.cannon_fire", muzzle, 0.9, 0.9 + this.shots * 0.04);
    }
    return t < 6 + def.shots * 5 + 6;
  }
}
registerConstruct("cannon", (ctx) => new CannonTask(ctx));

// projectile impacts (cannon bolts + NPC shots + missiles)
/** @type {Map<string, {owner: any, ctx: any}>} */
const missiles = new Map();

function corpsOfProjectile(p) {
  try {
    return CORPS_IDS[/** @type {number} */ (p.getProperty("glc:corps")) ?? 0] ?? "green";
  } catch {
    return "green";
  }
}

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const p = ev.projectile;
  if (!p || !p.typeId.startsWith("glc:")) return;
  const hitEntity = ev.getEntityHit()?.entity;
  onProjectileImpact(p, ev.dimension, ev.location, hitEntity);
});
world.afterEvents.projectileHitBlock.subscribe((ev) => {
  const p = ev.projectile;
  if (!p || !p.typeId.startsWith("glc:")) return;
  onProjectileImpact(p, ev.dimension, ev.location, undefined);
});

function onProjectileImpact(p, dim, loc, hitEntity) {
  let id;
  let type;
  try {
    id = p.id;
    type = p.typeId;
  } catch {
    return;
  }
  if (type === "glc:energy_bolt") {
    impactFx(dim, loc, corpsOfProjectile(p));
    return;
  }
  if (type === "glc:missile") {
    const m = missiles.get(id);
    missiles.delete(id);
    if (m) explodeMissile(m.ctx, dim, loc, hitEntity);
  }
}

function explodeMissile(ctx, dim, loc, direct) {
  const { caster, corps, def } = ctx;
  particle(dim, "glc:explosion", loc, corps, { radius: 2 }, 3);
  particle(dim, "glc:impact", loc, corps);
  shockwave(dim, loc, corps, def.radius);
  sound(dim, "glc.explosion", loc, 0.9, 1.1);
  const dmg = def.damage * ctx.power;
  if (direct && valid(direct) && valid(caster)) strike(caster, direct, dmg, ctx.dir, 0.6, 0.3);
  if (!valid(caster)) return;
  for (const e of targetsNear(dim, loc, def.radius, caster, "hostile")) {
    if (direct && e.id === direct.id) continue;
    strike(caster, e, dmg * 0.6, directionTo(loc, e.location), 0.6, 0.35);
  }
}

class MissilesTask extends Task {
  constructor(ctx) {
    super(ctx, "missiles");
    const { dim, eye, dir, right, caster } = ctx;
    this.aim = ctx.target ?? rayTargets(dim, eye, dir, 32, caster, 0.9).hits[0]?.entity;
    this.list = [];
    const offsets = [mul(right, 0.8), mul(right, -0.8), add(v3(0, 0.7, 0), mul(right, 0.35)), add(v3(0, 0.7, 0), mul(right, -0.35))];
    for (const off of offsets) {
      const from = add(add(eye, mul(dir, 0.9)), off);
      const launch = norm(add(dir, mul(off, 0.7)));
      const m = fireProjectile(dim, "glc:missile", from, mul(launch, 0.9), caster, ctx.corpsIndex);
      if (!m) continue;
      missiles.set(m.id, { owner: caster, ctx });
      this.list.push({ e: m, speed: 0.9 });
    }
    sound(dim, "glc.missile_launch", eye, 1, 1);
  }

  step(t) {
    const { dim, corps, caster } = this.ctx;
    let alive = 0;
    for (const m of this.list) {
      if (!valid(m.e)) continue;
      alive++;
      const loc = m.e.location;
      particle(dim, "glc:trail", loc, corps);
      if (t > 3 && t % 2 === 0) {
        const target = valid(this.aim) ? this.aim : nearestTarget(dim, loc, 18, caster, "hostile");
        if (target) {
          const cur = norm(m.e.getVelocity());
          const want = directionTo(loc, centerOf(target));
          const nd = norm(lerp(cur, want, 0.45));
          m.speed = Math.min(1.5, m.speed + 0.12);
          try {
            m.e.clearVelocity();
            m.e.applyImpulse(mul(nd, m.speed));
          } catch {
            // ignore
          }
        }
      }
      if (t >= 70) {
        missiles.delete(m.e.id);
        explodeMissile(this.ctx, dim, loc, undefined);
        try {
          m.e.remove();
        } catch {
          // ignore
        }
      }
    }
    return alive > 0 && t < 72;
  }

  dispose() {
    for (const m of this.list) missiles.delete(m.e.id);
  }
}
registerConstruct("missiles", (ctx) => new MissilesTask(ctx));

// ------------------------------------------------------------------ drones
class DronesTask extends Task {
  constructor(ctx) {
    super(ctx, "drones");
    this.duration = ctx.def.duration * 20;
    this.drones = [0, 1].map((k) => this.spawn("glc:drone", this.orbit(0, k), ctx.yaw, 0, 1, 0.8, k === 1));
    this.next = [10, 17];
  }

  orbit(t, k) {
    const base = add(this.ctx.caster.location, v3(0, 2.2, 0));
    const a = t * 0.11 + k * Math.PI;
    return add(base, v3(Math.cos(a) * 1.7, Math.sin(t * 0.07 + k) * 0.25, Math.sin(a) * 1.7));
  }

  step(t) {
    const { dim, corps, caster, def } = this.ctx;
    this.drones.forEach((d, k) => {
      if (!valid(d)) return;
      const pos = this.orbit(t, k);
      moveConstruct(d, pos, (t * 6 + k * 180) % 360);
      if (t >= this.next[k]) {
        this.next[k] = t + 15;
        const target = this.ctx.target && valid(this.ctx.target) ? this.ctx.target : nearestTarget(dim, pos, 16, caster, "hostile");
        if (target) {
          const at = centerOf(target);
          beam(dim, pos, at, corps, 0.55);
          strike(caster, target, def.damage * this.ctx.power, directionTo(pos, at), 0.15, 0.05);
          particle(dim, "glc:spark", at, corps);
          sound(dim, "glc.drone_fire", pos, 0.5, 1 + k * 0.1);
        }
      }
    });
    return t < this.duration && this.drones.some(valid);
  }
}
registerConstruct("drones", (ctx) => new DronesTask(ctx));

// ------------------------------------------------------------------ lance
class LanceTask extends Task {
  constructor(ctx) {
    super(ctx, "lance");
    this.chargeT = 30;
    sound(ctx.dim, "glc.charge", ctx.hand, 1, 1);
    if (ctx.isPlayer) {
      try {
        ctx.caster.addEffect("slowness", 32, { amplifier: 2, showParticles: false });
      } catch {
        // ignore
      }
    }
  }

  step(t) {
    const { dim, corps, caster, def } = this.ctx;
    const dir = aimDir(this.ctx);
    const hand = handOf(caster, dir);
    if (t < this.chargeT) {
      if (t % 2 === 0) particle(dim, "glc:charge", hand, corps, { radius: 1.5 - (t / this.chargeT) * 0.9 });
      if (t % 6 === 0) particle(dim, "glc:aura", hand, corps, { radius: 0.4 });
      return true;
    }
    if (t === this.chargeT) {
      const eye = caster.getHeadLocation();
      const { hits, end } = rayTargets(dim, eye, dir, def.range, caster, 1.4);
      beam(dim, hand, end, corps, 2.6);
      beam(dim, hand, end, corps, 1.0);
      for (const h of hits) {
        strike(caster, h.entity, def.damage * this.ctx.power, dir, 1.2, 0.35);
        impactFx(dim, centerOf(h.entity), corps);
      }
      impactFx(dim, end, corps, true);
      shockwave(dim, end, corps, 2.5);
      sound(dim, "glc.lance_fire", hand, 1, 1);
      shake(dim, hand, 16, 0.35, 0.5);
      if (this.ctx.isPlayer) {
        try {
          caster.applyKnockback({ x: -dir.x * 0.6, z: -dir.z * 0.6 }, 0.12);
        } catch {
          // ignore
        }
      }
    }
    return t < this.chargeT + 6;
  }
}
registerConstruct("lance", (ctx) => new LanceTask(ctx));

// ------------------------------------------------------------------ colossus
class ColossusTask extends Task {
  constructor(ctx) {
    super(ctx, "colossus");
    const { dim, caster } = ctx;
    let fwd = horizontal(ctx.dir);
    if (len(fwd) < 0.1) fwd = forwardFromYaw(ctx.yaw);
    this.fwd = fwd;
    this.yaw = yawPitchFromDir(fwd).yaw;
    const behind = add(caster.location, mul(fwd, -3));
    this.base = groundBelow(dim, add(behind, v3(0, 2, 0)), 8) ?? behind;
    this.impactAt = groundBelow(dim, add(add(this.base, mul(fwd, 6)), v3(0, 3, 0)), 10) ?? add(this.base, mul(fwd, 6));
    this.e = this.spawn("glc:colossus", this.base, this.yaw, 0, 2.5, 2.5, true);
    sound(dim, "glc.colossus_rise", this.base, 1, 1);
    this.requireCaster = false;
    this.hit = new Set();
  }

  step(t) {
    const { dim, corps, caster, def } = this.ctx;
    if (t < 16 && t % 3 === 0) particle(dim, "glc:pillar", this.base, corps, undefined, 3);
    if (t === 38 || t === 41 || t === 44) {
      const ring = t === 38 ? 4 : t === 41 ? 7 : def.radius;
      shockwave(dim, this.impactAt, corps, ring);
      if (t === 38) {
        particle(dim, "glc:explosion", this.impactAt, corps, { radius: 4 }, 3);
        sound(dim, "glc.colossus_slam", this.impactAt, 1, 1);
        shake(dim, this.impactAt, 28, 0.7, 0.8);
      }
      if (valid(caster)) {
        for (const e of targetsNear(dim, this.impactAt, ring, caster, "hostile")) {
          if (this.hit.has(e.id)) continue;
          this.hit.add(e.id);
          strike(caster, e, def.damage * this.ctx.power, directionTo(this.impactAt, e.location), 1.0, 0.95);
          impactFx(dim, centerOf(e), corps);
        }
      }
    }
    return t < 54;
  }
}
registerConstruct("colossus", (ctx) => new ColossusTask(ctx));
