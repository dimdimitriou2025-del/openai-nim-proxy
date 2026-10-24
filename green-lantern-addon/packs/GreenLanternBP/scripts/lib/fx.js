// Visual + audio effects.  Every particle is tinted with the caster's Corps
// colour, and a per-tick budget keeps busy fights cheap on mobile.
import { MolangVariableMap, system } from "@minecraft/server";
import { CORPS } from "../data/game_data.js";
import { PARTICLE_BUDGET_PER_TICK } from "../config.js";
import { add, dist, norm, sub, v3 } from "./vec.js";

const COLORS = {};
for (const c of CORPS) COLORS[c.id] = { red: c.color[0], green: c.color[1], blue: c.color[2] };

let budgetTick = -1;
let budget = PARTICLE_BUDGET_PER_TICK;

function take(cost) {
  if (system.currentTick !== budgetTick) {
    budgetTick = system.currentTick;
    budget = PARTICLE_BUDGET_PER_TICK;
  }
  if (budget < cost) return false;
  budget -= cost;
  return true;
}

export function corpsColor(corps) {
  return COLORS[corps] ?? COLORS.green;
}

/**
 * Spawn one of the add-on's particle effects.
 * @param {import("@minecraft/server").Dimension} dim
 * @param {string} id particle identifier, e.g. "glc:spark"
 * @param {import("@minecraft/server").Vector3} loc
 * @param {string} corps Corps id used for the tint
 * @param {Record<string, number>} [floats] extra Molang floats (without "variable.")
 * @param {number} [cost] budget cost
 */
export function particle(dim, id, loc, corps = "green", floats = undefined, cost = 1) {
  if (!take(cost)) return;
  try {
    const m = new MolangVariableMap();
    m.setColorRGB("variable.color", corpsColor(corps));
    if (floats) for (const k in floats) m.setFloat(`variable.${k}`, floats[k]);
    dim.spawnParticle(id, loc, m);
  } catch {
    // unloaded chunk / out of world: ignore
  }
}

/** A straight energy beam from a to b (one emitter call, particles along the line). */
export function beam(dim, a, b, corps = "green", width = 1) {
  if (!take(2)) return;
  try {
    const d = sub(b, a);
    const l = Math.max(0.1, dist(a, b));
    const m = new MolangVariableMap();
    m.setColorRGB("variable.color", corpsColor(corps));
    m.setSpeedAndDirection("variable.beam", l, norm(d));
    m.setFloat("variable.width", width);
    dim.spawnParticle("glc:beam", a, m);
  } catch {
    // ignore
  }
}

/** Energy flowing from a to b (battery charging). Lasts ~1 s. */
export function stream(dim, a, b, corps = "green") {
  if (!take(2)) return;
  try {
    const m = new MolangVariableMap();
    m.setColorRGB("variable.color", corpsColor(corps));
    m.setSpeedAndDirection("variable.beam", Math.max(0.1, dist(a, b)), norm(sub(b, a)));
    dim.spawnParticle("glc:stream", a, m);
  } catch {
    // ignore
  }
}

export function formFx(dim, loc, corps, radius = 1.5) {
  particle(dim, "glc:form", loc, corps, { radius });
}

export function dissipateFx(dim, loc, corps, radius = 1.0) {
  particle(dim, "glc:dissipate", loc, corps, { radius });
}

export function impactFx(dim, loc, corps, big = false) {
  particle(dim, "glc:impact", loc, corps);
  particle(dim, "glc:spark", loc, corps);
  if (big) particle(dim, "glc:explosion", loc, corps, { radius: 2 });
}

export function shockwave(dim, loc, corps, radius) {
  particle(dim, "glc:shockwave", add(loc, v3(0, 0.15, 0)), corps, { radius });
}

export function sound(dim, id, loc, volume = 1, pitch = 1) {
  try {
    dim.playSound(id, loc, { volume, pitch });
  } catch {
    // ignore
  }
}

/** Sound heard only by one player. */
export function playerSound(player, id, volume = 1, pitch = 1) {
  try {
    player.playSound(id, { volume, pitch });
  } catch {
    // ignore
  }
}

/** Screen shake for players near a location (uses the vanilla camerashake command). */
export function shake(dim, loc, radius, intensity = 0.3, seconds = 0.4) {
  try {
    for (const p of dim.getPlayers({ location: loc, maxDistance: radius })) {
      p.runCommand(`camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`);
    }
  } catch {
    // ignore
  }
}
