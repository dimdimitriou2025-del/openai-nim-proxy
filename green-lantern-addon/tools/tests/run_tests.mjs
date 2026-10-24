// End-to-end tests: run the real add-on scripts against the mocked Script API.
// Usage: node --import ./tools/tests/register.mjs tools/tests/run_tests.mjs
import assert from "node:assert/strict";
import * as MC from "@minecraft/server";
import { UI } from "@minecraft/server-ui";

const { system, world, tick, log, ItemStack } = MC;
const S = "../../packs/GreenLanternBP/scripts/";
const results = [];
const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => {
  warnings.push(a.join(" "));
};
console.log = () => {};

async function test(name, fn) {
  const before = warnings.length;
  try {
    await fn();
    const newWarn = warnings.slice(before).filter((w) => w.includes("[GLC]"));
    if (newWarn.length) throw new Error(`script warnings:\n  ${newWarn.join("\n  ")}`);
    results.push([name, true]);
  } catch (e) {
    results.push([name, false, e]);
  }
}

// ---------------------------------------------------------------- pure logic
const { checkOath, normalizeOath } = await import(S + "core/oath_logic.js");
const { OATH_LINES } = await import(S + "oath_config.js");
const CANON = "In brightest day, in blackest night, No evil shall escape my sight. Let those who worship evil's might, Beware my power, Green Lantern's light!";

await test("oath: exact text accepted", () => assert.equal(checkOath(CANON, OATH_LINES).ok, true));
await test("oath: case-insensitive", () => assert.equal(checkOath(CANON.toUpperCase(), OATH_LINES).ok, true));
await test("oath: leading/trailing/multiple whitespace and line breaks ignored", () =>
  assert.equal(checkOath(`   ${OATH_LINES.join("\n   ")}  \n`, OATH_LINES).ok, true));
await test("oath: punctuation and curly apostrophes ignored", () =>
  assert.equal(checkOath("in brightest day in blackest night no evil shall escape my sight let those who worship evil’s might beware my power green lanterns light", OATH_LINES).ok, true));
await test("oath: wrong word rejected with position", () => {
  const r = checkOath(CANON.replace("blackest", "darkest"), OATH_LINES);
  assert.equal(r.ok, false);
  assert.equal(r.matched, 4);
  assert.equal(r.expected, "blackest");
  assert.equal(r.typed, "darkest");
});
await test("oath: incomplete oath rejected", () => assert.equal(checkOath("In brightest day, in blackest night", OATH_LINES).ok, false));
await test("oath: extra words rejected", () => assert.equal(checkOath(CANON + " and stuff", OATH_LINES).ok, false));
await test("oath: empty rejected", () => assert.equal(checkOath("   ", OATH_LINES).empty, true));
await test("oath: strict punctuation mode", () => {
  assert.equal(checkOath(CANON, OATH_LINES, true).ok, true);
  assert.equal(checkOath(CANON.replace(/,/g, ""), OATH_LINES, true).ok, false);
});
await test("oath: normalize", () => assert.equal(normalizeOath("  Hello,   WORLD's  "), "hello worlds"));

// ---------------------------------------------------------------- boot
const reg = { items: {}, blocks: {}, commands: {} };
await import(S + "main.js");
const state = await import(S + "core/state.js");
const lantern = await import(S + "core/lantern.js");
const registry = await import(S + "constructs/registry.js");
const { CONSTRUCTS, RANKS } = await import(S + "data/game_data.js");

await test("startup registers custom components and commands", () => {
  system.beforeEvents.startup.fire({
    itemComponentRegistry: { registerCustomComponent: (n, c) => (reg.items[n] = c) },
    blockComponentRegistry: { registerCustomComponent: (n, c) => (reg.blocks[n] = c) },
    customCommandRegistry: { registerCommand: (def, cb) => (reg.commands[def.name] = { def, cb }), registerEnum() {} },
  });
  for (const n of ["glc:power_ring", "glc:book_of_oa"]) assert.ok(reg.items[n]?.onUse, n);
  assert.ok(reg.blocks["glc:power_battery"]?.onPlayerInteract);
  assert.ok(reg.blocks["glc:hardlight"]?.onTick);
  for (const n of ["glc:ring", "glc:oath", "glc:guide", "glc:fly", "glc:rank", "glc:recharge", "glc:kit", "glc:reset"]) assert.ok(reg.commands[n], n);
  assert.equal(reg.commands["glc:ring"].def.cheatsRequired, false);
  assert.equal(reg.commands["glc:rank"].def.cheatsRequired, true);
});

