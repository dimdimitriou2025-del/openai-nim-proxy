# Player Guide

Everything you need to become a Lantern. Controls are written for touch screens; on a controller or
keyboard use your normal **use item**, **sneak** and **jump** inputs.

## Contents

1. [Getting the ring](#1-getting-the-ring)
2. [Swearing the oath](#2-swearing-the-oath)
3. [Controls](#3-controls)
4. [Energy and the HUD](#4-energy-and-the-hud)
5. [Constructs](#5-constructs)
6. [Flight](#6-flight)
7. [Power Batteries](#7-power-batteries)
8. [Willpower and ranks](#8-willpower-and-ranks)
9. [Uniforms](#9-uniforms)
10. [Lantern allies and Sinestro](#10-lantern-allies-and-sinestro)
11. [Ring menu and settings](#11-ring-menu-and-settings)
12. [Commands](#12-commands)
13. [Tips](#13-tips)

## 1. Getting the ring

All items are crafted at a crafting table (they also appear in the creative inventory).

| Item | Recipe | Use |
| --- | --- | --- |
| **Power Ring** | top: emerald · middle: gold ingot, eye of ender, gold ingot · bottom: gold ingot (centre) | The heart of the add-on. |
| **Power Battery** | gold ingot in the corners, emeralds on the sides, a lantern in the centre | Placeable block for personal recharges. |
| **Central Power Battery** | emerald blocks in the corners, gold blocks on the sides, a Power Battery in the centre | Big battery for full recharges, ranks, training, uniforms and allies. |
| **Book of Oa** | a book surrounded by four emeralds (plus shape) | Opens the guide and the oath at any time. |

Flight, the HUD and energy regeneration work while the ring is anywhere on your **hotbar** or in
your **off-hand**; casting constructs and opening the menu need it in your **main hand**.

## 2. Swearing the oath

The ring stays dormant until you swear the oath — by **typing** it. There is no voice input.

1. Hold the ring and tap **Use Ring**. The ring introduces itself; tap **Recite the Oath**
   (or **Read the Oath slowly** to see it line by line first).
2. A form with a text box opens. Type the oath and tap **Swear the Oath**:

   > In brightest day, in blackest night,
   > No evil shall escape my sight.
   > Let those who worship evil's might,
   > Beware my power, Green Lantern's light!

3. Checking is forgiving about form, strict about words:
   - capital letters do not matter;
   - extra spaces and line breaks do not matter (one long line is fine);
   - punctuation and apostrophes do not matter (*evils might* = *evil's might,*);
   - every word must be there, spelled correctly, in the right order.
4. If something is wrong, the ring shows how many words were right, the part you got right and
   the word where it went wrong. Tap **Try again** — your text is kept, so you only fix the mistake.
   There is no limit on attempts.
5. When the oath is right: a green flash, an emerald pillar, a shockwave, titles and sound. You
   become a **Rank 1 Recruit** with a full, overcharged ring, your name is engraved on the ring,
   and you receive a **Green Lantern Corps Uniform** (put on automatically if your chest slot is
   empty).

You can read the oath line by line in the **Book of Oa** or in the ring menu (**Oath & Guide**).
Reciting it again later never repeats the first-time rewards and never resets your progress:
at a Power Battery it overcharges your ring, at the Central Power Battery it is how you ascend in
rank, and anywhere else it simply renews your resolve.

## 3. Controls

| Action | Touch controls |
| --- | --- |
| Swear the oath / cast your selected construct | Hold the ring, tap **Use Ring** |
| Open the ring menu | Turn **sneak** on, then tap **Use Ring** (or type `/glc:ring`) |
| Pick a construct | Ring menu → a category → a construct → **Make Active** (the menu also shows your last three as quick picks) |
| Take off / land | **Double-tap jump** (or ring menu → Take Flight, or `/glc:fly`) |
| Fly | Joystick — you fly where you look |
| Climb / descend while flying | Hold **jump** / turn **sneak** on (or look down and move) |
| Fly faster | Sprint while flying (×1.5) |
| Recharge | Tap a Power Battery or the Central Power Battery |
| Talk to a Lantern | Tap the Lantern's interact button |

Turn on the crosshair in your touch settings: constructs go where the **centre of the screen**
points.

## 4. Energy and the HUD

While the ring is on your hotbar, the HUD above the hotbar shows:

- a **10-segment energy bar** (gold segments = overcharge) and the percentage;
- your **rank** icon and a **flight** icon while flying;
- the **selected construct** and its cooldown.

Energy facts:

- Every construct costs energy; flight drains it slowly.
- The ring **regenerates** on its own while it is on your hotbar, powered up, and you are not
  flying (0.8–1.3 per second depending on rank).
- **Overcharge** is extra energy above your maximum from reciting the oath at a battery. It is spent
  first and fades by 1 per second.
- The ring warns you at **20 %** and **10 %** (message and sound) and when it is **empty** (plus a
  burst of fading particles). If you run dry in the air, flight fails gracefully and you get a few
  seconds of slow falling.
- Trying to cast without enough energy, or during a cooldown, shows a short message instead.
- **Power Down Ring** in the menu stops flight, casting and regeneration; the HUD shows
  *[ring off]* until you power it up again.

## 5. Constructs

Constructs are solid hard light: they form with an emerald flash, act, then dissolve. Damaging
constructs count as your attacks, so their kills give you willpower. Block-building constructs
(wall, platform, bridge) place real temporary blocks that fade on their own and drop nothing.
Each player can have 6 constructs active at once.

### Offensive Constructs

| Construct | Rank | Energy | Cooldown | What it does |
| --- | :-: | :-: | :-: | --- |
| **Energy Beam** | 1 | 6 | 0.6 s | Hitscan emerald beam that strikes the first target in your sight. |
| **Construct Fist** | 1 | 10 | 1.2 s | A giant fist flies forward, smashing and knocking back everything in its path. |
| **Energy Blade** | 2 | 8 | 0.9 s | Forms a hard-light sword and sweeps a wide arc in front of you. |
| **Construct Hammer** | 2 | 16 | 2.5 s | A massive hammer slams down where you aim, launching nearby enemies. |
| **Energy Cannon** | 3 | 18 | 3.5 s | A shoulder cannon fires a rapid volley of energy bolts. |
| **Emerald Missiles** | 3 | 22 | 4.5 s | Launches homing missiles that explode on impact without breaking blocks. |
| **Construct Drones** | 4 | 30 | 15 s | Two automated drones orbit you and fire at nearby hostiles for 20 seconds. |

### Defensive Constructs

| Construct | Rank | Energy | Cooldown | What it does |
| --- | :-: | :-: | :-: | --- |
| **Energy Shield** | 1 | 12 | 3 s | A directional shield blocks projectiles and attacks from the front for 10 seconds. Grants 2 willpower per cast. |
| **Barricade Wall** | 2 | 14 | 4 s | Raises a solid 5x3 wall of hard light in front of you for 20 seconds. Grants 2 willpower per cast. |
| **Protective Bubble** | 3 | 15 | 8 s | A personal bubble absorbs up to 30 damage, blocks fire and lets you breathe underwater. Grants 2 willpower per cast. |
| **Dome Barrier** | 3 | 25 | 12 s | A stationary dome repels hostiles and stops projectiles for 15 seconds. Grants 3 willpower per cast. |

### Utility Constructs

| Construct | Rank | Energy | Cooldown | What it does |
| --- | :-: | :-: | :-: | --- |
| **Energy Platform** | 1 | 5 | 1 s | Creates a 3x3 platform under your feet. Great for building and escaping falls. Grants 1 willpower per cast. |
| **Light Bridge** | 2 | 10 | 2 s | Builds a 3-wide bridge or ramp 16 blocks long in the direction you look. Grants 1 willpower per cast. |
| **Grapple Line** | 2 | 6 | 1 s | Fires a line: pulls you to the block you aim at, or yanks a creature to you. Grants 1 willpower per cast. |
| **Restraint Cage** | 3 | 18 | 6 s | Traps the creature you aim at inside a hard-light cage for 8 seconds. Grants 2 willpower per cast. |
| **Construct Drill** | 3 | 12 | 2 s | A spinning drill bores a 3x3 tunnel 5 blocks deep and collects the blocks. Grants 1 willpower per cast. |

### Advanced Constructs

| Construct | Rank | Energy | Cooldown | What it does |
| --- | :-: | :-: | :-: | --- |
| **Giant Fist** | 4 | 35 | 6 s | A huge fist plows through every enemy in a wide lane. |
| **Titan Hammer** | 4 | 42 | 9 s | A colossal hammer strike with a shockwave that hits everything nearby. |
| **Willpower Lance** | 4 | 45 | 8 s | Charge your ring, then unleash a piercing beam through every target in line. |
| **Aegis Dome** | 5 | 60 | 45 s | A giant dome shields every ally inside, healing them and repelling hostiles. Grants 4 willpower per cast. |
| **Emerald Colossus** | 5 | 80 | 40 s | A towering construct rises behind you and pounds the ground with both fists. |

Notes:

- **Damage grows with rank** (+5 % per rank above 1).
- The **drill** refuses to work in Adventure and Spectator mode. It never breaks bedrock, barriers,
  portals, command/structure blocks, spawners, beacons, containers (chests, barrels, shulker boxes)
  or hard-light blocks. The blocks it breaks drop as items and are pulled to you.
- The **missiles** and **titan hammer** never break blocks.
- **Cast immediately when selected** (Ring Settings) makes choosing a construct from the menu also
  cast it.

## 6. Flight

- **Double-tap jump** to take off (in Creative, double-tap is vanilla flight — use the ring menu or
  `/glc:fly` there).
- Push the joystick to fly **where you look**; release it to **hover** in place.
- Hold **jump** to climb, turn **sneak** on to descend, sprint to fly 1.5× faster.
- **Double-tap jump** again to land, or touch the ground (with *Land automatically* on).
- Higher ranks unlock **flight speeds 2 and 3** (Ring Settings → Flight speed).
- Flight drains **0.25 energy/s** while hovering and **0.6 × speed level per second** while moving.
- You take **no fall damage** while flying and for a few seconds after landing.
- Your character leans into a superhero pose and leaves an emerald trail.
- Flight needs the ring on your hotbar or off-hand; losing it mid-air ends flight.

## 7. Power Batteries

**Power Battery (block).** Place it and tap it:

- **Recharge** — a stream of energy fills your ring to the maximum.
- **Recite the Oath** — type the oath for a full recharge **plus 25 % overcharge**.
- Recharging at any battery gives **+5 willpower** (at most once every 2 minutes).

**Central Power Battery.** Place it with its item and tap it:

| Option | What it does |
| --- | --- |
| Full Recharge | Fills your ring and adds **50 % overcharge**. |
| Recite the Oath / Ascend | When you have enough willpower, reciting the oath here **raises your rank** with a ceremony. Otherwise it overcharges your ring. |
| Construct Training | Six targets appear around the battery. Destroy them with constructs within 60 seconds: **+15 willpower** each, **+20** bonus for all six. |
| Uniform Locker | From rank 2: take any Lantern uniform (Sinestro's from rank 4). |
| Call a Lantern Ally | From rank 3: summon Hal, John, Guy or Kyle (Sinestro at rank 5). |
| Ring Menu | Opens your ring menu. |
| Dismantle Battery | Turns it back into an item. |

Standing within **6 blocks** of a Central Power Battery also recharges you by **3 energy per
second**.

## 8. Willpower and ranks

Willpower is your experience. You earn it by:

- **defeating monsters** with constructs or by hand: half the monster's maximum health, between
  3 and 40 (a zombie gives 10);
- **casting defensive and utility constructs** (see the tables above);
- **construct training** at the Central Power Battery;
- **recharging** at a battery (+5, once every 2 minutes).

When you have enough willpower the ring tells you; go to a **Central Power Battery** and choose
**Ascend** to recite the oath and rise in rank. Willpower is a running total and is never spent.

| Rank | Name | Willpower needed | Max energy | Regen / s | Flight speeds | New constructs |
| :-: | --- | :-: | :-: | :-: | :-: | --- |
| 1 | Recruit | 0 | 100 | 0.8 | 1 | Energy Beam, Construct Fist, Energy Shield, Energy Platform |
| 2 | Lantern | 250 | 140 | 0.9 | 2 | Energy Blade, Construct Hammer, Barricade Wall, Light Bridge, Grapple Line |
| 3 | Honor Guard | 750 | 180 | 1.0 | 2 | Energy Cannon, Emerald Missiles, Protective Bubble, Dome Barrier, Restraint Cage, Construct Drill |
| 4 | Champion | 1750 | 220 | 1.15 | 3 | Construct Drones, Giant Fist, Titan Hammer, Willpower Lance |
| 5 | Legend | 3500 | 260 | 1.3 | 3 | Aegis Dome, Emerald Colossus |

## 9. Uniforms

Uniforms are worn in the **chest armor slot** (3 armor points) and change your whole look. A
character uniform dresses you as that Lantern from head to toe, face and hair included; the Corps
uniform keeps your own face and adds a green domino mask. A helmet, if you wear one, still shows
on top. Each uniform has a perk while worn.

| Uniform | How to get it | Perk |
| --- | --- | --- |
| Green Lantern Corps Uniform | Given at your first oath; Uniform Locker | +25 % ring energy regeneration |
| Hal Jordan's Uniform | Uniform Locker (rank 2) | +20 % flight speed, flight costs less energy |
| John Stewart's Uniform | Uniform Locker (rank 2) | Walls, platforms and bridges last twice as long |
| Guy Gardner's Uniform | Uniform Locker (rank 2) | +30 % damage from fists, hammers and blades |
| Kyle Rayner's Uniform | Uniform Locker (rank 2) | All constructs cost 15 % less energy |
| Sinestro's Uniform | Uniform Locker (rank 4) | Your constructs turn **yellow** and every hit weakens and slows the target (Fear) |

## 10. Lantern allies and Sinestro

From **rank 3**, the Central Power Battery can call a Lantern to fight beside you:

| Lantern | Constructs they use | Style |
| --- | --- | --- |
| **Hal Jordan** | Construct Fist, Energy Beam, Giant Fist | Fearless all-rounder |
| **John Stewart** | Energy Cannon, Energy Beam, Barricade Wall | The architect |
| **Guy Gardner** | Construct Hammer, Construct Fist, Energy Blade | Hot-headed brawler |
| **Kyle Rayner** | Emerald Missiles, Energy Beam, Construct Drones | Creative artist |

- One ally at a time; calling another sends the current one home.
- Allies follow you (they can fly and teleport to catch up), defend you, attack monsters within
  16 blocks with their constructs every few seconds and slowly regenerate health.
- Tap an ally to talk: **Send home** dismisses them. An unbound Lantern can be **recruited** by any
  sworn player.
- If an ally falls, you get a message — call them again at the battery.

At **rank 5** you can also summon **Sinestro**. He is a **neutral rival**, not an ally: he hunts
monsters with yellow constructs, fights back if attacked, and leaves when you tap him and choose
**Send him away**. Only one Sinestro appears at a time. He is a normal creature (60 health, no
boss bar).

## 11. Ring menu and settings

Sneak + Use Ring opens the ring menu:

- **Quick picks** — your three most recent constructs.
- **Offensive / Defensive / Utility / Advanced Constructs** — locked ones show the rank they need.
- **Take Flight / Land**.
- **Lantern Status** — rank, willpower, energy, active uniform perk and statistics.
- **Oath & Guide** — how to play, the oath line by line, and recite the oath.
- **Ring Settings**:
  - *Flight speed* (from rank 2);
  - *HUD style*: icons, text only, or hidden;
  - *Cast construct immediately when selected*;
  - *Land automatically when touching ground*;
  - *Ring voice messages in chat*.
- **Power Down / Power Up Ring**.

## 12. Commands

| Command | Who | What it does |
| --- | --- | --- |
| `/glc:ring` | everyone | Open the ring menu |
| `/glc:oath` | everyone | Recite the oath |
| `/glc:guide` | everyone | Open the guide |
| `/glc:fly` | everyone | Toggle ring flight |
| `/glc:kit` | operators, cheats on | Give the ring, batteries, Book of Oa and all uniforms |
| `/glc:rank <1-5>` | operators, cheats on | Set your rank (for testing) |
| `/glc:recharge` | operators, cheats on | Fully recharge your ring |
| `/glc:reset` | operators, cheats on | Reset your Lantern progress |

## 13. Tips

- Build a Central Power Battery early: its recharge aura and training make ranking up much faster.
- The **shield** blocks from the front only; the **bubble** protects from every side and works
  underwater and in lava.
- **Grapple** to a block to cross gaps quickly, or yank a dangerous mob to you.
- The **platform** under your feet saves you from falls — cast it in mid-air.
- John Stewart's uniform doubles how long walls, bridges and platforms last.
- Your progress is saved per player in the world, so friends each have their own ring and rank.
