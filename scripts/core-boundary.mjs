import { dirname, relative, resolve } from "node:path";

// Runtime dependencies flow toward data/lifecycle modules. Scene's input ownership
// identity is type-only; it must not instantiate Action or device implementations.
const allowed = {
  foundation: ["foundation"],
  scene: ["scene", "foundation"],
  graphics: ["graphics", "scene", "foundation"],
  interaction: ["interaction", "scene", "ui", "foundation"],
  ui: ["ui", "foundation"],
  animation: ["animation", "scene", "graphics", "foundation"],
  game: ["game", "scene", "graphics", "interaction", "foundation"],
  runtime: ["runtime", "scene", "graphics", "interaction", "foundation"],
};
export function validateCoreDependency(
  core,
  file,
  specifier,
  typeOnly = false,
) {
  const fail = () => {
    throw new Error(`CORE_BOUNDARY: ${file}: ${specifier}`);
  };
  if (!specifier.startsWith(".")) fail();
  const from = relative(resolve(core), resolve(file)).split("/");
  const target = relative(
    resolve(core),
    resolve(dirname(file), specifier),
  ).split("/");
  if (target[0] === ".." || from[0] === "..") fail();
  // Root files are public export aggregators. Internal modules import concrete files.
  if (from.length === 1) return;
  if (target.length === 1) fail();
  if (from[0] === "scene" && target[0] === "interaction" && typeOnly) return;
  if (!allowed[from[0]]?.includes(target[0])) fail();
}
