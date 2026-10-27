// Every tunable gameplay, layout and timing value lives here.
//
// Units: the game runs in the original 288x512 logical space ("game px") at a
// fixed 60 simulation ticks per second. Velocities are px/tick and
// accelerations px/tick^2, exactly like the original's per-frame integer
// world. Art is authored at half resolution (1 art px = 2 game px).
//
// Provenance tags:
//   [RE]   taken from the decompiled Android v1.3 game logic (GameScene)
//   [VID]  derived from frame-by-frame video analysis of the original
//   [OBS]  estimated from screenshots / footage of the original
//   [EST]  no reliable reference found; best estimate, tune freely
(function (FB) {
  'use strict';

  FB.CONFIG = Object.freeze({
    // ---- Screen -----------------------------------------------------------
    WIDTH: 288, // [RE] VIRTUAL_WIDTH
    HEIGHT: 512, // [RE] VIRTUAL_HEIGHT
    ART_SCALE: 2, // game px per art px
    TICK_RATE: 60, // [RE] fixed-step logic, 60 Hz like the original
    MAX_FRAME_TIME: 0.25, // s; longer frames are clamped (tab stalls)

    // ---- World ------------------------------------------------------------
    GROUND_Y: 400, // [RE] 512 * 0.78125, top of the land strip
    WORLD_SPEED: 2, // [RE] px/tick for pipes and land (120 px/s)
    LAND_WIDTH: 336, // [RE] land tile width, wraps every 336 px

    // ---- Pipes ------------------------------------------------------------
    PIPE_WIDTH: 52, // [RE]
    PIPE_HEIGHT: 320, // [RE] sprite length
    PIPE_GAP: 100, // [RE] vertical opening
    PIPE_SPAWN_INTERVAL: 90, // [RE] ticks between pairs => 180 px spacing
    PIPE_SPAWN_X: 340, // [RE] WIDTH + PIPE_WIDTH (left edge)
    PIPE_GAP_CENTER_MIN: 100, // [RE] GROUND_Y / 4
    PIPE_GAP_CENTER_MAX: 300, // [RE] GROUND_Y - GROUND_Y / 4
    MAX_PIPES: 4, // [RE]

    // ---- Bird physics -----------------------------------------------------
    BIRD_X: 57, // [RE] WIDTH / 5, bird centre
    BIRD_START_Y: 256, // [RE] HEIGHT / 2, bird centre
    GRAVITY: 0.375, // [VID] px/tick^2 (1350 px/s^2)
    FLAP_VELOCITY: -5.1, // [VID] px/tick; a flap SETS velocity (306 px/s up)
    MAX_FALL_SPEED: 10, // [EST] px/tick terminal velocity (600 px/s)

    // ---- Collision (bird centre based) -------------------------------------
    HITBOX_HALF_W: 7, // [RE] bird box vs pipes is 14 x 16 around the centre
    HITBOX_HALF_H: 8, // [RE]
    GROUND_CONTACT: 10, // [RE] dies when centre + 10 >= GROUND_Y
    CEILING_KILLS: true, // [RE] centre - 10 < 0 also ends the run
    CEILING_CONTACT: 10, // [RE]

    // ---- Bird rotation (degrees, positive = nose down) ---------------------
    ROT_FLAP: -20, // [OBS] snap angle on every flap
    ROT_DIVE_START_VELOCITY: 2, // [OBS] start nosing down once falling this fast
    ROT_DIVE_SPEED: 6, // [OBS] deg/tick while diving
    ROT_DEATH_SPEED: 8, // [OBS] deg/tick after a collision
    ROT_MAX: 90, // [OBS] straight down

    // ---- Bird animation -----------------------------------------------------
    WING_FRAME_TICKS: 5, // [OBS] ticks per wing frame
    WING_SEQUENCE: [0, 1, 2, 1], // up, mid, down, mid
    BOB_AMPLITUDE: 4, // [OBS] px, idle hover on title / get ready
    BOB_PERIOD_TICKS: 54, // [OBS]

    // ---- Death / game over sequence (ticks) --------------------------------
    FLASH_TICKS: 24, // [RE] white flash fades out over 0.4 s
    DIE_SOUND_DELAY: 12, // [EST] "die" swoop follows the "hit" smack
    FADE_TICKS: 14, // [OBS] black fade between screens, each direction
    READY_FADE_TICKS: 12, // [OBS] Get Ready + tutorial fade when play starts
    GAMEOVER_TEXT_TICKS: 14, // [OBS] "Game Over" drop-in
    GAMEOVER_TEXT_DROP: 10, // [OBS] px it falls while fading in
    PANEL_DELAY: 36, // [OBS] ticks after landing before the panel moves
    PANEL_SLIDE_TICKS: 24, // [OBS] panel slides up from below the screen
    COUNT_MAX_TICKS: 48, // [EST] score count-up never takes longer than this
    BUTTONS_DELAY: 6, // [OBS] ticks after count-up before buttons appear
    BUTTON_GUARD_TICKS: 10, // [EST] buttons ignore input briefly after appearing
    SPARKLE_TICKS: 18, // [OBS] lifetime of one medal glint

    // ---- Medals --------------------------------------------------------------
    MEDALS: [
      // [RE] thresholds, highest first
      { min: 40, name: 'platinum' },
      { min: 30, name: 'gold' },
      { min: 20, name: 'silver' },
      { min: 10, name: 'bronze' },
    ],

    // ---- Layout (game px, centres unless noted) -------------------------------
    LAYOUT: {
      TITLE_LOGO_Y: 128,
      TITLE_BIRD_X: 144,
      TITLE_BIRD_Y: 204,
      PLAY_BUTTON_Y: 358, // [RE] 0.70 * HEIGHT
      BUTTON_W: 116,
      BUTTON_H: 66,
      BUTTON_PRESS_OFFSET: 2, // px a held button sinks
      SCORE_TOP: 30, // [RE] 0.059 * HEIGHT
      READY_TEXT_Y: 146,
      TUTORIAL_Y: 273, // ghost bird level with the real bird at y = 256
      GAMEOVER_TEXT_Y: 128,
      PANEL_Y: 236,
    },

    STORAGE_KEY: 'flappy-recreation-best',
  });
})((globalThis.FB = globalThis.FB || {}));
