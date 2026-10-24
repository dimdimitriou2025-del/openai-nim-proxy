// Ring flight for touch screens: double-tap jump (or the menu) to toggle,
// push the joystick to fly where you look, hold jump to climb, release to hover.
import { ButtonState, GameMode, InputButton, system, world } from "@minecraft/server";
import { FLIGHT_SPEEDS } from "../data/game_data.js";
import { data, rt, save } from "../core/state.js";
import { corpsOf, perkOf, rankDef, ringSay, spendEnergy, toast } from "../core/lantern.js";
import {
  DOUBLE_TAP_TICKS, FLIGHT_AUTO_LAND_TICKS, FLIGHT_FEEDBACK, FLIGHT_FEED_FORWARD, FLIGHT_HOVER_DRAIN,
  FLIGHT_MOVE_DRAIN, FLIGHT_SPRINT_BOOST, FLIGHT_STRAFE_SIGN, FLIGHT_VERTICAL, SAFE_FALL_TICKS,
} from "../config.js";
import { particle, playerSound, sound } from "../lib/fx.js";
import { flightPose } from "../lib/poses.js";
import { add, clamp, len, mul, rightFromYaw, v3 } from "../lib/vec.js";

/** Highest speed level the player's rank allows (1-3). */
export function flightTier(player) {
  return rankDef(data(player)).flightTier;
}

export function canFly(player) {
  const d = data(player);
  const r = rt(player.id);
  return d.sworn && d.ringOn && r.carried;
}

/** @param {import("@minecraft/server").Player} player */
export function startFlight(player, quiet = false) {
  const r = rt(player.id);
  if (r.flying) return true;
  if (!canFly(player)) {
    if (!quiet) toast(player, "§7Carry your sworn Power Ring (hotbar or off-hand) to fly.");
    return false;
  }
  if (data(player).energy + data(player).over < 1) {
    if (!quiet) toast(player, "§cNot enough ring energy to fly.");
    return false;
  }
  r.flying = true;
  r.hoverY = player.location.y + 0.6;
  r.groundTicks = 0;
  r.safeFallUntil = system.currentTick + SAFE_FALL_TICKS;
  try {
    player.applyKnockback({ x: 0, z: 0 }, 0.6);
  } catch {
    // ignore
  }
  sound(player.dimension, "glc.flight_start", player.location, 0.9);
  flightPose(player, true);
  particle(player.dimension, "glc:ring_burst", add(player.location, v3(0, 0.2, 0)), corpsOf(player));
  if (!quiet) toast(player, "§aFlight ON §7- joystick to fly where you look, jump to climb, double-jump to land", 60);
  return true;
}

/** @param {import("@minecraft/server").Player} player */
export function stopFlight(player, reason = "") {
  const r = rt(player.id);
  if (!r.flying) return;
  r.flying = false;
  r.safeFallUntil = system.currentTick + SAFE_FALL_TICKS;
  sound(player.dimension, "glc.flight_stop", player.location, 0.8);
  flightPose(player, false);
  if (reason) toast(player, reason, 50);
}

export function toggleFlight(player) {
  if (rt(player.id).flying) stopFlight(player, "§7Flight OFF");
  else startFlight(player);
}

// double-tap jump toggles flight (not in creative, where it toggles vanilla flight)
world.afterEvents.playerButtonInput.subscribe((ev) => {
  if (ev.button !== InputButton.Jump || ev.newButtonState !== ButtonState.Pressed) return;
  const p = ev.player;
  const r = rt(p.id);
  const now = system.currentTick;
  if (now - r.lastJumpPress <= DOUBLE_TAP_TICKS) {
    r.lastJumpPress = -100;
    try {
      const gm = p.getGameMode();
      if (gm === GameMode.Creative || gm === GameMode.Spectator) return;
    } catch {
      return;
    }
    if (!canFly(p)) return;
    toggleFlight(p);
  } else {
    r.lastJumpPress = now;
  }
});

