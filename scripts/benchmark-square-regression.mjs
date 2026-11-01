import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const source = resolve(process.argv[2] ?? "."),
  output = resolve(
    process.argv[3] ?? "benchmarks/tile-geometry/square-current.json",
  );
const server = await createServer({
  configFile: false,
  root: resolve(source, "examples/ui-scenes"),
  resolve: {
    alias: {
      "@simpludify/core": resolve(source, "packages/core/src/index.ts"),
      "@simpludify/web": resolve(source, "packages/web/src/index.ts"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    fs: { allow: [source, process.cwd()] },
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
          p.getContext = function (k, ...a) {
            return k.includes("webgl")
              ? null
              : Reflect.apply(get, this, [k, ...a]);
          };
        }
      });
    await page.goto("http://127.0.0.1:4173/");
    await page.waitForFunction(() => !!window.demo);
    for (const [size, partial] of [
      [32, false],
      [100, true],
    ])
      for (const dynamic of [false, true])
        for (let repeat = 0; repeat < 3; repeat++) {
          const r = await page.evaluate(
            async (args) =>
              (await import(args.url)).measure(
                args.size,
                args.partial,
                args.dynamic,
              ),
            {
              url: `/@fs/${source}/tests/browser/tilemap-fixture.ts`,
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
            backend: fallback ? "Canvas2D" : "WebGL",
            repeat,
            ...r,
          });
        }
    await page.close();
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    `${JSON.stringify(
      {
        date: new Date().toISOString(),
        source,
        commit: execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim(),
        browser: browser.version(),
        note: "Same existing Tilemap fixture on baseline/current source. Explicit Vite aliases prevent shared node_modules workspace links from selecting the wrong revision. Isolated serial runs; 3 repeats, 5 warmups, 20 draws; dynamic=8 changed visible cells per draw. CPU submission, no GPU fence. Quantized timings are not a statistical equivalence proof.",
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Square regression saved: ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
