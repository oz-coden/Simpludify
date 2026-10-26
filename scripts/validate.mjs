import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g))
    if (!match[1].startsWith("."))
      throw new Error(`CORE_BOUNDARY: ${file}: ${match[1]}`);
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
