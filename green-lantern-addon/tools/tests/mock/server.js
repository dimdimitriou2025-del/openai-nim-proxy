// Minimal behavioural mock of @minecraft/server (2.6.0 subset used by the add-on)
// for running the real scripts in Node.  Not a game simulation - just enough
// world/entity/block behaviour to exercise every code path and catch runtime errors.

export const log = { particles: [], sounds: [], commands: [], messages: [], actionbars: [], titles: [], warnings: [] };

// ------------------------------------------------------------------ enums
export const EntityDamageCause = Object.fromEntries(["anvil", "blockExplosion", "campfire", "charging", "contact",
  "drowning", "entityAttack", "entityExplosion", "fall", "fallingBlock", "fire", "fireTick", "fireworks", "flyIntoWall",
  "freezing", "lava", "lightning", "maceSmash", "magic", "magma", "none", "override", "piston", "projectile",
  "ramAttack", "selfDestruct", "sonicBoom", "soulCampfire", "stalactite", "stalagmite", "starve", "suffocation",
  "temperature", "thorns", "void", "wither"].map((k) => [k, k]));
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const InputButton = { Jump: "Jump", Sneak: "Sneak" };
export const ButtonState = { Pressed: "Pressed", Released: "Released" };
export const GameMode = { Adventure: "Adventure", Creative: "Creative", Spectator: "Spectator", Survival: "Survival" };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandParamType = { Integer: "Integer", String: "String", Boolean: "Boolean", Float: "Float" };
export const CustomCommandStatus = { Success: 0, Failure: 1 };

// ------------------------------------------------------------------ scheduler
const queue = [];
let runId = 1;
export const system = {
  currentTick: 0,
  run(fn) { const id = runId++; queue.push({ id, at: this.currentTick + 1, fn }); return id; },
  runTimeout(fn, t = 1) { const id = runId++; queue.push({ id, at: this.currentTick + Math.max(1, t), fn }); return id; },
  runInterval(fn, t = 1) { const id = runId++; queue.push({ id, at: this.currentTick + t, fn, every: t }); return id; },
  clearRun(id) { const i = queue.findIndex((q) => q.id === id); if (i >= 0) queue.splice(i, 1); else cleared.add(id); },
  waitTicks(n) { return new Promise((res) => this.runTimeout(res, Math.max(1, n))); },
  beforeEvents: { startup: signal(), shutdown: signal() },
  afterEvents: { scriptEventReceive: signal() },
};
const cleared = new Set();

export async function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    system.currentTick++;
    const due = queue.filter((q) => q.at <= system.currentTick).sort((a, b) => a.id - b.id);
    for (const q of due) {
      if (q.every) q.at = system.currentTick + q.every;
      else queue.splice(queue.indexOf(q), 1);
      q.fn();
      if (cleared.has(q.id) && q.every) { queue.splice(queue.indexOf(q), 1); cleared.delete(q.id); }
    }
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
  }
}

function signal() {
  const handlers = [];
  return {
    handlers,
    subscribe(fn) { handlers.push(fn); return fn; },
    unsubscribe(fn) { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); },
    fire(ev) { for (const h of [...handlers]) h(ev); return ev; },
  };
}

// ------------------------------------------------------------------ world
const afterNames = ["entityDie", "entityLoad", "entityHurt", "playerLeave", "playerSpawn", "playerButtonInput",
  "playerInteractWithEntity", "projectileHitEntity", "projectileHitBlock", "worldLoad", "itemUse"];
const beforeNames = ["entityHurt", "playerLeave", "itemUse"];
const entities = new Map();
let nextId = 1;

export const world = {
  afterEvents: Object.fromEntries(afterNames.map((n) => [n, signal()])),
  beforeEvents: Object.fromEntries(beforeNames.map((n) => [n, signal()])),
  gameRules: { pvp: false },
  getAllPlayers() { return [...entities.values()].filter((e) => e.typeId === "minecraft:player" && e.isValid); },
  getDimension(id) { return dims[id.replace("minecraft:", "")] ?? dims.overworld; },
  getEntity(id) { const e = entities.get(id); return e && e.isValid ? e : undefined; },
  _entities: entities,
};

// ------------------------------------------------------------------ blocks
export class BlockPermutation {
  constructor(type, states = {}) { this.type = { id: type }; this.states = states; }
  static resolve(type, states = {}) { return new BlockPermutation(type, { ...states }); }
  getState(k) { return this.states[k]; }
  withState(k, v) { return new BlockPermutation(this.type.id, { ...this.states, [k]: v }); }
}

