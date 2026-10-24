// Hard-light blocks: real, solid construct blocks that expire on their own.
// Each block counts down its "glc:life" state on a block tick (one step = 2 s),
// so walls/bridges disappear even if the world was saved and reloaded.
import { BlockPermutation } from "@minecraft/server";
import { Task, feedback } from "./registry.js";
import { HARDLIGHT_ID, HARDLIGHT_STEP_SECONDS } from "../config.js";
import { dissipateFx, particle, sound } from "../lib/fx.js";
import { center, floor } from "../lib/vec.js";

/** Can a hard-light block be placed here without destroying anything? */
export function placeable(block) {
  try {
    if (!block) return false;
    if (block.isAir) return true;
    return block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water" ||
      block.typeId === "minecraft:short_grass" || block.typeId === "minecraft:tall_grass" ||
      block.typeId === "minecraft:snow_layer" || block.typeId === "minecraft:fern";
  } catch {
    return false;
  }
}

export function lifeSteps(seconds) {
  return Math.max(1, Math.min(15, Math.ceil(seconds / HARDLIGHT_STEP_SECONDS)));
}

export function placeHardlight(dim, pos, steps) {
  try {
    const b = dim.getBlock(pos);
    if (!placeable(b)) return false;
    b.setPermutation(BlockPermutation.resolve(HARDLIGHT_ID, { "glc:life": steps }));
    return true;
  } catch {
    return false;
  }
}

/** Places rows of hard-light blocks, one row per tick, forming from light. */
class BuildTask extends Task {
  constructor(ctx, rows, seconds) {
    super(ctx, "build");
    this.rows = rows;
    this.steps = lifeSteps(seconds * ctx.blockLife);
    this.placed = 0;
    this.requireCaster = false;
    this.counts = false;
    sound(ctx.dim, "glc.construct_form", center(floor(rows[0][Math.floor(rows[0].length / 2)])), 1, 1.1);
  }

  step(t) {
    const row = this.rows[t - 1];
    if (!row) {
      if (!this.placed) feedback(this.ctx.caster, "§7No room to build there.");
      return false;
    }
    let any = false;
    for (const p of row) {
      if (placeHardlight(this.ctx.dim, floor(p), this.steps)) {
        this.placed++;
        any = true;
      }
    }
    if (any) {
      const mid = center(floor(row[Math.floor(row.length / 2)]));
      particle(this.ctx.dim, "glc:form", mid, this.ctx.corps, { radius: 1.8 });
      particle(this.ctx.dim, "glc:spark", mid, this.ctx.corps);
    }
    return t < this.rows.length + 1;
  }
}

export function buildBlocks(ctx, rows, seconds) {
  return new BuildTask(ctx, rows, seconds);
}

/** Block custom component: count down and dissolve when life runs out. */
export const hardlightComponent = {
  /** @param {import("@minecraft/server").BlockComponentTickEvent} ev */
  onTick(ev) {
    const b = ev.block;
    try {
      const life = /** @type {number} */ (b.permutation.getState(/** @type {any} */ ("glc:life")) ?? 0);
      if (life <= 1) {
        dissipateFx(ev.dimension, center(b.location), "green", 0.6);
        b.setType("minecraft:air");
        if (Math.random() < 0.3) sound(ev.dimension, "glc.construct_dissipate", center(b.location), 0.4, 1.3);
      } else {
        b.setPermutation(b.permutation.withState(/** @type {any} */ ("glc:life"), life - 1));
      }
    } catch {
      // ignore
    }
  },
};
