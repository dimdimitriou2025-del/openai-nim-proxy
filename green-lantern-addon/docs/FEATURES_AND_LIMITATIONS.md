# Features and Known Limitations — v1.0.0

This page separates what is **implemented**, what is **implemented with limits**, what was
**left out on purpose**, and what is **planned**. It also states plainly what has and has not been
tested.

Legend: ✅ implemented · ⚠️ implemented with a limitation · ❌ not included by design · 🔜 planned

## Testing: what was done and what was not

**Done (automated, outside the game):**

- `tools/validate.py` — every JSON file parses; all cross-references resolve (geometry ↔ textures ↔
  bones, animations, animation controllers, render controllers, attachables, particles, sounds,
  items ↔ icons ↔ names, blocks ↔ textures ↔ loot, recipes, entity events and component groups,
  custom components registered in scripts, ids/sounds/icons/animations used by scripts).
- `tools/schema_check.py` — entities, items, blocks and particles validated against Mojang's
  official JSON schemas.
- TypeScript type check of every script against the exact `@minecraft/server` 2.6.0 and
  `@minecraft/server-ui` 2.0.0 typings.
- 67 end-to-end tests that load the real scripts against a simulated game API: oath checking,
  ring use, every construct casting, acting and cleaning up, cooldowns, energy, flight, batteries,
  ranks, training, uniforms and perks, allies, menus, commands and persistence.

