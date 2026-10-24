// The Power Ring item: use handling, equip detection and passive glow.
import { EquipmentSlot, system, world } from "@minecraft/server";
import { BOOK_ID, RING_ID } from "../config.js";
import { data, rt } from "./state.js";
import { corpsOf, ringSay, toast } from "./lantern.js";
import { oathIntro } from "./oath.js";
import { tryCast } from "../constructs/registry.js";
import { openGuide, openMainMenu } from "../ui/menu.js";
import { stopFlight } from "../systems/flight.js";
import { particle, playerSound } from "../lib/fx.js";
import { add, v3 } from "../lib/vec.js";

/**
 * Both the item custom component and the world itemUse event route here; a use
 * is handled once even if both fire for the same tap.
 */
function handleUse(player, itemId) {
  const r = rt(player.id);
  if (r.lastUseTick !== undefined && system.currentTick - r.lastUseTick <= 1) return;
  r.lastUseTick = system.currentTick;
  if (itemId === RING_ID) system.run(() => useRing(player));
  else if (itemId === BOOK_ID) system.run(() => openGuide(player, true));
}

/** Item custom component: glc:power_ring */
export const ringComponent = {
  /** @param {import("@minecraft/server").ItemComponentUseEvent} ev */
  onUse(ev) {
    const player = ev.source;
    if (!player || player.typeId !== "minecraft:player") return;
    handleUse(player, RING_ID);
  },
};

/** Item custom component: glc:book_of_oa */
export const bookComponent = {
  /** @param {import("@minecraft/server").ItemComponentUseEvent} ev */
  onUse(ev) {
    if (ev.source) handleUse(ev.source, BOOK_ID);
  },
};

world.afterEvents.itemUse.subscribe((ev) => {
  const id = ev.itemStack?.typeId;
  if (id === RING_ID || id === BOOK_ID) handleUse(ev.source, id);
});

/** @param {import("@minecraft/server").Player} player */
export function useRing(player) {
  if (!player.isValid) return;
  const d = data(player);
  const r = rt(player.id);
  if (system.currentTick < r.busyUntil) return;
  if (!d.sworn) {
    playerSound(player, "glc.ring_equip");
    particle(player.dimension, "glc:aura", add(player.getHeadLocation(), v3(0, -0.4, 0)), "green", { radius: 0.5 });
    oathIntro(player, "unlock");
    return;
  }
  if (player.isSneaking) {
    openMainMenu(player);
    return;
  }
  if (!d.ringOn) {
    toast(player, "§7Ring powered down. §fSneak + use§7 to open the menu and power it up.");
    return;
  }
  tryCast(player, d.selected);
}

/** Where is the ring? Checked once per second. */
export function scanRing(player) {
  const r = rt(player.id);
  let inHand = false;
  let offhand = false;
  let carried = false;
  try {
    const eq = player.getComponent("minecraft:equippable");
    inHand = eq?.getEquipment(EquipmentSlot.Mainhand)?.typeId === RING_ID;
    offhand = eq?.getEquipment(EquipmentSlot.Offhand)?.typeId === RING_ID;
    carried = inHand || offhand;
    if (!carried) {
      const inv = player.getComponent("minecraft:inventory")?.container;
      if (inv) {
        for (let i = 0; i < 9 && !carried; i++) if (inv.getItem(i)?.typeId === RING_ID) carried = true;
      }
    }
  } catch {
    // ignore
  }
  const d = data(player);
  const was = r.carried;
  r.carried = carried;
  r.inHand = inHand;
  if (!was && carried && d.sworn) onEquip(player, offhand);
  if (was && !carried && r.flying) stopFlight(player, "§7You lost contact with your ring!");
  r.offhand = offhand;
  // gentle glow around the ring hand while held
  if (d.sworn && d.ringOn && (inHand || offhand)) {
    particle(player.dimension, "glc:aura", add(player.getHeadLocation(), v3(0, -0.7, 0)), corpsOf(player), { radius: 0.35 });
  }
}

function onEquip(player, offhand) {
  const r = rt(player.id);
  playerSound(player, "glc.ring_equip", 0.8);
  particle(player.dimension, "glc:ring_burst", add(player.location, v3(0, 1, 0)), corpsOf(player));
  if (!r.equippedOnce) {
    r.equippedOnce = true;
    ringSay(player, offhand ? "Ring equipped on your off-hand. Flight and HUD active." : "Ring equipped. Willpower detected.");
  }
}
