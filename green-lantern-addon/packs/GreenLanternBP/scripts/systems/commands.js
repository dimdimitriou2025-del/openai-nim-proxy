// Custom slash commands.  Player commands work without cheats; creator/admin
// commands (rank, recharge, kit, reset) need operator permission and cheats.
import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, ItemStack, system } from "@minecraft/server";
import { RANKS, SUITS } from "../data/game_data.js";
import { data, resetData, save } from "../core/state.js";
import { fullRecharge, ringSay } from "../core/lantern.js";
import { oathIntro } from "../core/oath.js";
import { openGuide, openMainMenu } from "../ui/menu.js";
import { toggleFlight } from "./flight.js";

function playerOf(origin) {
  const e = origin.sourceEntity ?? origin.initiator;
  return e && e.typeId === "minecraft:player" ? /** @type {import("@minecraft/server").Player} */ (e) : undefined;
}

function run(fn) {
  return (origin, ...args) => {
    const p = playerOf(origin);
    if (!p) return { status: CustomCommandStatus.Failure, message: "Run this command as a player." };
    system.run(() => fn(p, ...args));
    return { status: CustomCommandStatus.Success };
  };
}

/** @param {import("@minecraft/server").StartupEvent} ev */
export function registerCommands(ev) {
  const reg = ev.customCommandRegistry;
  const any = { permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false };
  const op = { permissionLevel: CommandPermissionLevel.GameDirectors, cheatsRequired: true };
  try {
    reg.registerCommand({ name: "glc:ring", description: "Open your Power Ring menu", ...any }, run((p) => openMainMenu(p)));
    reg.registerCommand({ name: "glc:oath", description: "Recite the Green Lantern oath", ...any },
      run((p) => oathIntro(p, data(p).sworn ? "reaffirm" : "unlock")));
    reg.registerCommand({ name: "glc:guide", description: "How to use the Green Lantern add-on", ...any }, run((p) => openGuide(p)));
    reg.registerCommand({ name: "glc:fly", description: "Toggle ring flight", ...any }, run((p) => toggleFlight(p)));
    reg.registerCommand({
      name: "glc:rank", description: "Set your Lantern rank (1-5) for testing", ...op,
      mandatoryParameters: [{ name: "rank", type: CustomCommandParamType.Integer }],
    }, run((p, rank) => {
      const d = data(p);
      d.sworn = true;
      d.rank = Math.max(1, Math.min(RANKS.length, Number(rank) || 1));
      d.xp = Math.max(d.xp, RANKS[d.rank - 1].xp);
      save(p, true);
      fullRecharge(p, 0);
      ringSay(p, `Rank set to ${RANKS[d.rank - 1].name}.`, true);
    }));
    reg.registerCommand({ name: "glc:recharge", description: "Fully recharge your Power Ring", ...op },
      run((p) => {
        fullRecharge(p, 0.5);
        ringSay(p, "Ring recharged.", true);
      }));
    reg.registerCommand({ name: "glc:kit", description: "Give the Green Lantern starter kit", ...op },
      run((p) => {
        const inv = p.getComponent("minecraft:inventory")?.container;
        const items = ["glc:power_ring", "glc:power_battery", "glc:central_battery", "glc:book_of_oa",
          ...SUITS.map((s) => `glc:${s.id}`)];
        for (const id of items) {
          const left = inv?.addItem(new ItemStack(id, 1));
          if (left) p.dimension.spawnItem(left, p.location);
        }
        ringSay(p, "Starter kit delivered.", true);
      }));
    reg.registerCommand({ name: "glc:reset", description: "Reset your Lantern progress", ...op },
      run((p) => {
        resetData(p);
        ringSay(p, "Your Lantern progress has been reset. The ring awaits a new oath.", true);
      }));
  } catch (e) {
    console.warn(`[GLC] custom commands unavailable: ${e}`);
  }
}