class Block {
  constructor(dim, location) { this.dimension = dim; this.location = location; }
  get key() { return `${this.location.x},${this.location.y},${this.location.z}`; }
  get permutation() { return this.dimension._blocks.get(this.key) ?? new BlockPermutation(this.location.y <= 63 ? "minecraft:stone" : "minecraft:air"); }
  get typeId() { return this.permutation.type.id; }
  get isAir() { return this.typeId === "minecraft:air"; }
  get isLiquid() { return this.typeId.includes("water") || this.typeId.includes("lava"); }
  get isValid() { return true; }
  setPermutation(p) { this.dimension._blocks.set(this.key, p); }
  setType(t) { this.dimension._blocks.set(this.key, new BlockPermutation(t)); }
}

const fl = (v) => ({ x: Math.floor(v.x), y: Math.floor(v.y), z: Math.floor(v.z) });

class Dimension {
  constructor(id) { this.id = `minecraft:${id}`; this._blocks = new Map(); }
  getBlock(loc) { return new Block(this, fl(loc)); }
  getBlockFromRay(from, dir, opts = {}) {
    const max = opts.maxDistance ?? 64;
    for (let d = 0; d <= max; d += 0.25) {
      const p = { x: from.x + dir.x * d, y: from.y + dir.y * d, z: from.z + dir.z * d };
      const b = this.getBlock(p);
      if (!b.isAir && !b.isLiquid) return { block: b, face: "Up", faceLocation: { x: p.x - b.location.x, y: p.y - b.location.y, z: p.z - b.location.z } };
    }
    return undefined;
  }
  getBlockBelow(loc, opts = {}) {
    for (let d = 0; d <= (opts.maxDistance ?? 64); d++) {
      const b = this.getBlock({ x: loc.x, y: loc.y - d, z: loc.z });
      if (!b.isAir) return b;
    }
    return undefined;
  }
  spawnEntity(type, loc, opts = {}) {
    if (type === "glc:__fail") throw new Error("spawn failed");
    const e = type === "minecraft:player" ? new Player(this, loc) : new Entity(type, this, loc);
    if (opts.initialRotation !== undefined) e.rotation.y = opts.initialRotation;
    return e;
  }
  spawnItem(item, loc) { const e = new Entity("minecraft:item", this, loc); e.item = item; return e; }
  spawnParticle(id, loc, vars) {
    if (!vars || !vars.data["variable.color.r"] && vars.data["variable.color.r"] !== 0) log.warnings.push(`particle ${id} without colour`);
    log.particles.push({ id, loc, vars: vars?.data });
  }
  playSound(id, loc, opts) { log.sounds.push({ id, loc, opts }); }
  getEntities(opts = {}) {
    return [...entities.values()].filter((e) => e.isValid && e.dimension === this && e.matches(opts));
  }
  getPlayers(opts = {}) { return this.getEntities({ ...opts, type: "minecraft:player" }); }
  getEntitiesFromRay() { return []; }
  runCommand(cmd) {
    log.commands.push(cmd);
    const m = cmd.match(/^setblock (-?\d+) (-?\d+) (-?\d+) air destroy$/);
    if (m) this.getBlock({ x: +m[1], y: +m[2], z: +m[3] }).setType("minecraft:air");
    return { successCount: 1 };
  }
}
const dims = { overworld: new Dimension("overworld"), nether: new Dimension("nether"), the_end: new Dimension("the_end") };

// ------------------------------------------------------------------ items
export class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId.includes(":") ? typeId : `minecraft:${typeId}`; this.amount = amount; this.lore = []; }
  setLore(l) { this.lore = l ?? []; }
  getLore() { return this.lore; }
}

class Container {
  constructor(size) { this.size = size; this.items = new Array(size).fill(undefined); }
  getItem(i) { return this.items[i]; }
  setItem(i, it) { this.items[i] = it; }
  addItem(it) { const i = this.items.findIndex((x) => !x); if (i < 0) return it; this.items[i] = it; return undefined; }
}

export class MolangVariableMap {
  constructor() { this.data = {}; }
  setColorRGB(n, c) { this.data[`${n}.r`] = c.red; this.data[`${n}.g`] = c.green; this.data[`${n}.b`] = c.blue; }
  setColorRGBA(n, c) { this.setColorRGB(n, c); this.data[`${n}.a`] = c.alpha; }
  setFloat(n, v) { if (!Number.isFinite(v)) throw new Error(`non-finite molang ${n}`); this.data[n] = v; }
  setSpeedAndDirection(n, s, d) {
    if (![s, d.x, d.y, d.z].every(Number.isFinite)) throw new Error(`non-finite molang ${n}`);
    Object.assign(this.data, { [`${n}.speed`]: s, [`${n}.direction_x`]: d.x, [`${n}.direction_y`]: d.y, [`${n}.direction_z`]: d.z });
  }
  setVector3(n, v) { Object.assign(this.data, { [`${n}.x`]: v.x, [`${n}.y`]: v.y, [`${n}.z`]: v.z }); }
}