**Not done:** the add-on has **not been run inside Minecraft** (no device or game client was
available while building it). The automated checks prove the files are well-formed and the game
logic behaves as designed against the documented API, but they cannot prove how things look or feel
in the game. See [Unverified until tested in game](#unverified-until-tested-in-game).

## 1. Power Ring

| Feature | Status | Notes |
| --- | :-: | --- |
| Custom 3D held ring, item icon and glow | ✅ | Held-item attachable with an emissive gem and gentle float; glow particles around the ring hand. |
| Activate (oath), power down / up, recharge | ✅ | |
| Energy with overcharge, regeneration and rank-based maximum | ✅ | |
| HUD energy bar, rank, flight and cooldown display | ⚠️ | Uses the action bar (see limitations). Text-only and hidden modes available. |
| Touch-friendly power selection | ⚠️ | Large icon buttons in standard Bedrock forms plus quick picks. Not a custom radial wheel (see limitations). |
| Unlockable abilities | ✅ | 21 constructs unlocked across 5 ranks. |
| Low-energy and cooldown feedback | ✅ | Messages, sounds and particles at 20 %, 10 %, empty; cooldown timers. |

## 2. Models, textures, animations and effects

| Feature | Status | Notes |
| --- | :-: | --- |
| Constructs visibly form from green energy | ✅ | Grow-in animation, formation burst and sound; dissolve animation and particles when they end. |
| Charging effects, beams, impacts, shockwaves, dissipation | ✅ | 17 particle effects tinted per Corps colour. |
| Synced sound effects | ✅ | 34 original synthesized sounds. |
| Animated constructs | ✅ | e.g. hammer slam, blade swing, cannon recoil, drone and drill spin, colossus punches, pulsing domes. |
| Player cast gesture and flight pose | ⚠️ | Third-person animations played from scripts; unverified in game and may conflict with add-ons that also replace player poses. |
| Real UVs, previews and contact sheets | ✅ | Box-UV packed models; see `docs/previews/`. |

## 3. Constructs (21)

| Group | Constructs | Status |
| --- | --- | :-: |
| Offense | Energy Beam, Construct Fist, Energy Blade, Construct Hammer, Energy Cannon, Emerald Missiles (homing, explosive), Construct Drones | ✅ |
| Defense | Energy Shield (directional), Barricade Wall, Protective Bubble, Dome Barrier | ✅ |
| Utility | Energy Platform, Light Bridge, Grapple Line, Restraint Cage, Construct Drill | ✅ |
| Advanced | Giant Fist, Titan Hammer (AoE), Willpower Lance (charged beam), Aegis Dome (large shield), Emerald Colossus (temporary giant construct) | ✅ |

Each construct has its own behaviour, visuals, sound, energy cost and cooldown (full table in the
[Player Guide](PLAYER_GUIDE.md#5-constructs)).

## 4. Flight

| Feature | Status | Notes |
| --- | :-: | --- |
| Double-tap jump to fly / land, menu toggle, `/glc:fly` | ✅ | Double-tap is left to vanilla flight in Creative. |
| Joystick flight toward the camera direction, hover, climb, descend | ⚠️ | Physics-based, see limitations. |
| Speed tiers, sprint boost, energy drain, fall protection, auto-land | ✅ | |
| Trail and superhero pose | ⚠️ | Pose unverified in game. |

## 5. The oath

| Requirement | Status | Notes |
| --- | :-: | --- |
| Real text field and confirmation button | ✅ | `ModalFormData.textField` + **Swear the Oath** button. |
| Case-insensitive, whitespace-tolerant checking | ✅ | Punctuation also ignored unless strict mode is switched on. |
| Clear feedback when incorrect | ✅ | Words correct, the correct part so far, and the word that went wrong; typed text is kept. |
| Ceremony | ✅ | Green camera flash, emerald pillar, emblem, shockwave, titles, levitation, sounds. |
| Per-player progression, works in multiplayer | ✅ | Data saved on each player. |
| In-game guide showing the oath | ✅ | Book of Oa, ring menu and the oath screens. |
| Oath stored in one configurable place | ✅ | `packs/GreenLanternBP/scripts/oath_config.js` (see the Developer Guide). Editing it means editing the pack files, which is easiest on a computer. |
| Repeating the oath never duplicates rewards or resets progress | ✅ | Covered by tests. |
| No voice / microphone | ✅ | Typing only. |

## 6. Batteries and progression

| Feature | Status |
| --- | :-: |
| Personal Power Battery block (recharge, oath overcharge) | ✅ |
| Central Power Battery (full recharge, ascension, training, uniform locker, allies, dismantle, recharge aura) | ✅ |
| Willpower from kills, constructs, training and recharges; 5 ranks | ✅ |
| Persistent per-player progress | ✅ |

## 7. Characters — NPC or playable?

| Character | What it is in this add-on |
| --- | --- |
| **Hal Jordan, John Stewart, Guy Gardner, Kyle Rayner** | AI-controlled **NPC allies** with custom models, skins, idle/walk/fly/hover/cast animations and their own construct sets. Summoned at the Central Power Battery (rank 3) or placed with spawn eggs in Creative. |
| **Sinestro** | A **neutral rival NPC**: summoned at the Central Power Battery (rank 5) or with his spawn egg in Creative; uses yellow constructs and fights back if attacked. Not a boss — normal health, no boss bar. |
| **Playing as a character** | ⚠️ You cannot replace your player with another character model. Instead, each character has a **wearable uniform** that dresses you as that Lantern head to toe and grants their perk. |

Why not fully playable characters: an add-on can only change the player's body by overriding the
vanilla player entity, which breaks other add-ons and Character Creator skins. Wearable uniforms
give the look without that cost.

## 8. Corps architecture

| Corps | Status |
| --- | :-: |
| Green Lantern Corps (Willpower) | ✅ complete |
| Sinestro Corps (Fear) | ⚠️ partial — Sinestro NPC, yellow construct textures and energy, Sinestro's uniform with the Fear perk. No yellow ring or Sinestro Corps progression for players. |
| Red, Blue, Indigo, Violet, Orange, White, Black | 🔜 listed in the data with their colours, **inactive** on purpose (no unfinished assets were shipped). |

Colours, textures (texture arrays indexed by a Corps entity property), particles and scripts are all
keyed by Corps, so adding one is mostly content work — see the Developer Guide.

## 9. Not included by design

- ❌ Bosses.
- ❌ Cosmic exploration (Oa, Mogo, Qward, planet travel).
- ❌ Voice chat or microphone input.

## Known limitations

**Interface**

- Menus are standard Bedrock forms. Script-driven custom screens (such as a radial wheel) would
  require overriding vanilla UI files, which breaks easily between game updates and with other
  add-ons. The forms use large icon buttons that work well on touch screens.
- The HUD lives in the action bar. Other add-ons or commands that also write to the action bar will
  alternate with it; the HUD re-sends itself every 1.5 seconds.
- The HUD icons use the custom glyph page `glyph_EC`. If another pack uses the same page, the
  symbols look wrong — switch to **HUD style → Text only**.
- English only.

**Ring and controls**

- Casting and the menu use the item in your **main hand**; Bedrock does not let off-hand items be
  "used". Flight, HUD and regeneration also work with the ring in the off-hand or on the hotbar.
- On touch screens sneak is a toggle, so descending while flying means switching sneak on (or
  looking down and moving).

**Flight**

- Flight is driven by small impulses every tick, not by creative flight, because add-ons cannot
  grant creative flight in survival. It can feel floatier under heavy lag.
- The strafe direction of the joystick is an assumption (`FLIGHT_STRAFE_SIGN` in
  `scripts/config.js`); if left/right are swapped in game, flip that one value.

**Constructs and blocks**

- Wall, platform and bridge place real temporary blocks. Their countdown pauses while their chunk
  is unloaded and resumes when it loads. They drop nothing when broken.
- The drill uses `/setblock … destroy`, so drops ignore Fortune and Silk Touch, and it does not know
  about land-claim or protection add-ons (it does refuse Adventure/Spectator mode and protected
  blocks such as containers and bedrock).
- A player can have 6 constructs at once, and a world 40; particles are capped per tick to protect
  frame rate on phones.
- Leftover construct entities (for example after a crash) are removed automatically when they load.

**Uniforms and characters**

- Uniform arms are the classic 4-pixel width; on slim-arm skins the arms look slightly thicker.
  Character Creator accessories that stick far out of the body may poke through.
- One ally per player. Allies use vanilla follow/attack AI and can get stuck on complex terrain;
  calling them again at the battery replaces them. A fallen ally is gone until summoned again.
- NPC casts cost no energy (they use their own cooldowns).

**Progress and worlds**

- Progress is saved per player **per world** (it does not move between worlds).
- No natural spawning, structures or loot: everything is crafted or summoned.

## Unverified until tested in game

These are the items that most need a first play session on a device:

- [ ] Held ring placement and size in first and third person; uniform fit over different skins.
- [ ] Construct, NPC and battery models, materials and glow (including with Vibrant Visuals).
- [ ] Cast gesture and flight pose animations on the player.
- [ ] Flight feel on iPhone touch controls (speed, hover stability, joystick strafe direction).
- [ ] Use Ring button on touch controls, including aiming at blocks.
- [ ] HUD glyph rendering and readability on a 6.7-inch screen.
- [ ] Sound volumes and particle density; frame rate with many constructs.
- [ ] Ally pathing and following while flying.
- [ ] Multiplayer and Realms behaviour.

## Planned / possible next steps

- 🔜 Other Corps with their own rings, oaths, constructs and colours (data already in place).
- 🔜 A player Yellow Lantern ring and Sinestro Corps progression.
- 🔜 Option to cast with the ring in the off-hand via a dedicated item binding.
- 🔜 More languages.
- 🔜 Tuning of balance, flight and visuals after in-game testing.
