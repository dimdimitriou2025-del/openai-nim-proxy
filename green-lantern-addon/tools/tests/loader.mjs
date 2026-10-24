// Node module hook: resolve the Minecraft script modules to the local mocks.
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const MAP = {
  "@minecraft/server": pathToFileURL(join(here, "mock", "server.js")).href,
  "@minecraft/server-ui": pathToFileURL(join(here, "mock", "server-ui.js")).href,
};

export async function resolve(specifier, context, next) {
  if (MAP[specifier]) return { url: MAP[specifier], shortCircuit: true };
  return next(specifier, context);
}

// Pack scripts are ES modules, but the packs carry no package.json (it would be shipped).
export async function load(url, context, next) {
  if (url.startsWith("file:") && url.includes("/packs/") && url.endsWith(".js")) {
    return next(url, { ...context, format: "module" });
  }
  return next(url, context);
}
