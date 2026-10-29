import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain"), "", "Save before measuring");
const revision = git("rev-parse", "HEAD"),
  out = process.argv[2] ?? "benchmarks/canvas-ui/browser.json";
const root = resolve("."),
  server = await createServer({
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
const browser = await chromium.launch({
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
const workloads = [],
  cycles = [];
try {
  for (const fallback of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1000, height: 700 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
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
    await page.goto("http://127.0.0.1:4173");
    await page.waitForFunction(() => !!window.demo);
    await page.evaluate(() => window.demo.dispose());
    const url = `/@fs/${root}/tests/browser/canvas-ui-benchmark.ts`;
    for (const count of [10, 100, 1000]) {
      const result = await page.evaluate(
        async ({ url, count }) => (await import(url)).browserWorkload(count),
        { url, count },
      );
      workloads.push({ renderer: fallback ? "Canvas2D" : "WebGL", ...result });
      console.log(
        JSON.stringify({
          renderer: fallback ? "Canvas2D" : "WebGL",
          count,
          mount: result.mountMs,
          edit: result.editLayoutSyncMs.p50,
          gesture: result.gesture7SyntheticEventsMs.p50,
          dispose: result.disposeMs,
        }),
      );
    }
    await page.evaluate(async (url) => {
      window.canvasCycles = await (await import(url)).createCycleProbe();
    }, url);
    const client = await page.context().newCDPSession(page);
    await client.send("HeapProfiler.collectGarbage");
    const initial = await client.send("Runtime.getHeapUsage"),
      heap = [];
    for (let i = 0; i < 30; i++) {
      const released = await page.evaluate(() => window.canvasCycles.cycle());
      assert.equal(released.visuals.nodes, 0);
      assert.equal(released.visuals.presentations, 0);
      assert.equal(released.mirrors, 0);
      assert.equal(released.pointers.captures, 0);
      if ((i + 1) % 5 === 0) {
        await client.send("HeapProfiler.collectGarbage");
        heap.push({
          cycle: i + 1,
          ...(await client.send("Runtime.getHeapUsage")),
        });
      }
    }
    const released = await page.evaluate(() => window.canvasCycles.dispose());
    assert.equal(released.input, 0);
    cycles.push({
      renderer: fallback ? "Canvas2D" : "WebGL",
      count: 30,
      buttons: 100,
      initial,
      heap,
      released,
      scope:
        "CDP V8 heap, GC after each five complete Scene round trips; not native or GPU memory",
    });
    assert.deepEqual(errors, []);
    await page.close();
  }
  const report = {
    revision,
    time: new Date().toISOString(),
    environment: {
      node: process.version,
      browser: browser.version(),
      cpu: cpus()[0].model,
      platform: platform(),
      renderer: "SwiftShader WebGL / forced Canvas2D",
      viewport: { width: 1000, height: 700 },
    },
    scope:
      "20 recorded samples, 10 pointer warmups. UI synchronization timing excludes app.render. Draw submission is synchronous CPU/driver time, not GPU completion or FPS. Synthetic DOM pointer sequences test adapter overhead, not physical input latency. Functional mouse/CDP touch/keyboard validation is a separate suite. Mount includes initial presentation/render. No concurrent local tests/builds.",
    workloads,
    cycles,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ out, revision, cycles }));
} finally {
  await browser.close();
  await server.close();
}
