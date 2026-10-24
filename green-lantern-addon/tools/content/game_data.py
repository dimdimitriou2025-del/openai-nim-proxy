"""Single source of truth for game content.

The build writes this data to packs/GreenLanternBP/scripts/data/game_data.js so
scripts and generated assets (icons, names, sounds, particles) always agree.
Balance numbers live here; edit, then run tools/build.py.
"""

# ---------------------------------------------------------------- constructs
# category: offense | defense | utility | advanced
# rank: minimum Lantern rank (1-5) required to use the construct
# cost: ring energy spent on cast; cooldown: seconds; xp: willpower gained per cast
CONSTRUCTS = [
    # --- offense
    {"id": "beam", "name": "Energy Beam", "category": "offense", "rank": 1, "cost": 6, "cooldown": 0.6, "xp": 0,
     "desc": "Hitscan emerald beam that strikes the first target in your sight.", "damage": 6, "range": 28},
    {"id": "fist", "name": "Construct Fist", "category": "offense", "rank": 1, "cost": 10, "cooldown": 1.2, "xp": 0,
     "desc": "A giant fist flies forward, smashing and knocking back everything in its path.", "damage": 8, "range": 12},
    {"id": "blade", "name": "Energy Blade", "category": "offense", "rank": 2, "cost": 8, "cooldown": 0.9, "xp": 0,
     "desc": "Forms a hard-light sword and sweeps a wide arc in front of you.", "damage": 9, "range": 4.5},
    {"id": "hammer", "name": "Construct Hammer", "category": "offense", "rank": 2, "cost": 16, "cooldown": 2.5, "xp": 0,
     "desc": "A massive hammer slams down where you aim, launching nearby enemies.", "damage": 11, "radius": 3.5},
    {"id": "cannon", "name": "Energy Cannon", "category": "offense", "rank": 3, "cost": 18, "cooldown": 3.5, "xp": 0,
     "desc": "A shoulder cannon fires a rapid volley of energy bolts.", "damage": 5, "shots": 6},
    {"id": "missiles", "name": "Emerald Missiles", "category": "offense", "rank": 3, "cost": 22, "cooldown": 4.5, "xp": 0,
     "desc": "Launches homing missiles that explode on impact without breaking blocks.", "damage": 7, "radius": 2.5},
    {"id": "drones", "name": "Construct Drones", "category": "offense", "rank": 4, "cost": 30, "cooldown": 15, "xp": 0,
     "desc": "Two automated drones orbit you and fire at nearby hostiles for 20 seconds.", "damage": 3, "duration": 20},
    # --- defense
    {"id": "shield", "name": "Energy Shield", "category": "defense", "rank": 1, "cost": 12, "cooldown": 3, "xp": 2,
     "desc": "A directional shield blocks projectiles and attacks from the front for 10 seconds.", "duration": 10},
    {"id": "wall", "name": "Barricade Wall", "category": "defense", "rank": 2, "cost": 14, "cooldown": 4, "xp": 2,
     "desc": "Raises a solid 5x3 wall of hard light in front of you for 20 seconds.", "duration": 20},
    {"id": "bubble", "name": "Protective Bubble", "category": "defense", "rank": 3, "cost": 15, "cooldown": 8, "xp": 2,
     "desc": "A personal bubble absorbs up to 30 damage, blocks fire and lets you breathe underwater.", "duration": 12},
    {"id": "dome", "name": "Dome Barrier", "category": "defense", "rank": 3, "cost": 25, "cooldown": 12, "xp": 3,
     "desc": "A stationary dome repels hostiles and stops projectiles for 15 seconds.", "duration": 15, "radius": 4.5},
    # --- utility
    {"id": "platform", "name": "Energy Platform", "category": "utility", "rank": 1, "cost": 5, "cooldown": 1, "xp": 1,
     "desc": "Creates a 3x3 platform under your feet. Great for building and escaping falls.", "duration": 30},
    {"id": "bridge", "name": "Light Bridge", "category": "utility", "rank": 2, "cost": 10, "cooldown": 2, "xp": 1,
     "desc": "Builds a 3-wide bridge or ramp 16 blocks long in the direction you look.", "duration": 30},
    {"id": "grapple", "name": "Grapple Line", "category": "utility", "rank": 2, "cost": 6, "cooldown": 1, "xp": 1,
     "desc": "Fires a line: pulls you to the block you aim at, or yanks a creature to you.", "range": 40},
    {"id": "cage", "name": "Restraint Cage", "category": "utility", "rank": 3, "cost": 18, "cooldown": 6, "xp": 2,
     "desc": "Traps the creature you aim at inside a hard-light cage for 8 seconds.", "duration": 8},
    {"id": "drill", "name": "Construct Drill", "category": "utility", "rank": 3, "cost": 12, "cooldown": 2, "xp": 1,
     "desc": "A spinning drill bores a 3x3 tunnel 5 blocks deep and collects the blocks.", "depth": 5},
    # --- advanced
    {"id": "giant_fist", "name": "Giant Fist", "category": "advanced", "rank": 4, "cost": 35, "cooldown": 6, "xp": 0,
     "desc": "A huge fist plows through every enemy in a wide lane.", "damage": 14, "range": 16},
    {"id": "titan_hammer", "name": "Titan Hammer", "category": "advanced", "rank": 4, "cost": 42, "cooldown": 9, "xp": 0,
     "desc": "A colossal hammer strike with a shockwave that hits everything nearby.", "damage": 18, "radius": 7},
    {"id": "lance", "name": "Willpower Lance", "category": "advanced", "rank": 4, "cost": 45, "cooldown": 8, "xp": 0,
     "desc": "Charge your ring, then unleash a piercing beam through every target in line.", "damage": 20, "range": 40},
    {"id": "aegis", "name": "Aegis Dome", "category": "advanced", "rank": 5, "cost": 60, "cooldown": 45, "xp": 4,
     "desc": "A giant dome shields every ally inside, healing them and repelling hostiles.", "duration": 25, "radius": 10},
    {"id": "colossus", "name": "Emerald Colossus", "category": "advanced", "rank": 5, "cost": 80, "cooldown": 40, "xp": 0,
     "desc": "A towering construct rises behind you and pounds the ground with both fists.", "damage": 26, "radius": 9},
]

