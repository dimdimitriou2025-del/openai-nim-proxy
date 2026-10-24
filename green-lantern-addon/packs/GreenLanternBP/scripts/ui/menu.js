// Power Ring menu: big touch-friendly buttons with icons.
import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CATEGORIES, CONSTRUCTS, RANKS, VERSION, FLIGHT_SPEEDS } from "../data/game_data.js";
import { data, rt, save } from "../core/state.js";
import {
  CONSTRUCT_BY_ID, canAscend, corpsOf, costOf, isUnlocked, maxEnergy, nextRank, perkOf, rankName, ringSay, toast,
} from "../core/lantern.js";
import { oathGuide, oathIntro, oathText } from "../core/oath.js";
import { tryCast } from "../constructs/registry.js";
import { flightTier, setFlightSpeed, toggleFlight } from "../systems/flight.js";
import { particle, playerSound } from "../lib/fx.js";
import { add, v3 } from "../lib/vec.js";
import { lines, showForm } from "./forms.js";

const ICON = "textures/glc/ui/";
const CAT_COLOR = { offense: "§c", defense: "§b", utility: "§e", advanced: "§d" };

function energyLine(player) {
  const d = data(player);
  const max = maxEnergy(player);
  const over = d.over > 0 ? ` §f(+${Math.floor(d.over)} overcharge)` : "";
  return `§fEnergy: §a${Math.floor(d.energy)}§7/${max}${over}`;
}

function rankLine(d) {
  const n = nextRank(d);
  const prog = n ? `§7Willpower §f${Math.floor(d.xp)}§7/${n.xp}${canAscend(d) ? " §6- ready to ascend!" : ""}` : "§6Maximum rank";
  return `§fRank: §a${rankName(d)}  ${prog}`;
}

/** @param {import("@minecraft/server").Player} player */
export async function openMainMenu(player) {
  const d = data(player);
  if (!d.sworn) return oathIntro(player, "unlock");
  playerSound(player, "glc.menu_open", 0.8);
  const r = rt(player.id);
  const sel = CONSTRUCT_BY_ID[d.selected];
  const f = new ActionFormData()
    .title("§2§lPOWER RING")
    .body(lines(rankLine(d), energyLine(player), `§fActive construct: §a${sel ? sel.name : "-"}`,
      r.flying ? "§bFlight: ON" : "§7Flight: off", "§8Tap a construct to make it active, then tap with the ring to use it."));
  const actions = [];
  for (const id of d.recent) {
    const c = CONSTRUCT_BY_ID[id];
    if (!c || !isUnlocked(d, c)) continue;
    f.button(`§l★ ${c.name}§r\n§8Quick pick - ${costOf(player, c)} energy`, `${ICON}icon_${c.id}`);
    actions.push(() => selectConstruct(player, c.id));
  }
  for (const cat of CATEGORIES) {
    const list = CONSTRUCTS.filter((c) => c.category === cat.id);
    const open = list.filter((c) => isUnlocked(d, c)).length;
    f.button(`${CAT_COLOR[cat.id]}§l${cat.name}§r\n§8${open}/${list.length} unlocked`, `${ICON}${cat.icon}`);
    actions.push(() => openCategory(player, cat.id));
  }
  f.button(r.flying ? "§l§bLand (Flight ON)§r\n§8or double-tap jump" : "§l§3Take Flight§r\n§8or double-tap jump", `${ICON}ui_flight`);
  actions.push(() => toggleFlight(player));
  f.button("§l§2Lantern Status§r\n§8Rank, willpower, perks", `${ICON}ui_status`);
  actions.push(() => openStatus(player));
  f.button("§l§2Oath & Guide§r\n§8How to play, the oath", `${ICON}ui_oath`);
  actions.push(() => openGuide(player));
  f.button("§l§2Ring Settings§r\n§8Flight speed, HUD...", `${ICON}ui_settings`);
  actions.push(() => openSettings(player));
  f.button(d.ringOn ? "§l§8Power Down Ring§r\n§8Stops HUD, flight & casting" : "§l§aPower Up Ring§r\n§8Reactivate your ring", `${ICON}ui_power`);
  actions.push(() => setRingPower(player, !d.ringOn));
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection === undefined) return;
  playerSound(player, "glc.menu_select");
  await actions[res.selection]?.();
}