world.afterEvents.worldLoad.fire({});
await tick(2);

await test("every construct in game_data has an implementation", () => {
  const impl = registry.implemented();
  for (const c of CONSTRUCTS) assert.ok(impl.includes(c.id), `missing ${c.id}`);
});

const dim = world.getDimension("overworld");
const p = dim.spawnEntity("minecraft:player", { x: 0.5, y: 64, z: 0.5 });
p.inventory.setItem(0, new ItemStack("glc:power_ring"));
world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
await tick(25);

const D = () => state.data(p);
const useRing = async (ticks = 3) => {
  reg.items["glc:power_ring"].onUse({ source: p, itemStack: p.inventory.getItem(0) });
  await tick(ticks);
};
const textAnswer = (text) => (form) => ({ canceled: false, formValues: form.values({ text }) });

await test("ring is detected in the hotbar", () => assert.equal(state.rt(p.id).carried, true));

await test("unsworn ring opens the oath; casting is impossible", async () => {
  UI.reset();
  await useRing();
  assert.ok(UI.shown.at(-1)._title.includes("Oath"));
  assert.equal(D().sworn, false);
});

await test("wrong oath is rejected without reward, then correct oath unlocks the ring", async () => {
  UI.reset();
  UI.respond({ selection: 0 }); // recite
  UI.respond(textAnswer("In brightest day, in darkest night")); // wrong
  UI.respond({ selection: 0 }); // try again
  UI.respond(textAnswer(`  IN BRIGHTEST DAY, in blackest night,\nNo evil shall escape my sight. Let those who worship evils might, beware my power — Green Lantern’s light!  `));
  await useRing(4);
  const rejected = UI.shown.find((f) => f._title.includes("rejects"));
  assert.ok(rejected, "rejection form shown");
  assert.ok(rejected._body.includes("darkest"), "feedback names the wrong word");
  await tick(100);
  assert.equal(D().sworn, true);
  assert.equal(D().rank, 1);
  assert.equal(D().energy, RANKS[0].maxEnergy);
  assert.equal(p.equipment.Chest?.typeId, "glc:corps_uniform", "uniform equipped");
  assert.ok(log.titles.some((t) => t.t.includes("GREEN LANTERN")), "ceremony title");
  assert.ok(log.particles.some((x) => x.id === "glc:pillar") && log.particles.some((x) => x.id === "glc:emblem"));
  assert.ok(log.sounds.some((s) => s.id === "glc.oath_success"));
  assert.ok(p.inventory.getItem(0).getLore().some((l) => l.includes(p.name)), "ring bound in lore");
});

await test("repeating the oath does not duplicate rewards or reset progress", async () => {
  D().xp = 42;
  const before = JSON.stringify({ rank: D().rank, xp: D().xp, uniform: D().uniformGiven });
  UI.reset();
  UI.respond({ selection: 0 });
  UI.respond(textAnswer(CANON));
  const { oathIntro } = await import(S + "core/oath.js");
  await oathIntro(p, "reaffirm");
  await tick(5);
  assert.equal(JSON.stringify({ rank: D().rank, xp: D().xp, uniform: D().uniformGiven }), before);
  assert.equal(p.inventory.items.filter((i) => i?.typeId === "glc:corps_uniform").length, 0, "no second uniform");
});

await test("HUD shows energy bar glyphs", async () => {
  log.actionbars.length = 0;
  await tick(120); // the post-oath tip toast holds the action bar for 5 s
  assert.ok(log.actionbars.some((a) => a.includes("") && a.includes("")), "glyph HUD");
});

await test("locked construct is refused at rank 1", async () => {
  D().selected = "hammer";
  const e0 = D().energy;
  await useRing();
  assert.equal(D().energy, e0);
});

// rank 5 for construct tests
await test("/glc:rank 5 sets rank", async () => {
  reg.commands["glc:rank"].cb({ sourceEntity: p }, 5);
  await tick(2);
  assert.equal(D().rank, 5);
});

function clearHardlight() {
  for (const [k, v] of [...dim._blocks]) if (v.type.id === "glc:hardlight") dim._blocks.delete(k);
}

