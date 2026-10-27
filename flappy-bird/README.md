# Flappy Bird (2013) recreation

A browser recreation of the original 2013 mobile game Flappy Bird, built to
play like the original as closely as the available evidence allows. It uses
plain HTML5 canvas and JavaScript, needs no build step and has no runtime
dependencies. All art and sound is drawn or synthesised in code; no original
assets are used.

## Run it

- **Quickest:** open `index.html` in any modern browser (works from `file://`).
- **On a phone, or over HTTP:** `node serve.js` (or `npm start`), then open the
  printed URL. Use the "on your network" address from a phone on the same Wi-Fi.

### Controls

| Action | Input |
| --- | --- |
| Flap / start | tap, click, <kbd>Space</kbd>, <kbd>↑</kbd>, <kbd>W</kbd>, <kbd>Enter</kbd> |
| PLAY button (title, game over) | tap/click the button, or any of the keys above |
| Mute / unmute | <kbd>M</kbd> |
| Show hitboxes | open `index.html?debug` |

The flow is the original's: title → PLAY → Get Ready → first tap flaps →
crash → Game Over → score panel → PLAY → Get Ready. The best score is kept in
`localStorage`.

## Files

| File | Responsibility |
| --- | --- |
| `js/config.js` | **every tunable value** (physics, pipes, hitbox, timings, layout) |
| `js/bird.js` | bird physics, rotation, wing animation |
| `js/pipes.js` | pipe spawning, scrolling, recycling |
| `js/collision.js` | bird vs upper pipe / lower pipe / ground / ceiling |
| `js/game.js` | state machine, scoring, death sequence, game over, restart, best score |
| `js/loop.js` | fixed 60 Hz timestep driver with render interpolation |
| `js/pixels.js`, `js/font.js`, `js/sprites.js` | procedural pixel art and bitmap fonts (the asset layer) |
| `js/render.js` | canvas scaling (DPR aware, letterboxed 9:16) and drawing |
| `js/audio.js` | Web Audio synthesis of the five sound cues |
| `js/input.js` | pointer/touch/keyboard input, blocks page scroll and zoom |
| `js/main.js` | wiring and the `requestAnimationFrame` loop |
| `serve.js` | tiny static server for LAN/phone testing |
| `tests/` | headless sim tests, Playwright browser tests, screenshot script |

The simulation files (`bird`, `pipes`, `collision`, `game`, `loop`) never touch
the DOM, so the game runs headless in Node for testing.

To use authorised replacement artwork, make `FB.buildSprites()` in
`js/sprites.js` return images of the same sizes (art is half-resolution: a
34×24 bird is a 17×12 image). Nothing else needs to change.

## Tests

```sh
node --test tests/sim.test.js       # 21 simulation tests, no dependencies
node --test tests/browser.test.js   # 9 real-browser tests (needs Playwright + Chromium)
node tests/screens.js [outDir]      # screenshots of every state
```

The simulation tests check:

- the flap sets the velocity rather than adding to it
- the flap arc (apex after 13 ticks, about 32 px high)
- constant gravity and the terminal velocity
- rotation and the wings freezing in a nose dive
- pipe spacing, gap size and gap range
- exactly one point per pair, awarded on the crossing tick
- all four collision types
- ground and pipe deaths, including the sounds, the frozen world and no points after death
- the game-over sequence and the button guard
- restart resetting everything with no extra flap
- determinism
- identical tick-by-tick runs at 30, 60, 75, 120, 144 and 240 Hz with timestamp jitter
- 60 Hz frames getting exactly one tick each
- clamping of long frame stalls
- a look-ahead autopilot clearing 150 pipes on each of six seeds, which proves the random courses are always passable
- the sound synthesis

The browser tests run in Chromium. They drive real mouse, keyboard and touch
input on desktop and phone viewports and check:

- the ~60 ticks/s real-time loop
- no page scroll or zoom
- 9:16 scaling and the DPR-aware backing store across window sizes
- audio unlocking and every sound cue
- mute
- the full crash → game over → PLAY → restart cycle
- the best score surviving a reload

## Fidelity: parameters and where they come from

