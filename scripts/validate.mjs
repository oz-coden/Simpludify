import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { validateCoreDependency } from "./core-boundary.mjs";
import { sdkVersion } from "./sdk-version.mjs";

const core = "packages/core/src";
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
}
const runtimeGraph = new Map();
for (const file of files(core)) {
  const edges = [];
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
    if (!typeOnly) edges.push(resolve(dirname(file), `${match[3]}.ts`));
  }
  for (const match of source.matchAll(/import\s*(?:\(\s*)?["']([^"']+)["']/g))
    validateCoreDependency(core, file, match[1]);
  runtimeGraph.set(resolve(file), edges);
}
const visited = new Set(),
  visiting = new Set();
function visitModule(file, chain = []) {
  if (visiting.has(file))
    throw new Error(`CORE_CYCLE: ${[...chain, file].join(" -> ")}`);
  if (visited.has(file)) return;
  visiting.add(file);
  for (const next of runtimeGraph.get(file) ?? [])
    visitModule(next, [...chain, file]);
  visiting.delete(file);
  visited.add(file);
}
for (const file of runtimeGraph.keys()) visitModule(file);
for (const file of [
  "examples/character/index.html",
  "examples/ui-scenes/index.html",
  "examples/ui-scenes/public/player.svg",
  "examples/signal-run/index.html",
  "examples/signal-run/logic.ts",
  "examples/signal-run/main.ts",
  "docs/archive/practical-validation.md",
  "LICENSE",
  "docs/en/api.md",
  "docs/ja/api.md",
  "docs/en/architecture.md",
  "docs/ja/architecture.md",
])
  if (!existsSync(file)) throw new Error(`FILE_MISSING: ${file}`);
for (const folder of ["core", "web"]) {
  const pkg = JSON.parse(
    readFileSync(`packages/${folder}/package.json`, "utf8"),
  );
  function leaves(value) {
    return typeof value === "string"
      ? [value]
      : Object.values(value).flatMap(leaves);
  }
  for (const entry of leaves(pkg.exports)) {
    // Distribution existence is verified separately after build:packages.
    if (
      !entry.startsWith("./dist/") &&
      !existsSync(join("packages", folder, entry))
    )
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

const workspaceVersion = sdkVersion;
console.log(`SDK version ${workspaceVersion} is consistent.`);
