import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";
import { checkPackageReadme } from "./check-package-readmes.mjs";
import {
  assertInstalledSdk,
  installCandidateProject,
  installFlags,
  publicRegistry,
  publicSdkUrl,
  readJson,
  runConsumerNpm,
  sdkNames,
  writeSdkRegistry,
} from "./sdk-candidate.mjs";
import { sdkVersion } from "./sdk-version.mjs";

const root = resolve(import.meta.dirname, ".."),
  project = mkdtempSync(join(tmpdir(), "simpludify-starter-"));
cpSync(join(root, "templates/npm-vite"), project, {
  recursive: true,
  filter: (source) => !/[\\/](?:node_modules|dist)(?:[\\/]|$)/.test(source),
});
const registryMode = process.argv.includes("--registry");
const run = (args) => runConsumerNpm(project, args);
const starterVersion = readJson(join(project, "package.json")).dependencies[
  "@simpludify/web"
];
assert.match(
  starterVersion,
  /^\d+\.\d+\.\d+$/,
  "Starter must pin a published SDK version",
);
const starterLock = readJson(join(project, "package-lock.json"));
for (const name of sdkNames) {
  const entry = starterLock.packages[`node_modules/@simpludify/${name}`];
  assert.equal(
    entry.version,
    starterVersion,
    "Starter lock must match its published SDK pin",
  );
  assert.equal(entry.resolved, publicSdkUrl(name, starterVersion));
}
const manifest = { name: "@simpludify/web", version: sdkVersion };
for (const bad of [
  "Experimental v0.1.0\nnpm install @simpludify/web@0.1.0",
  `Experimental v${sdkVersion}\nnpm install @simpludify/web@${sdkVersion}\nOnce published:`,
])
  assert.throws(() => checkPackageReadme(manifest, bad));
if (registryMode) {
  writeSdkRegistry(project, publicRegistry);
  const cache = ["--cache", join(project, ".npm-cache")];
  if (starterVersion !== sdkVersion) {
    await run([
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--save-exact",
      ...installFlags,
      ...cache,
      `@simpludify/web@${sdkVersion}`,
    ]);
  }
  await run(["ci", ...installFlags, ...cache]);
  assertInstalledSdk(project, { resolved: publicSdkUrl });
} else {
  if (!process.argv.includes("--packed"))
    await runConsumerNpm(root, ["run", "pack:packages"]);
  await installCandidateProject(project);
}
await run(["run", "check"]);
await run(["run", "build", "--", "--base", "/starter-test/"]);
const notices = readFileSync(
  join(project, "dist/THIRD-PARTY-NOTICES.txt"),
  "utf8",
);
for (const pkg of [
  `@simpludify/core@${sdkVersion}`,
  `@simpludify/web@${sdkVersion}`,
  "pixi.js@",
  "@pixi/colord@2.9.6",
  "0d16e3b7ab0a4bcb42e6682712cc124af5f7ce9d",
])
  assert(notices.includes(pkg), pkg);
assert(!notices.includes("## typescript@"));
assert(existsSync(join(project, "dist/LICENSE.txt")));
const server = await preview({
  configFile: false,
  root: project,
  base: "/starter-test/",
  preview: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: [
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.getByRole("button", { name: "Move right", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Move right", exact: true })
    .press("Enter");
  await page
    .getByRole("button", { name: "Restart scene", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "Move right", exact: true }).waitFor();
  assert.equal(await page.locator(".simpludify > canvas").count(), 1);
  assert.equal(
    await page
      .locator(".simpludify")
      .evaluate((el) => getComputedStyle(el).position),
    "relative",
  );
  assert.equal(
    (
      await page.request.get(
        new URL("THIRD-PARTY-NOTICES.txt", server.resolvedUrls.local[0]).href,
      )
    ).status(),
    200,
  );
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await server.close();
}
// Missing or altered production licenses must fail instead of silently producing incomplete notices.
const license = join(project, "node_modules/@simpludify/core/LICENSE");
writeFileSync(license, "");
// An empty license text must also fail; the generator checks the text body.
await assert.rejects(() => run(["run", "licenses"]));
console.log(
  `PASS independent ${registryMode ? "public registry" : "candidate"} starter: npm ci, types, production subpath/CSS, scene restart and notices (${process.platform}); ${project}`,
);
