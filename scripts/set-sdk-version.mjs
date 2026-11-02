import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
assert(
  process.argv.length === 3 && /^\d+\.\d+\.\d+$/.test(version),
  "Usage: npm run version:sdk -- X.Y.Z",
);
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const json = (path) => JSON.parse(read(path));
const write = (path, value) => writeFileSync(new URL(path, root), value);
const writeJSON = (path, value) =>
  write(path, `${JSON.stringify(value, null, 2)}\n`);
const previous = json("package.json").version;
for (const path of [
  "package.json",
  "packages/core/package.json",
  "packages/web/package.json",
]) {
  const manifest = json(path);
  manifest.version = version;
  if (path === "packages/web/package.json")
    manifest.dependencies["@simpludify/core"] = version;
  writeJSON(path, manifest);
}
const lock = json("package-lock.json");
lock.version = version;
for (const path of ["", "packages/core", "packages/web"])
  lock.packages[path].version = version;
lock.packages["packages/web"].dependencies["@simpludify/core"] = version;
writeJSON("package-lock.json", lock);
const source = "packages/core/src/foundation/version.ts";
write(
  source,
  read(source).replace(
    /ENGINE_VERSION = "[^"]+"/,
    `ENGINE_VERSION = "${version}"`,
  ),
);
for (const name of ["core", "web"]) {
  const path = `packages/${name}/README.md`;
  write(path, read(path).replaceAll(previous, version));
}
await import("./sdk-version.mjs");
await import("./check-package-readmes.mjs");
console.log(
  `SDK ${previous} → ${version}. Review release notes and registry status before publishing.`,
);
