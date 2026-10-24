// Defensive constructs: shield, dome, bubble, aegis dome, barricade wall.
import { Task, registerConstruct, moveConstruct, activeTasks } from "./registry.js";
import { buildBlocks } from "./hardlight.js";
import { rt } from "../core/state.js";
import { spendEnergy } from "../core/lantern.js";
import { particle, sound } from "../lib/fx.js";
import { add, dist, dominantAxis, floor, forwardFromYaw, horizontal, mul, sub, v3 } from "../lib/vec.js";
import { centerOf, isPlayer, targetsNear, valid } from "../lib/util.js";

/** Is this entity a projectile that should be stopped by `owner`'s barrier? */
export function isHostileProjectile(p, owner) {
  try {
    if (!p.isValid || p.id === owner.id) return false;
    const proj = p.getComponent("minecraft:projectile");
    if (!proj) return false;
    const src = proj.owner;
    if (src && (src.id === owner.id || src.matches({ families: ["glc_lantern"] }) && src.typeId !== "glc:sinestro")) return false;
    return true;
  } catch {
    return false;
  }
}

function zapProjectiles(dim, center, radius, owner, corps) {
  let n = 0;
  try {
    for (const p of dim.getEntities({ location: center, maxDistance: radius })) {
      if (!isHostileProjectile(p, owner)) continue;
      const at = p.location;
      p.remove();
      particle(dim, "glc:shield_hit", at, corps);
      particle(dim, "glc:spark", at, corps);
      n++;
    }
  } catch {
    // ignore
  }
  if (n) sound(dim, "glc.shield_hit", center, 0.8, 1.1);
  return n;
}

// ------------------------------------------------------------------ shield
export class ShieldTask extends Task {
  constructor(ctx) {
    super(ctx, "shield");
    this.duration = ctx.def.duration * 20;
    this.e = this.spawn("glc:shield", this.place(), this.facing(), 0, 1, 1.6, true);
    sound(ctx.dim, "glc.shield_up", ctx.caster.location);
    rt(ctx.caster.id).shield = this;
  }

  facing() {
    return this.ctx.caster.getRotation().y;
  }

  place() {
    const c = this.ctx.caster;
    return add(add(c.location, v3(0, 1.1, 0)), mul(forwardFromYaw(this.facing()), 1.6));
  }

  /** Does the shield cover an attack coming from `from`? */
  covers(from) {
    const c = this.ctx.caster;
    const to = horizontal(sub(from, c.location));
    const f = forwardFromYaw(this.facing());
    return to.x * f.x + to.z * f.z > Math.cos((75 * Math.PI) / 180);
  }

  onBlocked(from) {
    const { dim, corps } = this.ctx;
    const p = valid(this.e) ? this.e.location : this.place();
    particle(dim, "glc:shield_hit", p, corps);
    particle(dim, "glc:spark", p, corps);
    sound(dim, "glc.shield_hit", p, 0.9, 0.9 + Math.random() * 0.2);
    if (this.ctx.isPlayer && !spendEnergy(/** @type {any} */ (this.ctx.caster), 2, true)) this.finish();
  }

  step(t) {
    const { dim, corps, caster } = this.ctx;
    const pos = this.place();
    moveConstruct(this.e, pos, this.facing());
    if (this.ctx.isPlayer && t % 20 === 0 && !spendEnergy(/** @type {any} */ (caster), 0.8, true)) return false;
    if (t % 2 === 0) zapProjectiles(dim, pos, 2.6, caster, corps);
    return t < this.duration;
  }

  dispose() {
    super.dispose();
    const r = rt(this.ctx.caster.id);
    if (r.shield === this) r.shield = null;
  }
}
registerConstruct("shield", (ctx) => new ShieldTask(ctx));

// ------------------------------------------------------------------ domes
export class DomeTask extends Task {
  constructor(ctx, aegis) {
    super(ctx, "dome");
    this.aegis = aegis;
    this.radius = ctx.def.radius;
    this.duration = ctx.def.duration * 20;
    this.center = ctx.caster.location;
    this.requireCaster = false;
    this.counts = !aegis;
    this.e = this.spawn("glc:dome", this.center, 0, 0, this.radius / 1.5, 1.2, true);
    sound(ctx.dim, "glc.shield_up", this.center, 1, aegis ? 0.6 : 0.8);
    particle(ctx.dim, "glc:sphere_flash", add(this.center, v3(0, 1, 0)), ctx.corps, { radius: this.radius * 0.8 }, 2);
  }