// ------------------------------------------------------------------ entities
const FAMILIES = {
  "minecraft:zombie": ["zombie", "undead", "monster", "mob"],
  "minecraft:skeleton": ["skeleton", "undead", "monster", "mob"],
  "minecraft:cow": ["cow", "mob"],
  "minecraft:villager_v2": ["villager", "mob"],
  "minecraft:player": ["player"],
  "minecraft:arrow": ["arrow"],
  "minecraft:item": ["item"],
  "glc:energy_bolt": ["glc_projectile", "projectile"],
  "glc:missile": ["glc_projectile", "projectile"],
  "glc:central_battery": ["glc_battery", "inanimate"],
  "glc:training_target": ["glc_training", "inanimate"],
  "glc:hal_jordan": ["glc_lantern", "lantern_green", "mob"],
  "glc:john_stewart": ["glc_lantern", "lantern_green", "mob"],
  "glc:guy_gardner": ["glc_lantern", "lantern_green", "mob"],
  "glc:kyle_rayner": ["glc_lantern", "lantern_green", "mob"],
  "glc:sinestro": ["glc_lantern", "lantern_yellow", "mob"],
};
const PROPS = {
  construct: { "glc:state": 0, "glc:corps": 0, "glc:size": 1, "glc:pitch": 0 },
  projectile: { "glc:corps": 0 },
  lantern: { "glc:casting": false },
};

