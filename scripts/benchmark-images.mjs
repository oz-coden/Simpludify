import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = process.cwd();
const output = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : undefined;
const server = await createServer({
  configFile: false,
  root: resolve("examples/ui-scenes"),
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 4192,
    strictPort: true,
    fs: { allow: [root] },
  },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: [
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--js-flags=--expose-gc",
      "--enable-precise-memory-info",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1000, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:4192");
  await page.waitForFunction(() => !!window.demo);
  const rows = await page.evaluate(async (sdk) => {
    const {
      Actor,
      Transform,
      Renderable,
      Scene,
      PixiRenderer,
      createViewTransform,
    } = await import(sdk);
    window.demo.dispose();
    const image = (i) =>
      `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#${(0x102030 + i).toString(16).padStart(6, "0")}"/></svg>`)}`;
    const view = createViewTransform({
      viewport: { x: 0, y: 0, width: 720, height: 540 },
    });
    const heap = () => {
      window.gc?.();
      return performance.memory?.usedJSHeapSize ?? null;
    };
    const actors = (scene, count, different = false) => {
      const rows = [];
      for (let i = 0; i < count; i++) {
        const a = scene.add(new Actor());
        a.add(
          new Transform({
            x: 10 + (i % 40) * 17,
            y: 10 + Math.floor(i / 40) * 20,
          }),
        );
        rows.push(
          a.add(
            new Renderable({
              source: { kind: "image", url: image(different ? i : 0) },
              width: 12,
              height: 16,
            }),
          ),
        );
      }
      return rows;
    };
    const create = async () => {
      const host = document.createElement("div");
      document.body.append(host);
      const renderer = new PixiRenderer(host);
      await renderer.init();
      renderer.resize(720, 540, 1);
      let loads = 0;
      const load = renderer.image.bind(renderer);
      renderer.image = (...args) => {
        loads++;
        return load(...args);
      };
      return { renderer, host, loads: () => loads };
    };
    const resources = (renderer) => {
      const sprites = (renderer.app.stage?.children ?? [])
        .flatMap((root) => root.children[0]?.children ?? [])
        .filter((s) => s.texture);
      return {
        sprites: sprites.length,
        uniqueTextures: new Set(sprites.map((s) => s.texture)).size,
        uniqueTextureSources: new Set(sprites.map((s) => s.texture.source))
          .size,
      };
    };
    const rows = [];
    for (const workload of [
      "same-100",
      "same-1000",
      "different-100",
      "cached-switch",
      "scene-transition",
      "two-renderers",
    ]) {
      const runs = [];
      for (let iteration = 0; iteration < 7; iteration++) {
        const f = await create(),
          scene = new Scene("images");
        const heapBefore = heap();
        let start = performance.now();
        const count =
          workload === "same-1000"
            ? 1000
            : workload === "cached-switch"
              ? 3
              : workload === "two-renderers"
                ? 1
                : 100;
        const views = actors(scene, count, workload === "different-100");
        if (workload === "cached-switch")
          views[1].source = { kind: "image", url: image(1) };
        const createMs = performance.now() - start;
        start = performance.now();
        const prepared = await f.renderer.prepare(scene);
        const prepareMs = performance.now() - start;
        start = performance.now();
        prepared.render(view);
        const renderMs = performance.now() - start;
        const heapPrepared = heap(),
          initialLoads = f.loads();
        let extraMs = 0,
          extraLoads = 0,
          overlap,
          other;
        if (workload === "cached-switch") {
          start = performance.now();
          for (let j = 0; j < 20; j++) {
            views[0].source = { kind: "image", url: image(j % 2 ? 0 : 1) };
            prepared.render(view);
            await prepared.ready();
            prepared.render(view);
          }
          extraMs = performance.now() - start;
          extraLoads = f.loads() - initialLoads;
        } else if (workload === "scene-transition") {
          other = new Scene("next");
          actors(other, count);
          start = performance.now();
          const next = await f.renderer.prepare(other);
          extraMs = performance.now() - start;
          extraLoads = f.loads() - initialLoads;
          next.render(view);
          overlap = { ...f.renderer.diagnostics, ...resources(f.renderer) };
          scene.dispose();
          next.render(view);
        } else if (workload === "two-renderers") {
          const second = await create(),
            scene2 = new Scene("independent");
          actors(scene2, 1);
          const ready2 = await second.renderer.prepare(scene2);
          ready2.render(view);
          overlap = [f.renderer.diagnostics, second.renderer.diagnostics];
          scene.dispose();
          f.renderer.dispose();
          ready2.render(view);
          overlap.push(second.renderer.diagnostics);
          scene2.dispose();
          second.renderer.dispose();
          second.host.remove();
          if (Object.values(second.renderer.diagnostics).some((n) => n !== 0))
            throw Error("second renderer leak");
        }
        const live = { ...f.renderer.diagnostics, ...resources(f.renderer) };
        start = performance.now();
        scene.dispose();
        other?.dispose();
        f.renderer.dispose();
        const disposeMs = performance.now() - start;
        const after = f.renderer.diagnostics;
        if (Object.values(after).some((n) => n !== 0))
          throw Error("renderer leak");
        f.host.remove();
        const heapDisposed = heap();
        if (iteration >= 2)
          runs.push({
            createMs,
            prepareMs,
            renderMs,
            extraMs,
            disposeMs,
            initialLoads,
            extraLoads,
            live,
            overlap,
            after,
            heapBefore,
            heapPrepared,
            heapDisposed,
          });
        await new Promise(requestAnimationFrame);
      }
      rows.push({ workload, warmup: 2, runs });
    }
    return rows;
  }, `/@fs/${root}/packages/web/src/index.ts`);
  for (const row of rows)
    for (const run of row.runs)
      assert.ok(Object.values(run.after).every((n) => n === 0));
  const median = (values) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const report = {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    runtimeDiffSha256: createHash("sha256")
      .update(execFileSync("git", ["diff", "HEAD", "--", "packages/"]))
      .digest("hex"),
    node: process.version,
    platform: platform(),
    cpu: cpus()[0]?.model,
    browser: browser.version(),
    conditions:
      "WebGL/SwiftShader; Vite dev; viewport1000x800 DPR1;720x540 canvas; 32x32 data SVGs; 2 warmup+5 samples/workload; CPU submission, not GPU time. initialLoads counts Image loader/Texture creation calls, not network/cache hits. forced-GC performance.memory is JS heap only, includes host/tooling. No native/GPU-memory measurement.",
    rows: rows.map((row) => ({
      ...row,
      median: Object.fromEntries(
        [
          "createMs",
          "prepareMs",
          "renderMs",
          "extraMs",
          "disposeMs",
          "initialLoads",
          "extraLoads",
          "heapBefore",
          "heapPrepared",
          "heapDisposed",
        ].map((k) => [k, median(row.runs.map((r) => r[k]))]),
      ),
    })),
  };
  if (output) {
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(
    JSON.stringify(
      {
        ...report,
        rows: report.rows.map(({ runs, ...row }) => ({
          ...row,
          representative: runs[2],
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
