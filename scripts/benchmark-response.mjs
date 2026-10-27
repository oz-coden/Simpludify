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
  assert.ok(value && !value.startsWith("--"));
  args.splice(i, 2);
  return value;
}
const mode = option("--mode", "core"),
  out = option("--out"),
  source = resolve(option("--source", ".")),
  soakSeconds = Number(option("--soak-seconds", "0"));
assert.equal(args.length, 0);
assert.ok(["core", "browser"].includes(mode));
assert.ok(
  Number.isFinite(soakSeconds) && soakSeconds >= 0 && soakSeconds <= 3600,
);
function percentiles(values) {
  const a = [...values].sort((a, b) => a - b),
    p = (x) => a[Math.floor((a.length - 1) * x)] ?? 0;
  return { p50: p(0.5), p95: p(0.95), p99: p(0.99) };
}
const environment = {
  date: new Date().toISOString(),
  node: process.version,
  platform: platform(),
  cpu: cpus()[0]?.model,
  sourceRevision: execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
};
let report;
if (mode === "core") {
  assert.equal(typeof globalThis.gc, "function", "Use node --expose-gc");
  const server = await createServer({
    configFile: false,
    root: source,
    server: { middlewareMode: true },
    logLevel: "silent",
  });
  try {
    const sdk = await server.ssrLoadModule("/packages/core/src/index.ts"),
      {
        Engine,
        Actor,
        Transform,
        Collider,
        CollisionWorld,
        CollisionShape,
        CollisionResponse,
        CollisionBody,
        Motion,
        Character,
        Action,
        ActionController,
        defineActions,
        ContactEnter,
        ContactExit,
      } = sdk;
    const names = [
      "empty",
      "1000 passive Actors",
      "1000 moving Characters",
      "1000 sparse Triggers",
      "1000 grid Triggers",
      "100 dense Triggers",
    ];
    if (CollisionBody)
      names.push(
        "1000 fixed Solids",
        "1000 static obstacles + 1 dynamic Actor",
        "100 moving dynamic Solids",
        "100 crowded dynamic Solids",
        "one Trigger wall",
        "one Solid wall",
      );
    const results = [];
    for (const name of names) {
      const resets = [];
      const engine = new Engine(42),
        world =
          name.includes("Trigger") ||
          name.includes("Solid") ||
          name.includes("obstacles")
            ? new CollisionWorld(engine.scene)
            : undefined;
      const add = (
        x,
        y,
        {
          solid = false,
          dynamic = false,
          mask = 0xffffffff,
          layer = 1,
          moving = false,
        } = {},
      ) => {
        const a = engine.scene.add(new Actor());
        a.add(new Transform({ x, y }));
        a.add(
          new Collider({
            shape: CollisionShape.Circle,
            radius: 8,
            response: solid ? CollisionResponse.Solid : "trigger",
            layer,
            mask,
          }),
        );
        if (dynamic) a.add(new CollisionBody());
        if (moving) a.add(new Motion({ x: 1, speed: 100 }));
        return a;
      };
      const actions = defineActions({ Move: Action.axis2D() });
      const controls = new ActionController(actions, {
        scene: engine.scene,
        input: engine.input,
      });
      if (name.includes("passive"))
        for (let i = 0; i < 1000; i++) engine.scene.add(new Actor());
      else if (name.includes("Characters")) {
        for (let i = 0; i < 1000; i++)
          engine.scene.add(
            Character({ movement: controls.reader(actions.Move) }),
          );
        controls.createSource().set(actions.Move, { x: 1, y: 0 });
      } else if (name.includes("sparse"))
        for (let i = 0; i < 1000; i++) add(i * 20, 0);
      else if (name.includes("grid Triggers"))
        for (let i = 0; i < 1000; i++)
          add((i % 40) * 12, Math.floor(i / 40) * 12);
      else if (name.includes("dense")) for (let i = 0; i < 100; i++) add(0, 0);
      else if (name.includes("fixed Solids") || name.includes("obstacles")) {
        for (let i = 0; i < 1000; i++)
          add((i % 40) * 30, Math.floor(i / 40) * 30, {
            solid: true,
            layer: 2,
            mask: 1,
          });
        if (name.includes("obstacles"))
          add(-30, 0, {
            solid: true,
            dynamic: true,
            moving: true,
            layer: 1,
            mask: 2,
          });
      } else if (name.includes("dynamic Solids")) {
        for (let i = 0; i < 100; i++) {
          const x = (i % 10) * 15,
            y = Math.floor(i / 10) * 15;
          const actor = add(x, y, { solid: true, dynamic: true, moving: true });
          if (name.includes("crowded"))
            resets.push({ transform: actor.require(Transform.type), x, y });
        }
      } else if (name.startsWith("one")) {
        const wall = engine.scene.add(new Actor());
        wall.add(new Transform({ x: 40 }));
        wall.add(
          new Collider({
            width: 10,
            height: 100,
            response: name.includes("Solid")
              ? CollisionResponse.Solid
              : "trigger",
            layer: 2,
            mask: 1,
          }),
        );
        add(0, 0, {
          solid: true,
          dynamic: true,
          moving: true,
          layer: 1,
          mask: 2,
        });
      }
      const reset = () => {
        for (const { transform, x, y } of resets) {
          transform.x = x;
          transform.y = y;
        }
      };
      for (let i = 0; i < 200; i++) {
        reset();
        engine.step(1 / 60);
      }
      const times = [];
      for (let i = 0; i < 1000; i++) {
        reset();
        const start = performance.now();
        engine.step(1 / 60);
        times.push(performance.now() - start);
      }
      results.push({
        workload: name,
        resetPosesOutsideTimedRegion: resets.length,
        samples: times.length,
        stepMilliseconds: percentiles(times),
        contacts: world?.diagnostics,
        response: world?.responseDiagnostics,
      });
      engine.dispose();
      if (world) assert.equal(world.diagnostics.contacts, 0);
    }
    const engine = new Engine(),
      world = new CollisionWorld(engine.scene);
    let enters = 0,
      exits = 0;
    for (let i = 0; i < 1000; i++) {
      const a = engine.scene.add(new Actor());
      a.add(new Transform({ x: i * 30 }));
      a.add(
        new Collider({
          shape: CollisionShape.Circle,
          radius: 4,
          layer: 2,
          mask: 1,
        }),
      );
    }
    const a = engine.scene.add(new Actor()),
      t = a.add(new Transform()),
      c = a.add(
        new Collider({
          shape: CollisionShape.Circle,
          radius: 4,
          layer: 1,
          mask: 2,
        }),
      );
    c.events.on(ContactEnter, () => enters++);
    c.events.on(ContactExit, () => exits++);
    const times = [];
    for (let i = 0; i < 2000; i++) {
      t.x = (i % 1000) * 30;
      const start = performance.now();
      engine.step(1 / 60);
      times.push(performance.now() - start);
    }
    const churn = {
      steps: 2000,
      enters,
      exits,
      finalContacts: world.diagnostics.contacts,
      stepMilliseconds: percentiles(times),
    };
    assert.equal(enters, 2000);
    assert.equal(exits, 1999);
    assert.equal(churn.finalContacts, 1);
    engine.dispose();
    const { Round } = await server.ssrLoadModule(
      "/examples/signal-run/logic.ts",
    );
    const cycle = () => {
      const e = new Engine(),
        r = new Round(e.scene, e.input);
      r.input.set(r.controls.actions.Move, { x: 1, y: 0 });
      for (let i = 0; i < 60; i++) e.step(1 / 60);
      e.dispose();
      assert.equal(r.world.diagnostics.contacts, 0);
      assert.equal(r.world.diagnostics.colliders, 0);
      assert.equal(e.input.sourceCount, 0);
      assert.equal(r.walls?.size ?? 0, 0);
    };
    for (let i = 0; i < 50; i++) cycle();
    globalThis.gc();
    globalThis.gc();
    const memory = [{ cycles: 0, heapUsed: process.memoryUsage().heapUsed }];
    for (let batch = 1; batch <= 5; batch++) {
      for (let i = 0; i < 100; i++) cycle();
      globalThis.gc();
      globalThis.gc();
      memory.push({
        cycles: batch * 100,
        heapUsed: process.memoryUsage().heapUsed,
      });
    }
    report = {
      environment,
      results,
      churn,
      disposal: { warmup: 50, cycles: 500, memory },
      limitations: [
        "Shared host, no renderer/GPU work",
        "Dense contacts and a one-axis sweep retain quadratic worst cases",
        "Fixed iteration budgets do not guarantee arbitrary crowd/stack convergence",
        "Forced-GC managed memory includes tooling and does not prove absence of native leaks",
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
  const deadline = setTimeout(
    () => {
      void browser?.close();
    },
    (soakSeconds + 120) * 1000,
  );
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
    page.on("pageerror", (e) => errors.push(e.message));
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
    const soak = [];
    let restarts = 0;
    await page.evaluate(() => window.signalRun.game.goTo("play"));
    const started = performance.now();
    if (soakSeconds > 0) {
      soak.push({ seconds: 0, ...(await memory()) });
      let nextSample = 30;
      // Actual elapsed wall-clock operation, with fresh rounds before the 30-second deadline.
      while ((performance.now() - started) / 1000 < soakSeconds) {
        const elapsed = (performance.now() - started) / 1000;
        if (Math.floor(elapsed / 20) > restarts) {
          await page.evaluate(() => window.signalRun.game.goTo("play"));
          restarts++;
        }
        await page.evaluate(
          (down) => {
            const round = window.signalRun.round;
            const input = round.input;
            input.clear();
            input.set(round.controls.actions.Move, { x: 0, y: down ? 1 : -1 });
          },
          Math.floor(elapsed / 5) % 2 === 0,
        );
        if (elapsed >= nextSample) {
          soak.push({ seconds: elapsed, ...(await memory()) });
          nextSample += 30;
          console.error(`SOAK ${Math.floor(elapsed)}s / ${soakSeconds}s`);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      soak.push({
        seconds: (performance.now() - started) / 1000,
        ...(await memory()),
      });
    }
    const profile = await page.evaluate(async () => {
      const game = window.signalRun.game,
        nativeRAF = window.requestAnimationFrame.bind(window);
      const sampleFrames = (count) =>
        new Promise((resolve) => {
          const values = [];
          let previous;
          const frame = (time) => {
            if (previous !== undefined) values.push(time - previous);
            previous = time;
            if (values.length < count) nativeRAF(frame);
            else resolve(values);
          };
          nativeRAF(frame);
        });
      const actual = await sampleFrames(180);
      // Drain the single application frame, then schedule the measured workload explicitly.
      window.requestAnimationFrame = () => 0;
      await new Promise((resolve) => nativeRAF(resolve));
      const results = [];
      for (const mode of [
        "RAF only",
        "simulation only",
        "render only",
        "simulation + render",
      ]) {
        await game.goTo("play");
        window.signalRun.round.input.set(
          window.signalRun.round.controls.actions.Move,
          { x: 0, y: 1 },
        );
        const intervals = [],
          logic = [],
          draw = [];
        let previous;
        await new Promise((resolve) => {
          const frame = (time) => {
            const start = performance.now();
            if (mode.includes("simulation")) game.engine.step(1 / 60);
            const afterLogic = performance.now();
            if (mode.includes("render")) game.setViewport();
            const end = performance.now();
            if (previous !== undefined) {
              intervals.push(time - previous);
              logic.push(afterLogic - start);
              draw.push(end - afterLogic);
            }
            previous = time;
            if (intervals.length < 180) nativeRAF(frame);
            else resolve();
          };
          nativeRAF(frame);
        });
        results.push({ mode, intervals, logic, draw });
      }
      window.requestAnimationFrame = nativeRAF;
      return { actual, results };
    });
    const profiles = profile.results.map((r) => ({
      workload: r.mode,
      samples: r.intervals.length,
      rafMilliseconds: percentiles(r.intervals),
      simulationCpuMilliseconds: percentiles(r.logic),
      renderAndProjectionCpuMilliseconds: percentiles(r.draw),
      intervalsOver25ms: r.intervals.filter((x) => x > 25).length,
    }));
    const heap = [{ cycles: 0, ...(await memory()) }];
    for (let batch = 1; batch <= 5; batch++) {
      await page.evaluate(async () => {
        const game = window.signalRun.game;
        for (let i = 0; i < 20; i++) {
          await game.goTo("play");
          for (let k = 0; k < 60; k++) game.engine.step(1 / 60);
          await game.goTo("menu");
        }
      });
      heap.push({ cycles: batch * 20, ...(await memory()) });
      assert.deepEqual(
        await page.evaluate(() => ({
          sources: window.signalRun.game.engine.input.sourceCount,
          actors: window.signalRun.game.engine.scene.actors.length,
          canvases: document.querySelectorAll("canvas").length,
        })),
        { sources: 1, actors: 0, canvases: 1 },
      );
    }
    await page.evaluate(() => window.signalRun.game.dispose());
    assert.deepEqual(
      await page.evaluate(() => ({
        sources: window.signalRun.game.engine.input.sourceCount,
        hosts: document.querySelectorAll(".simpludify").length,
      })),
      { sources: 0, hosts: 0 },
    );
    assert.deepEqual(errors, []);
    report = {
      environment: {
        ...environment,
        browser: await browser.version(),
        viewport: [1280, 720],
        renderer: "WebGL / SwiftShader",
        build: "production Signal Run",
      },
      soak: { requestedSeconds: soakSeconds, restarts, samples: soak },
      actualGameRafMilliseconds: percentiles(profile.actual),
      profiles,
      cycles: { count: 100, heap },
      limitations: [
        "Shared software-rendering host, no physical hardware guarantee",
        "RAF is presentation cadence, not CPU duration or GPU execution time",
        "Render proxy is public Game.setViewport(), including projection and synchronous draw submission",
        "Deferred layout/composition and native/GPU work are not isolated by JS clocks",
        "Measured modes stop automatic application RAF and drive simulation explicitly; normal pacing is sampled separately",
        "GC heap/DOM samples omit native/GPU allocations; bounded soak is not exhaustive",
      ],
    };
  } finally {
    clearTimeout(deadline);
    await browser?.close();
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}
const text = `${JSON.stringify(report, null, 2)}\n`;
if (out) writeFileSync(out, text);
console.log(text);
