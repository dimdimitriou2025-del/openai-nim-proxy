// Form helpers: retry when the player is busy (e.g. another screen is closing).
import { system } from "@minecraft/server";
import { FormCancelationReason } from "@minecraft/server-ui";

/**
 * Show a form, retrying while the player is busy. Resolves with the response,
 * or undefined if the player closed it / left.
 * @template T
 * @param {import("@minecraft/server").Player} player
 * @param {{show(player: import("@minecraft/server").Player): Promise<T>}} form
 * @returns {Promise<T | undefined>}
 */
export async function showForm(player, form, tries = 20) {
  for (let i = 0; i < tries; i++) {
    if (!player.isValid) return undefined;
    let res;
    try {
      res = await form.show(player);
    } catch {
      return undefined;
    }
    // @ts-ignore - all response types share canceled/cancelationReason
    if (res && res.canceled && res.cancelationReason === FormCancelationReason.UserBusy) {
      await system.waitTicks(5);
      continue;
    }
    return res;
  }
  return undefined;
}

/** Wrap long text for form bodies (forms wrap automatically; this keeps paragraphs tidy). */
export function lines(...parts) {
  return parts.filter((p) => p !== undefined && p !== null).join("\n");
}
