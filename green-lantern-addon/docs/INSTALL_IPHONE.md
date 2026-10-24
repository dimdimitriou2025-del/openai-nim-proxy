# Installing on iPhone (iPhone 14 Pro Max and other iPhones/iPads)

You need **Minecraft (Bedrock Edition) 1.26.10 or newer** from the App Store and about 3 MB of free
space. No experiments, beta toggles or cheats are required to play.

## 1. Download the add-on on the iPhone

1. Open this repository in **Safari** and go to `green-lantern-addon/dist/`.
2. Tap **`GreenLantern-v1.0.0.mcaddon`**, then tap the **download** button (or **View raw**).
3. When Safari asks *"Do you want to download GreenLantern-v1.0.0.mcaddon?"*, tap **Download**.
   The file goes to the **Files** app → **Downloads**.

> If the file arrives as `GreenLantern-v1.0.0.zip`, long-press it in Files → **Rename** and change
> the ending back to `.mcaddon`.

You can also AirDrop the file from a Mac, or put it in iCloud Drive from any computer.

## 2. Import it into Minecraft

1. In Safari tap the **downloads** arrow (or open **Files → Downloads**) and tap the file.
2. On the preview screen tap the **Share** button (square with an arrow).
3. Choose **Minecraft** in the row of apps. If it is not there, swipe to the end, tap **More** and
   pick Minecraft.
4. Minecraft opens and shows *Import started…* followed by two messages:
   *Successfully imported "Green Lantern Corps (Behavior)"* and
   *Successfully imported "Green Lantern Corps (Resources)"*.

## 3. Turn it on for a world

**New world**

1. **Play → Create New → Create New World**.
2. In the left-hand list open **Behavior Packs → Available**, tap
   **Green Lantern Corps (Behavior)** and tap **Activate**.
3. If Minecraft asks to apply the packs it depends on, tap **Activate/Yes**. Check that
   **Resource Packs → Active** now lists **Green Lantern Corps (Resources)**.
4. Tap **Create**.

**Existing world**

1. Make a backup first: tap the **pencil** next to the world → scroll down → **Copy World**.
2. Tap the pencil again → **Behavior Packs** → activate the pack as above.

**Cheats** are optional. Turn them on (world settings → **Cheats**) only if you want the admin
commands `/glc:kit`, `/glc:rank`, `/glc:recharge` and `/glc:reset`. Turning on cheats disables
achievements for that world.

## 4. Recommended iPhone settings

- **Crosshair aiming.** Constructs fire where the centre of your screen points. Turn on the
  crosshair in **Settings → Touch** (called *Split controls* or an *Interaction / crosshair*
  option depending on your Minecraft version) for precise aiming.
- **Use Ring button.** While you hold the ring, the touch controls show a **Use Ring** button —
  that is the main way to cast. Holding sneak (tap the sneak button so it stays on) and tapping
  Use Ring opens the ring menu.
- **Performance.** A render distance of 10–16 chunks is comfortable on an iPhone 14 Pro Max.
  The add-on limits itself to 6 active constructs per player (40 per world) and caps particles.
- **Custom HUD glyphs.** If the energy bar ever shows squares or wrong symbols (another add-on
  using the same glyph page), open the ring menu → **Ring Settings → HUD style → Text only**.

## 5. Playing with friends

- **Local multiplayer / online friends:** the host activates the packs. Friends who join download
  them automatically (allow pack downloads when asked). Progress is saved per player in the
  world, so everyone has their own ring, rank and energy.
- **Realms:** upload a world that already has the packs active (Realm settings → **Replace World**).
  Try the add-on in a local world first.

## 6. Updating to a newer version

1. Import the new `.mcaddon` the same way.
2. Open the world's **Behavior Packs** list and check that the active Green Lantern pack shows the
   new version number. If it still shows the old one, deactivate it and activate the new one
   (do the same under Resource Packs if needed).
3. Player progress is stored in the world save, not in the pack, so ranks and energy are kept.

To remove old versions: **Settings → Storage** → select the old Green Lantern packs → **Delete**.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| *Import failed* / *unsupported pack* | Update Minecraft from the App Store to 1.26.10 or newer. |
| *Duplicate pack* when importing | That version is already installed. Delete it in **Settings → Storage** or just use it. |
| The ring is just an item and nothing happens | The **behavior pack** is not active on this world (the resource pack alone has no gameplay). Activate it and reload the world. |
| Ring shows a purple/black checkerboard | The **resource pack** is not active. Add *Green Lantern Corps (Resources)* under Resource Packs. |
| No *Use Ring* button | Hold the ring in your main hand. On a controller or keyboard, use the normal *use item* input. |
| Constructs miss | Turn on the crosshair (see above) and aim with the centre of the screen. |
| Want to see errors | **Settings → Creator → Enable Content Log GUI**, then reload. Add-on messages start with `[GLC]`. Please include them when reporting a bug. |
| Lost your ring | Craft a new one. Your oath, rank and energy belong to you, not to the ring, so a new ring works immediately. |
