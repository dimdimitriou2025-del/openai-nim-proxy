// Energy, willpower (XP), ranks, Corps colour and suit perks.
import { system, world } from "@minecraft/server";
import { CONSTRUCTS, RANKS, GLYPHS } from "../data/game_data.js";
import { data, rt, save } from "./state.js";
import { LOW_ENERGY_FRACTION, XP_KILL_MAX, XP_KILL_MIN, XP_KILL_MULTIPLIER } from "../config.js";
import { particle, playerSound } from "../lib/fx.js";

export const CONSTRUCT_BY_ID = Object.fromEntries(CONSTRUCTS.map((c) => [c.id, c]));

export function rankDef(d) {
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, (d.rank || 1) - 1))];
}

export function rankName(d) {
  return d.rank > 0 ? rankDef(d).name : "Unsworn";
}

export function nextRank(d) {
  return d.rank >= 1 && d.rank < RANKS.length ? RANKS[d.rank] : null;
}

export function canAscend(d) {
  const n = nextRank(d);
  return !!n && d.xp >= n.xp;
}

export function maxEnergy(player) {
  const d = data(player);
  return d.rank > 0 ? rankDef(d).maxEnergy : 100;
}

export function energyOf(player) {
  const d = data(player);
  return d.energy + d.over;
}

export function isUnlocked(d, construct) {
  return d.sworn && d.rank >= construct.rank;
}

// ------------------------------------------------------------------ perks
/** Active suit perk id (set every second by systems/suits.js). */
export function perkOf(player) {
  return rt(player.id).perk;
}

export function corpsOf(entity) {
  if (entity.typeId === "minecraft:player") return perkOf(entity) === "fear" ? "yellow" : "green";
  if (entity.typeId === "glc:sinestro") return "yellow";
  return "green";
}

export function costOf(player, construct) {
  const base = construct.cost;
  return perkOf(player) === "artist" ? Math.max(1, Math.round(base * 0.85)) : base;
}

const MELEE = new Set(["fist", "giant_fist", "hammer", "titan_hammer", "blade"]);

export function damageMultiplier(caster, constructId) {
  if (caster.typeId !== "minecraft:player") return 1;
  let m = 1 + 0.05 * Math.max(0, data(caster).rank - 1); // mastery: +5% per rank
  if (perkOf(caster) === "brawler" && MELEE.has(constructId)) m *= 1.3;
  return m;
}

export function blockLifeMultiplier(caster) {
  return caster.typeId === "minecraft:player" && perkOf(caster) === "architect" ? 2 : 1;
}

// ------------------------------------------------------------------ messages
export function ringSay(player, msg, force = false) {
  const d = data(player);
  if (!d.voice && !force) return;
  try {
    player.sendMessage(`${GLYPHS.emblem} §a[Power Ring]§r §f${msg}`);
  } catch {
    // ignore
  }
}

/** Short message shown on the action bar for `ticks`, overriding the HUD. */
export function toast(player, msg, ticks = 40) {
  const r = rt(player.id);
  r.toast = msg;
  r.toastUntil = system.currentTick + ticks;
  try {
    player.onScreenDisplay.setActionBar(msg);
  } catch {
    // ignore
  }
}

// ------------------------------------------------------------------ energy
/**
 * Spend ring energy (overcharge first). Returns false (and warns) if too low.
 * @param {import("@minecraft/server").Player} player
 */
export function spendEnergy(player, amount, silent = false) {
  const d = data(player);
  if (d.energy + d.over + 1e-6 < amount) {
    if (!silent) {
      toast(player, `§c${GLYPHS.bolt} Not enough ring energy §7(${Math.floor(d.energy + d.over)}/${Math.ceil(amount)})`);
      playerSound(player, "glc.ring_low");
    }
    return false;
  }
  const before = (d.energy + d.over) / maxEnergy(player);
  const fromOver = Math.min(d.over, amount);
  d.over -= fromOver;
  d.energy = Math.max(0, d.energy - (amount - fromOver));
  save(player);
  const after = (d.energy + d.over) / maxEnergy(player);
  warnThresholds(player, before, after);
  return true;
}

