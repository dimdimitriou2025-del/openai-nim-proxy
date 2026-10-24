// Power Batteries: the personal lantern block and the Central Power Battery.
import { EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { SUITS, CHARACTERS } from "../data/game_data.js";
import { data, rt, save } from "../core/state.js";
import {
  addEnergy, addXp, canAscend, corpsOf, fullRecharge, maxEnergy, nextRank, rankName, ringSay, toast,
} from "../core/lantern.js";
import { oathIntro } from "../core/oath.js";
import {
  BATTERY_XP, BATTERY_XP_COOLDOWN_TICKS, CENTRAL_AURA_PER_SECOND, CENTRAL_AURA_RADIUS, CENTRAL_BATTERY_ID,
  CENTRAL_OVERCHARGE, RING_ID, TRAINING_DURATION_TICKS, TRAINING_TARGETS, XP_TRAINING_TARGET,
} from "../config.js";
import { particle, playerSound, sound, stream } from "../lib/fx.js";
import { add, center, dist, v3 } from "../lib/vec.js";
import { lines, showForm } from "../ui/forms.js";
import { openMainMenu } from "../ui/menu.js";
import { summonAlly } from "./allies.js";

const ICON = "textures/glc/ui/";

function holdingRing(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    return [EquipmentSlot.Mainhand, EquipmentSlot.Offhand].some((s) => eq?.getEquipment(s)?.typeId === RING_ID);
  } catch {
    return false;
  }
}

/** Animated recharge: energy streams from the battery into the player. */
function chargeFrom(player, source, fill, onDone) {
  const r = rt(player.id);
  if (r.charging) return;
  const corps = corpsOf(player);
  const dim = player.dimension;
  r.charging = { t: 0 };
  sound(dim, "glc.battery_charge", source, 1, 1);
  const max = maxEnergy(player);
  const job = system.runInterval(() => {
    const c = r.charging;
    if (!player.isValid || !c) {
      system.clearRun(job);
      return;
    }
    c.t += 4;
    if (dist(player.location, source) > 7) {
      r.charging = null;
      system.clearRun(job);
      toast(player, "§7Charging interrupted - stay near the battery.");
      return;
    }
    stream(dim, source, add(player.location, v3(0, 1.1, 0)), corps);
    addEnergy(player, (max * fill) / 10);
    if (c.t >= 40) {
      r.charging = null;
      system.clearRun(job);
      onDone();
    }
  }, 4);
}

function batteryXp(player) {
  const d = data(player);
  if (system.currentTick - d.lastBatteryXp >= BATTERY_XP_COOLDOWN_TICKS) {
    d.lastBatteryXp = system.currentTick;
    addXp(player, BATTERY_XP);
    save(player);
  }
}

// ------------------------------------------------------------------ personal battery (block)
export const batteryComponent = {
  /** @param {import("@minecraft/server").BlockComponentPlayerInteractEvent} ev */
  onPlayerInteract(ev) {
    const player = ev.player;
    if (!player) return;
    const at = add(center(ev.block.location), v3(0, 0.2, 0));
    system.run(() => personalBattery(player, at));
  },
  /** @param {import("@minecraft/server").BlockComponentTickEvent} ev */
  onTick(ev) {
    particle(ev.dimension, "glc:aura", add(center(ev.block.location), v3(0, 0.1, 0)), "green", { radius: 0.35 });
  },
};

async function personalBattery(player, at) {
  const d = data(player);
  if (!d.sworn) {
    if (holdingRing(player)) {
      ringSay(player, "The lantern recognises your ring. Speak the oath to unlock it.", true);
      return oathIntro(player, "unlock");
    }
    toast(player, "§7The lantern hums with green light... a §aPower Ring§7 could draw on it.", 60);
    playerSound(player, "glc.ring_equip", 0.5);
    return;
  }
  const max = maxEnergy(player);
  const f = new ActionFormData().title("§2§lPower Battery")
    .body(lines(`§fRing energy: §a${Math.floor(d.energy)}§7/${max}${d.over > 0 ? ` §f(+${Math.floor(d.over)})` : ""}`,
      "§7Recharge quickly, or recite the oath to overcharge your ring."))
    .button("§2§lRecharge\n§r§8Fill your ring", `${ICON}ui_recharge`)
    .button("§2§lRecite the Oath\n§r§8Recharge + overcharge", `${ICON}ui_oath`)
    .button("§0Close", `${ICON}ui_back`);
  const res = await showForm(player, f);
  if (!res || res.canceled) return;
  if (res.selection === 0) {
    chargeFrom(player, at, 1, () => {
      fullRecharge(player, 0);
      batteryXp(player);
      particle(player.dimension, "glc:ring_burst", add(player.location, v3(0, 1, 0)), corpsOf(player));
      toast(player, "§aRing fully charged.", 50);
    });
  } else if (res.selection === 1) {
    batteryXp(player);
    return oathIntro(player, "recharge");
  }
}