function spawnZombieRing(n = 4, r = 5) {
  const zs = [];
  for (let i = 0; i < n; i++) {
    const z = dim.spawnEntity("minecraft:zombie", { x: 0.5 + (i - (n - 1) / 2) * 1.2, y: 64, z: 0.5 + r });
    zs.push(z);
  }
  return zs;
}

const longCasts = { drones: 430, aegis: 520, dome: 320, shield: 220, bubble: 260, cage: 180, colossus: 70, lance: 45, missiles: 80 };
for (const c of CONSTRUCTS) {
  await test(`construct '${c.id}' casts, acts and cleans up`, async () => {
    reg.commands["glc:recharge"].cb({ sourceEntity: p });
    await tick(2);
    p.rotation = { x: c.id === "drill" ? 0 : 5, y: 0 }; // face +Z towards the zombies
    p.location = { x: 0.5, y: 64, z: 0.5 };
    const zs = spawnZombieRing();
    D().selected = c.id;
    state.rt(p.id).cooldowns[c.id] = 0;
    const e0 = D().energy + D().over;
    log.particles.length = 0;
    await useRing(2);
    const spent = e0 - (D().energy + D().over);
    assert.ok(spent >= lantern.costOf(p, c) - 0.01, `energy spent (${spent})`);
    await tick(longCasts[c.id] ?? 60);
    assert.ok(log.particles.length > 0, "visual effects spawned");
    if (["beam", "fist", "giant_fist", "blade", "hammer", "titan_hammer", "lance", "colossus", "drones"].includes(c.id)) {
      assert.ok(zs.some((z) => z.damageTaken > 0 || !z.isValid), "damaged a zombie");
    }
    await tick(12);
    const left = dim.getEntities({ families: ["glc_construct"] });
    assert.equal(left.length, 0, `constructs left: ${left.map((e) => e.typeId)}`);
    for (const z of zs) if (z.isValid) z.remove();
    // hard-light blocks expire by block ticks in the game; clear them for the next test
    for (const [k, v] of [...dim._blocks]) if (v.type.id === "glc:hardlight") dim._blocks.delete(k);
  });
}

await test("cooldowns block immediate recast", async () => {
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  await tick(2);
  D().selected = "fist";
  state.rt(p.id).cooldowns.fist = 0;
  log.animations.length = 0;
  await useRing(3);
  await useRing(1);
  assert.equal(dim.getEntities({ type: "glc:fist" }).length, 1, "only one fist despite two uses");
  assert.ok(log.actionbars.at(-1).includes("recharging"), "cooldown feedback shown");
  const casts = log.animations.filter((a) => a.entity === p.id && a.name === "animation.glc.player.cast_right");
  assert.equal(casts.length, 1, "one cast gesture for the one successful cast");
  assert.equal(casts[0].controller, "glc:cast");
  await tick(40);
});

await test("ring use is handled once when both the component and world itemUse fire", async () => {
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  await tick(30);
  D().selected = "fist";
  state.rt(p.id).cooldowns.fist = 0;
  const item = p.inventory.getItem(0);
  reg.items["glc:power_ring"].onUse({ source: p, itemStack: item });
  world.afterEvents.itemUse.fire({ source: p, itemStack: item });
  await tick(2);
  assert.equal(dim.getEntities({ type: "glc:fist" }).length, 1);
  await tick(40);
  state.rt(p.id).cooldowns.fist = 0;
  world.afterEvents.itemUse.fire({ source: p, itemStack: item }); // world event alone also works
  await tick(2);
  assert.equal(dim.getEntities({ type: "glc:fist" }).length, 1);
  await tick(40);
});

await test("using the ring on a block casts; on a Power Battery block it does not", async () => {
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  await tick(30);
  D().selected = "fist";
  state.rt(p.id).cooldowns.fist = 0;
  const useOn = (typeId) => reg.items["glc:power_ring"].onUseOn({ source: p, itemStack: p.inventory.getItem(0), block: { typeId } });
  useOn("glc:power_battery");
  await tick(3);
  assert.equal(dim.getEntities({ type: "glc:fist" }).length, 0, "battery tap does not cast");
  useOn("minecraft:stone");
  await tick(3);
  assert.equal(dim.getEntities({ type: "glc:fist" }).length, 1, "tap on a block casts");
  await tick(40);
});

