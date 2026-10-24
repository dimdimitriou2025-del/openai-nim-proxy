// Utility constructs: platform, bridge, grapple, cage, drill.
import { GameMode, system } from "@minecraft/server";
import { Task, feedback, moveConstruct, registerConstruct } from "./registry.js";
import { buildBlocks } from "./hardlight.js";
import { aimDir, handOf } from "./offense.js";
import { rt } from "../core/state.js";
import { SAFE_FALL_TICKS } from "../config.js";
import { beam, particle, sound } from "../lib/fx.js";
import {
  add, center, clamp, dist, dominantAxis, floor, forwardFromYaw, horizontal, len, mul, norm, sub, v3, yawPitchFromDir,
} from "../lib/vec.js";
import { centerOf, directionTo, rayBlock, rayTargets, valid } from "../lib/util.js";

// ------------------------------------------------------------------ platform
registerConstruct("platform", (ctx) => {
  const loc = ctx.caster.location;
  const y = Math.floor(loc.y) - 1;
  const cx = Math.floor(loc.x);
  const cz = Math.floor(loc.z);
  const ring1 = [v3(cx, y, cz)];
  const ring2 = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx || dz) ring2.push(v3(cx + dx, y, cz + dz));
  if (ctx.isPlayer) rt(ctx.caster.id).safeFallUntil = system.currentTick + 20;
  return buildBlocks(ctx, [ring1, ring2], ctx.def.duration);
});

// ------------------------------------------------------------------ bridge
registerConstruct("bridge", (ctx) => {
  const c = ctx.caster;
  let fwd = horizontal(ctx.dir);
  if (len(fwd) < 0.1) fwd = forwardFromYaw(ctx.yaw);
  const axis = dominantAxis(fwd, false);
  const perp = { x: -axis.z, y: 0, z: axis.x };
  const slope = clamp(-Math.tan((ctx.pitch * Math.PI) / 180), -1, 1); // looking up builds a ramp up
  const start = add(c.location, v3(0, -0.5, 0));
  const rows = [];
  for (let i = 1; i <= 16; i++) {
    const p = add(add(start, mul(axis, i)), v3(0, slope * i, 0));
    rows.push([-1, 0, 1].map((w) => add(p, v3(perp.x * w, 0, perp.z * w))));
  }
  // build two rows per tick by merging pairs
  const merged = [];
  for (let i = 0; i < rows.length; i += 2) merged.push([...rows[i], ...(rows[i + 1] ?? [])]);
  return buildBlocks(ctx, merged, ctx.def.duration);
});

// ------------------------------------------------------------------ grapple
class GrappleTask extends Task {
  constructor(ctx, mode, target, anchor) {
    super(ctx, "grapple");
    this.mode = mode;
    this.target = target;
    this.anchor = anchor;
    sound(ctx.dim, "glc.grapple_fire", ctx.hand, 1, 1);
    if (mode === "pull") {
      const back = yawPitchFromDir(sub(ctx.eye, anchor));
      this.spawn("glc:claw", anchor, back.yaw, back.pitch, 1, 0.6, true);
    }
  }

  step(t) {
    const { dim, corps, caster } = this.ctx;
    const dir = aimDir(this.ctx);
    const hand = handOf(caster, dir);
    if (this.mode === "yank") {
      const e = this.target;
      if (!valid(e)) return false;
      beam(dim, hand, centerOf(e), corps, 0.35);
      if (t === 1 || t === 4) {
        const to = directionTo(e.location, caster.location);
        try {
          e.applyKnockback({ x: to.x * 1.25, z: to.z * 1.25 }, 0.4);
        } catch {
          // ignore
        }
      }
      return t < 9;
    }
    const to = sub(this.anchor, caster.location);
    const d = len(to);
    if (d < 2.2 || t > 50 || (this.ctx.isPlayer && caster.isSneaking && t > 4)) {
      try {
        caster.applyKnockback({ x: 0, z: 0 }, 0.35);
      } catch {
        // ignore
      }
      return false;
    }
    const v = mul(norm(to), 1.15);
    try {
      caster.applyKnockback({ x: v.x, z: v.z }, clamp(v.y + 0.12, -0.6, 1.0));
    } catch {
      // ignore
    }
    beam(dim, hand, this.anchor, corps, 0.35);
    rt(caster.id).safeFallUntil = system.currentTick + SAFE_FALL_TICKS;
    return true;
  }
}

registerConstruct("grapple", (ctx) => {
  const { dim, eye, dir, caster, def } = ctx;
  const hitE = rayTargets(dim, eye, dir, 30, caster, 0.6).hits[0];
  const hitB = rayBlock(dim, eye, dir, def.range);
  if (hitE && (!hitB || hitE.at < hitB.dist)) return new GrappleTask(ctx, "yank", hitE.entity, undefined);
  if (hitB) return new GrappleTask(ctx, "pull", undefined, hitB.loc);
  feedback(caster, "§7Nothing in range to grab.");
  return false;
});

// ------------------------------------------------------------------ cage
class CageTask extends Task {
  constructor(ctx, target) {
    super(ctx, "cage");
    this.target = target;
    this.at = target.location;
    this.duration = ctx.def.duration * 20;
    this.requireCaster = false;
    let h = 1.8;
    try {
      h = Math.max(1, target.getHeadLocation().y - target.location.y + 0.4);
    } catch {
      // ignore
    }
    this.e = this.spawn("glc:cage", this.at, ctx.yaw, 0, Math.max(1, h / 1.75), 1.4, true);
    sound(ctx.dim, "glc.cage_lock", this.at, 1, 1);
  }