// ------------------------------------------------------------------ central battery (entity)
world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  if (ev.target?.typeId !== CENTRAL_BATTERY_ID) return;
  const player = ev.player;
  const battery = ev.target;
  system.run(() => centralMenu(player, battery));
});

async function centralMenu(player, battery) {
  if (!battery.isValid) return;
  const d = data(player);
  const at = add(battery.location, v3(0, 1.6, 0));
  if (!d.sworn) {
    if (holdingRing(player)) return oathIntro(player, "unlock");
    toast(player, "§7The Central Power Battery pulses... only a sworn Lantern can draw on it.", 60);
    return;
  }
  const n = nextRank(d);
  const f = new ActionFormData().title("§2§lCentral Power Battery").body(lines(
    `§fRank: §a${rankName(d)}§7   Willpower: §f${Math.floor(d.xp)}${n ? `§7/${n.xp}` : ""}`,
    `§fRing energy: §a${Math.floor(d.energy)}§7/${maxEnergy(player)}`,
    canAscend(d) ? `§6You are ready to become ${n.name}! Recite the oath.` : n ? `§7Next rank: ${n.name}` : "§6Legend - highest rank",
  ));
  const actions = [];
  f.button("§2§lFull Recharge\n§r§8+50% overcharge", `${ICON}ui_recharge`);
  actions.push(() => chargeFrom(player, at, 1, () => {
    fullRecharge(player, CENTRAL_OVERCHARGE);
    batteryXp(player);
    particle(player.dimension, "glc:pillar", player.location, corpsOf(player), undefined, 3);
    toast(player, "§aRing overcharged by the Central Power Battery.", 60);
  }));
  f.button(canAscend(d) ? `§6§lAscend to ${n?.name}\n§r§8Recite the oath` : "§2§lRecite the Oath\n§r§8Overcharge your ring", `${ICON}ui_oath`);
  actions.push(() => oathIntro(player, "ascend"));
  f.button("§2§lConstruct Training\n§r§8Destroy targets for willpower", `${ICON}ui_training`);
  actions.push(() => startTraining(player, battery));
  f.button(d.rank >= 2 ? "§2§lUniform Locker\n§r§8Lantern uniforms" : "§7§lUniform Locker\n§r§8Unlocks at rank 2", `${ICON}icon_shield`);
  actions.push(() => (d.rank >= 2 ? uniformLocker(player) : toast(player, "§7Reach rank 2 (Lantern) to open the locker.")));
  f.button(d.rank >= 3 ? "§2§lCall a Lantern Ally\n§r§8Hal, John, Guy, Kyle" : "§7§lCall a Lantern Ally\n§r§8Unlocks at rank 3", `${ICON}ui_allies`);
  actions.push(() => (d.rank >= 3 ? allyMenu(player) : toast(player, "§7Reach rank 3 (Honor Guard) to call allies.")));
  f.button("§0Ring Menu", `${ICON}ui_ring`);
  actions.push(() => openMainMenu(player));
  f.button("§8Dismantle Battery\n§8Pick it back up", `${ICON}ui_dismantle`);
  actions.push(() => dismantle(player, battery));
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection === undefined) return;
  playerSound(player, "glc.menu_select");
  await actions[res.selection]?.();
}

async function dismantle(player, battery) {
  const f = new ActionFormData().title("§cDismantle the battery?")
    .body("§7The Central Power Battery will drop as an item.")
    .button("§cDismantle", `${ICON}ui_dismantle`).button("§0Cancel", `${ICON}ui_back`);
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection !== 0 || !battery.isValid) return;
  const loc = battery.location;
  const dim = battery.dimension;
  particle(dim, "glc:dissipate", add(loc, v3(0, 1.5, 0)), "green", { radius: 2 }, 2);
  sound(dim, "glc.construct_dissipate", loc, 1, 0.7);
  battery.remove();
  dim.spawnItem(new ItemStack("glc:central_battery", 1), add(loc, v3(0, 0.5, 0)));
}

async function uniformLocker(player) {
  const d = data(player);
  const avail = SUITS.filter((s) => s.id !== "suit_sinestro" || d.rank >= 4);
  const f = new ActionFormData().title("§2§lUniform Locker")
    .body("§7Choose a uniform. It goes to your chest slot (or inventory). Each has a perk while worn.");
  for (const s of avail) f.button(`§l${s.name}\n§r§8${s.perkText}`, `textures/glc/items/${s.id}`);
  f.button("§0Back", `${ICON}ui_back`);
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection === undefined || res.selection >= avail.length) return;
  const s = avail[res.selection];
  const item = new ItemStack(`glc:${s.id}`, 1);
  try {
    const eq = player.getComponent("minecraft:equippable");
    if (eq && !eq.getEquipment(EquipmentSlot.Chest)) eq.setEquipment(EquipmentSlot.Chest, item);
    else {
      const left = player.getComponent("minecraft:inventory")?.container?.addItem(item);
      if (left) player.dimension.spawnItem(left, player.location);
    }
    particle(player.dimension, "glc:pillar", player.location, s.corps, undefined, 3);
    playerSound(player, "glc.ring_activate");
    toast(player, `§a${s.name}§7 - ${s.perkText}`, 80);
  } catch {
    // ignore
  }
}

