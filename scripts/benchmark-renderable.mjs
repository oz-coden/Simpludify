import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

// Historical measurement adapter: old dynamic rendering uses documented remove/add.
const legacy = process.argv.includes("--legacy");
const output = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : undefined;
const root = process.cwd();
const server = await createServer({
  configFile: false,
  root: resolve("examples/ui-scenes"),
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 4191,
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
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1000, height: 800 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:4191");
  await page.waitForFunction(() => !!window.demo);
  const rows = await page.evaluate(
    async ({ sdk, legacy }) => {
      const {
        Actor,
        Transform,
        Renderable,
        Shape,
        Scene,
        PixiRenderer,
        createViewTransform,
      } = await import(sdk);
      window.demo.dispose();
      const image = (color) =>
        `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="16"><rect width="32" height="16" fill="${color}"/></svg>`)}`;
      const options = (value) => {
        if (!legacy) return value;
        const { source, ...rest } = value;
        return source?.kind === "image"
          ? { ...rest, sprite: source.url, fit: source.fit }
          : { ...rest, shape: source?.shape ?? Shape.Box };
      };
      const results = [];
      for (const workload of ["static", "color", "dimensions", "images"]) {
        const host = document.createElement("div");
        host.style.cssText = "width:720px;height:540px";
        document.body.append(host);
        const scene = new Scene(workload),
          actors = [],
          count = workload === "images" ? 16 : 1000;
        for (let i = 0; i < count; i++) {
          const actor = scene.add(new Actor());
          actor.add(
            new Transform({
              x: 10 + (i % 40) * 17,
              y: 10 + Math.floor(i / 40) * 20,
            }),
          );
          const value = {
            width: 12,
            height: 16,
            color: 0xffffff,
            source:
              workload === "images"
                ? { kind: "image", url: image("red") }
                : { kind: "shape", shape: Shape.Box },
          };
          actors.push({
            actor,
            value,
            view: actor.add(new Renderable(options(value))),
          });
        }
        const renderer = new PixiRenderer(host);
        await renderer.init();
        renderer.resize(720, 540, 1);
        let loads = 0;
        const method = legacy ? "texture" : "image",
          load = renderer[method].bind(renderer);
        renderer[method] = (...args) => {
          loads++;
          return load(...args);
        };
        const prepared = await renderer.prepare(scene),
          view = createViewTransform({
            viewport: { x: 0, y: 0, width: 720, height: 540 },
          });
        const seen = new WeakSet();
        let created = 0;
        const collect = () => {
          for (const display of renderer.app.stage.children[0].children[0]
            .children)
            if (!seen.has(display)) {
              seen.add(display);
              created++;
            }
        };
        const mutate = (index) => {
          if (workload === "static") return;
          const change =
            workload === "color"
              ? { color: index % 2 ? 0xff8080 : 0x80ff80 }
              : workload === "dimensions"
                ? { width: index % 2 ? 12 : 14, height: index % 2 ? 16 : 18 }
                : {
                    source: {
                      kind: "image",
                      url: image(index % 2 ? "red" : "blue"),
                    },
                  };
          for (const row of actors) {
            if (legacy) {
              row.value = { ...row.value, ...change };
              row.actor.remove(Renderable.type);
              row.view = row.actor.add(new Renderable(options(row.value)));
            } else
              for (const [key, value] of Object.entries(change))
                row.view[key] = value;
          }
        };
        for (let i = 0; i < 20; i++) {
          mutate(i);
          prepared.render(view);
          if (workload === "images") await prepared.ready();
        }
        prepared.render(view);
        collect();
        const objectsBefore = created,
          loadsBefore = loads,
          samples = [],
          frames = workload === "images" ? 20 : 100;
        for (let i = 0; i < frames; i++) {
          const start = performance.now();
          mutate(i);
          prepared.render(view);
          if (workload === "images") {
            await prepared.ready();
            prepared.render(view);
          }
          samples.push(performance.now() - start);
          collect();
          await new Promise(requestAnimationFrame);
        }
        const beforeDispose = renderer.diagnostics,
          start = performance.now();
        scene.dispose();
        renderer.dispose();
        results.push({
          workload,
          actors: count,
          frames,
          samples,
          newDisplayObjects: created - objectsBefore,
          newLoads: loads - loadsBefore,
          beforeDispose,
          afterDispose: renderer.diagnostics,
          disposalMilliseconds: performance.now() - start,
        });
        host.remove();
      }
      const host = document.createElement("div");
      document.body.append(host);
      const renderer = new PixiRenderer(host);
      await renderer.init();
      const samples = [];
      for (let i = 0; i < 30; i++) {
        const start = performance.now(),
          scene = new Scene("cycle");
        for (let j = 0; j < 100; j++) {
          const actor = scene.add(new Actor());
          actor.add(new Transform());
          actor.add(new Renderable());
        }
        const prepared = await renderer.prepare(scene);
        prepared.render(
          createViewTransform({
            viewport: { x: 0, y: 0, width: 720, height: 540 },
          }),
        );
        scene.dispose();
        samples.push(performance.now() - start);
      }
      renderer.dispose();
      host.remove();
      results.push({
        workload: "100-visual prepare/render/dispose",
        cycles: 30,
        samples,
        afterDispose: renderer.diagnostics,
      });
      return results;
    },
    { sdk: `/@fs/${root}/packages/web/src/index.ts`, legacy },
  );
  const percentile = (values) => {
    const a = [...values].sort((a, b) => a - b);
    return {
      p50: a[Math.floor((a.length - 1) * 0.5)],
      p95: a[Math.floor((a.length - 1) * 0.95)],
      p99: a[Math.floor((a.length - 1) * 0.99)],
    };
  };
  for (const row of rows)
    assert.deepEqual(row.afterDispose, {
      presentations: 0,
      visuals: 0,
      textures: 0,
      imageReferences: 0,
      imageEntries: 0,
      pendingImages: 0,
    });
  const report = {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    runtimeDiffSha256: createHash("sha256")
      .update(execFileSync("git", ["diff", "HEAD", "--", "packages/"]))
      .digest("hex"),
    strategy: legacy ? "pre-live remove/add" : "live revisions",
    node: process.version,
    platform: platform(),
    cpu: cpus()[0]?.model,
    browser: browser.version(),
    conditions:
      "WebGL/SwiftShader; Vite dev; 1000x800 DPR1; 20 warmup; 100 shape samples, 20 image samples; mutation + CPU submission, images include readiness; RAF yield outside timing; no GPU/native-memory measurement",
    rows: rows.map((row) => ({ ...row, summary: percentile(row.samples) })),
  };
  if (output) {
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(
    JSON.stringify(
      { ...report, rows: report.rows.map(({ samples, ...row }) => row) },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