  step(t) {
    const e = this.target;
    if (!valid(e)) return false;
    try {
      if (dist(e.location, this.at) > 0.25) e.teleport(this.at, { keepVelocity: false });
      if (t % 20 === 1) {
        e.addEffect("slowness", 30, { amplifier: 5, showParticles: false });
        e.addEffect("weakness", 30, { amplifier: 1, showParticles: false });
      }
    } catch {
      // ignore
    }
    if (t % 10 === 0) particle(this.ctx.dim, "glc:aura", centerOf(e), this.ctx.corps, { radius: 0.8 });
    return t < this.duration;
  }
}

registerConstruct("cage", (ctx) => {
  const hit = ctx.target ?? rayTargets(ctx.dim, ctx.eye, ctx.dir, 24, ctx.caster, 0.8).hits[0]?.entity;
  if (!hit) {
    feedback(ctx.caster, "§7Aim at a creature to cage it.");
    return false;
  }
  return new CageTask(ctx, hit);
});

// ------------------------------------------------------------------ drill
const UNBREAKABLE = new Set([
  "minecraft:bedrock", "minecraft:barrier", "minecraft:command_block", "minecraft:chain_command_block",
  "minecraft:repeating_command_block", "minecraft:structure_block", "minecraft:jigsaw", "minecraft:end_portal_frame",
  "minecraft:end_portal", "minecraft:portal", "minecraft:end_gateway", "minecraft:reinforced_deepslate",
  "minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel", "minecraft:ender_chest", "minecraft:spawner",
  "minecraft:trial_spawner", "minecraft:vault", "minecraft:allow", "minecraft:deny", "minecraft:border_block",
  "minecraft:light_block", "minecraft:structure_void", "minecraft:beacon", "minecraft:respawn_anchor",
]);

function breakable(block) {
  try {
    if (!block || block.isAir || block.isLiquid) return false;
    const id = block.typeId;
    if (UNBREAKABLE.has(id) || id.startsWith("glc:") || id.endsWith("shulker_box")) return false;
    return true;
  } catch {
    return false;
  }
}

class DrillTask extends Task {
  constructor(ctx) {
    super(ctx, "drill");
    const c = ctx.caster;
    this.axis = dominantAxis(ctx.dir, true);
    const vertical = this.axis.y !== 0;
    const feet = floor(c.location);
    // horizontal tunnels are centred one block above the feet; vertical ones on the feet column
    this.origin = vertical ? add(feet, v3(0, this.axis.y > 0 ? 2 : -1, 0)) : add(add(feet, v3(0, 1, 0)), this.axis);
    this.perpA = vertical ? v3(1, 0, 0) : v3(0, 1, 0);
    this.perpB = vertical ? v3(0, 0, 1) : { x: -this.axis.z, y: 0, z: this.axis.x };
    this.depth = ctx.def.depth;
    this.layer = 0;
    this.broken = 0;
    const yp = yawPitchFromDir(this.axis);
    this.yaw = yp.yaw;
    this.pitch = yp.pitch;
    this.e = this.spawn("glc:drill", this.headPos(), yp.yaw, yp.pitch, 1, 1.2, true);
    sound(ctx.dim, "glc.drill", center(this.origin), 1, 1);
  }

  headPos() {
    return add(center(add(this.origin, mul(this.axis, Math.max(0, this.layer - 1)))), mul(this.axis, -0.6));
  }

  /** Pull the blocks dropped by the last layer to the caster. */
  collect(at) {
    const c = this.ctx.caster;
    if (!valid(c) || c.dimension.id !== this.ctx.dim.id) return;
    try {
      for (const item of this.ctx.dim.getEntities({ type: "minecraft:item", location: at, maxDistance: 2.5 })) {
        item.teleport(c.location);
      }
    } catch {
      // unloaded
    }
  }

  step(t) {
    const { dim, corps } = this.ctx;
    moveConstruct(this.e, this.headPos(), this.yaw, this.pitch);
    if (t % 4 !== 0) {
      if (t % 2 === 0) particle(dim, "glc:spark", add(this.headPos(), mul(this.axis, 1)), corps);
      return true;
    }
    if (this.layer > 0) this.collect(center(add(this.origin, mul(this.axis, this.layer - 1))));
    if (this.layer >= this.depth) return t < this.depth * 4 + 6;
    const base = add(this.origin, mul(this.axis, this.layer));
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const p = add(add(base, mul(this.perpA, a)), mul(this.perpB, b));
        try {
          const block = dim.getBlock(p);
          if (!breakable(block)) continue;
          dim.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
          this.broken++;
        } catch {
          // unloaded or protected
        }
      }
    }
    particle(dim, "glc:explosion", center(base), corps, { radius: 0.8 }, 2);
    if (this.layer % 2 === 0) sound(dim, "glc.drill", center(base), 0.7, 1 + this.layer * 0.05);
    this.layer++;
    return true;
  }
}

registerConstruct("drill", (ctx) => {
  if (ctx.isPlayer) {
    try {
      const mode = /** @type {import("@minecraft/server").Player} */ (ctx.caster).getGameMode();
      if (mode === GameMode.Adventure || mode === GameMode.Spectator) {
        feedback(ctx.caster, "§7The drill cannot break blocks in this game mode.");
        return false;
      }
    } catch {
      // ignore
    }
  }
  return new DrillTask(ctx);
});