CATEGORIES = [
    {"id": "offense", "name": "Offensive Constructs", "icon": "cat_offense"},
    {"id": "defense", "name": "Defensive Constructs", "icon": "cat_defense"},
    {"id": "utility", "name": "Utility Constructs", "icon": "cat_utility"},
    {"id": "advanced", "name": "Advanced Constructs", "icon": "cat_advanced"},
]

# ---------------------------------------------------------------- progression
RANKS = [
    {"rank": 1, "name": "Recruit", "xp": 0, "maxEnergy": 100, "regen": 0.8, "flightTier": 1},
    {"rank": 2, "name": "Lantern", "xp": 250, "maxEnergy": 140, "regen": 0.9, "flightTier": 2},
    {"rank": 3, "name": "Honor Guard", "xp": 750, "maxEnergy": 180, "regen": 1.0, "flightTier": 2},
    {"rank": 4, "name": "Champion", "xp": 1750, "maxEnergy": 220, "regen": 1.15, "flightTier": 3},
    {"rank": 5, "name": "Legend", "xp": 3500, "maxEnergy": 260, "regen": 1.3, "flightTier": 3},
]

# blocks per tick for each flight speed level
FLIGHT_SPEEDS = [0.55, 0.85, 1.25]

# ---------------------------------------------------------------- corps
# index == texture variant index used by construct render controllers.
# Only "active" corps have assets in this release; the rest are planned.
CORPS = [
    {"id": "green", "name": "Green Lantern Corps", "emotion": "Willpower", "color": [0.25, 1.0, 0.42], "active": True},
    {"id": "yellow", "name": "Sinestro Corps", "emotion": "Fear", "color": [1.0, 0.84, 0.16], "active": True},
    {"id": "red", "name": "Red Lantern Corps", "emotion": "Rage", "color": [0.95, 0.12, 0.10], "active": False},
    {"id": "blue", "name": "Blue Lantern Corps", "emotion": "Hope", "color": [0.20, 0.55, 1.0], "active": False},
    {"id": "indigo", "name": "Indigo Tribe", "emotion": "Compassion", "color": [0.36, 0.20, 0.75], "active": False},
    {"id": "violet", "name": "Star Sapphires", "emotion": "Love", "color": [0.86, 0.25, 0.80], "active": False},
    {"id": "orange", "name": "Orange Lanterns", "emotion": "Avarice", "color": [1.0, 0.50, 0.08], "active": False},
    {"id": "white", "name": "White Lanterns", "emotion": "Life", "color": [0.95, 0.97, 1.0], "active": False},
    {"id": "black", "name": "Black Lanterns", "emotion": "Death", "color": [0.30, 0.30, 0.34], "active": False},
]