export class Entity {
  constructor(typeId, dim, loc) {
    this.id = String(nextId++);
    this.typeId = typeId;
    this.dimension = dim;
    this.location = { ...loc };
    this.rotation = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.valid = true;
    this.health = typeId.startsWith("glc:") && !this.isLantern() && typeId !== "glc:training_target" ? 1000 : 20;
    if (this.isLantern()) this.health = 60;
    this.maxHealth = this.health;
    this.families = FAMILIES[typeId] ?? (typeId.startsWith("glc:") ? ["glc_construct", "inanimate"] : ["mob"]);
    const kind = this.families.includes("glc_construct") ? "construct" : this.families.includes("glc_projectile") ? "projectile" : this.isLantern() ? "lantern" : null;
    this.props = kind ? { ...PROPS[kind] } : {};
    this.dyn = {};
    this.effects = {};
    this.damageTaken = 0;
    this.knockbacks = [];
    this.nameTag = "";
    this.isSneaking = false;
    this.tamedTo = undefined;
    this.projectile = this.families.includes("projectile") || typeId === "minecraft:arrow" ? { owner: undefined, shots: [], shoot(v) { this.shots.push(v); } } : undefined;
    entities.set(this.id, this);
  }
  isLantern() { return ["glc:hal_jordan", "glc:john_stewart", "glc:guy_gardner", "glc:kyle_rayner", "glc:sinestro"].includes(this.typeId); }
  get isValid() { return this.valid; }
  get isOnGround() { return this.dimension.getBlock({ x: this.location.x, y: this.location.y - 0.01, z: this.location.z }).isAir === false; }
  matches(o = {}) {
    if (o.type && this.typeId !== o.type) return false;
    if (o.families && !o.families.every((f) => this.families.includes(f))) return false;
    if (o.excludeFamilies && o.excludeFamilies.some((f) => this.families.includes(f))) return false;
    if (o.location && o.maxDistance !== undefined) {
      const dx = this.location.x - o.location.x, dy = this.location.y - o.location.y, dz = this.location.z - o.location.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) > o.maxDistance) return false;
    }
    return true;
  }
  _check() { if (!this.valid) throw new Error(`InvalidEntityError ${this.typeId}`); }
  getProperty(k) { this._check(); return this.props[k]; }
  setProperty(k, v) {
    this._check();
    if (!(k in this.props)) throw new Error(`property ${k} not defined on ${this.typeId}`);
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error(`non-finite property ${k}`);
    this.props[k] = v;
  }
  teleport(loc, opts) {
    this._check();
    if (![loc.x, loc.y, loc.z].every(Number.isFinite)) throw new Error("teleport to NaN");
    this.location = { ...loc };
    if (opts?.rotation) this.rotation = { ...opts.rotation };
  }
  remove() { this._check(); this.valid = false; }
  kill() { this.health = 0; this._die(undefined); return true; }
  getHeadLocation() { return { x: this.location.x, y: this.location.y + 1.62, z: this.location.z }; }
  getViewDirection() { const r = (this.rotation.y * Math.PI) / 180, p = (this.rotation.x * Math.PI) / 180; return { x: -Math.sin(r) * Math.cos(p), y: -Math.sin(p), z: Math.cos(r) * Math.cos(p) }; }
  getRotation() { return { ...this.rotation }; }
  getVelocity() { return { ...this.velocity }; }
  clearVelocity() { this.velocity = { x: 0, y: 0, z: 0 }; }
  applyImpulse(v) { if (this.typeId === "minecraft:player") throw new Error("applyImpulse on player"); this.velocity = { x: this.velocity.x + v.x, y: this.velocity.y + v.y, z: this.velocity.z + v.z }; }
  applyKnockback(h, v) {
    this._check();
    if (typeof h !== "object" || !Number.isFinite(h.x) || !Number.isFinite(h.z) || !Number.isFinite(v)) throw new Error("bad knockback args");
    this.knockbacks.push({ ...h, v });
    this.velocity = { x: h.x, y: v, z: h.z };
  }
  applyDamage(amount, opts) {
    this._check();
    if (!Number.isFinite(amount)) throw new Error("NaN damage");
    if (opts?.damagingEntity && !opts.damagingEntity.isValid) throw new Error("invalid damaging entity");
    if (this.families.includes("glc_construct") || this.typeId === "glc:central_battery") return false;
    this.damageTaken += amount;
    this.health -= amount;
    if (this.health <= 0) this._die(opts);
    return true;
  }
  _die(opts) {
    world.afterEvents.entityDie.fire({ deadEntity: this, damageSource: { cause: opts?.cause ?? "none", damagingEntity: opts?.damagingEntity } });
    this.valid = false;
  }
  addEffect(id, dur, opts) { this.effects[id] = { dur, ...opts }; return {}; }
  removeEffect(id) { delete this.effects[id]; return true; }
  triggerEvent(ev) { if (ev === "glc:despawn") this.valid = false; }
  setDynamicProperty(k, v) { if (typeof v === "string" && v.length > 32767) throw new Error("dynamic property too long"); this.dyn[k] = v; }
  getDynamicProperty(k) { return this.dyn[k]; }
  hasComponent(c) { return !!this.getComponent(c); }
  getComponent(c) {
    this._check();
    const self = this;
    if (c === "minecraft:health") return { get currentValue() { return self.health; }, effectiveMax: self.maxHealth, setCurrentValue(v) { self.health = v; return true; } };
    if (c === "minecraft:projectile") return this.projectile;
    if (c === "minecraft:tameable" && this.isLantern()) return { tame(p) { self.tamedTo = p.id; return true; } };
    if (c === "minecraft:is_tamed") return this.tamedTo ? {} : undefined;
    return undefined;
  }
  runCommand(cmd) { log.commands.push(cmd); return { successCount: 1 }; }
}

export class Player extends Entity {
  constructor(dim, loc) {
    super("minecraft:player", dim, loc);
    this.name = `Steve${this.id}`;
    this.health = 20;
    this.isJumping = false;
    this.isSprinting = false;
    this.gameMode = GameMode.Survival;
    this.move = { x: 0, y: 0 };
    this.jumpButton = ButtonState.Released;
    this.inventory = new Container(36);
    this.equipment = {};
    const self = this;
    this.inputInfo = { getMovementVector() { return { ...self.move }; }, getButtonState(b) { return b === "Jump" ? self.jumpButton : ButtonState.Released; } };
    this.onScreenDisplay = { setActionBar(t) { log.actionbars.push(t); }, setTitle(t, o) { log.titles.push({ t, o }); } };
    this.camera = { fade(o) { log.commands.push(`fade ${JSON.stringify(o)}`); } };
  }
  sendMessage(m) { log.messages.push(m); }
  playSound(id, o) { log.sounds.push({ id, o, player: this.name }); }
  getGameMode() { return this.gameMode; }
  getComponent(c) {
    if (c === "minecraft:inventory") return { container: this.inventory };
    if (c === "minecraft:equippable") {
      const self = this;
      return {
        getEquipment(s) { return s === "Mainhand" ? self.inventory.getItem(0) : self.equipment[s]; },
        setEquipment(s, it) { if (s === "Mainhand") self.inventory.setItem(0, it); else self.equipment[s] = it; return true; },
      };
    }
    return super.getComponent(c);
  }
}

export function resetWorld() {
  entities.clear();
  for (const d of Object.values(dims)) d._blocks.clear();
  for (const k of Object.keys(log)) log[k].length = 0;
}
