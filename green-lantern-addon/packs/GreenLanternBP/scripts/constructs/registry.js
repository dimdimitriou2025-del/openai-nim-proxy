// Construct engine: validation, energy/cooldowns, lifecycle of construct entities.
import { system, world } from "@minecraft/server";
import { CORPS, GLYPHS } from "../data/game_data.js";
import { data, rt, save } from "../core/state.js";
import {
  CONSTRUCT_BY_ID, addXp, blockLifeMultiplier, corpsOf, costOf, damageMultiplier, isUnlocked, rankDef,
  spendEnergy, toast,
} from "../core/lantern.js";
import { MAX_ACTIVE_CONSTRUCTS_PER_PLAYER, MAX_ACTIVE_CONSTRUCTS_TOTAL } from "../config.js";
import { dissipateFx, formFx, playerSound, sound } from "../lib/fx.js";
import { add, mul, rightFromYaw, v3, yawPitchFromDir } from "../lib/vec.js";
import { centerOf, directionTo, valid } from "../lib/util.js";

const CORPS_INDEX = Object.fromEntries(CORPS.map((c, i) => [c.id, i]));

/** @type {Record<string, (ctx: CastContext) => Task | undefined | void>} */
const IMPLS = {};
/** @type {Set<Task>} */
const active = new Set();
/** ids of construct entities spawned this session (anything else is an orphan) */
const owned = new Set();

/**
 * @typedef {object} CastContext
 * @property {import("@minecraft/server").Entity} caster
 * @property {boolean} isPlayer
 * @property {import("@minecraft/server").Dimension} dim
 * @property {import("@minecraft/server").Vector3} eye
 * @property {import("@minecraft/server").Vector3} dir
 * @property {import("@minecraft/server").Vector3} right
 * @property {import("@minecraft/server").Vector3} hand
 * @property {number} yaw
 * @property {number} pitch
 * @property {string} corps
 * @property {number} corpsIndex
 * @property {number} power damage multiplier
 * @property {number} blockLife hard-light block life multiplier
 * @property {any} def construct definition from game_data
 * @property {import("@minecraft/server").Entity | undefined} target NPC target
 */

export function registerConstruct(id, impl) {
  IMPLS[id] = impl;
}

export function implemented() {
  return Object.keys(IMPLS);
}

/**
 * Build the aiming context for a caster (player or NPC).
 * @param {import("@minecraft/server").Entity} caster
 * @returns {CastContext}
 */
export function buildContext(caster, id, target = undefined) {
  const isPlayer = caster.typeId === "minecraft:player";
  const eye = caster.getHeadLocation();
  const dir = target ? directionTo(eye, centerOf(target)) : caster.getViewDirection();
  const { yaw, pitch } = yawPitchFromDir(dir);
  const right = rightFromYaw(yaw);
  const hand = add(add(add(eye, v3(0, -0.45, 0)), mul(right, 0.38)), mul(dir, 0.6));
  const corps = corpsOf(caster);
  return {
    caster, isPlayer, dim: caster.dimension, eye, dir, right, hand, yaw, pitch, corps,
    corpsIndex: CORPS_INDEX[corps] ?? 0, power: damageMultiplier(caster, id),
    blockLife: blockLifeMultiplier(caster), def: CONSTRUCT_BY_ID[id], target,
  };
}

function countFor(id) {
  let n = 0;
  for (const t of active) if (t.owner === id && t.counts) n++;
  return n;
}

/**
 * Try to cast a construct. Players pay energy and respect cooldowns/ranks;
 * NPC Lanterns cast for free on their own timers.
 * @param {import("@minecraft/server").Entity} caster
 * @param {string} id construct id
 * @returns {boolean}
 */
export function tryCast(caster, id, target = undefined) {
  const def = CONSTRUCT_BY_ID[id];
  const impl = IMPLS[id];
  if (!def || !impl || !valid(caster)) return false;
  const now = system.currentTick;
  const r = rt(caster.id);
  const player = caster.typeId === "minecraft:player" ? /** @type {import("@minecraft/server").Player} */ (caster) : undefined;
  if (player) {
    const d = data(player);
    if (!d.sworn) return false;
    if (r.busyUntil > now) return false;
    if (!d.ringOn) {
      toast(player, "§7Your ring is powered down. §fSneak + use§7 to open the menu.");
      return false;
    }
    if (!isUnlocked(d, def)) {
      toast(player, `§c${GLYPHS.lock} ${def.name} unlocks at rank ${def.rank}.`);
      return false;
    }
    const ready = r.cooldowns[id] ?? 0;
    if (ready > now) {
      toast(player, `§7${def.name} recharging... §f${((ready - now) / 20).toFixed(1)}s`, 20);
      return false;
    }
    if (countFor(player.id) >= MAX_ACTIVE_CONSTRUCTS_PER_PLAYER || active.size >= MAX_ACTIVE_CONSTRUCTS_TOTAL) {
      toast(player, "§eToo many constructs active - let some dissipate first.");
      return false;
    }
    if (!spendEnergy(player, costOf(player, def))) return false;
  } else if ((r.cooldowns[id] ?? 0) > now) {
    return false;
  }
  const ctx = buildContext(caster, id, target);
  /** @type {Task | undefined | void | false} */
  let task;
  try {
    task = impl(ctx);
  } catch (e) {
    console.warn(`[GLC] construct ${id} failed: ${e}`);
    task = false;
  }
  if (task === false) {
    // nothing to act on (no target, no room): refund, no cooldown
    if (player) {
      const d = data(player);
      d.energy = Math.min(d.energy + costOf(player, def), Math.max(d.energy, rankDef(d).maxEnergy));
      save(player);
    }
    return false;
  }
  r.cooldowns[id] = now + Math.round(def.cooldown * 20);
  if (task) active.add(task);
  if (player) {
    const d = data(player);
    d.casts++;
    d.recent = [id, ...d.recent.filter((x) => x !== id)].slice(0, 3);
    save(player);
    if (def.xp) addXp(player, def.xp);
  }
  return true;
}

