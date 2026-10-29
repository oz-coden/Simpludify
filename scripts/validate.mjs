import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateCoreDependency } from "./core-boundary.mjs";

const core = "packages/core/src";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
}
for (const file of files(core)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(
    /(?:import|export)\s+(type\s+)?(\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s*from\s*["']([^"']+)["']/g,
  )) {
    const typeOnly = Boolean(
      match[1] ||
        (match[2].startsWith("{") &&
          match[2]
            .slice(1, -1)
            .split(",")
            .filter((s) => s.trim())
            .every((s) => s.trim().startsWith("type "))),
    );
    validateCoreDependency(core, file, match[3], typeOnly);
  }
  for (const match of source.matchAll(/import\s*(?:\(\s*)?["']([^"']+)["']/g))
    validateCoreDependency(core, file, match[1]);
}
for (const file of [
  "examples/character/index.html",
  "examples/ui-scenes/index.html",
  "examples/ui-scenes/public/player.svg",
  "examples/signal-run/index.html",
  "examples/signal-run/logic.ts",
  "examples/signal-run/main.ts",
  "docs/practical-validation.md",
  "LICENSE",
  "docs/api.md",
  "docs/architecture.md",
])
  if (!existsSync(file)) throw new Error(`FILE_MISSING: ${file}`);
for (const folder of ["core", "web"]) {
  const pkg = JSON.parse(
    readFileSync(`packages/${folder}/package.json`, "utf8"),
  );
  for (const entry of typeof pkg.exports === "string"
    ? [pkg.exports]
    : Object.values(pkg.exports)) {
    if (!existsSync(join("packages", folder, entry)))
      throw new Error(`EXPORT_MISSING: ${folder}: ${entry}`);
  }
  if (
    Object.keys(pkg.dependencies ?? {}).some((name) =>
      name.includes("electron"),
    )
  )
    throw new Error(`ELECTRON_BOUNDARY: ${folder}`);
}
console.log("Architecture and required-file validation passed.");

const workspaceVersion = JSON.parse(
  readFileSync("package.json", "utf8"),
).version;
const sourceVersion = readFileSync(
  "packages/core/src/foundation/version.ts",
  "utf8",
).match(/ENGINE_VERSION = "([^"]+)"/)?.[1];
if (workspaceVersion !== sourceVersion)
  throw new Error("ENGINE_VERSION does not match package.json");