# ---------------------------------------------------------------- characters
CHARACTERS = [
    {"id": "hal_jordan", "name": "Hal Jordan", "corps": "green", "index": 1, "ally": True,
     "title": "Green Lantern of Sector 2814", "signature": "fist",
     "quote": "In brightest day... let's get to work!"},
    {"id": "john_stewart", "name": "John Stewart", "corps": "green", "index": 2, "ally": True,
     "title": "The Architect", "signature": "wall",
     "quote": "Hold the line. I've got you covered."},
    {"id": "guy_gardner", "name": "Guy Gardner", "corps": "green", "index": 3, "ally": True,
     "title": "Hot-headed Lantern", "signature": "hammer",
     "quote": "Somebody call for some hard-light knuckles?"},
    {"id": "kyle_rayner", "name": "Kyle Rayner", "corps": "green", "index": 4, "ally": True,
     "title": "The Torchbearer", "signature": "missiles",
     "quote": "Let me draw you something... explosive."},
    {"id": "sinestro", "name": "Sinestro", "corps": "yellow", "index": 5, "ally": False,
     "title": "Founder of the Sinestro Corps", "signature": "blade",
     "quote": "Fear is the only order this universe respects."},
]

# Wearable uniforms (chest slot). perk ids are implemented in scripts/suits.js
SUITS = [
    {"id": "corps_uniform", "name": "Green Lantern Corps Uniform", "character": None, "corps": "green",
     "perk": "regen", "perkText": "+25% ring energy regeneration"},
    {"id": "suit_hal", "name": "Hal Jordan's Uniform", "character": "hal_jordan", "corps": "green",
     "perk": "flight", "perkText": "+20% flight speed, flight costs less energy"},
    {"id": "suit_john", "name": "John Stewart's Uniform", "character": "john_stewart", "corps": "green",
     "perk": "architect", "perkText": "Walls, platforms and bridges last twice as long"},
    {"id": "suit_guy", "name": "Guy Gardner's Uniform", "character": "guy_gardner", "corps": "green",
     "perk": "brawler", "perkText": "+30% damage from fists, hammers and blades"},
    {"id": "suit_kyle", "name": "Kyle Rayner's Uniform", "character": "kyle_rayner", "corps": "green",
     "perk": "artist", "perkText": "All constructs cost 15% less energy"},
    {"id": "suit_sinestro", "name": "Sinestro's Uniform", "character": "sinestro", "corps": "yellow",
     "perk": "fear", "perkText": "Your strikes weaken and slow enemies (Fear)"},
]

# NOTE: the oath text is NOT here on purpose.  It lives in the hand-editable
# packs/GreenLanternBP/scripts/oath_config.js so it can be changed without tools.