async function openCategory(player, catId) {
  const d = data(player);
  const cat = CATEGORIES.find((c) => c.id === catId);
  const list = CONSTRUCTS.filter((c) => c.category === catId);
  const f = new ActionFormData().title(`${CAT_COLOR[catId]}§l${cat.name}`)
    .body(lines(energyLine(player), "§8Locked constructs open as you rise through the ranks."));
  for (const c of list) {
    if (isUnlocked(d, c)) {
      const active = d.selected === c.id ? "§a● " : "";
      f.button(`${active}§l${c.name}§r\n§8${costOf(player, c)} energy • ${c.cooldown}s`, `${ICON}icon_${c.id}`);
    } else {
      f.button(`§7§l${c.name}§r\n§8Rank ${c.rank}: ${RANKS[c.rank - 1].name}`, `${ICON}ui_locked`);
    }
  }
  f.button("§0Back", `${ICON}ui_back`);
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection === undefined) return;
  if (res.selection >= list.length) return openMainMenu(player);
  const c = list[res.selection];
  if (!isUnlocked(d, c)) return lockedInfo(player, c);
  return constructInfo(player, c);
}

async function constructInfo(player, c) {
  const d = data(player);
  const f = new ActionFormData().title(`§2§l${c.name}`)
    .body(lines(`§f${c.desc}`, "", `§7Energy: §a${costOf(player, c)}§7   Cooldown: §a${c.cooldown}s`,
      c.damage ? `§7Damage: §c${c.damage}` : undefined, c.duration ? `§7Duration: §b${c.duration}s` : undefined,
      d.castOnSelect ? "§8(Cast-on-select is ON: choosing it also uses it now.)" : undefined))
    .button("§2§lMake Active\n§r§8Tap with the ring to use", `${ICON}icon_${c.id}`)
    .button("§0Back", `${ICON}ui_back`);
  const res = await showForm(player, f);
  if (!res || res.canceled) return;
  if (res.selection === 0) return selectConstruct(player, c.id);
  return openCategory(player, c.category);
}

async function lockedInfo(player, c) {
  const d = data(player);
  const rk = RANKS[c.rank - 1];
  const f = new ActionFormData().title(`§7${c.name} (locked)`)
    .body(lines(`§f${c.desc}`, "", `§cRequires rank ${c.rank}: ${rk.name}`, `§7Willpower needed: §f${rk.xp}§7 (you have ${Math.floor(d.xp)})`,
      "§7Defeat hostile mobs, use constructs and train at a §aCentral Power Battery§7,",
      "§7then recite the oath there to ascend."))
    .button("§0Back", `${ICON}ui_back`);
  await showForm(player, f);
  return openCategory(player, c.category);
}

export function selectConstruct(player, id) {
  const d = data(player);
  const c = CONSTRUCT_BY_ID[id];
  if (!c || !isUnlocked(d, c)) return;
  d.selected = id;
  save(player);
  particle(player.dimension, "glc:aura", add(player.getHeadLocation(), v3(0, -0.5, 0)), corpsOf(player), { radius: 0.5 });
  toast(player, `§a${c.name}§7 ready - tap with the ring to use it`, 50);
  if (d.castOnSelect) system.run(() => tryCast(player, id));
}

async function openStatus(player) {
  const d = data(player);
  const n = nextRank(d);
  const unlocked = CONSTRUCTS.filter((c) => isUnlocked(d, c)).length;
  const perk = perkOf(player);
  const body = lines(
    `§2§l${player.name}§r §7- Green Lantern Corps`,
    rankLine(d),
    energyLine(player),
    `§fConstructs unlocked: §a${unlocked}§7/${CONSTRUCTS.length}`,
    `§fFlight speed: §a${d.flightSpeed}§7/${flightTier(player)} (max ${FLIGHT_SPEEDS.length})`,
    `§fMonsters defeated: §a${d.kills}§7   Constructs used: §a${d.casts}`,
    perk ? `§fUniform perk: §a${rt(player.id).suitPerkText ?? perk}` : "§7No uniform perk (wear a Lantern uniform)",
    "",
    n ? (canAscend(d)
      ? `§6Ready! Recite the oath at a Central Power Battery to become ${n.name}.`
      : `§7Next rank: §f${n.name}§7 at ${n.xp} willpower.`) : "§6You have reached the highest rank: Legend.",
    "§8Earn willpower by defeating monsters, using defensive/utility constructs,",
    "§8recharging at batteries and Construct Training.",
    `§8Add-on v${VERSION}`,
  );
  const f = new ActionFormData().title("§2§lLantern Status").body(body).button("§0Back", `${ICON}ui_back`);
  const res = await showForm(player, f);
  if (res && !res.canceled) return openMainMenu(player);
}