  inside(loc) {
    return dist(loc, this.center) <= this.radius && loc.y >= this.center.y - 1.5;
  }

  step(t) {
    const { dim, corps, caster } = this.ctx;
    if (t % 3 === 0 && valid(caster)) {
      for (const e of targetsNear(dim, this.center, this.radius + 0.5, caster, "hostile")) {
        if (!this.inside(e.location)) continue;
        const out = horizontal(sub(e.location, this.center));
        try {
          e.applyKnockback({ x: out.x * 0.9, z: out.z * 0.9 }, 0.25);
        } catch {
          // ignore
        }
        particle(dim, "glc:shield_hit", centerOf(e), corps);
      }
    }
    if (t % 2 === 0) zapProjectiles(dim, add(this.center, v3(0, 1, 0)), this.radius, valid(caster) ? caster : { id: "" }, corps);
    if (this.aegis && t % 40 === 1) {
      try {
        for (const p of dim.getEntities({ location: this.center, maxDistance: this.radius })) {
          if (!(isPlayer(p) || p.matches({ families: ["glc_lantern"] })) || p.typeId === "glc:sinestro") continue;
          p.addEffect("regeneration", 60, { amplifier: 0, showParticles: false });
          p.addEffect("resistance", 60, { amplifier: 0, showParticles: false });
          particle(dim, "glc:aura", centerOf(p), corps, { radius: 0.6 });
        }
      } catch {
        // ignore
      }
    }
    return t < this.duration;
  }
}
registerConstruct("dome", (ctx) => new DomeTask(ctx, false));
registerConstruct("aegis", (ctx) => new DomeTask(ctx, true));

/** Domes protecting a location (used by the damage protection system). */
export function domesCovering(loc) {
  return activeTasks("dome").filter((d) => d.inside(loc));
}

// ------------------------------------------------------------------ bubble
export class BubbleTask extends Task {
  constructor(ctx) {
    super(ctx, "bubble");
    this.duration = ctx.def.duration * 20;
    this.pool = 30;
    this.e = this.spawn("glc:bubble", this.place(), 0, 0, 1, 1.0, true);
    sound(ctx.dim, "glc.shield_up", ctx.caster.location, 0.8, 1.3);
    const r = rt(ctx.caster.id);
    if (r.bubble && r.bubble !== this) r.bubble.finish();
    r.bubble = this;
  }

  place() {
    return add(this.ctx.caster.location, v3(0, 0.95, 0));
  }

  absorb(amount) {
    const { dim, corps } = this.ctx;
    this.pool -= amount;
    particle(dim, "glc:sphere_flash", this.place(), corps, { radius: 1.3 });
    sound(dim, "glc.shield_hit", this.place(), 0.7, 1.4);
    if (this.pool <= 0) this.finish();
  }

  step(t) {
    moveConstruct(this.e, this.place());
    if (t % 40 === 1) {
      try {
        this.ctx.caster.addEffect("water_breathing", 60, { amplifier: 0, showParticles: false });
        this.ctx.caster.addEffect("fire_resistance", 60, { amplifier: 0, showParticles: false });
      } catch {
        // ignore
      }
    }
    return t < this.duration && this.pool > 0;
  }

  dispose() {
    const { dim, corps } = this.ctx;
    if (this.pool <= 0 && valid(this.ctx.caster)) {
      sound(dim, "glc.bubble_pop", this.place(), 1, 1);
      particle(dim, "glc:sphere_flash", this.place(), corps, { radius: 1.6 }, 2);
    }
    super.dispose();
    const r = rt(this.ctx.caster.id);
    if (r.bubble === this) r.bubble = null;
  }
}
registerConstruct("bubble", (ctx) => new BubbleTask(ctx));

// ------------------------------------------------------------------ wall
registerConstruct("wall", (ctx) => {
  const c = ctx.caster;
  const fwd = horizontal(ctx.dir);
  const axis = dominantAxis(fwd.x || fwd.z ? fwd : forwardFromYaw(ctx.yaw), false);
  const perp = { x: -axis.z, y: 0, z: axis.x };
  const base = floor(add(c.location, mul(axis, 3)));
  const rows = [];
  for (let y = 0; y < 3; y++) {
    const row = [];
    for (let w = -2; w <= 2; w++) row.push(add(base, v3(perp.x * w, y, perp.z * w)));
    rows.push(row);
  }
  return buildBlocks(ctx, rows, ctx.def.duration);
});
