// Lantern characters as NPCs: Hal Jordan, John Stewart, Guy Gardner and Kyle
// Rayner fight beside their owner; Sinestro is a neutral Yellow Lantern rival.
// They use the same construct system as players (tryCast with a target).
import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CHARACTERS } from "../data/game_data.js";
import { data, rt } from "../core/state.js";
import { ringSay, toast } from "../core/lantern.js";
import { tryCast } from "../constructs/registry.js";
import { particle, playerSound, sound } from "../lib/fx.js";
import { add, v3 } from "../lib/vec.js";
import { nearestTarget, valid } from "../lib/util.js";
import { MAX_ALLIES_PER_PLAYER } from "../config.js";
import { lines, showForm } from "../ui/forms.js";

const BY_TYPE = Object.fromEntries(CHARACTERS.map((c) => [`glc:${c.id}`, c]));
const MOVES = {
  hal_jordan: ["fist", "beam", "giant_fist"],
  john_stewart: ["cannon", "beam", "wall"],
  guy_gardner: ["hammer", "fist", "blade"],
  kyle_rayner: ["missiles", "beam", "drones"],
  sinestro: ["blade", "beam", "cage"],
};
const OWNER_KEY = "glc:owner";

function characterOf(e) {
  return BY_TYPE[e.typeId];
}

function ownerId(e) {
  try {
    return /** @type {string | undefined} */ (e.getDynamicProperty(OWNER_KEY));
  } catch {
    return undefined;
  }
}

/** @param {import("@minecraft/server").Player} player */
export function summonAlly(player, charId) {
  const ch = CHARACTERS.find((c) => c.id === charId);
  if (!ch) return;
  // send existing allies home; Sinestro (an unbound rival) never appears twice nearby
  if (ch.ally) {
    for (const e of player.dimension.getEntities({ families: ["glc_lantern"] })) {
      if (ownerId(e) === player.id && MAX_ALLIES_PER_PLAYER <= 1) dismiss(e, true);
    }
  } else {
    for (const e of player.dimension.getEntities({ type: `glc:${ch.id}`, location: player.location, maxDistance: 96 })) {
      dismiss(e, true);
    }
  }
  const loc = add(player.location, add(v3(0, 1.5, 0), (() => {
    const v = player.getViewDirection();
    return v3(v.x * 2.5, 0, v.z * 2.5);
  })()));
  let e;
  try {
    e = player.dimension.spawnEntity(`glc:${ch.id}`, loc);
  } catch (err) {
    toast(player, "§cNo room for a Lantern to arrive here.");
    return;
  }
  const corps = ch.corps;
  particle(player.dimension, "glc:pillar", add(loc, v3(0, -1.5, 0)), corps, undefined, 4);
  particle(player.dimension, "glc:ring_burst", loc, corps, undefined, 2);
  sound(player.dimension, "glc.ring_activate", loc, 1, corps === "yellow" ? 0.7 : 1);
  try {
    e.nameTag = ch.corps === "green" ? `§a${ch.name}` : `§e${ch.name}`;
  } catch {
    // ignore
  }
  if (ch.ally) bind(e, player);
  system.runTimeout(() => {
    if (!player.isValid) return;
    player.sendMessage(`${ch.corps === "green" ? "§a" : "§e"}<${ch.name}>§r ${ch.quote}`);
  }, 20);
}

function bind(e, player) {
  try {
    e.setDynamicProperty(OWNER_KEY, player.id);
    e.getComponent("minecraft:tameable")?.tame(player);
    e.triggerEvent("glc:on_tame"); // follow_owner group, even if tame() did not run the tame event
  } catch (err) {
    console.warn(`[GLC] bind ally: ${err}`);
  }
}

function dismiss(e, quiet = false) {
  if (!valid(e)) return;
  const ch = characterOf(e);
  particle(e.dimension, "glc:pillar", e.location, ch?.corps ?? "green", undefined, 3);
  if (!quiet) sound(e.dimension, "glc.flight_start", e.location, 1, 1.2);
  try {
    e.triggerEvent("glc:despawn");
  } catch {
    e.remove();
  }
}

