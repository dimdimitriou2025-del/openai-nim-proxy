// Tunable constants for the gameplay scripts.  Balance numbers for constructs
// and ranks live in data/game_data.js (generated from tools/content/game_data.py).

export const RING_ID = "glc:power_ring";
export const BOOK_ID = "glc:book_of_oa";
export const BATTERY_BLOCK_ID = "glc:power_battery";
export const CENTRAL_BATTERY_ID = "glc:central_battery";
export const HARDLIGHT_ID = "glc:hardlight";

// --- timing (ticks; 20 ticks = 1 second)
export const HUD_INTERVAL = 10;
export const SCAN_INTERVAL = 20;
export const SAVE_INTERVAL = 100;
export const DOUBLE_TAP_TICKS = 7;

// --- energy
export const LOW_ENERGY_FRACTION = 0.2;
export const OVERCHARGE_DECAY_PER_SECOND = 1.0;
export const BATTERY_OVERCHARGE = 0.25; // personal battery oath bonus (fraction of max)
export const CENTRAL_OVERCHARGE = 0.5;
export const CENTRAL_AURA_RADIUS = 6;
export const CENTRAL_AURA_PER_SECOND = 3;
export const BATTERY_XP = 5;
export const BATTERY_XP_COOLDOWN_TICKS = 2400; // 2 minutes

// --- flight
export const FLIGHT_HOVER_DRAIN = 0.25; // energy per second while hovering
export const FLIGHT_MOVE_DRAIN = 0.6; // energy per second per speed level while moving
export const FLIGHT_SPRINT_BOOST = 1.5;
export const FLIGHT_VERTICAL = 0.55; // blocks/tick when pressing jump (up) / sneak (down)
export const FLIGHT_FEED_FORWARD = 0.7;
export const FLIGHT_FEEDBACK = 0.35;
export const FLIGHT_STRAFE_SIGN = -1; // movement vector x > 0 is treated as "left"
export const FLIGHT_AUTO_LAND_TICKS = 8;
export const SAFE_FALL_TICKS = 80;

// --- performance limits (mobile friendly)
export const PARTICLE_BUDGET_PER_TICK = 70;
export const MAX_ACTIVE_CONSTRUCTS_PER_PLAYER = 6;
export const MAX_ACTIVE_CONSTRUCTS_TOTAL = 40;
export const MAX_ALLIES_PER_PLAYER = 1;

// --- XP
export const XP_KILL_MULTIPLIER = 0.5;
export const XP_KILL_MIN = 3;
export const XP_KILL_MAX = 40;
export const XP_TRAINING_TARGET = 15;
export const TRAINING_DURATION_TICKS = 1200;
export const TRAINING_TARGETS = 6;

// --- hard-light blocks: one life step == 40 ticks (2 s)
export const HARDLIGHT_STEP_SECONDS = 2;
