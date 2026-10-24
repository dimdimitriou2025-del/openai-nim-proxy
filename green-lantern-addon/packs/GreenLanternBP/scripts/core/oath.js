// The Green Lantern oath: a real text-entry form, validation and ceremonies.
import { EquipmentSlot, ItemStack, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { OATH_LINES, OATH_PLACEHOLDER, OATH_TITLE, STRICT_PUNCTUATION } from "../oath_config.js";
import { checkOath, oathPrefix } from "./oath_logic.js";
import { data, rt, save } from "./state.js";
import {
  canAscend, corpsOf, fullRecharge, nextRank, rankDef, ringSay, toast,
} from "./lantern.js";
import { RANKS, CONSTRUCTS, GLYPHS } from "../data/game_data.js";
import { BATTERY_OVERCHARGE, CENTRAL_OVERCHARGE, RING_ID } from "../config.js";
import { particle, playerSound, shockwave, sound } from "../lib/fx.js";
import { add, v3 } from "../lib/vec.js";
import { showForm, lines } from "../ui/forms.js";

const ICON = "textures/glc/ui/";

/** Oath text formatted for display. */
export function oathText(color = "§a") {
  return OATH_LINES.map((l) => `${color}§o${l}§r`).join("\n");
}

/**
 * Entry point: explain, then let the player recite the oath.
 * @param {import("@minecraft/server").Player} player
 * @param {"unlock"|"recharge"|"ascend"|"reaffirm"} context
 */
export async function oathIntro(player, context = "unlock") {
  const d = data(player);
  const intro = {
    unlock: lines(
      "§fThe ring has chosen you. You have the ability to overcome great fear.",
      "",
      "§7To accept it, type the §aGreen Lantern Oath§7 exactly (capital letters and punctuation do not matter):",
      "",
      oathText(),
    ),
    recharge: lines("§fPlace your ring before the Power Battery and speak the oath to charge it beyond its limit.", "", oathText()),
    ascend: lines(
      canAscend(d)
        ? `§6Your willpower is ready.§f Recite the oath before the Central Power Battery to become §6${nextRank(d)?.name}§f.`
        : "§fRecite the oath to the Central Power Battery to overcharge your ring.",
      "",
      oathText(),
    ),
    reaffirm: lines("§fYour ring is already bound to you. Speaking the oath again renews your resolve, but changes nothing.", "", oathText()),
  }[context];
  const f = new ActionFormData()
    .title(`§2§l${OATH_TITLE}`)
    .body(intro)
    .button("§2§lRecite the Oath\n§r§8Type it in a text box", ICON + "ui_oath")
    .button("§0Read the Oath slowly\n§8Full text, line by line", ICON + "ui_guide")
    .button("§0Not now", ICON + "ui_back");
  const res = await showForm(player, f);
  if (!res || res.canceled) return;
  if (res.selection === 0) return oathForm(player, context);
  if (res.selection === 1) return oathGuide(player, context);
}

/** Displays the oath for players who need to read it before typing. */
export async function oathGuide(player, context = "unlock") {
  const body = lines(
    "§7The oath has four lines. Type all four in one text box, in order:",
    "",
    ...OATH_LINES.map((l, i) => `§a${i + 1}. §f${l}`),
    "",
    "§7Tip: on iPhone, tap the text box, type the oath, then press §fSwear the Oath§7.",
    "§7Upper/lower case, extra spaces and punctuation are ignored.",
  );
  const f = new ActionFormData().title(`§2${OATH_TITLE}`).body(body)
    .button("§2§lRecite it now", ICON + "ui_oath")
    .button("§0Close", ICON + "ui_back");
  const res = await showForm(player, f);
  if (res && !res.canceled && res.selection === 0) return oathForm(player, context);
}

/**
 * The text-entry form. Validates the actual typed text.
 * @param {import("@minecraft/server").Player} player
 */
export async function oathForm(player, context = "unlock", attempt = 1, previous = "") {
  const f = new ModalFormData()
    .title(`§2§l${OATH_TITLE}`)
    .label(attempt > 1 ? "§cThe ring rejected your oath. Try again:" : "§fSpeak the oath with all your will:")
    .textField("§aType the oath here:", OATH_PLACEHOLDER, { defaultValue: previous })
    .submitButton("§2Swear the Oath");
  const res = await showForm(player, f);
  if (!res || res.canceled || !res.formValues) return;
  // formValues follow control order; the label occupies no value slot in some versions,
  // so pick the first string value.
  const typed = /** @type {string} */ (res.formValues.find((v) => typeof v === "string") ?? "");
  const result = checkOath(typed, OATH_LINES, STRICT_PUNCTUATION);
  if (result.ok) return oathAccepted(player, context);
  return oathRejected(player, context, attempt, typed, result);
}

async function oathRejected(player, context, attempt, typed, result) {
  playerSound(player, "glc.oath_fail");
  particle(player.dimension, "glc:low_power", player.getHeadLocation(), corpsOf(player));
  let why;
  if (result.empty) why = "§cYou did not say anything.";
  else if (result.matched === 0) why = `§cThe oath begins: §a"${oathPrefix(OATH_LINES, 3)}..."`;
  else if (result.expected === undefined) why = "§cYour oath continues past the final word.";
  else {
    why = lines(
      `§fCorrect so far: §a"${oathPrefix(OATH_LINES, result.matched)}"`,
      result.typed ? `§cThen you wrote §f"${result.typed}"§c - check the next word.` : "§cYour oath stopped early - keep going.",
    );
  }
  const f = new ActionFormData()
    .title("§cThe ring rejects your oath")
    .body(lines(why, "", `§7(${result.matched}/${result.total} words correct)`))
    .button("§2§lTry again\n§r§8Your text is kept", ICON + "ui_oath")
    .button("§0Show me the oath", ICON + "ui_guide")
    .button("§0Cancel", ICON + "ui_back");
  const res = await showForm(player, f);
  if (!res || res.canceled) return;
  if (res.selection === 0) return oathForm(player, context, attempt + 1, typed);
  if (res.selection === 1) return oathGuide(player, context);
}

/** Successful oath: grants exactly the reward the context allows (never duplicates). */
function oathAccepted(player, context) {
  const d = data(player);
  d.oathCount++;
  if (!d.sworn) return unlockCeremony(player);
  if (context === "ascend") {
    if (canAscend(d)) return ascendCeremony(player);
    fullRecharge(player, CENTRAL_OVERCHARGE);
    chargeFx(player, "§aBeware my power!", "§7Your ring is overcharged.");
    return;
  }
  if (context === "recharge") {
    fullRecharge(player, BATTERY_OVERCHARGE);
    chargeFx(player, "§aBeware my power!", `§7Overcharged to ${Math.round(100 + BATTERY_OVERCHARGE * 100)}%`);
    return;
  }
  save(player, true);
  ringSay(player, "Your oath is acknowledged. Your ring is already yours - recite it at a Power Battery to charge it.");
  playerSound(player, "glc.ring_equip");
}

function chargeFx(player, title, subtitle) {
  const dim = player.dimension;
  const corps = corpsOf(player);
  try {
    player.onScreenDisplay.setTitle(title, { subtitle, fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 15 });
  } catch {
    // ignore
  }
  sound(dim, "glc.battery_charge", player.location);
  particle(dim, "glc:pillar", player.location, corps, undefined, 4);
  particle(dim, "glc:ring_burst", add(player.location, v3(0, 1, 0)), corps, undefined, 2);
}

// ------------------------------------------------------------------ ceremonies
function unlockCeremony(player) {
  const d = data(player);
  d.sworn = true;
  d.rank = Math.max(1, d.rank);
  d.selected = "beam";
  d.ringOn = true;
  save(player, true);
  fullRecharge(player, 0.25);
  bindRing(player);
  const dim = player.dimension;
  const corps = corpsOf(player);
  const base = player.location;
  const r = rt(player.id);
  r.busyUntil = system.currentTick + 70;
  r.safeFallUntil = system.currentTick + 200;
  try {
    player.camera.fade({ fadeColor: { red: 0.1, green: 0.85, blue: 0.3 },
      fadeTime: { fadeInTime: 0.35, holdTime: 0.25, fadeOutTime: 1.4 } });
  } catch {
    // camera API unavailable: the rest of the ceremony still plays
  }
  try {
    player.onScreenDisplay.setTitle("§aIn brightest day...", { subtitle: "§2...in blackest night", fadeInDuration: 8, stayDuration: 30, fadeOutDuration: 8 });
  } catch {
    // ignore
  }
  sound(dim, "glc.oath_success", base, 1.0);
  particle(dim, "glc:pillar", base, corps, undefined, 4);
  try {
    player.addEffect("levitation", 30, { amplifier: 0, showParticles: false });
    player.addEffect("resistance", 200, { amplifier: 4, showParticles: false });
  } catch {
    // ignore
  }
  const step = (delay, fn) => system.runTimeout(() => {
    if (player.isValid) {
      try {
        fn();
      } catch (e) {
        console.warn(`[GLC] ceremony: ${e}`);
      }
    }
  }, delay);
  step(12, () => {
    particle(dim, "glc:emblem", add(player.getHeadLocation(), v3(0, 1.4, 0)), corps, undefined, 2);
    particle(dim, "glc:ring_burst", add(player.location, v3(0, 1.1, 0)), corps, undefined, 3);
  });
  step(26, () => {
    shockwave(dim, player.location, corps, 4.5);
    particle(dim, "glc:spark", add(player.location, v3(0, 1, 0)), corps);
    giveUniform(player);
  });
  step(34, () => {
    player.onScreenDisplay.setTitle("§l§aGREEN LANTERN", {
      subtitle: `§fWelcome to the Corps, ${player.name}!`, fadeInDuration: 6, stayDuration: 60, fadeOutDuration: 20,
    });
    playerSound(player, "glc.ring_activate");
  });
  step(44, () => {
    ringSay(player, `${player.name} of Earth, you have the ability to overcome great fear. Welcome to the Green Lantern Corps.`, true);
  });
  step(80, () => {
    ringSay(player, "§7Tap with the ring to use a construct. §fSneak + tap§7 opens the ring menu. §fDouble-jump§7 to fly.", true);
    toast(player, "§aSneak + use ring: open menu  §7|  §aDouble-jump: fly", 100);
  });
}

function ascendCeremony(player) {
  const d = data(player);
  const n = nextRank(d);
  if (!n) return;
  d.rank = n.rank;
  save(player, true);
  fullRecharge(player, CENTRAL_OVERCHARGE);
  const dim = player.dimension;
  const corps = corpsOf(player);
  sound(dim, "glc.rank_up", player.location);
  particle(dim, "glc:pillar", player.location, corps, undefined, 4);
  particle(dim, "glc:emblem", add(player.getHeadLocation(), v3(0, 1.4, 0)), corps, undefined, 2);
  shockwave(dim, player.location, corps, 6);
  try {
    player.camera.fade({ fadeColor: { red: 0.15, green: 0.9, blue: 0.35 }, fadeTime: { fadeInTime: 0.2, holdTime: 0.1, fadeOutTime: 1.0 } });
  } catch {
    // ignore
  }
  player.onScreenDisplay.setTitle(`§6${GLYPHS["rank" + n.rank]} ${n.name.toUpperCase()}`, {
    subtitle: "§fYour ring answers a stronger will", fadeInDuration: 6, stayDuration: 60, fadeOutDuration: 20,
  });
  const unlocked = CONSTRUCTS.filter((c) => c.rank === n.rank).map((c) => c.name);
  system.runTimeout(() => {
    if (!player.isValid) return;
    ringSay(player, `§6Rank achieved: ${n.name}.§f Max energy ${rankDef(d).maxEnergy}.`, true);
    if (unlocked.length) ringSay(player, `§fNew constructs: §a${unlocked.join("§f, §a")}`, true);
    if (n.flightTier > RANKS[n.rank - 2].flightTier) ringSay(player, "§fFaster flight speed unlocked (Ring Settings).", true);
  }, 30);
}

/** Write the owner into the ring's lore (cosmetic; the bond itself is stored on the player). */
export function bindRing(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    for (const slot of [EquipmentSlot.Mainhand, EquipmentSlot.Offhand]) {
      const it = eq?.getEquipment(slot);
      if (it && it.typeId === RING_ID) {
        it.setLore([`§7Bound to §a${player.name}`, "§7Green Lantern Corps", "§8Sneak + use: ring menu"]);
        eq.setEquipment(slot, it);
        return;
      }
    }
  } catch {
    // ignore
  }
}

/** First-oath uniform: auto-equipped if the chest slot is free. */
export function giveUniform(player) {
  const d = data(player);
  if (d.uniformGiven) return;
  d.uniformGiven = true;
  save(player, true);
  try {
    const item = new ItemStack("glc:corps_uniform", 1);
    const eq = player.getComponent("minecraft:equippable");
    if (eq && !eq.getEquipment(EquipmentSlot.Chest)) {
      eq.setEquipment(EquipmentSlot.Chest, item);
      ringSay(player, "Your ring weaves a uniform of pure willpower.");
      return;
    }
    const inv = player.getComponent("minecraft:inventory")?.container;
    const left = inv?.addItem(item);
    if (left) player.dimension.spawnItem(left, player.location);
    ringSay(player, "Your ring has created a Corps uniform - it is in your inventory.");
  } catch {
    // ignore
  }
}