await test("the ring does not fire at the Central Power Battery or a Lantern being talked to", async () => {
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  await tick(30);
  p.location = { x: 0.5, y: 64, z: 0.5 };
  p.rotation = { x: 0, y: 0 };
  D().selected = "beam";
  state.rt(p.id).cooldowns.beam = 0;
  const ally = dim.spawnEntity("glc:hal_jordan", { x: 0.5, y: 64, z: 3.5 });
  const e0 = D().energy + D().over;
  await useRing(3);
  assert.equal(ally.damageTaken ?? 0, 0, "ally not hit");
  assert.ok(D().energy + D().over >= e0 - 0.01, "no energy spent");
  ally.remove();
  await useRing(3);
  assert.ok(D().energy + D().over < e0, "casts normally once nothing interactable is in the way");
  await tick(20);
});

await test("not enough energy refuses casting", async () => {
  D().energy = 1;
  D().over = 0;
  D().selected = "colossus";
  state.rt(p.id).cooldowns.colossus = 0;
  await useRing(2);
  assert.equal(dim.getEntities({ type: "glc:colossus" }).length, 0);
  assert.ok(log.actionbars.at(-1).includes("Not enough"));
});

await test("hard-light wall places real blocks that expire via block ticks", async () => {
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  await tick(2);
  p.rotation = { x: 0, y: 0 };
  D().selected = "wall";
  state.rt(p.id).cooldowns.wall = 0;
  await useRing(6);
  const placed = [...dim._blocks.entries()].filter(([, v]) => v.type.id === "glc:hardlight");
  assert.equal(placed.length, 15, "5x3 wall");
  const [k] = placed[0];
  const [x, y, z] = k.split(",").map(Number);
  const block = dim.getBlock({ x, y, z });
  for (let i = 0; i < 16; i++) reg.blocks["glc:hardlight"].onTick({ block, dimension: dim });
  assert.equal(block.typeId, "minecraft:air");
  clearHardlight();
});

await test("platform builds under the player in mid-air", async () => {
  p.location = { x: 10.5, y: 70.4, z: 10.5 };
  D().selected = "platform";
  state.rt(p.id).cooldowns.platform = 0;
  await useRing(4);
  assert.equal(dim.getBlock({ x: 10, y: 69, z: 10 }).typeId, "glc:hardlight");
  p.location = { x: 0.5, y: 64, z: 0.5 };
});

await test("drill breaks blocks but is refused in adventure mode", async () => {
  p.gameMode = MC.GameMode.Adventure;
  D().selected = "drill";
  state.rt(p.id).cooldowns.drill = 0;
  p.location = { x: 0.5, y: 64, z: 0.5 };
  p.rotation = { x: 89, y: 0 }; // straight down
  const before = log.commands.length;
  await useRing(30);
  assert.equal(log.commands.slice(before).filter((c) => c.startsWith("setblock")).length, 0);
  p.gameMode = MC.GameMode.Survival;
  state.rt(p.id).cooldowns.drill = 0;
  await useRing(30);
  assert.ok(log.commands.slice(before).filter((c) => c.startsWith("setblock")).length >= 9);
  const drops = dim.getEntities({ type: "minecraft:item" });
  assert.ok(drops.length >= 9, `blocks dropped (${drops.length})`);
  const far = drops.filter((i) => Math.hypot(i.location.x - p.location.x, i.location.y - p.location.y, i.location.z - p.location.z) > 0.01);
  assert.equal(far.length, 0, "every dropped block was collected to the player");
  for (const i of drops) i.remove();
  p.rotation = { x: 0, y: 0 };
});

await test("shield blocks frontal attacks only; bubble absorbs; fall damage cancelled in flight", async () => {
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  p.location = { x: 0.5, y: 64, z: 0.5 };
  p.rotation = { x: 0, y: 0 };
  D().selected = "shield";
  state.rt(p.id).cooldowns.shield = 0;
  await useRing(3);
  const front = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: 64, z: 3 });
  const back = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: 64, z: -3 });
  const hit = (src, cause = "entityAttack") => world.beforeEvents.entityHurt.fire({ hurtEntity: p, damage: 4, cancel: false, damageSource: { cause, damagingEntity: src } });
  assert.equal(hit(front).cancel, true, "front blocked");
  assert.equal(hit(back).cancel, false, "back not blocked");
  registry.endTasks("shield", p.id);
  await tick(12);
  D().selected = "bubble";
  state.rt(p.id).cooldowns.bubble = 0;
  await useRing(3);
  assert.equal(hit(back).cancel, true, "bubble absorbs");
  registry.endTasks("bubble", p.id);
  await tick(12);
  state.rt(p.id).flying = true;
  assert.equal(hit(undefined, "fall").cancel, true, "no fall damage while flying");
  state.rt(p.id).flying = false;
  front.remove();
  back.remove();
});

