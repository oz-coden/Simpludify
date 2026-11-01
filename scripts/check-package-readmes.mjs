import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export function checkPackageReadme(manifest, text) {
  assert(
    text.includes(`Experimental v${manifest.version}`),
    `${manifest.name}: README version must match manifest ${manifest.version}`,
  );
  assert(
    text.includes(`npm install ${manifest.name}@${manifest.version}`),
    `${manifest.name}: README install command must match manifest`,
  );
  for (const match of text.matchAll(
    /@simpludify\/(?:core|web)@(\d+\.\d+\.\d+(?:-[\w.-]+)?)/g,
  ))
    assert.equal(
      match[1],
      manifest.version,
      `${manifest.name}: stale README SDK version`,
    );
  assert(
    !/registry availability is not yet confirmed|distribution is being prepared|Once published:|not yet published/i.test(
      text,
    ),
    `${manifest.name}: stale unpublished README state`,
  );
}
export function checkPackageReadmes() {
  for (const name of ["core", "web"]) {
    const dir = new URL(`../packages/${name}/`, import.meta.url);
    checkPackageReadme(
      JSON.parse(readFileSync(new URL("package.json", dir), "utf8")),
      readFileSync(new URL("README.md", dir), "utf8"),
    );
  }
}
checkPackageReadmes();
