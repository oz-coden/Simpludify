import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { arch, cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = process.cwd(),
  output = resolve(process.argv[2] ?? "benchmarks/tile-geometry/results.json");
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
const runs = [];
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
    const r = await page.evaluate(
      async (url) => (await import(url)).measure(),
      `/@fs/${root}/tests/browser/tile-geometry-benchmark.ts`,
    );
    assert.deepEqual(r.errors, []);
    assert.equal(r.remaining.maps, 0);
    assert.equal(r.remaining.graphics, 0);
    for (const row of r.rows) assert.equal(row.staticAndEditCellVisits, 40);
    runs.push({ backend: fallback ? "Canvas2D" : "WebGL", ...r });
    await page.close();
  }
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    JSON.stringify(
      {
        date: new Date().toISOString(),
        node: process.version,
        browser: browser.version(),
        platform: platform(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        viewport: { width: 1440, height: 900 },
        worldResolution: { width: 400, height: 300 },
        warmupFrames: 12,
        samples: 40,
        note: "One foreground page, no concurrent tests/builds. CPU wall times include Pixi render submission, not GPU completion; software SwiftShader. Creation includes Grid allocation/copy. Fixed-view map-size sweep plus all-visible 16/32/64 maps. Selection batch=1000; range batch=100. Raw samples retained.",
        runs,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Geometry measurements saved: ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
