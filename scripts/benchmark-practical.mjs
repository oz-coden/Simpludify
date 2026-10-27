import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer, preview } from "vite";

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const value = args[i + 1];
  assert.ok(value && !value.startsWith("--"), `${name} requires a value`);
  args.splice(i, 2);
  return value;
}
const mode = option("--mode", "core"),
  output = option("--out");
assert.equal(args.length, 0, `Unknown arguments: ${args.join(" ")}`);
assert.ok(["core", "browser"].includes(mode), "Choose core or browser");
const percentile = (samples) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const p = (v) => sorted[Math.floor((sorted.length - 1) * v)];
  return { p50: p(0.5), p95: p(0.95), p99: p(0.99) };
};
const environment = {
  date: new Date().toISOString(),
  node: process.version,
  platform: platform(),
  cpu: cpus()[0]?.model,
  engineSourceCommit: execFileSync(
    "git",
    ["log", "-1", "--format=%H", "--", "packages/core", "packages/web"],
    { encoding: "utf8" },
  ).trim(),
};
let report;
if (mode === "core") {
  assert.equal(
    typeof globalThis.gc,
    "function",
    "Run node --expose-gc scripts/benchmark-practical.mjs",
  );
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  try {
    const {
      Actor,
      Collider,
      CollisionShape,
      CollisionWorld,
      Engine,
      Transform,
    } = await server.ssrLoadModule("/packages/core/src/index.ts");
    const { Round } = await server.ssrLoadModule(
      "/examples/signal-run/logic.ts",
    );
    const results = [];
    for (const workload of ["1000 sparse", "1000 grid", "100 dense"]) {
      const engine = new Engine({ seed: 42 }),
        world = new CollisionWorld(engine.scene);
      const count = workload.startsWith("100 ") ? 100 : 1000;
      for (let i = 0; i < count; i++) {
        const actor = engine.scene.add(new Actor());
        const x = workload.includes("sparse")
          ? i * 20
          : workload.includes("grid")
            ? (i % 40) * 12
            : 0;
        const y = workload.includes("grid") ? Math.floor(i / 40) * 12 : 0;
        actor.add(new Transform({ x, y }));
        actor.add(new Collider({ shape: CollisionShape.Circle, radius: 8 }));
      }
      for (let i = 0; i < 200; i++) engine.step(1 / 60);
      const samples = [];
      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        engine.step(1 / 60);
        samples.push(performance.now() - start);
      }
      results.push({
        workload,
        samples: samples.length,
        milliseconds: percentile(samples),
        diagnostics: world.diagnostics,
      });
      engine.dispose();
      assert.deepEqual(world.diagnostics, {
        colliders: 0,
        contacts: 0,
        candidates: world.diagnostics.candidates,
        narrowTests: world.diagnostics.narrowTests,
      });
    }
    const session = (active) => {
      const engine = new Engine({ seed: 42 }),
        round = active
          ? new Round(engine.scene, engine.input, {
              duration: 601,
              hp: 1000000,
            })
          : undefined;
      const start = performance.now();
      for (let frame = 0; frame < 36000; frame++) {
        if (active && frame % 300 === 0) {
          engine.input.clear();
          round.input.set(round.controls.actions.Move, {
            x: 0,
            y: frame % 600 === 0 ? -1 : 1,
          });
        }
        engine.step(1 / 60);
      }
      const result = {
        workload: active ? "accelerated active round" : "accelerated idle",
        steps: 36000,
        simulationSeconds: 600,
        wallMilliseconds: performance.now() - start,
        round: round?.snapshot(),
      };
      if (round) assert.equal(round.status, "playing");
      engine.dispose();
      if (round) {
        assert.equal(round.world.disposed, true);
        assert.equal(round.pickups.size, 0);
      }
      return result;
    };
    const sessions = [session(false), session(true)];
    const cycle = () => {
      const engine = new Engine({ seed: 42 }),
        round = new Round(engine.scene, engine.input),
        source = round.controls.createSource(engine.scene);
      source.set(round.controls.actions.Move, { x: 1, y: 0 });
      for (let i = 0; i < 60; i++) engine.step(1 / 60);
      engine.dispose();
      assert.equal(engine.input.sourceCount, 0);
      assert.equal(round.world.disposed, true);
      assert.equal(round.world.diagnostics.colliders, 0);
      assert.equal(round.pickups.size, 0);
      assert.equal(round.hazards.size, 0);
    };
    for (let i = 0; i < 50; i++) cycle();
    globalThis.gc();
    globalThis.gc();
    const heap = [{ cycles: 0, heapUsed: process.memoryUsage().heapUsed }];
    for (let batch = 1; batch <= 5; batch++) {
      for (let i = 0; i < 100; i++) cycle();
      globalThis.gc();
      globalThis.gc();
      heap.push({
        cycles: batch * 100,
        heapUsed: process.memoryUsage().heapUsed,
      });
    }
    report = {
      environment,
      scope:
        "Core Engine.step, trigger contacts, accelerated simulation and forced-GC round disposal",
      results,
      sessions,
      disposal: { warmupCycles: 50, measuredCycles: 500, heap },
      limitations: [
        "Shared host, no GPU workload",
        "600 simulation seconds run faster than real time; not a 10-minute wall-clock soak",
        "Forced-GC heap samples are observations, not proof of leak absence",
        "Dense overlap stores quadratic contact pairs",
      ],
    };
  } finally {
    await server.close();
  }
} else {
  const server = await preview({
    configFile: false,
    base: "/Simpludify/",
    build: { outDir: resolve("dist") },
    preview: { host: "127.0.0.1", port: 4176, strictPort: true },
    logLevel: "error",
  });
  let browser;
  const watchdog = setTimeout(() => {
    void browser?.close();
  }, 90_000);
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
    const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
      }),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4176/Simpludify/");
    await page.waitForFunction(() => window.signalRun);
    const cdp = await page.context().newCDPSession(page);
    const memory = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      return {
        ...(await cdp.send("Runtime.getHeapUsage")),
        ...(await cdp.send("Memory.getDOMCounters")),
      };
    };
    const frameResults = [];
    for (const active of [false, true]) {
      await page.evaluate(async (active) => {
        await window.signalRun.game.goTo(active ? "play" : "menu");
        if (active)
          window.signalRun.round.input.set(
            window.signalRun.round.controls.actions.Move,
            { x: 0, y: 1 },
          );
      }, active);
      const frames = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let previous;
            const samples = [];
            const frame = (time) => {
              if (previous !== undefined) samples.push(time - previous);
              previous = time;
              if (samples.length < 300) requestAnimationFrame(frame);
              else resolve(samples);
            };
            requestAnimationFrame(frame);
          }),
      );
      frameResults.push({
        workload: active ? "Signal Run active" : "menu idle",
        frames: frames.length,
        frameMilliseconds: percentile(frames),
        intervalsOver25ms: frames.filter((x) => x > 25).length,
      });
    }
    const cycle = async (count) =>
      page.evaluate(async (count) => {
        for (let i = 0; i < count; i++) {
          const game = window.signalRun.game;
          await game.goTo("play");
          window.signalRun.round.input.set(
            window.signalRun.round.controls.actions.Move,
            { x: 1, y: 0 },
          );
          for (let step = 0; step < 60; step++) game.engine.step(1 / 60);
          await game.goTo("menu");
        }
      }, count);
    await cycle(20);
    const heap = [{ cycles: 0, ...(await memory()) }],
      durations = [];
    for (let batch = 1; batch <= 5; batch++) {
      const start = performance.now();
      await cycle(20);
      durations.push((performance.now() - start) / 20);
      heap.push({ cycles: batch * 20, ...(await memory()) });
      const state = await page.evaluate(() => ({
        canvases: document.querySelectorAll("canvas").length,
        overlays: document.querySelectorAll(".s-ui").length,
        sources: window.signalRun.game.engine.input.sourceCount,
        actors: window.signalRun.game.engine.scene.actors.length,
      }));
      assert.deepEqual(state, {
        canvases: 1,
        overlays: 1,
        sources: 1,
        actors: 0,
      });
    }
    await page.evaluate(() => window.signalRun.game.dispose());
    const disposed = await page.evaluate(() => ({
      hosts: document.querySelectorAll(".simpludify").length,
      canvases: document.querySelectorAll("canvas").length,
      sources: window.signalRun.game.engine.input.sourceCount,
    }));
    assert.deepEqual(disposed, { hosts: 0, canvases: 0, sources: 0 });
    assert.deepEqual(errors, []);
    report = {
      environment: {
        ...environment,
        browser: await browser.version(),
        viewport: [1280, 720],
        renderer: "headless WebGL / SwiftShader",
        build: "Vite production output at /Simpludify/",
      },
      frameResults,
      disposal: {
        warmupRounds: 20,
        measuredRounds: 100,
        transitionsPerRound: 2,
        meanCycleMillisecondsByBatch: durations,
        heap,
        afterDispose: disposed,
      },
      limitations: [
        "Shared host with software rendering; no hardware/GPU or latency guarantee",
        "300 RAF samples per workload are short observations",
        "Forced-GC heap and DOM counters do not include all native/GPU memory",
        "Accelerated round cycling is not an extended real-time soak",
      ],
    };
  } finally {
    clearTimeout(watchdog);
    await browser?.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}
const text = `${JSON.stringify(report, null, 2)}\n`;
if (output) writeFileSync(output, text);
console.log(text);