export async function openGuide(player, fromBook = false) {
  const d = data(player);
  const body = lines(
    "§2§lHOW TO BE A GREEN LANTERN§r",
    "§f1. §7Hold the §aPower Ring§7 and tap the screen (use) to swear the oath.",
    "§f2. §7Type the oath exactly - capitals and punctuation do not matter:",
    oathText(),
    "§f3. §7Tap with the ring to use your active construct.",
    "§f4. §fSneak + tap§7 opens this ring menu to pick constructs.",
    "§f5. §fDouble-tap jump§7 to fly. Push the joystick to fly where you look,",
    "   §7hold jump to climb, let go to hover. Double-tap jump again to land.",
    "§f6. §7Recharge at a §aPower Battery§7 (lantern block) or a §aCentral Power Battery§7.",
    "§f7. §7Gain willpower and recite the oath at a Central Power Battery to rank up.",
    "§8Keep the ring in your hotbar or off-hand for flight and the HUD.",
  );
  const f = new ActionFormData().title(fromBook ? "§2§lBook of Oa" : "§2§lOath & Guide").body(body);
  const actions = [];
  if (!d.sworn) {
    f.button("§2§lSwear the Oath\n§r§8Unlock your ring", `${ICON}ui_oath`);
    actions.push(() => oathIntro(player, "unlock"));
  } else {
    f.button("§2Recite the Oath\n§8Renew your resolve", `${ICON}ui_oath`);
    actions.push(() => oathIntro(player, "reaffirm"));
  }
  f.button("§0Read the oath line by line", `${ICON}ui_guide`);
  actions.push(() => oathGuide(player, d.sworn ? "reaffirm" : "unlock"));
  f.button("§0Close", `${ICON}ui_back`);
  actions.push(() => (d.sworn && !fromBook ? openMainMenu(player) : undefined));
  const res = await showForm(player, f);
  if (!res || res.canceled || res.selection === undefined) return;
  await actions[res.selection]?.();
}

async function openSettings(player) {
  const d = data(player);
  const tier = flightTier(player);
  const hudModes = ["icons", "text", "off"];
  const f = new ModalFormData().title("§2§lRing Settings");
  if (tier > 1) f.slider(`Flight speed (max ${tier} at your rank)`, 1, tier, { valueStep: 1, defaultValue: Math.min(d.flightSpeed, tier) });
  else f.label("§7Flight speed: 1 (faster speeds unlock at higher ranks)");
  f.dropdown("HUD style", ["Icons (energy bar glyphs)", "Text only", "Hidden"], { defaultValueIndex: Math.max(0, hudModes.indexOf(d.hud)) })
    .toggle("Cast construct immediately when selected", { defaultValue: d.castOnSelect })
    .toggle("Land automatically when touching ground", { defaultValue: d.autoLand })
    .toggle("Ring voice messages in chat", { defaultValue: d.voice })
    .submitButton("§2Save");
  const res = await showForm(player, f);
  if (!res || res.canceled || !res.formValues) return openMainMenu(player);
  const vals = res.formValues.filter((v) => v !== undefined);
  let i = 0;
  if (tier > 1) setFlightSpeed(player, Number(vals[i++]));
  d.hud = hudModes[Number(vals[i++])] ?? "icons";
  d.castOnSelect = !!vals[i++];
  d.autoLand = !!vals[i++];
  d.voice = !!vals[i++];
  save(player, true);
  toast(player, "§aRing settings saved");
  return openMainMenu(player);
}

export function setRingPower(player, on) {
  const d = data(player);
  d.ringOn = on;
  save(player, true);
  const corps = corpsOf(player);
  if (on) {
    particle(player.dimension, "glc:ring_burst", add(player.location, v3(0, 1, 0)), corps, undefined, 2);
    playerSound(player, "glc.ring_activate");
    ringSay(player, "Ring online. Power levels nominal.");
  } else {
    particle(player.dimension, "glc:low_power", player.getHeadLocation(), corps);
    playerSound(player, "glc.ring_empty", 0.7);
    rt(player.id).flying && toggleFlight(player);
    toast(player, "§7Ring powered down. Sneak + use the ring to power it up again.", 60);
  }
}