export function tickConstructs() {
  for (const t of active) {
    let keep = false;
    try {
      keep = t.update();
    } catch (e) {
      console.warn(`[GLC] construct update: ${e}`);
      keep = false;
    }
    if (!keep) {
      active.delete(t);
      try {
        t.dispose();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Active tasks of a given kind, optionally for one owner (used by protection).
 * @returns {any[]}
 */
export function activeTasks(kind, ownerId = undefined) {
  const out = [];
  for (const t of active) if (t.kind === kind && (ownerId === undefined || t.owner === ownerId)) out.push(t);
  return out;
}

export function endTasks(kind, ownerId) {
  for (const t of activeTasks(kind, ownerId)) t.finish();
}

// ------------------------------------------------------------------ task base
/** Base class for running constructs. step(t) returns false to finish. */
export class Task {
  /** @param {CastContext} ctx */
  constructor(ctx, kind = "construct") {
    this.ctx = ctx;
    this.kind = kind;
    this.owner = ctx.caster.id;
    this.t = 0;
    this.counts = true;
    this.requireCaster = true;
    this.finished = false;
    /** @type {import("@minecraft/server").Entity[]} */
    this.entities = [];
  }

  update() {
    if (this.finished) return false;
    if (this.requireCaster && !valid(this.ctx.caster)) return false;
    this.t++;
    return this.step(this.t) !== false;
  }

  /** @param {number} t */
  step(t) {
    return t < 2;
  }

  finish() {
    this.finished = true;
  }

  dispose() {
    for (const e of this.entities) dissolveEntity(e, this.ctx.corps);
    this.entities = [];
  }

  /**
   * Spawn a construct entity that forms out of green light.
   * @returns {import("@minecraft/server").Entity | undefined}
   */
  spawn(type, loc, yaw = this.ctx.yaw, pitch = 0, size = 1, formRadius = 1.5, silent = false) {
    const e = spawnConstruct(this.ctx.dim, type, loc, yaw, pitch, size, this.ctx.corpsIndex);
    if (!e) return undefined;
    this.entities.push(e);
    formFx(this.ctx.dim, loc, this.ctx.corps, formRadius * size);
    if (!silent) sound(this.ctx.dim, "glc.construct_form", loc, 0.8, 1.15 - Math.min(0.5, size * 0.1));
    return e;
  }
}

export function spawnConstruct(dim, type, loc, yaw, pitch, size, corpsIndex) {
  let e;
  try {
    e = dim.spawnEntity(type, loc, { initialRotation: yaw });
  } catch (err) {
    console.warn(`[GLC] spawn ${type}: ${err}`);
    return undefined;
  }
  owned.add(e.id);
  try {
    e.setProperty("glc:corps", corpsIndex);
    if (size !== 1) e.setProperty("glc:size", size);
    if (pitch) e.setProperty("glc:pitch", Math.max(-90, Math.min(90, pitch)));
    e.teleport(loc, { rotation: { x: 0, y: yaw } });
  } catch {
    // projectiles have fewer properties
  }
  return e;
}

/** Move a construct entity (keeps rotation in sync). */
export function moveConstruct(e, loc, yaw = undefined, pitch = undefined) {
  if (!valid(e)) return;
  try {
    e.teleport(loc, yaw === undefined ? undefined : { rotation: { x: 0, y: yaw } });
    if (pitch !== undefined) e.setProperty("glc:pitch", Math.max(-90, Math.min(90, pitch)));
  } catch {
    // ignore
  }
}

/** Play the dissolve animation + particles, then remove the entity. */
export function dissolveEntity(e, corps = "green", silent = false) {
  if (!valid(e)) return;
  let loc;
  try {
    loc = e.location;
    e.setProperty("glc:state", 2);
  } catch {
    // projectiles: no state property
  }
  if (loc) {
    dissipateFx(e.dimension, add(loc, v3(0, 0.3, 0)), corps, 1.2);
    if (!silent) sound(e.dimension, "glc.construct_dissipate", loc, 0.6);
  }
  system.runTimeout(() => {
    try {
      if (e.isValid) e.remove();
    } catch {
      // ignore
    }
    owned.delete(e.id);
  }, 8);
}

// ------------------------------------------------------------------ orphans
function removeOrphan(e) {
  try {
    if (e.isValid && !owned.has(e.id) && e.matches({ families: ["glc_construct"] })) e.remove();
  } catch {
    // ignore
  }
}

world.afterEvents.entityLoad.subscribe((ev) => system.run(() => removeOrphan(ev.entity)));

export function cleanupOrphans() {
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      for (const e of world.getDimension(id).getEntities({ families: ["glc_construct"] })) removeOrphan(e);
    } catch {
      // dimension not loaded
    }
  }
}

export function feedback(player, msg) {
  if (player && player.typeId === "minecraft:player") {
    toast(/** @type {any} */ (player), msg);
    playerSound(/** @type {any} */ (player), "glc.ring_low", 0.6);
  }
}