async function allyMenu(player) {
  const d = data(player);
  const options = CHARACTERS.filter((c) => c.ally || d.rank >= 5);
  const f = new ActionFormData().title("§2§lCall a Lantern")
    .body("§7One Lantern can fight beside you at a time. Calling another sends the current one home.\n§8Sinestro (rank 5) arrives as a neutral rival - he will fight if provoked.");
  for (const c of options) f.button(`§l${c.name}\n§r§8${c.title}`, `${ICON}portrait_${c.id}`);
  f.button("§0Back", `${ICON}ui_back`);
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection === undefined || res.selection >= options.length) return;
  summonAlly(player, options[res.selection].id);
}

// ------------------------------------------------------------------ training
/** @type {Map<string, {player: any, ends: number, targets: Set<string>, hits: number, dim: any}>} */
const sessions = new Map();

function startTraining(player, battery) {
  const r = rt(player.id);
  if (sessions.has(player.id)) {
    toast(player, "§7Training already in progress.");
    return;
  }
  const dim = battery.dimension;
  const base = battery.location;
  const s = { player, ends: system.currentTick + TRAINING_DURATION_TICKS, targets: new Set(), hits: 0, dim };
  for (let i = 0; i < TRAINING_TARGETS; i++) {
    const a = (i / TRAINING_TARGETS) * Math.PI * 2 + Math.random() * 0.4;
    const rad = 7 + Math.random() * 4;
    const loc = add(base, v3(Math.cos(a) * rad, 1 + Math.random() * 3, Math.sin(a) * rad));
    try {
      const t = dim.spawnEntity("glc:training_target", loc);
      s.targets.add(t.id);
      particle(dim, "glc:form", add(loc, v3(0, 1, 0)), "green", { radius: 1.2 });
    } catch {
      // blocked location
    }
  }
  sessions.set(player.id, s);
  r.training = s;
  playerSound(player, "glc.training_start");
  player.onScreenDisplay.setTitle("§aConstruct Training", { subtitle: `§fDestroy ${s.targets.size} targets in 60 seconds!`, fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 10 });
}

world.afterEvents.entityDie.subscribe((ev) => {
  const dead = ev.deadEntity;
  if (dead.typeId !== "glc:training_target") return;
  let id;
  try {
    id = dead.id;
  } catch {
    return;
  }
  for (const s of sessions.values()) {
    if (!s.targets.has(id)) continue;
    s.targets.delete(id);
    s.hits++;
    if (s.player.isValid) {
      addXp(s.player, XP_TRAINING_TARGET);
      playerSound(s.player, "glc.target_hit");
      toast(s.player, `§aTarget destroyed! §f${s.hits}§7 hit, ${s.targets.size} left  §6+${XP_TRAINING_TARGET} willpower`, 40);
    }
    if (s.targets.size === 0) endTraining(s, true);
    return;
  }
});

function endTraining(s, cleared) {
  sessions.delete(s.player.id);
  for (const id of s.targets) {
    try {
      const e = world.getEntity(id);
      if (e) {
        particle(e.dimension, "glc:dissipate", e.location, "green", { radius: 1 });
        e.remove();
      }
    } catch {
      // ignore
    }
  }
  if (!s.player.isValid) return;
  rt(s.player.id).training = null;
  if (cleared) {
    addXp(s.player, 20);
    s.player.onScreenDisplay.setTitle("§6Training complete!", { subtitle: `§fAll targets destroyed  §6+20 bonus willpower`, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
    playerSound(s.player, "glc.rank_up", 0.6, 1.3);
  } else {
    toast(s.player, `§7Training over: §f${s.hits}§7 targets destroyed.`, 80);
  }
}

/** Called every second from main loop: training timers + battery aura. */
export function batterySecond(players) {
  const now = system.currentTick;
  for (const s of [...sessions.values()]) if (now >= s.ends || !s.player.isValid) endTraining(s, false);
  for (const p of players) {
    const d = data(p);
    let near;
    try {
      near = p.dimension.getEntities({ type: CENTRAL_BATTERY_ID, location: p.location, maxDistance: 16 });
    } catch {
      continue;
    }
    for (const b of near) {
      const top = add(b.location, v3(0, 3.6, 0));
      particle(b.dimension, "glc:aura", add(b.location, v3(0, 1.5, 0)), "green", { radius: 1.6 });
      if (Math.random() < 0.25) particle(b.dimension, "glc:spark", top, "green");
      if (d.sworn && dist(p.location, b.location) <= CENTRAL_AURA_RADIUS && d.energy < maxEnergy(p)) {
        addEnergy(p, CENTRAL_AURA_PER_SECOND);
        if (now % 40 === 0) stream(b.dimension, add(b.location, v3(0, 1.8, 0)), add(p.location, v3(0, 1, 0)), "green");
      }
    }
  }
}
