// Run from a 0.1.5 source checkout with npm ci; the engine itself comes only from npm.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../../../..");
const consumer = mkdtempSync(join(tmpdir(), "simpludify-registry-virtual-"));
const run = (command, args, cwd, env = process.env) =>
  new Promise((done, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? done(output) : reject(new Error(output)),
    );
  });
const report = {
  mode: "public-registry-virtual-consumer",
  consumer,
  packages: [],
  checks: [],
};
let server;
try {
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "@simpludify/core@0.1.5",
      "@simpludify/web@0.1.5",
    ],
    consumer,
  );
  for (const name of ["core", "web"]) {
    const pkg = JSON.parse(
      readFileSync(
        join(consumer, `node_modules/@simpludify/${name}/package.json`),
        "utf8",
      ),
    );
    const lock = JSON.parse(
      readFileSync(join(consumer, "package-lock.json"), "utf8"),
    ).packages[`node_modules/@simpludify/${name}`];
    assert.equal(pkg.version, "0.1.5");
    assert.match(lock.resolved, /^https:\/\/registry\.npmjs\.org\//);
    report.packages.push({
      name: pkg.name,
      version: pkg.version,
      resolved: lock.resolved,
      integrity: lock.integrity,
    });
  }
  const target = join(consumer, "play/virtual-input");
  mkdirSync(target, { recursive: true });
  mkdirSync(join(consumer, "play/shared"), { recursive: true });
  cpSync(
    join(root, "examples/virtual-input/index.html"),
    join(target, "index.html"),
  );
  cpSync(
    join(root, "examples/shared/start.ts"),
    join(consumer, "play/shared/start.ts"),
  );
  // HMR is source-tooling-only; all game code and public SDK imports are unchanged.
  const main = readFileSync(
    join(root, "examples/virtual-input/main.ts"),
    "utf8",
  ).replace(
    "if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());",
    "",
  );
  writeFileSync(join(target, "main.ts"), main);
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        strict: true,
        noEmit: true,
        types: [],
      },
      include: ["play/**/*.ts"],
    }),
  );
  await run(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      join(consumer, "tsconfig.json"),
    ],
    consumer,
  );
  report.checks.push(
    "Strict public declarations; no workspace aliases or engine source imports",
  );
  const { build, preview } = await import(
    pathToFileURL(join(root, "node_modules/vite/dist/node/index.js")).href
  );
  await build({
    root: consumer,
    configFile: false,
    base: "/verify/",
    logLevel: "error",
    build: { rollupOptions: { input: join(target, "index.html") } },
  });
  report.checks.push("Production subpath build from public Core/Web 0.1.5");
  server = await preview({
    root: consumer,
    configFile: false,
    base: "/verify/",
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");
  await run(
    process.execPath,
    [join(root, "scripts/site-virtual-input-live.mjs")],
    root,
    {
      ...process.env,
      SITE_URL: `http://127.0.0.1:${address.port}/verify/`,
      GITHUB_SHA: "npm:@simpludify/core@0.1.5+@simpludify/web@0.1.5",
    },
  );
  report.result = JSON.parse(
    readFileSync(
      join(root, "test-results/site/virtual-input-live.json"),
      "utf8",
    ),
  );
  assert.equal(report.result.cases.length, 4);
  report.checks.push(
    "WebGL/Canvas2D × 1440/390px: CDP crossing, third-button release, neutral cancel, same Actor program handoff, Scene/final cleanup",
  );
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  await server?.close();
  mkdirSync(join(root, "test-results/packages"), { recursive: true });
  writeFileSync(
    join(root, "test-results/packages/virtual-registry.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
}