await test("flight: double-tap jump toggles, joystick flies, energy drains, lands", async () => {
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  await tick(2);
  p.location = { x: 0.5, y: 64, z: 0.5 };
  const press = () => world.afterEvents.playerButtonInput.fire({ player: p, button: "Jump", newButtonState: "Pressed" });
  press();
  await tick(3);
  press();
  await tick(1);
  assert.equal(state.rt(p.id).flying, true, "flying after double tap");
  const pose = log.animations.filter((a) => a.entity === p.id && a.controller === "glc:flight");
  assert.equal(pose.at(-1)?.name, "animation.glc.player.flight", "flight pose started");
  assert.ok(pose.at(-1).stopExpression.includes("q.is_on_ground"), "pose ends by itself on landing");
  p.location = { x: 0.5, y: 70, z: 0.5 };
  p.move = { x: 0, y: 1 };
  p.knockbacks.length = 0;
  const e0 = D().energy + D().over;
  await tick(60);
  assert.ok(p.knockbacks.length >= 55, "knockback every tick");
  assert.ok(p.knockbacks.at(-1).z > 0.2, "moving forward (+Z)");
  assert.ok(D().energy + D().over < e0, "energy drained");
  assert.ok(log.particles.some((x) => x.id === "glc:trail"));
  p.move = { x: 0, y: 0 };
  press();
  await tick(3);
  press();
  await tick(1);
  assert.equal(state.rt(p.id).flying, false, "landed");
  const end = log.animations.filter((a) => a.entity === p.id && a.controller === "glc:flight").at(-1);
  assert.equal(end?.name, "animation.glc.player.reset", "flight pose ended");
});

await test("creative mode double-tap does not toggle ring flight", async () => {
  p.gameMode = MC.GameMode.Creative;
  const press = () => world.afterEvents.playerButtonInput.fire({ player: p, button: "Jump", newButtonState: "Pressed" });
  press();
  await tick(2);
  press();
  await tick(1);
  assert.equal(state.rt(p.id).flying, false);
  p.gameMode = MC.GameMode.Survival;
});

await test("personal battery recharges with a charging animation", async () => {
  D().energy = 10;
  D().over = 0;
  UI.reset();
  UI.respond({ selection: 0 });
  reg.blocks["glc:power_battery"].onPlayerInteract({ player: p, block: dim.getBlock({ x: 2, y: 64, z: 0 }) });
  await tick(60);
  assert.equal(D().energy, lantern.maxEnergy(p));
  assert.ok(log.particles.some((x) => x.id === "glc:stream"));
  reg.blocks["glc:power_battery"].onTick({ block: dim.getBlock({ x: 2, y: 64, z: 0 }), dimension: dim });
});

await test("battery oath overcharges without other rewards", async () => {
  UI.reset();
  UI.respond({ selection: 1 }); // recite at battery
  UI.respond({ selection: 0 }); // intro -> recite
  UI.respond(textAnswer(CANON));
  const rank = D().rank;
  reg.blocks["glc:power_battery"].onPlayerInteract({ player: p, block: dim.getBlock({ x: 2, y: 64, z: 0 }) });
  await tick(10);
  assert.ok(D().over > 0, "overcharged");
  assert.equal(D().rank, rank);
});

