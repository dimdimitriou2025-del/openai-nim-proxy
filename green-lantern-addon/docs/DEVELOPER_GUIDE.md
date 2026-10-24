# Developer Guide

How the add-on is built, checked, packaged and extended. All commands run from the
`green-lantern-addon/` folder.

## Requirements

| Tool | Used for |
| --- | --- |
| Python 3.10+ with **Pillow** and **numpy** | Generating models, textures, icons, particles, JSON and previews |
| **ffmpeg** with libvorbis | Only when regenerating sounds (skip with `--skip-audio`) |
| Node.js 20.6+ | End-to-end tests and the type check |
| `jsonschema` + `referencing` (pip) | Optional: official schema check |

## What is generated and what is hand-written

- `tools/build.py` regenerates **everything in both packs** — manifests, entities, items, blocks,
  recipes, loot tables, geometry, textures, animations, render controllers, attachables, particles,
  sounds, language files, icons, the glyph font and `scripts/data/game_data.js` — plus the preview
  sheets in `docs/previews/`.
- The gameplay scripts in `packs/GreenLanternBP/scripts/` (except `scripts/data/`) are
  **hand-written** and never touched by the build.
- Do not edit generated files directly; change the generator in `tools/` and rebuild. Builds are
  reproducible: the same sources always produce byte-identical files.

```
tools/
├── build.py              orchestrates generation of both packs
├── validate.py           cross-reference validator
├── schema_check.py       Mojang official JSON schema check
├── package.py            .mcaddon / .mcpack packaging (never overwrites older builds)
├── glc/                  geometry builder (geo.py), painter (paint.py), software renderer (render.py), file io
├── content/
│   ├── game_data.py      constructs, ranks, flight speeds, Corps, characters, uniforms
│   ├── construct_models.py / other_models.py   3D models (constructs, battery, ring, humanoids)
│   ├── skins.py          Lantern character and uniform textures
│   ├── art.py            item/UI icons, particle textures, HUD glyphs, pack icon
│   ├── particles_def.py  particle effects
│   ├── sounds_def.py     synthesized sound effects
│   ├── bp_defs.py        behavior-pack JSON (entities, items, blocks, recipes, loot)
│   └── rp_defs.py        resource-pack JSON (client entities, animations, render controllers, attachables)
├── tests/                mocked @minecraft/server + server-ui and the end-to-end test suite
└── typecheck/            pinned TypeScript + Script API typings
```

Scripts (`packs/GreenLanternBP/scripts/`):

| Path | Responsibility |
| --- | --- |
| `main.js` | Startup registration (item/block components, commands), the tick loop |
| `config.js` | Tunable constants (intervals, energy, flight, limits, XP) |
| `oath_config.js` | **The oath text and checking options** |
| `core/` | Player state and persistence, energy/willpower/ranks, ring use, oath flow, HUD |
| `constructs/` | Construct registry and task system, offense, defense, utility, hard-light blocks |
| `systems/` | Flight, batteries and training, allies, damage protection, uniforms, commands |
| `ui/` | Forms helper and ring menus |
| `lib/` | Vectors, effects (particles/sounds), entity helpers, player poses |

## Everyday commands

```sh
python3 tools/build.py                 # regenerate packs (+ sounds, + previews)
python3 tools/build.py --skip-audio    # faster: reuse existing .ogg files
python3 tools/validate.py              # must print "0 errors, 0 warnings"

# official schemas (sparse checkout of Mojang/bedrock-samples, metadata/json_schemas)
python3 tools/schema_check.py /path/to/bedrock-samples/metadata/json_schemas

(cd tools/typecheck && npm ci && npx tsc -p tsconfig.json)   # type check scripts
node --import ./tools/tests/register.mjs tools/tests/run_tests.mjs   # end-to-end tests
```

## Releasing a version

1. `python3 tools/build.py --version 1.1.0` (sets the version in both manifests and the scripts).
2. Run the validator, schema check, type check and tests.
3. `python3 tools/package.py` → `dist/GreenLantern-v1.1.0.mcaddon` plus one `.mcpack` per pack.
   Use `--tag preview` for test builds. The packager refuses to overwrite an existing file, so
   every earlier build stays in `dist/` as a backup.
4. Never change the pack UUIDs at the top of `tools/build.py`: worlds reference packs by UUID.

## Changing the oath

Edit `packs/GreenLanternBP/scripts/oath_config.js`:

