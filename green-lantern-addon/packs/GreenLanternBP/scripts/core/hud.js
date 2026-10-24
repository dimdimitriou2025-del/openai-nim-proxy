// Action-bar HUD: energy bar (custom glyphs), rank, selected construct, flight.
import { system } from "@minecraft/server";
import { GLYPHS } from "../data/game_data.js";
import { data, rt } from "./state.js";
import { CONSTRUCT_BY_ID, maxEnergy, rankName } from "./lantern.js";

const SEGMENTS = 10;

function bar(frac, overFrac, icons) {
  if (!icons) {
    const full = Math.round(Math.max(0, Math.min(1, frac)) * SEGMENTS);
    return `§a${"|".repeat(full)}§8${"|".repeat(SEGMENTS - full)}${overFrac > 0 ? "§f+" : ""}`;
  }
  let s = "";
  for (let i = 0; i < SEGMENTS; i++) {
    const segFill = Math.max(0, Math.min(1, frac * SEGMENTS - i));
    if (segFill >= 0.875) s += GLYPHS.seg_full;
    else if (segFill >= 0.625) s += GLYPHS.seg_3q;
    else if (segFill >= 0.375) s += GLYPHS.seg_half;
    else if (segFill >= 0.125) s += GLYPHS.seg_1q;
    else s += GLYPHS.seg_empty;
  }
  const overSegs = Math.ceil(Math.min(0.5, overFrac) * SEGMENTS);
  for (let i = 0; i < overSegs; i++) s += GLYPHS.seg_over;
  return s;
}

/**
 * Build the HUD line for a player.
 * @param {import("@minecraft/server").Player} player
 */
export function hudLine(player) {
  const d = data(player);
  const r = rt(player.id);
  const icons = d.hud !== "text";
  const max = maxEnergy(player);
  const frac = d.energy / max;
  const overFrac = d.over / max;
  const c = CONSTRUCT_BY_ID[d.selected];
  const cdLeft = c ? Math.max(0, (r.cooldowns[c.id] ?? 0) - system.currentTick) / 20 : 0;
  const pct = Math.floor((d.energy + d.over) / max * 100);
  const color = frac < 0.2 ? "§c" : frac < 0.5 ? "§e" : "§a";
  const emblem = icons ? GLYPHS.emblem : "§2[GL]";
  const rank = icons ? GLYPHS["rank" + Math.max(1, d.rank)] : "";
  const fly = r.flying ? (icons ? ` ${GLYPHS.flight}` : " §b^FLY") : "";
  const sel = c ? `§f${c.name}${cdLeft > 0 ? ` §8${cdLeft.toFixed(1)}s` : ""}` : "";
  const state = d.ringOn ? "" : " §8[ring off]";
  return `${emblem} ${rank}§a${rankName(d)} ${bar(frac, overFrac, icons)} ${color}${pct}%§r${fly}  §7» ${sel}${state}`;
}

/** Called every HUD_INTERVAL ticks for players carrying a sworn ring. */
export function updateHud(player) {
  const d = data(player);
  const r = rt(player.id);
  if (d.hud === "off" || !d.sworn) return;
  if (r.toast && system.currentTick < r.toastUntil) return;
  r.toast = null;
  const line = hudLine(player);
  // re-send when changed, or every 1.5 s so the action bar never fades out
  if (line !== r.lastHud || system.currentTick - r.lastHudTick >= 30) {
    r.lastHud = line;
    r.lastHudTick = system.currentTick;
    try {
      player.onScreenDisplay.setActionBar(line);
    } catch {
      // ignore
    }
  }
}