const battery = dim.spawnEntity("glc:central_battery", { x: 3.5, y: 64, z: 0.5 });
await test("central battery: ascension requires willpower and the oath", async () => {
  reg.commands["glc:reset"].cb({ sourceEntity: p });
  await tick(2);
  // swear again quickly via form
  UI.reset();
  UI.respond({ selection: 0 });
  UI.respond(textAnswer(CANON));
  const { oathIntro } = await import(S + "core/oath.js");
  await oathIntro(p, "unlock");
  await tick(100);
  assert.equal(D().rank, 1);
  // not enough willpower -> oath only overcharges
  UI.reset();
  UI.respond({ selection: 1 });
  UI.respond({ selection: 0 });
  UI.respond(textAnswer(CANON));
  world.afterEvents.playerInteractWithEntity.fire({ player: p, target: battery });
  await tick(8);
  assert.equal(D().rank, 1, "no rank-up without willpower");
  lantern.addXp(p, RANKS[1].xp);
  UI.reset();
  UI.respond({ selection: 1 });
  UI.respond({ selection: 0 });
  UI.respond(textAnswer(CANON));
  world.afterEvents.playerInteractWithEntity.fire({ player: p, target: battery });
  await tick(40);
  assert.equal(D().rank, 2, "ascended to Lantern");
  assert.ok(log.sounds.some((s) => s.id === "glc.rank_up"));
});

await test("killing monsters grants willpower", async () => {
  const xp0 = D().xp;
  const z = dim.spawnEntity("minecraft:zombie", { x: 0.5, y: 64, z: 4 });
  z.applyDamage(30, { cause: "entityAttack", damagingEntity: p });
  await tick(1);
  assert.ok(D().xp > xp0);
});

await test("central battery: construct training awards willpower", async () => {
  UI.reset();
  UI.respond({ selection: 2 });
  world.afterEvents.playerInteractWithEntity.fire({ player: p, target: battery });
  await tick(4);
  const targets = dim.getEntities({ type: "glc:training_target" });
  assert.ok(targets.length >= 5, `targets spawned: ${targets.length}`);
  const xp0 = D().xp;
  for (const t of targets) t.applyDamage(100, { cause: "entityAttack", damagingEntity: p });
  await tick(2);
  assert.ok(D().xp >= xp0 + targets.length * 15);
});

await test("central battery: uniform locker and ally call (rank 3)", async () => {
  clearHardlight();
  reg.commands["glc:rank"].cb({ sourceEntity: p }, 3);
  await tick(2);
  delete p.equipment.Chest;
  UI.reset();
  UI.respond({ selection: 3 }); // locker
  UI.respond({ selection: 1 }); // Hal's uniform
  world.afterEvents.playerInteractWithEntity.fire({ player: p, target: battery });
  await tick(6);
  assert.equal(p.equipment.Chest?.typeId, "glc:suit_hal");
  await tick(25);
  assert.equal(state.rt(p.id).perk, "flight", "suit perk detected");
  UI.reset();
  UI.respond({ selection: 4 }); // allies
  UI.respond({ selection: 0 }); // Hal
  world.afterEvents.playerInteractWithEntity.fire({ player: p, target: battery });
  await tick(6);
  const hal = dim.getEntities({ type: "glc:hal_jordan" })[0];
  assert.ok(hal, "Hal summoned");
  assert.equal(hal.tamedTo, p.id, "bound to player");
  const z = dim.spawnEntity("minecraft:zombie", { x: hal.location.x + 3, y: 64, z: hal.location.z });
  z.health = 200;
  await tick(160);
  assert.ok(z.damageTaken > 0, "Hal attacked with constructs");
  // summoning another ally sends Hal home
  UI.reset();
  UI.respond({ selection: 4 });
  UI.respond({ selection: 1 }); // John
  world.afterEvents.playerInteractWithEntity.fire({ player: p, target: battery });
  await tick(6);
  assert.equal(hal.isValid, false, "previous ally dismissed");
  assert.ok(dim.getEntities({ type: "glc:john_stewart" })[0]);
  z.remove();
});

await test("Sinestro's uniform turns constructs yellow and strikes inflict fear", async () => {
  clearHardlight();
  for (const e of dim.getEntities({ families: ["glc_lantern"] })) e.remove();
  p.equipment.Chest = new MC.ItemStack("glc:suit_sinestro");
  await tick(25);
  assert.equal(state.rt(p.id).perk, "fear", "fear perk detected");
  reg.commands["glc:recharge"].cb({ sourceEntity: p });
  p.rotation = { x: 5, y: 0 };
  p.location = { x: 0.5, y: 64, z: 0.5 };
  const [z] = spawnZombieRing(1, 5);
  z.health = 200;
  D().selected = "beam";
  state.rt(p.id).cooldowns.beam = 0;
  log.particles.length = 0;
  await useRing(3);
  assert.ok(z.damageTaken > 0, "beam hit");
  assert.ok(z.effects.weakness && z.effects.slowness, "fear: weakness and slowness applied");
  const yellow = log.particles.filter((x) => x.vars && x.vars["variable.color.r"] > 0.9 && x.vars["variable.color.b"] < 0.3);
  assert.ok(yellow.length > 0, "yellow construct energy");
  z.remove();
  delete p.equipment.Chest;
  await tick(25);
  assert.notEqual(state.rt(p.id).perk, "fear", "perk removed with the uniform");
});