All values are in the original 288×512 logical space at 60 ticks/s (the
original's frame-locked world). Tags match the comments in `js/config.js`:

- **RE** comes from the decompiled game logic of the Android v1.3 release
  (`GameScene` in the SSMGAlt/Flappy-Bird-RE reconstruction).
- **VID** comes from frame-by-frame video analysis of the original.
- **OBS** is estimated from footage and screenshots.
- **EST** is a best guess with no reliable reference.

| Parameter | Value | Source |
| --- | --- | --- |
| Logical screen | 288 × 512 | RE |
| Ground line | y = 400 (land strip 112 px) | RE |
| Pipe / land scroll speed | 2 px/tick (120 px/s) | RE |
| Pipe width, gap | 52 px, 100 px | RE |
| Pipe spacing | one pair every 90 ticks = 180 px (1.5 s) | RE |
| First pair | spawns at x = 340 the moment play starts | RE |
| Gap centre range | uniform integer in [100, 300] | RE |
| Bird position | centre x = 57, starts at y = 256 | RE |
| Bird hitbox vs pipes | 14 × 16 box around the centre | RE |
| Ground contact | centre + 10 ≥ 400 | RE |
| Ceiling | centre − 10 < 0 also ends the run | RE |
| Scoring | when the pair's trailing edge passes the bird's centre | RE |
| Medals | bronze 10, silver 20, gold 30, platinum 40 | RE / widely documented |
| Hit flash | white, fades over 0.4 s | RE |
| Gravity | 0.375 px/tick² (1350 px/s²) | VID |
| Flap | sets velocity to −5.1 px/tick (−306 px/s) | VID |
| Resulting arc | apex in 0.22 s, ~32 px high, back level in 0.45 s | derived |
| Terminal velocity | 10 px/tick | EST |
| Rotation | snaps to −20° on flap, dives at 6°/tick once falling > 2 px/tick, max 90° | OBS |
| Wings | 3 frames, 5 ticks each (up, mid, down, mid); still in a full dive | OBS |
| Screen fades, Game Over drop-in, panel slide, count-up | see `config.js` | OBS / EST |

**How the physics were derived.** The bird class itself was not available
from the decompilation. The original sets velocity on every tap, so each tap
gives the same arc whatever the bird was doing; that is confirmed by the
video analysis. That analysis measured gravity at 9.75 m/s² when the bird is
scaled to a 24 cm robin, with a post-tap speed of "a bit more than 2 m/s".
Scaling by the 34 px sprite gives about 1350 px/s² and 306 px/s.

The time to the top of a flap is v/g ≈ 0.22 s and does not depend on that
scale assumption. Many popular clones use 900 px/s² and 276 px/s instead
(0.31 s to the top, a floatier jump). If you prefer that feel, set
`GRAVITY: 0.25` and `FLAP_VELOCITY: -4.6`.

## Known differences from the original

1. **Art and audio are recreations**, made for this project, not the
   original files. The colours, proportions and sprite sizes follow the
   original, but individual pixels, the lettering and the exact sound
   timbres differ.
2. **No leaderboard ("Score") button, Rate button, ads or copyright line.**
   The original's second button opened Game Center or Google Play Games,
   which is out of scope (no online leaderboards). So the single PLAY button
   is centred where the original had two side by side.
3. **Daytime and the yellow bird only.** The original randomly picked a day
   or night background, a green or red-tinted pipe set and a yellow, red or
   blue bird for each run. This build keeps the classic day look as
   requested. The palette-driven sprite builder makes the others easy to add.
4. **Bird physics are measured, not decompiled** (see above). Expect about
   ±10% uncertainty on gravity and flap strength. The terminal velocity is a
   guess that rarely matters in play.
5. **Rotation, wing speed and UI animation timings** come from observation,
   not from the code.
6. **The score shows "0" on the Get Ready screen**, as in iOS screenshots. The
   Android logic only draws it once play starts.
7. **Touching the top of the screen ends the run.** This follows the Android
   logic; the iOS build may have behaved differently. Set
   `CEILING_KILLS: false` to let the bird fly above the screen. Pipes extend
   upward without limit, so that cannot be used to skip them.
8. **No pause button.** It arrived in a later update. The game freezes while
   the tab is hidden and resumes without fast-forwarding.
9. **Muting with M** is an addition for browsers; the original had no audio
   toggle.

## References

- Decompiled game logic of Flappy Bird v1.3 for Android, `GameScene`
  (SSMGAlt/Flappy-Bird-RE on GitHub, 2026): world speed, pipe constants,
  ground line, bird spawn, hitbox, scoring rule, flash and medal thresholds.
- F. Noschese, "Flappy Bird Physics Is Real Life?", *Action-Reaction*, Jan/Feb
  2014: video analysis of gravity and the constant post-tap velocity.
- Wikipedia, "Flappy Bird": medal thresholds and release history.
- Widely documented sprite dimensions of the original: 288×512 background,
  336×112 land, 52×320 pipes, 34×24 bird.

Flappy Bird is the work of Dong Nguyen / .GEARS. This is an unofficial,
non-commercial recreation made for study.
