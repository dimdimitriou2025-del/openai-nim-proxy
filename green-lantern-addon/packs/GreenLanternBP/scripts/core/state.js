// Player state: persistent data (dynamic property, survives leaving/rejoining)
// plus per-session runtime data (cooldowns, flight, active constructs...).
import { system, world } from "@minecraft/server";
import { RANKS } from "../data/game_data.js";

const KEY = "glc:data";
const VERSION = 1;

/** @typedef {ReturnType<typeof defaults>} LanternData */
function defaults() {
  return {
    v: VERSION,
    sworn: false,
    rank: 0,
    xp: 0,
    energy: 0,
    over: 0,
    selected: "beam",
    recent: [],
    ringOn: true,
    flightSpeed: 1,
    castOnSelect: false,
    hud: "icons",
    autoLand: true,
    voice: true,
    oathCount: 0,
    lastBatteryXp: -999999,
    kills: 0,
    casts: 0,
    uniformGiven: false,
  };
}

/** @type {Map<string, LanternData>} */
const cache = new Map();
/** @type {Set<string>} */
const dirty = new Set();
/** @type {Map<string, any>} */
const runtime = new Map();

/**
 * Persistent Lantern data for a player (loaded lazily, cached).
 * @param {import("@minecraft/server").Player} player
 * @returns {LanternData}
 */
export function data(player) {
  let d = cache.get(player.id);
  if (d) return d;
  d = defaults();
  try {
    const raw = player.getDynamicProperty(KEY);
    if (typeof raw === "string" && raw.length) Object.assign(d, JSON.parse(raw));
  } catch (e) {
    console.warn(`[GLC] could not read data for ${player.name}: ${e}`);
  }
  // sanitise (also migrates older/edited data)
  d.rank = Math.max(0, Math.min(RANKS.length, Math.floor(Number(d.rank) || 0)));
  if (d.sworn && d.rank < 1) d.rank = 1;
  d.xp = Math.max(0, Number(d.xp) || 0);
  d.energy = Math.max(0, Number(d.energy) || 0);
  d.over = Math.max(0, Number(d.over) || 0);
  if (!Array.isArray(d.recent)) d.recent = [];
  cache.set(player.id, d);
  return d;
}

/** Mark data dirty; important=true writes immediately. */
export function save(player, important = false) {
  dirty.add(player.id);
  if (important) flush(player);
}

/** @param {import("@minecraft/server").Player} player */
export function flush(player) {
  const d = cache.get(player.id);
  if (!d || !dirty.has(player.id)) return;
  try {
    player.setDynamicProperty(KEY, JSON.stringify(d));
    dirty.delete(player.id);
  } catch (e) {
    console.warn(`[GLC] could not save data for ${player.name}: ${e}`);
  }
}

export function flushAll() {
  for (const p of world.getAllPlayers()) flush(p);
}

/** Reset a player's Lantern progress completely (admin command). */
export function resetData(player) {
  const d = defaults();
  cache.set(player.id, d);
  save(player, true);
  runtime.delete(player.id);
  return d;
}

/**
 * Session-only runtime state for any entity id (players and NPC casters).
 * @param {string} id
 */
export function rt(id) {
  let r = runtime.get(id);
  if (!r) {
    r = {
      cooldowns: {},
      carried: false,
      inHand: false,
      offhand: false,
      equippedOnce: false,
      flying: false,
      hoverY: 0,
      lastJumpPress: -100,
      groundTicks: 0,
      safeFallUntil: 0,
      shield: null,
      bubble: null,
      constructs: 0,
      perk: null,
      suit: null,
      toast: null,
      toastUntil: 0,
      lastHud: "",
      lastHudTick: 0,
      warned: 0,
      charging: null,
      training: null,
      busyUntil: 0,
    };
    runtime.set(id, r);
  }
  return r;
}

export function dropRuntime(id) {
  runtime.delete(id);
  cache.delete(id);
  dirty.delete(id);
}

world.afterEvents.playerLeave.subscribe((ev) => {
  // data was flushed periodically; forget session caches
  system.run(() => dropRuntime(ev.playerId));
});
