import { writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = process.cwd();
const server = await createServer({
  configFile: false,
  root: resolve("examples/ui-scenes"),
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
    fs: { allow: [root] },
  },
  logLevel: "error",
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
    viewport: { width: 1280, height: 720 },
  });
  await page.goto("http://127.0.0.1:4174");
  await page.waitForFunction(() => window.demo);
  const results = await page.evaluate(async (url) => {
    const {
      Game,
      Character,
      Action,
      ActionController,
      defineActions,
      Label,
      Panel,
    } = await import(url);
    window.demo.dispose();
    const results = [];
    const sample = async (name, setup, count = 180) => {
      const game = new Game();
      const labels = [];
      let tick = 0;
      const actions = defineActions({ Move: Action.axis2D() });
      let controls;
      game.scene("bench", (context) => {
        controls = new ActionController(actions, {
          scene: context.scene,
          input: game.engine.input,
        });
        setup(context, labels, controls.reader(actions.Move));
      });
      await game.run("bench");
      controls.createSource().set(actions.Move, { x: 1, y: 0 });
      const heapBefore = performance.memory?.usedJSHeapSize ?? null;
      let previous;
      const durations = [];
      await new Promise((resolve) => {
        const frame = (time) => {
          if (previous !== undefined) durations.push(time - previous);
          previous = time;
          if (name.includes("UI"))
            labels[tick++ % labels.length]?.setText(`Updated ${tick}`);
          if (name.includes("resize")) {
            game.element.style.width = tick % 2 ? "90%" : "100%";
            game.element.style.setProperty(
              "--s-font",
              tick++ % 2 ? "serif" : "system-ui",
            );
          }
          if (durations.length < count) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      const heapAfter = performance.memory?.usedJSHeapSize ?? null;
      const slowFrames = durations.filter((value) => value > 25).length;
      durations.sort((a, b) => a - b);
      const p = (value) =>
        durations[Math.floor((durations.length - 1) * value)];
      game.dispose();
      results.push({
        workload: name,
        frames: durations.length,
        frameMilliseconds: { p50: p(0.5), p95: p(0.95), p99: p(0.99) },
        slowFramesOver25ms: slowFrames,
        heapBefore,
        heapAfter,
      });
    };
    await sample("idle/empty scene", () => {});
    await sample("1000 moving image sprites", ({ add }, _labels, movement) => {
      for (let i = 0; i < 1000; i++)
        add(
          Character({
            x: (i % 40) * 20,
            y: Math.floor(i / 40) * 18,
            size: 12,
            speed: 1,
            movement,
            source: { kind: "image", url: "./player.svg" },
          }),
        );
    });
    await sample(
      "1000 UI labels / one selective update per frame",
      ({ ui }, labels) => {
        for (let i = 0; i < 1000; i++) labels.push(Label(`Label ${i}`));
        ui(Panel(labels));
      },
    );
    await sample("continuous resize and font changes", ({ ui }) =>
      ui(Panel([Label("Resize and font measurement")])),
    );
    const game = new Game();
    game.scene("cycle", ({ add }) => add(Character()));
    await game.run("cycle");
    const durations = [],
      memory = [];
    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await game.goTo("cycle");
      durations.push(performance.now() - start);
      if (i % 10 === 0) memory.push(performance.memory?.usedJSHeapSize ?? null);
    }
    game.dispose();
    durations.sort((a, b) => a - b);
    results.push({
      workload: "50 scene creation/disposal cycles",
      transitionMilliseconds: {
        p50: durations[24],
        p95: durations[46],
        p99: durations[48],
      },
      heapSamples: memory,
    });
    await sample("short idle memory sample (not a soak test)", () => {}, 300);
    await sample(
      "short active memory sample (not a soak test)",
      ({ add }, _labels, movement) => add(Character({ movement })),
      300,
    );
    return results;
  }, `/@fs/${root}/packages/web/src/index.ts`);
  const report = {
    date: new Date().toISOString(),
    environment: {
      browser: await browser.version(),
      node: process.version,
      platform: platform(),
      cpu: cpus()[0]?.model,
      viewport: [1280, 720],
      renderer: "headless Chromium / WebGL / SwiftShader software rendering",
      build: "Vite development server",
    },
    limitations: [
      "Shared container; not controlled physical hardware",
      "No CPU/GPU load or dropped-frame telemetry",
      "Heap samples are approximate and not forced-GC retained-memory measurements",
      "Short idle/active samples do not replace a long-running soak test",
      "No Godot/Phaser comparator; no performance superiority claim",
    ],
    results,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--out"))
    writeFileSync(process.argv[process.argv.indexOf("--out") + 1], output);
  console.log(output);
} finally {
  await browser?.close();
  await server.close();
}
