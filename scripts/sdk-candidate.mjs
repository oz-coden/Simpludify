import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { sdkVersion } from "./sdk-version.mjs";

export const candidateDirectory = resolve(
  import.meta.dirname,
  "../test-results/packages",
);
export const sdkNames = ["core", "web"];
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export function readCandidate() {
  return Object.fromEntries(
    sdkNames.map((name) => {
      const [packed] = readJson(join(candidateDirectory, `${name}-pack.json`));
      assert.equal(packed.name, `@simpludify/${name}`);
      assert.equal(packed.version, sdkVersion);
      assert.equal(packed.filename, `simpludify-${name}-${sdkVersion}.tgz`);
      const path = join(candidateDirectory, packed.filename);
      const data = readFileSync(path);
      const integrity = createHash("sha512").update(data).digest("base64");
      assert.equal(packed.integrity, `sha512-${integrity}`);
      return [name, { packed, path, data }];
    }),
  );
}

export function runConsumerNpm(project, args, env = {}) {
  assert(process.env.npm_execpath, "Run consumer validation through npm");
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [process.env.npm_execpath, ...args], {
      cwd: project,
      env: { ...process.env, NODE_PATH: "", ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? done() : reject(new Error(`npm ${args.join(" ")}: ${code}`)),
    );
  });
}

export const installFlags = ["--no-audit", "--no-fund", "--prefer-offline"];
export const publicRegistry = "https://registry.npmjs.org/";
export const sdkLocation = (name) => `node_modules/@simpludify/${name}`;

export function writeSdkRegistry(project, url) {
  writeFileSync(join(project, ".npmrc"), `@simpludify:registry=${url}\n`);
}

export function assertInstalledSdk(
  project,
  { version = sdkVersion, resolved, integrity } = {},
) {
  const lock = readJson(join(project, "package-lock.json"));
  for (const name of sdkNames) {
    const path = join(project, sdkLocation(name));
    const entry = lock.packages[sdkLocation(name)];
    assert.equal(entry?.version, version, `${name}: locked SDK version`);
    assert.equal(entry.resolved, resolved(name), `${name}: locked SDK origin`);
    if (integrity) assert.equal(entry.integrity, integrity(name));
    assert(!entry.link && !lstatSync(path).isSymbolicLink());
    const relativePath = relative(realpathSync(project), realpathSync(path));
    assert(
      relativePath &&
        !relativePath.startsWith("..") &&
        !isAbsolute(relativePath),
    );
    const manifest = readJson(join(path, "package.json"));
    assert.equal(manifest.name, `@simpludify/${name}`);
    assert.equal(manifest.version, version);
    if (name === "web")
      assert.equal(manifest.dependencies["@simpludify/core"], version);
  }
}

export const publicSdkUrl = (name, version = sdkVersion) =>
  `${publicRegistry}@simpludify/${name}/-/${name}-${version}.tgz`;

export async function installCandidateProject(project) {
  const candidate = readCandidate();
  mkdirSync(join(project, ".sdk"));
  for (const { path, packed } of Object.values(candidate))
    copyFileSync(path, join(project, ".sdk", packed.filename));

  // Both tarballs are explicit in the temporary lock. A scope lookup would indicate
  // that npm cannot satisfy an SDK edge from the archives being tested.
  writeSdkRegistry(project, "http://127.0.0.1:1/");
  const resolved = (name) => `file:.sdk/${candidate[name].packed.filename}`;
  await runConsumerNpm(project, [
    "install",
    "--package-lock-only",
    "--ignore-scripts",
    "--save-exact",
    ...installFlags,
    ...sdkNames.map(resolved),
  ]);
  await runConsumerNpm(project, ["ci", ...installFlags]);
  assertInstalledSdk(project, {
    resolved,
    integrity: (name) => candidate[name].packed.integrity,
  });
}
