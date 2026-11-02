import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const json = (path) => JSON.parse(read(path));
export const sdkVersion = json("package.json").version;
assert.match(sdkVersion, /^\d+\.\d+\.\d+$/);
for (const name of ["core", "web"]) {
  const manifest = json(`packages/${name}/package.json`);
  assert.equal(manifest.name, `@simpludify/${name}`);
  assert.equal(manifest.version, sdkVersion, `${name}: SDK version mismatch`);
  if (name === "web")
    assert.equal(manifest.dependencies["@simpludify/core"], sdkVersion);
}
assert.equal(
  read("packages/core/src/foundation/version.ts").match(
    /ENGINE_VERSION = "([^"]+)"/,
  )?.[1],
  sdkVersion,
  "ENGINE_VERSION mismatch",
);
const lock = json("package-lock.json");
assert.equal(lock.version, sdkVersion);
for (const path of ["", "packages/core", "packages/web"])
  assert.equal(
    lock.packages[path].version,
    sdkVersion,
    `${path}: lock version mismatch`,
  );
assert.equal(
  lock.packages["packages/web"].dependencies["@simpludify/core"],
  sdkVersion,
);