function warnThresholds(player, before, after) {
  const r = rt(player.id);
  if (after <= 0.001 && before > 0.001) {
    ringSay(player, "§cPower levels depleted. Recharge at a Power Battery.", true);
    playerSound(player, "glc.ring_empty");
    particle(player.dimension, "glc:low_power", player.getHeadLocation(), corpsOf(player));
  } else if (after < 0.1 && before >= 0.1) {
    ringSay(player, "Power levels at 10%.");
    playerSound(player, "glc.ring_low");
  } else if (after < LOW_ENERGY_FRACTION && before >= LOW_ENERGY_FRACTION) {
    ringSay(player, "Power levels at 20%.");
    playerSound(player, "glc.ring_low");
    r.warned = system.currentTick;
  }
}

export function addEnergy(player, amount) {
  const d = data(player);
  const max = maxEnergy(player);
  if (d.energy >= max) return 0;
  const add = Math.min(amount, max - d.energy);
  d.energy += add;
  save(player);
  return add;
}

/** Fill to max and add overcharge (fraction of max, capped at 50%). */
export function fullRecharge(player, overFraction = 0) {
  const d = data(player);
  const max = maxEnergy(player);
  d.energy = max;
  d.over = Math.min(max * 0.5, Math.max(d.over, max * overFraction));
  save(player, true);
}

// ------------------------------------------------------------------ willpower
/**
 * Add willpower XP; announces when the next rank becomes available.
 * @param {import("@minecraft/server").Player} player
 */
export function addXp(player, amount) {
  const d = data(player);
  if (!d.sworn || amount <= 0) return;
  const could = canAscend(d);
  d.xp = Math.round((d.xp + amount) * 100) / 100;
  save(player);
  if (!could && canAscend(d)) {
    const n = nextRank(d);
    ringSay(player, `§6Your willpower has grown!§f Recite the oath at a §aCentral Power Battery§f to ascend to §6${n.name}§f.`, true);
    playerSound(player, "glc.ring_activate", 0.8, 1.2);
    save(player, true);
  }
}

// Fallback when a dead entity can no longer be queried.
const MONSTER_HP = {
  "minecraft:zombie": 20, "minecraft:husk": 20, "minecraft:drowned": 20, "minecraft:skeleton": 20,
  "minecraft:stray": 20, "minecraft:bogged": 16, "minecraft:creeper": 20, "minecraft:spider": 16,
  "minecraft:cave_spider": 12, "minecraft:enderman": 40, "minecraft:witch": 26, "minecraft:pillager": 24,
  "minecraft:vindicator": 24, "minecraft:evocation_illager": 24, "minecraft:ravager": 100, "minecraft:blaze": 20,
  "minecraft:ghast": 10, "minecraft:magma_cube": 16, "minecraft:slime": 16, "minecraft:phantom": 20,
  "minecraft:wither_skeleton": 20, "minecraft:piglin_brute": 50, "minecraft:hoglin": 40, "minecraft:zoglin": 40,
  "minecraft:guardian": 30, "minecraft:elder_guardian": 80, "minecraft:silverfish": 8, "minecraft:endermite": 8,
  "minecraft:vex": 14, "minecraft:breeze": 30, "minecraft:creaking": 1, "minecraft:zombie_villager_v2": 20,
};

function monsterHealth(e) {
  try {
    if (!e.matches({ families: ["monster"] })) return 0;
    return e.getComponent("minecraft:health")?.effectiveMax ?? 20;
  } catch {
    return MONSTER_HP[e.typeId] ?? 0;
  }
}

// kill rewards: defeating monsters strengthens a sworn Lantern's will
world.afterEvents.entityDie.subscribe((ev) => {
  const killer = ev.damageSource?.damagingEntity;
  if (!killer || killer.typeId !== "minecraft:player") return;
  const hp = monsterHealth(ev.deadEntity);
  if (!hp) return;
  const player = /** @type {import("@minecraft/server").Player} */ (killer);
  try {
    const d = data(player);
    if (!d.sworn) return;
    d.kills++;
    addXp(player, Math.max(XP_KILL_MIN, Math.min(XP_KILL_MAX, Math.round(hp * XP_KILL_MULTIPLIER))));
  } catch {
    // killer left the world
  }
});