// talk to a Lantern
world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  const ch = characterOf(ev.target);
  if (!ch) return;
  const player = ev.player;
  const npc = ev.target;
  system.run(() => talk(player, npc, ch));
});

async function talk(player, npc, ch) {
  if (!npc.isValid) return;
  const color = ch.corps === "green" ? "§a" : "§e";
  const mine = ownerId(npc) === player.id;
  const f = new ActionFormData().title(`${color}§l${ch.name}`)
    .body(lines(`§7${ch.title}`, "", `§f"${ch.quote}"`, "",
      ch.ally ? (mine ? "§7Fighting beside you." : "§7Not bound to anyone.") : "§eA Yellow Lantern. Neutral - unless you attack him."));
  const actions = [];
  if (ch.ally && !mine) {
    f.button(`${color}§lRecruit\n§r§8Fight beside me`, "textures/glc/ui/ui_allies");
    actions.push(() => {
      if (!data(player).sworn) {
        toast(player, `§7${ch.name} only follows sworn Lanterns.`);
        return;
      }
      bind(npc, player);
      playerSound(player, "glc.ring_activate");
      player.sendMessage(`${color}<${ch.name}>§r You got it, Lantern.`);
    });
  }
  if (mine || !ch.ally) {
    f.button(mine ? "§l§cSend home\n§r§8Dismiss this Lantern" : "§l§eSend him away\n§r§8He leaves this place", "textures/glc/ui/ui_back");
    actions.push(() => dismiss(npc));
  }
  f.button("§0Close", "textures/glc/ui/ui_back");
  actions.push(() => undefined);
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection === undefined) return;
  actions[res.selection]?.();
}

/**
 * Every second: Lantern NPCs near players use signature constructs and regenerate.
 * @param {import("@minecraft/server").Player[]} players
 */
export function alliesSecond(players) {
  const seen = new Set();
  const now = system.currentTick;
  for (const p of players) {
    let list;
    try {
      list = p.dimension.getEntities({ families: ["glc_lantern"], location: p.location, maxDistance: 48 });
    } catch {
      continue;
    }
    for (const npc of list) {
      if (seen.has(npc.id)) continue;
      seen.add(npc.id);
      const ch = characterOf(npc);
      if (!ch) continue;
      const r = rt(npc.id);
      // regenerate 2 HP every 2 seconds
      if (now % 40 === 0) {
        try {
          const hp = npc.getComponent("minecraft:health");
          if (hp && hp.currentValue < hp.effectiveMax) hp.setCurrentValue(Math.min(hp.effectiveMax, hp.currentValue + 2));
        } catch {
          // ignore
        }
      }
      if ((r.nextMove ?? 0) > now) continue;
      const target = nearestTarget(npc.dimension, npc.location, 16, npc, "hostile");
      if (!target) {
        if (r.casting) setCasting(npc, false);
        continue;
      }
      const moves = MOVES[ch.id] ?? ["beam"];
      const move = moves[Math.floor(Math.random() * moves.length)];
      setCasting(npc, true);
      tryCast(npc, move, target);
      r.nextMove = now + 60 + Math.floor(Math.random() * 60);
      system.runTimeout(() => setCasting(npc, false), 25);
    }
  }
}

function setCasting(npc, on) {
  try {
    if (npc.isValid) npc.setProperty("glc:casting", on);
    rt(npc.id).casting = on;
  } catch {
    // ignore
  }
}

world.afterEvents.entityDie.subscribe((ev) => {
  const ch = characterOf(ev.deadEntity);
  if (!ch) return;
  try {
    const owner = ownerId(ev.deadEntity);
    if (!owner) return;
    const player = world.getEntity(owner);
    if (player && player.typeId === "minecraft:player") ringSay(/** @type {any} */ (player), `§c${ch.name} has fallen. Call them again from a Central Power Battery.`, true);
  } catch {
    // ignore
  }
});
