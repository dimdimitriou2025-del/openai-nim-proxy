// Wearable Lantern uniforms: detect the chest slot and apply the uniform's perk.
import { EquipmentSlot } from "@minecraft/server";
import { SUITS } from "../data/game_data.js";
import { rt } from "../core/state.js";
import { ringSay } from "../core/lantern.js";

const BY_ITEM = Object.fromEntries(SUITS.map((s) => [`glc:${s.id}`, s]));

/** @param {import("@minecraft/server").Player} player */
export function scanSuit(player) {
  const r = rt(player.id);
  let suit;
  try {
    const it = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Chest);
    suit = it ? BY_ITEM[it.typeId] : undefined;
  } catch {
    suit = undefined;
  }
  const id = suit ? suit.id : null;
  if (id !== r.suit) {
    r.suit = id;
    r.perk = suit ? suit.perk : null;
    r.suitPerkText = suit ? suit.perkText : null;
    if (suit) ringSay(player, `§f${suit.name}: §a${suit.perkText}`);
  }
}
