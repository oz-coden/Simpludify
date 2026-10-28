import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = process.cwd();
const output = resolve(process.argv[2] ?? "benchmarks/tilemap/results.json");
const server = await createServer({
  configFile: false,
  root: resolve("examples/ui-scenes"),
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    fs: { allow: [root] },
  },
  logLevel: "error",
});
await server.listen();
let browser;
const results = [];
try {
  browser = await chromium.launch({
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
  for (const fallback of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (fallback)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "gpu", { get: () => undefined });
        for (const p of [
          HTMLCanvasElement.prototype,
          typeof OffscreenCanvas === "undefined"
            ? undefined
            : OffscreenCanvas.prototype,
        ]) {
          if (!p) continue;
          const get = p.getContext;
          p.getContext = function (k, ...args) {
            return k.includes("webgl")
              ? null
              : Reflect.apply(get, this, [k, ...args]);
          };
        }
      });
    await page.goto("http://127.0.0.1:4173");
    await page.waitForFunction(() => !!window.demo);
    for (const size of [32, 100, 256])
      for (const partial of [false, true])
        for (const dynamic of [false, true])
          for (let repeat = 0; repeat < 3; repeat++) {
            const r = await page.evaluate(
              async ({ url, size, partial, dynamic }) =>
                (await import(url)).measure(size, partial, dynamic),
              {
                url: `/@fs/${root}/tests/browser/tilemap-fixture.ts`,
                size,
                partial,
                dynamic,
              },
            );
            assert.deepEqual(r.errors, []);
            assert.equal(r.final.imageReferences, 0);
            assert.equal(r.final.textures, 0);
            assert.equal(r.textureSources, 1);
            assert.equal(r.actorCount, 1);
            assert.equal(r.visited, dynamic ? 160 : 0);
            assert.equal(r.updated, dynamic ? 160 : 0);
            assert.equal(r.initial.sprites, partial ? 475 : size * size);
            results.push({
              backend: fallback ? "canvas" : "webgl",
              repeat,
              ...r,
            });
            console.log(
              `${fallback ? "canvas" : "webgl"} ${size} ${partial ? "partial" : "all"} ${dynamic ? "dynamic" : "static"} #${repeat}: ${r.p50.toFixed(3)} ms, ${r.initial.sprites} sprites`,
            );
          }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const report = {
    date: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    browser: browser.version(),
    commit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    worktree: execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
    }).trim(),
    viewport: { width: 1440, height: 900, dpr: 1 },
    logicalResolution: { width: 400, height: 300 },
    tileSize: 16,
    warmups: 5,
    samplesPerRun: 20,
    repeats: 3,
    changedCellsPerStep: 8,
    notes:
      "CPU render submission incl. edits, not GPU completion. Run without other tests/builds. Initial preparation includes first draw at selected zoom; loading and drawing combined. No comparison engine or library measured.",
    results,
  };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(output);
} finally {
  await browser?.close();
  await server.close();
}
