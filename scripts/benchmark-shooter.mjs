import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname } from "node:path";
import { createServer } from "vite";

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const value = args[i + 1];
  assert(value && !value.startsWith("--"));
  args.splice(i, 2);
  return value;
}
const recording = args.includes("--record");
if (recording) args.splice(args.indexOf("--record"), 1);
const mode = option("--mode", "core"),
  output = option("--out", "test-results/shooter.json"),
  seconds = Number(option("--seconds", "120"));
assert.equal(args.length, 0);
assert(["core", "browser"].includes(mode));
assert(Number.isFinite(seconds) && seconds >= 10 && seconds <= 600);
export const percentile = (values) => {
  const sorted = [...values].sort((a, b) => a - b),
    at = (p) => sorted[Math.floor((sorted.length - 1) * p)] ?? 0;
  return {
    samples: values.length,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    maximum: sorted.at(-1) ?? 0,
  };
};
const environment = {
  date: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  cpu: cpus()[0]?.model,
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  trackedSourceChanges: execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  }).trim(),
};
let measurements;
if (mode === "browser") {
  const { benchmarkBrowser } = await import("./benchmark-shooter-browser.mjs");
  measurements = await benchmarkBrowser({ seconds, percentile });
} else {
  assert.equal(typeof globalThis.gc, "function", "Run with node --expose-gc");
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  try {
    const { Engine, ReplayRecorder } = await server.ssrLoadModule(
      "/packages/core/src/index.ts",
    );
    const { Raid } = await server.ssrLoadModule(
      "/examples/prism-raid/logic.ts",
    );
    const { autopilot } = await server.ssrLoadModule(
      "/examples/prism-raid/autoplay.ts",
    );
    const workload = (enemies, shots, overlap) => {
      const engine = new Engine({ seed: 42 }),
        round = new Raid(
          engine.scene,
          engine.input,
          () => engine.random.next(),
          {
            hp: 1000,
            spawnInterval: 1000,
            duration: 10000,
          },
        );
      for (let i = 0; i < enemies; i++)
        round.spawnEnemy({
          kind: "gunner",
          x: overlap ? 25 + (i % 10) * 32 : 30 + (i % 5) * 23,
          y: 60 + Math.floor(i / 10) * 20,
          hp: 1000,
          shoots: false,
          speed: 1,
        });
      for (let i = 0; i < shots; i++)
        round.spawnPlayerShot(
          overlap ? 25 + (i % 10) * 32 : 245 + (i % 4) * 20,
          400 + (i % 100),
        );
      if (!overlap) for (let i = 0; i < 20; i++) engine.step(1 / 240);
      const times = [];
      let candidates = 0,
        narrowTests = 0,
        peakActors = 0;
      for (let i = 0; i < 160; i++) {
        const begin = performance.now();
        engine.step(1 / 240);
        times.push(performance.now() - begin);
        const d = round.world.diagnostics;
        candidates = Math.max(candidates, d.candidates);
        narrowTests = Math.max(narrowTests, d.narrowTests);
        peakActors = Math.max(peakActors, round.units.size);
      }
      const result = {
        enemies,
        shots,
        overlap,
        stepSeconds: 1 / 240,
        milliseconds: percentile(times),
        peakActors,
        candidates,
        narrowTests,
        finalColliders: round.world.diagnostics.colliders,
      };
      engine.dispose();
      assert.equal(round.units.size, 0);
      assert.equal(round.world.diagnostics.colliders, 0);
      return result;
    };
    const updates = [
      workload(0, 0, false),
      workload(60, 240, false),
      workload(100, 1000, true),
    ];
    const engine = new Engine({ seed: 42 }),
      round = new Raid(engine.scene, engine.input, () => engine.random.next(), {
        spawnInterval: 1000,
        duration: 10000,
      });
    for (let i = 0; i < 1000; i++) round.spawnPlayerShot(100, 300).dispose();
    globalThis.gc();
    const before = process.memoryUsage().heapUsed,
      begin = performance.now();
    for (let i = 0; i < 10000; i++) round.spawnPlayerShot(100, 300).dispose();
    const churnMilliseconds = performance.now() - begin;
    engine.step(0);
    globalThis.gc();
    const churn = {
      actorsCreatedAndDestroyed: 10000,
      milliseconds: churnMilliseconds,
      microsecondsPerActor: (churnMilliseconds * 1000) / 10000,
      heapBefore: before,
      heapAfter: process.memoryUsage().heapUsed,
      remainingActors: engine.scene.actors.length,
    };
    engine.dispose();
    let steps = 0,
      kills = 0,
      created = 0,
      peakActors = 0,
      wins = 0,
      losses = 0;
    let replayBytes = 0,
      recordedFrames = 0;
    const play = (seed) => {
      const simulation = new Engine({ seed: seed }),
        mission = new Raid(simulation.scene, simulation.input, () =>
          simulation.random.next(),
        );
      const recorder = recording
        ? new ReplayRecorder(simulation, {
            controllers: { raid: mission.controls },
            metadata: { gameVersion: "benchmark-1" },
          })
        : undefined;
      for (let i = 0; i < 120 * 76 && mission.status === "playing"; i++) {
        if (i % 6 === 0) autopilot(mission);
        simulation.step(1 / 120);
        steps++;
        peakActors = Math.max(peakActors, mission.units.size);
      }
      if (recorder) {
        const data = recorder.finish();
        recordedFrames += data.steps.length;
        replayBytes += Buffer.byteLength(JSON.stringify(data));
      }
      created += mission.shotsFired + mission.spawned;
      kills += mission.kills;
      if (mission.status === "won") wins++;
      else losses++;
      simulation.dispose();
      assert.equal(mission.units.size, 0);
      assert.equal(mission.world.diagnostics.colliders, 0);
    };
    for (let i = 0; i < 5; i++) play(i);
    steps = 0;
    kills = 0;
    created = 0;
    wins = 0;
    losses = 0;
    peakActors = 0;
    replayBytes = 0;
    recordedFrames = 0;
    globalThis.gc();
    const memory = [{ round: 0, heap: process.memoryUsage().heapUsed }],
      started = performance.now();
    for (let i = 0; i < 60; i++) {
      play(i + 42);
      if ((i + 1) % 10 === 0) {
        globalThis.gc();
        memory.push({ round: i + 1, heap: process.memoryUsage().heapUsed });
      }
    }
    measurements = {
      scope:
        "Core only; no renderer/DOM. Controlled GC, warmup and complete input-only rounds. No other local tests/builds during recording.",
      updates,
      churn,
      accelerated: {
        rounds: 60,
        steps,
        simulatedSeconds: steps / 120,
        wallMilliseconds: performance.now() - started,
        kills,
        createdPlayerShotsAndEnemies: created,
        peakActors,
        wins,
        losses,
        gcHeapSamples: memory,
        replay: {
          enabled: recording,
          recordedFrames,
          jsonBytes: replayBytes,
          bytesPerStep: recordedFrames ? replayBytes / recordedFrames : 0,
          scope:
            "record mode includes finish validation/copy and JSON serialization",
        },
      },
    };
  } finally {
    await server.close();
  }
}
const report = { environment, mode, measurements };
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
