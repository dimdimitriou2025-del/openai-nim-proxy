// Green Lantern add-on - script entry point (Script API v2, @minecraft/server 2.6.0).
import { system, world } from "@minecraft/server";
import { CONSTRUCTS, VERSION } from "./data/game_data.js";
import { HUD_INTERVAL, OVERCHARGE_DECAY_PER_SECOND, SAVE_INTERVAL, SCAN_INTERVAL } from "./config.js";
import { data, flushAll, rt, save } from "./core/state.js";
import { addEnergy, perkOf, rankDef } from "./core/lantern.js";
import { updateHud } from "./core/hud.js";
import { bookComponent, ringComponent, scanRing } from "./core/ring.js";
import { cleanupOrphans, implemented, tickConstructs } from "./constructs/registry.js";
import "./constructs/offense.js";
import "./constructs/defense.js";
import "./constructs/utility.js";
import { hardlightComponent } from "./constructs/hardlight.js";
import { flightTick } from "./systems/flight.js";
import { batteryComponent, batterySecond } from "./systems/battery.js";
import { alliesSecond } from "./systems/allies.js";
import { scanSuit } from "./systems/suits.js";
import { registerCommands } from "./systems/commands.js";
import "./systems/protection.js";

system.beforeEvents.startup.subscribe((ev) => {
  ev.itemComponentRegistry.registerCustomComponent("glc:power_ring", ringComponent);
  ev.itemComponentRegistry.registerCustomComponent("glc:book_of_oa", bookComponent);
  ev.blockComponentRegistry.registerCustomComponent("glc:power_battery", batteryComponent);
  ev.blockComponentRegistry.registerCustomComponent("glc:hardlight", hardlightComponent);
  registerCommands(ev);
});

world.afterEvents.worldLoad.subscribe(() => {
  cleanupOrphans();
  const missing = CONSTRUCTS.filter((c) => !implemented().includes(c.id)).map((c) => c.id);
  if (missing.length) console.warn(`[GLC] constructs without implementation: ${missing.join(", ")}`);
  system.runInterval(tick, 1);
  console.log(`[GLC] Green Lantern add-on v${VERSION} loaded (${implemented().length} constructs).`);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  system.runTimeout(() => {
    if (!p.isValid) return;
    const d = data(p);
    if (!d.sworn) {
      p.sendMessage("§a[Green Lantern]§r Craft a §aPower Ring§r (emerald, gold ingots, eye of ender) and use it to swear the oath. Type §f/glc:guide§r for help.");
    } else {
      p.sendMessage(`§a[Green Lantern]§r Welcome back, Lantern. Sneak + use your ring to open its menu.`);
    }
  }, 60);
});

function stagger(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % SCAN_INTERVAL;
}

function tick() {
  const now = system.currentTick;
  tickConstructs();
  const players = world.getAllPlayers();
  for (const p of players) {
    try {
      const r = rt(p.id);
      if (r.flying) flightTick(p, now);
      if (now % HUD_INTERVAL === 0 && r.carried) updateHud(p);
      if (now % SCAN_INTERVAL === stagger(p.id)) everySecond(p);
    } catch (e) {
      console.warn(`[GLC] tick ${p.name}: ${e}`);
    }
  }
  if (now % 20 === 0) {
    try {
      batterySecond(players);
      alliesSecond(players);
    } catch (e) {
      console.warn(`[GLC] systems: ${e}`);
    }
  }
  if (now % SAVE_INTERVAL === 0) flushAll();
}

/** @param {import("@minecraft/server").Player} p */
function everySecond(p) {
  scanRing(p);
  scanSuit(p);
  const d = data(p);
  const r = rt(p.id);
  if (!d.sworn) return;
  if (d.ringOn && r.carried && !r.flying) addEnergy(p, rankDef(d).regen * (perkOf(p) === "regen" ? 1.25 : 1));
  if (d.over > 0) {
    d.over = Math.max(0, d.over - OVERCHARGE_DECAY_PER_SECOND);
    save(p);
  }
}