/**
 * Per-tick flight controller. Works whether applyKnockback replaces or adds to
 * velocity: feed-forward + velocity feedback while moving, altitude hold while hovering.
 * @param {import("@minecraft/server").Player} player
 */
export function flightTick(player, tick) {
  const r = rt(player.id);
  if (!r.flying) return;
  if (!canFly(player)) {
    stopFlight(player, "§7Flight ended - ring not equipped");
    return;
  }
  const d = data(player);
  let move;
  let jumping = false;
  try {
    move = player.inputInfo.getMovementVector();
    jumping = player.inputInfo.getButtonState(InputButton.Jump) === ButtonState.Pressed || player.isJumping;
  } catch {
    move = { x: 0, y: 0 };
  }
  const sneaking = player.isSneaking;
  const view = player.getViewDirection();
  const yaw = player.getRotation().y;
  const right = rightFromYaw(yaw);
  const level = clamp(d.flightSpeed, 1, flightTier(player));
  let speed = FLIGHT_SPEEDS[level - 1] * (player.isSprinting ? FLIGHT_SPRINT_BOOST : 1);
  if (perkOf(player) === "flight") speed *= 1.2;

  let want = add(mul(view, move.y), mul(right, move.x * FLIGHT_STRAFE_SIGN));
  const moving = len(want) > 0.12;
  const vel = player.getVelocity();
  const loc = player.location;
  let k;
  if (moving) {
    want = mul(want, speed / Math.max(1, len(want)));
    if (jumping) want.y += FLIGHT_VERTICAL;
    if (sneaking) want.y -= FLIGHT_VERTICAL;
    k = {
      x: want.x * FLIGHT_FEED_FORWARD + (want.x - vel.x) * FLIGHT_FEEDBACK,
      y: want.y * FLIGHT_FEED_FORWARD + (want.y - vel.y) * FLIGHT_FEEDBACK + 0.04,
      z: want.z * FLIGHT_FEED_FORWARD + (want.z - vel.z) * FLIGHT_FEEDBACK,
    };
    r.hoverY = loc.y;
  } else {
    if (jumping) r.hoverY = loc.y + FLIGHT_VERTICAL * 2;
    else if (sneaking) r.hoverY = loc.y - FLIGHT_VERTICAL * 2;
    k = {
      x: -vel.x * 0.45,
      y: clamp((r.hoverY - loc.y) * 0.35, -0.45, 0.45) + 0.035,
      z: -vel.z * 0.45,
    };
  }
  try {
    player.applyKnockback({ x: k.x, z: k.z }, k.y);
  } catch {
    // ignore
  }
  r.safeFallUntil = tick + SAFE_FALL_TICKS;

  // emerald trail
  if (moving && tick % 2 === 0) particle(player.dimension, "glc:trail", add(loc, v3(0, 0.5, 0)), corpsOf(player));
  else if (!moving && tick % 8 === 0) particle(player.dimension, "glc:aura", add(loc, v3(0, 0.1, 0)), corpsOf(player), { radius: 0.5 });

  // energy drain once per second
  if (tick % 20 === 0) {
    let drain = moving ? FLIGHT_MOVE_DRAIN * level : FLIGHT_HOVER_DRAIN;
    if (perkOf(player) === "flight") drain *= 0.6;
    if (!spendEnergy(player, drain, true)) {
      stopFlight(player, "§cRing energy depleted - flight failing!");
      try {
        player.addEffect("slow_falling", 120, { amplifier: 0, showParticles: false });
      } catch {
        // ignore
      }
      ringSay(player, "§cInsufficient power for flight.");
    }
  }

  // automatic landing
  if (d.autoLand && player.isOnGround && !moving && !jumping) {
    r.groundTicks++;
    if (r.groundTicks >= FLIGHT_AUTO_LAND_TICKS) stopFlight(player, "§7Landed");
  } else {
    r.groundTicks = 0;
  }
}

export function setFlightSpeed(player, level) {
  const d = data(player);
  d.flightSpeed = clamp(Math.round(level), 1, flightTier(player));
  save(player);
  playerSound(player, "glc.menu_select");
}
