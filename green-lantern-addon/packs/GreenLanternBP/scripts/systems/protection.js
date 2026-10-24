// Damage protection from flight safety, shields, bubbles and domes.
// world.beforeEvents.entityHurt runs read-only: we only cancel/adjust damage here
// and defer effects (particles, energy) with system.run.
import { EntityDamageCause, system, world } from "@minecraft/server";
import { rt } from "../core/state.js";
import { domesCovering } from "../constructs/defense.js";
import { particle } from "../lib/fx.js";

const UNBLOCKABLE = new Set([EntityDamageCause.void, EntityDamageCause.selfDestruct, EntityDamageCause.starve,
  EntityDamageCause.override]);
const ATTACKS = new Set([EntityDamageCause.entityAttack, EntityDamageCause.projectile, EntityDamageCause.entityExplosion,
  EntityDamageCause.magic, EntityDamageCause.sonicBoom, EntityDamageCause.ramAttack, EntityDamageCause.thorns,
  EntityDamageCause.wither, EntityDamageCause.fireworks, EntityDamageCause.maceSmash, EntityDamageCause.charging]);

function protectable(e) {
  return e.typeId === "minecraft:player" || (e.typeId.startsWith("glc:") && e.typeId !== "glc:sinestro" &&
    e.typeId !== "glc:training_target");
}

world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (!protectable(e)) return;
  const cause = ev.damageSource.cause;
  if (UNBLOCKABLE.has(cause)) return;
  const r = rt(e.id);
  const now = system.currentTick;

  // flight / grapple safety
  if ((cause === EntityDamageCause.fall || cause === EntityDamageCause.flyIntoWall) && (r.flying || now < r.safeFallUntil)) {
    ev.cancel = true;
    return;
  }

  // protective bubble absorbs everything up to its pool
  const bubble = r.bubble;
  if (bubble && !bubble.finished && bubble.pool > 0) {
    ev.cancel = true;
    const amount = ev.damage;
    system.run(() => bubble.absorb(amount));
    return;
  }

  if (!ATTACKS.has(cause)) return;
  const src = ev.damageSource.damagingProjectile ?? ev.damageSource.damagingEntity;

  // directional shield
  const shield = r.shield;
  if (shield && !shield.finished && src) {
    let from;
    try {
      from = src.location;
    } catch {
      from = undefined;
    }
    if (from && shield.covers(from)) {
      ev.cancel = true;
      system.run(() => shield.onBlocked(from));
      return;
    }
  }

  // domes: attacks from outside (or by hostiles) can't reach those inside
  let loc;
  try {
    loc = e.location;
  } catch {
    return;
  }
  const domes = domesCovering(loc);
  if (domes.length) {
    ev.cancel = true;
    const d = domes[0];
    system.run(() => particle(d.ctx.dim, "glc:shield_hit", { x: loc.x, y: loc.y + 1, z: loc.z }, d.ctx.corps));
  }
});