```js
export const OATH_LINES = [
  "In brightest day, in blackest night,",
  "No evil shall escape my sight.",
  "Let those who worship evil's might,",
  "Beware my power, Green Lantern's light!",
];
export const STRICT_PUNCTUATION = false; // true = punctuation must match too
export const OATH_PLACEHOLDER = "In brightest day, in blackest night...";
```

The forms, guide, Book of Oa and error messages all read from this file. Checking is
case-insensitive, ignores extra whitespace and line breaks, and (unless strict) punctuation;
every word must be present and in order (`scripts/core/oath_logic.js`). After changing the text,
update `CANON` in `tools/tests/run_tests.mjs`, run the tests and package a new version.

## Balancing

- Constructs, ranks, flight speeds, uniforms and characters: `tools/content/game_data.py`
  (rebuild to regenerate `scripts/data/game_data.js`).
- Energy regeneration, drains, overcharge, battery and XP numbers, construct limits and particle
  budget: `packs/GreenLanternBP/scripts/config.js`.

## Adding a construct

1. Add an entry to `CONSTRUCTS` in `tools/content/game_data.py` (`id`, `name`, `category`, `rank`,
   `cost`, `cooldown`, `xp`, `desc` and any parameters such as `damage`, `range`, `duration`).
2. If it needs a model: add a builder to `construct_models.py` (`ALL` dict), then map an entity to it
   in `CONSTRUCT_ENTITIES` in `rp_defs.py` and add the entity in `bp_defs.py`.
3. Add its menu icon in `art.py` (`icon_<id>`); the validator fails if it is missing.
4. Implement it in `scripts/constructs/*.js`:

   ```js
   registerConstruct("platform", (ctx) => {
     // ctx: caster, isPlayer, dim, eye, dir, right, hand, yaw, pitch, corps, corpsIndex,
     //      power (damage multiplier), blockLife, def (game data entry), target (NPC casts)
     return buildBlocks(ctx, rows, ctx.def.duration); // a Task, or false to refund energy
   });
   ```

   Return a `Task` subclass (see `registry.js`) for anything that lasts several ticks; spawn models
   with `this.spawn(...)` so they form and dissolve with the standard effects and are cleaned up.
5. Rebuild, validate and run the tests — the suite automatically casts every construct and checks
   that it spends energy, spawns effects and leaves nothing behind.

## Adding a Corps

The Corps foundation is data-driven:

- `CORPS` in `game_data.py` lists all nine Corps; the list order is the index stored in the
  `glc:corps` entity property and used by the texture arrays, so **append new Corps, never
  reorder**, and keep green first.
- Every construct texture array has one slot per Corps; inactive Corps fall back to green.

To activate a Corps (for example Red):

1. Add a palette to `CORPS` in `tools/glc/paint.py` (`core`, `rim`, `deep`, `hue`).
2. Set `"active": True` for it in `game_data.py` and rebuild: `<construct>_red.png` textures and a
   `shimmer_red.png` are generated and wired into the arrays automatically; particles take the
   Corps colour from the game data.
3. Decide who uses it in `scripts/core/lantern.js` → `corpsOf(entity)` (a new ring item, a uniform
   perk, an NPC type…). Everything a caster creates is then coloured by that Corps.
4. Optional: an emblem (`paint.emblem_mask`), characters, uniforms and a separate oath.

## Adding a Lantern character

1. Add the character to `CHARACTERS` in `game_data.py` (and optionally a uniform to `SUITS`).
2. Add a skin design class in `tools/content/skins.py` (64×128 texture: standard skin layout plus
   extras such as hair or fins).
3. Entities are generated per character by `bp_defs.py` / `rp_defs.py`; give them a construct set
   in `MOVES` in `scripts/systems/allies.js`.
4. Rebuild — the portrait, spawn egg and preview are generated.

## Tests

`tools/tests/mock/` implements the parts of `@minecraft/server` and `@minecraft/server-ui` the
add-on uses: a tick scheduler, events, a block world (stone below y = 64), entities and players with
components, effects, damage and knockback, and forms with scripted answers. A Node loader hook
(`tools/tests/loader.mjs`) maps the `@minecraft/*` imports to these mocks, so the real pack scripts
run unchanged.

Tests live in `tools/tests/run_tests.mjs`; a typical test sets up the player, fires an event or
uses the ring, advances time with `await tick(n)` and asserts on game state and on the logs of
particles, sounds, commands, titles, action bar messages and animations. The mock is not the game:
it checks logic and API usage, not visuals or feel.
