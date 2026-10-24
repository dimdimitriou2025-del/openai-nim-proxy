// Targeting, damage and world-query helpers shared by constructs and systems.
import { EntityDamageCause, world } from "@minecraft/server";
import { add, dist, mul, norm, pointSegment, sub } from "./vec.js";
import { rt } from "../core/state.js";

export const isPlayer = (e) => !!e && e.typeId === "minecraft:player";
export const valid = (e) => !!e && e.isValid;

const NEVER_HIT_TYPES = new Set([
  "minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:snowball", "minecraft:egg",
  "minecraft:painting", "minecraft:armor_stand", "minecraft:fishing_hook", "minecraft:ender_pearl",
  "minecraft:villager_v2", "minecraft:villager", "minecraft:wandering_trader", "minecraft:npc",
  "minecraft:leash_knot", "minecraft:lightning_bolt", "minecraft:tnt", "minecraft:falling_block",
]);
const NEVER_HIT_FAMILIES = ["glc_construct", "glc_projectile", "glc_battery"];

export function hasHealth(e) {
  try {
    return !!e.getComponent("minecraft:health");
  } catch {
    return false;
  }
}

function isTamed(e) {
  try {
    return !!e.getComponent("minecraft:is_tamed");
  } catch {
    return false;
  }
}

function sameTeam(e, caster) {
  // Green Lanterns (and their pets/allies) never hurt each other; Sinestro hurts anyone.
  if (caster.typeId === "glc:sinestro") return e.typeId === "glc:sinestro";
  if (e.typeId === "glc:sinestro") return false;
  if (e.matches({ families: ["glc_lantern"] })) return true;
  if (isPlayer(e)) return !world.gameRules.pvp || isPlayer(caster) === false;
  return isTamed(e);
}

/**
 * Can `caster`'s construct damage `e`?
 * mode "hostile": monsters, Sinestro, training targets (and players when PvP is on) - used by area attacks
 * mode "any": anything alive except allies, pets, villagers - used by aimed attacks
 */
export function canHit(e, caster, mode = "any") {
  if (!valid(e) || e.id === caster.id) return false;
  if (NEVER_HIT_TYPES.has(e.typeId)) return false;
  if (e.matches({ families: NEVER_HIT_FAMILIES })) return false;
  if (!hasHealth(e)) return false;
  if (e.typeId === "glc:training_target") return true;
  if (sameTeam(e, caster)) return false;
  if (isPlayer(e)) return world.gameRules.pvp;
  if (mode === "hostile") {
    if (caster.typeId === "glc:sinestro") return true;
    return e.matches({ families: ["monster"] }) || e.typeId === "glc:sinestro";
  }
  return true;
}

/** Entities within radius that `caster` can hit. */
export function targetsNear(dim, loc, radius, caster, mode = "hostile") {
  try {
    return dim
      .getEntities({ location: loc, maxDistance: radius, excludeFamilies: NEVER_HIT_FAMILIES })
      .filter((e) => canHit(e, caster, mode));
  } catch {
    return [];
  }
}

export function nearestTarget(dim, loc, radius, caster, mode = "hostile") {
  let best;
  let bestD = Infinity;
  for (const e of targetsNear(dim, loc, radius, caster, mode)) {
    const d = dist(e.location, loc);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Point a bit above the entity's feet (approximate centre of mass). */
export function centerOf(e) {
  try {
    const h = e.getHeadLocation();
    return { x: e.location.x, y: (e.location.y + h.y) / 2, z: e.location.z };
  } catch {
    return add(e.location, { x: 0, y: 0.8, z: 0 });
  }
}

/**
 * First solid block along a ray.
 * @returns {{block: import("@minecraft/server").Block, loc: import("@minecraft/server").Vector3, dist: number} | undefined}
 */
export function rayBlock(dim, from, dir, range) {
  try {
    const hit = dim.getBlockFromRay(from, dir, { maxDistance: range, includeLiquidBlocks: false, includePassableBlocks: false });
    if (!hit) return undefined;
    const loc = add(hit.block.location, hit.faceLocation);
    return { block: hit.block, loc, dist: dist(from, loc) };
  } catch {
    return undefined;
  }
}

/** Entities along a ray that `caster` can hit, nearest first, stopping at walls. */
export function rayTargets(dim, from, dir, range, caster, radius = 0.6) {
  const wall = rayBlock(dim, from, dir, range);
  const maxD = wall ? wall.dist : range;
  const end = add(from, mul(dir, maxD));
  const mid = add(from, mul(dir, maxD / 2));
  const hits = [];
  for (const e of targetsNear(dim, mid, maxD / 2 + 2, caster, "any")) {
    const c = centerOf(e);
    const { d, t } = pointSegment(c, from, end);
    if (d <= radius + 0.5) hits.push({ entity: e, at: t * maxD });
  }
  hits.sort((a, b) => a.at - b.at);
  return { hits, end, wall };
}

/** Ground block below a point (top face location), or undefined. */
export function groundBelow(dim, loc, maxDown = 24) {
  try {
    const b = dim.getBlockBelow(loc, { maxDistance: maxDown, includeLiquidBlocks: false, includePassableBlocks: false });
    return b ? { x: loc.x, y: b.location.y + 1, z: loc.z } : undefined;
  } catch {
    return undefined;
  }
}

/** Sinestro and wearers of his uniform strike with fear. */
function strikesWithFear(caster) {
  if (!valid(caster)) return false;
  if (caster.typeId === "glc:sinestro") return true;
  return caster.typeId === "minecraft:player" && rt(caster.id).perk === "fear";
}

/**
 * Damage + optional knockback, attributed to the caster (so kills count as theirs).
 * Fear (Sinestro's perk) also weakens and slows whoever survives the hit.
 * @param {import("@minecraft/server").Entity} caster
 * @param {import("@minecraft/server").Entity} target
 */
export function strike(caster, target, amount, knockDir = undefined, horizontal = 0, vertical = 0) {
  if (!valid(target)) return false;
  let ok = false;
  try {
    ok = target.applyDamage(amount, { cause: EntityDamageCause.entityAttack, damagingEntity: valid(caster) ? caster : undefined });
  } catch {
    ok = false;
  }
  if (ok && valid(target) && strikesWithFear(caster)) {
    try {
      target.addEffect("weakness", 80, { amplifier: 0 });
      target.addEffect("slowness", 60, { amplifier: 1 });
    } catch {
      // effect-immune entity
    }
  }
  if (knockDir && (horizontal || vertical)) {
    try {
      const d = norm({ x: knockDir.x, y: 0, z: knockDir.z });
      target.applyKnockback({ x: d.x * horizontal, z: d.z * horizontal }, vertical);
    } catch {
      // some entities can't be knocked back
    }
  }
  return ok;
}

export function directionTo(from, to) {
  return norm(sub(to, from));
}

export function isAirLike(block) {
  try {
    return !!block && (block.isAir || block.typeId === "minecraft:light_block" || block.typeId === "minecraft:structure_void");
  } catch {
    return false;
  }
}

export function safe(fn) {
  try {
    return fn();
  } catch (e) {
    console.warn(`[GLC] ${e}`);
    return undefined;
  }
}
