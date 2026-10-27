import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { createServer } from "vite";
import { serveSite } from "./site-server.mjs";

export async function benchmarkBrowser({ seconds, percentile }) {
  const browser = await chromium.launch({
    headless: true,
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
  const base = JSON.parse(
    readFileSync("site-dist/site-manifest.json", "utf8"),
  ).base;
  const production = await serveSite({ base, port: 0 });
  const dev = await createServer({
    configFile: false,
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 4189, strictPort: true },
  });
  try {
    await dev.listen();
    const page = await browser.newPage({
      viewport: { width: 1000, height: 800 },
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(20000);
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto("http://127.0.0.1:4189/examples/prism-raid/index.html");
    await page.waitForFunction(() => !!window.prismRaid);
    const renderer = await page.evaluate(async (sdk) => {
      const {
        Actor,
        Transform,
        Renderable,
        Shape,
        Scene,
        PixiRenderer,
        createViewTransform,
      } = await import(sdk);
      window.prismRaid.game.dispose();
      document.body.replaceChildren();
      const results = [];
      for (const count of [100, 500])
        for (const shape of [Shape.Box, Shape.Triangle]) {
          const host = document.createElement("div");
          host.style.cssText = "width:720px;height:540px";
          document.body.append(host);
          const scene = new Scene("triangles");
          for (let i = 0; i < count; i++) {
            const actor = new Actor();
            actor.add(
              new Transform({
                x: 12 + (i % 30) * 24,
                y: 12 + Math.floor(i / 30) * 24,
                rotation: ((i % 4) * Math.PI) / 2,
              }),
            );
            actor.add(
              new Renderable({
                shape,
                width: 12,
                height: 18,
                color: 0x65a8ed,
                opacity: 0.8,
                zIndex: i % 4,
              }),
            );
            scene.add(actor);
          }
          const renderer = new PixiRenderer(host);
          await renderer.init();
          renderer.resize(720, 540, 1);
          const prepared = await renderer.prepare(scene),
            view = createViewTransform({
              viewport: { x: 0, y: 0, width: 720, height: 540 },
              resolution: { width: 720, height: 540 },
            });
          for (let i = 0; i < 30; i++) prepared.render(view);
          const samples = [];
          for (let i = 0; i < 120; i++) {
            const before = performance.now();
            prepared.render(view);
            samples.push(performance.now() - before);
          }
          const beforeDispose = renderer.diagnostics;
          scene.dispose();
          renderer.dispose();
          results.push({
            shape,
            count,
            drawSubmissionMilliseconds: samples,
            beforeDispose,
            afterDispose: renderer.diagnostics,
          });
          host.remove();
        }
      return results;
    }, `/@fs/${process.cwd()}/packages/web/src/index.ts`);
    const triangle = renderer.map(({ drawSubmissionMilliseconds, ...row }) => ({
      ...row,
      drawSubmissionMilliseconds: percentile(drawSubmissionMilliseconds),
    }));
    for (const row of triangle) assert.equal(row.afterDispose.visuals, 0);
    await page.goto(production.url + "play/prism-raid/index.html");
    await page
      .getByRole("button", { name: "Watch autopilot", exact: true })
      .click();
    await page.waitForFunction(() => !!window.prismRaid.round);
    // Warm one complete mission, using public input and stepping, before sampling.
    await page.evaluate(() => {
      const { game } = window.prismRaid;
      for (
        let i = 0;
        i < 10000 && window.prismRaid.round.status === "playing";
        i++
      ) {
        if (i % 6 === 0) window.prismRaid.autoStep();
        game.engine.step(1 / 120);
        if (i % 40 === 0) game.setViewport();
      }
    });
    await page.evaluate(async () => {
      const { game, renderer } = window.prismRaid;
      window.raidMeasure = {
        simulation: [],
        draw: [],
        frames: [],
        lastFrame: undefined,
        excludeUntil: 0,
        active: true,
      };
      const m = window.raidMeasure;
      const record = (array, value) => {
        if (performance.now() > m.excludeUntil && array.length < 16000)
          array.push(value);
      };
      const step = game.engine.step.bind(game.engine);
      game.engine.step = (delta) => {
        const start = performance.now();
        try {
          return step(delta);
        } finally {
          record(m.simulation, performance.now() - start);
        }
      };
      const prepare = renderer.prepare.bind(renderer);
      renderer.prepare = async (scene) => {
        const prepared = await prepare(scene),
          render = prepared.render.bind(prepared);
        prepared.render = (view) => {
          const start = performance.now();
          try {
            return render(view);
          } finally {
            record(m.draw, performance.now() - start);
          }
        };
        return prepared;
      };
      const frame = (time) => {
        if (!m.active) return;
        if (m.lastFrame !== undefined) record(m.frames, time - m.lastFrame);
        m.lastFrame = time;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      await game.goTo("play");
    });
    const session = await page.context().newCDPSession(page);
    const capture = async (elapsed) => {
      await page.evaluate(() => {
        window.raidMeasure.excludeUntil = performance.now() + 500;
      });
      await session.send("HeapProfiler.collectGarbage");
      const heap = await session.send("Runtime.getHeapUsage"),
        dom = await session.send("Memory.getDOMCounters");
      const resources = await page.evaluate(() => ({
        sources: window.prismRaid.game.engine.input.sourceCount,
        renderer: window.prismRaid.renderer.diagnostics,
        units: window.prismRaid.round?.units.size ?? 0,
        canvases: document.querySelectorAll("canvas").length,
        hosts: document.querySelectorAll(".simpludify").length,
      }));
      return { elapsedSeconds: elapsed, heap, dom, resources };
    };
    await page.waitForTimeout(1000);
    const memory = [await capture(0)],
      started = Date.now();
    let nextSample = 30,
      wins = 0,
      losses = 0,
      peakActors = 0,
      peakVisuals = 0;
    while (Date.now() - started < seconds * 1000) {
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => ({
        status: window.prismRaid.round?.status,
        actors: window.prismRaid.round?.units.size ?? 0,
        visuals: window.prismRaid.renderer.diagnostics.visuals,
      }));
      peakActors = Math.max(peakActors, state.actors);
      peakVisuals = Math.max(peakVisuals, state.visuals);
      if (state.status !== "playing") {
        if (state.status === "won") wins++;
        else losses++;
        await page
          .getByRole("button", { name: "Restart", exact: true })
          .click();
      }
      const elapsed = (Date.now() - started) / 1000;
      if (elapsed >= nextSample) {
        memory.push(await capture(elapsed));
        nextSample += 30;
      }
    }
    memory.push(await capture((Date.now() - started) / 1000));
    const timings = await page.evaluate(() => ({
      simulation: window.raidMeasure.simulation,
      draw: window.raidMeasure.draw,
      frames: window.raidMeasure.frames,
    }));
    const frameData = {
      simulationCPU: percentile(timings.simulation),
      renderSubmissionCPU: percentile(timings.draw),
      frameIntervals: percentile(timings.frames),
    };
    await page.evaluate(() => {
      window.raidMeasure.active = false;
      window.raidMeasure.simulation.length = 0;
      window.raidMeasure.draw.length = 0;
      window.raidMeasure.frames.length = 0;
      window.prismRaid.game.dispose();
    });
    const disposed = await capture((Date.now() - started) / 1000);
    assert.equal(disposed.resources.sources, 0);
    assert.equal(disposed.resources.renderer.visuals, 0);
    assert.equal(disposed.resources.renderer.presentations, 0);
    assert.equal(disposed.resources.hosts, 0);
    assert.equal(disposed.resources.canvases, 0);
    assert.deepEqual(failures, []);
    await session.detach();
    await page.close();
    return {
      scope:
        "Isolated Box/Triangle render submission through local Vite, then production Prism Raid realtime autoplay/restart. Chrome with SwiftShader, DPR 1, 1000x800. CPU timings are not GPU execution time. GC pauses plus 500ms are excluded; timing buffers are bounded. No other local tests/builds during recording.",
      browser: browser.version(),
      triangle,
      soak: {
        requestedSeconds: seconds,
        actualSeconds: (Date.now() - started) / 1000,
        wins,
        losses,
        peakActors,
        peakVisuals,
        milliseconds: frameData,
        memory,
        disposed,
      },
      failures,
    };
  } finally {
    await browser.close();
    await production.close();
    await dev.close();
  }
}