await test("talking to an unbound Lantern can recruit them", async () => {
  const kyle = dim.spawnEntity("glc:kyle_rayner", { x: -3, y: 65, z: 0 });
  UI.reset();
  UI.respond({ selection: 0 });
  world.afterEvents.playerInteractWithEntity.fire({ player: p, target: kyle });
  await tick(4);
  assert.equal(kyle.tamedTo, p.id);
});

await test("ring menu, categories, selection and settings work", async () => {
  p.isSneaking = true;
  UI.reset();
  // main menu -> first category button (after quick picks)
  UI.respond((form) => ({ canceled: false, selection: form.buttons.findIndex((b) => b.text.includes("Offensive")) }));
  UI.respond({ selection: 0 }); // first offense construct (beam)
  UI.respond({ selection: 0 }); // make active
  await useRing(6);
  p.isSneaking = false;
  assert.equal(D().selected, "beam");
  UI.reset();
  p.isSneaking = true;
  UI.respond((form) => ({ canceled: false, selection: form.buttons.findIndex((b) => b.text.includes("Settings")) }));
  UI.respond((form) => ({ canceled: false, formValues: form.values({ slider: 2, dropdown: 1, toggle: true }) }));
  await useRing(6);
  p.isSneaking = false;
  assert.equal(D().hud, "text");
  assert.equal(D().flightSpeed, 2);
});

await test("power down / up ring", async () => {
  const menu = await import(S + "ui/menu.js");
  menu.setRingPower(p, false);
  D().selected = "beam";
  state.rt(p.id).cooldowns.beam = 0;
  const e0 = D().energy;
  await useRing(2);
  assert.equal(D().energy, e0, "no casting while powered down");
  menu.setRingPower(p, true);
});

await test("book of Oa opens the guide", async () => {
  UI.reset();
  reg.items["glc:book_of_oa"].onUse({ source: p });
  await tick(3);
  assert.ok(UI.shown.at(-1)._title.includes("Book of Oa"));
  assert.ok(UI.shown.at(-1)._body.includes("brightest day"));
});

await test("/glc:kit gives the starter kit", async () => {
  p.inventory.items.fill(undefined);
  reg.commands["glc:kit"].cb({ sourceEntity: p });
  await tick(2);
  const ids = p.inventory.items.filter(Boolean).map((i) => i.typeId);
  for (const id of ["glc:power_ring", "glc:power_battery", "glc:central_battery", "glc:book_of_oa", "glc:corps_uniform"]) assert.ok(ids.includes(id), id);
});

await test("progress persists across leave/rejoin", async () => {
  const rank = D().rank;
  const xp = D().xp;
  state.flushAll();
  state.dropRuntime(p.id);
  assert.equal(state.data(p).rank, rank);
  assert.equal(state.data(p).xp, xp);
});

await test("orphaned constructs are removed on load", async () => {
  const orphan = dim.spawnEntity("glc:fist", { x: 0, y: 70, z: 0 });
  world.afterEvents.entityLoad.fire({ entity: orphan });
  await tick(2);
  assert.equal(orphan.isValid, false);
});

await test("no particle was spawned without a Corps colour", () => {
  const bad = log.warnings.filter((w) => w.startsWith("particle"));
  assert.equal(bad.length, 0, bad.slice(0, 3).join("; "));
});

// ---------------------------------------------------------------- report
console.warn = origWarn;
let failed = 0;
for (const [name, ok, e] of results) {
  if (ok) process.stdout.write(`  ok   ${name}\n`);
  else {
    failed++;
    process.stdout.write(`  FAIL ${name}\n       ${String(e?.stack ?? e).split("\n").slice(0, 6).join("\n       ")}\n`);
  }
}
process.stdout.write(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);
