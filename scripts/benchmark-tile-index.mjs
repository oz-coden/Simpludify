import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

assert.ok(global.gc, "Run node --expose-gc scripts/benchmark-tile-index.mjs");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const value = args[i + 1];
  assert.ok(value);
  args.splice(i, 2);
  return value;
};
const out = option("--out", "benchmarks/tile-index/results.json");
const core = resolve(option("--core", "packages/core/src/index.ts"));
const baseline = args.includes("--baseline");
assert.ok(args.length === (baseline ? 1 : 0));
const git = (...values) =>
  execFileSync("git", values, { encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain"),
  "",
  "Commit/push the checkpoint before recording results",
);
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
const warmups = 15,
  samples = 40,
  results = [];
const percentile = (a, q) =>
  [...a].sort((a, b) => a - b)[Math.ceil(a.length * q) - 1];
try {
  const {
    Actor,
    Collider,
    CollisionBody,
    CollisionResponse: R,
    CollisionShape,
    CollisionWorld,
    Engine,
    Grid,
    SpriteSheet,
    Tilemap,
    Transform,
  } = await server.ssrLoadModule(core);
  const sheet = SpriteSheet.grid("never-loaded.png", {
    frameWidth: 16,
    frameHeight: 16,
  });
  for (const size of [32, 128, 512])
    for (const workload of [
      "small-wall",
      "wide-sparse",
      "filtered-dense",
      "dense-trigger",
    ])
      for (const tileSearch of baseline ? ["cells"] : ["cells", "rectangles"]) {
        global.gc();
        const before = process.memoryUsage().heapUsed;
        const engine = new Engine(),
          world = new CollisionWorld(engine.scene, { tileSearch });
        const initStart = performance.now();
        let collisionCells = 0;
        const map = new Tilemap({
          sheet,
          tiles: Grid.generate(size, size, (x) => {
            const wall =
              workload.includes("dense") ||
              workload === "dense-trigger" ||
              x % 16 === 8;
            if (wall) collisionCells++;
            return wall ? 0 : null;
          }),
          tileWidth: 24,
          tileHeight: 16,
          collision: {
            tiles: [{ tile: 0, response: R.Solid, layer: 2, mask: 1 }],
          },
        }).place(engine.scene);
        const mapMs = performance.now() - initStart;
        const actors = workload === "small-wall" ? 32 : 8,
          bodies = [];
        for (let i = 0; i < actors; i++) {
          const actor = engine.scene.add(new Actor());
          const t = actor.add(
            new Transform({ rotation: workload === "wide-sparse" ? 0.6 : 0 }),
          );
          const collider = new Collider({
            ...(workload === "wide-sparse"
              ? { width: 384, height: 12 }
              : {
                  shape: CollisionShape.Circle,
                  radius:
                    workload === "small-wall"
                      ? 10
                      : workload === "filtered-dense"
                        ? 160
                        : 80,
                }),
            response: workload === "small-wall" ? R.Solid : R.Trigger,
            layer: 1,
            mask: workload === "filtered-dense" ? 1 : 2,
          });
          actor.add(collider);
          if (workload === "small-wall") actor.add(new CollisionBody());
          bodies.push(t);
        }
        const poses = (frame) =>
          bodies.forEach((t, i) => {
            t.x =
              (8 + 16 * (i % Math.max(1, Math.floor(size / 16) - 1))) * 24 - 8;
            t.y =
              (4 + ((i * 3) % (size - 8))) * 16 + Math.sin(frame * 0.2 + i) * 3;
          });
        poses(0);
        const coldStart = performance.now();
        engine.step(0);
        const coldMs = performance.now() - coldStart;
        const rawMs = [],
          updatesMs = [],
          rebuilds = [];
        for (let frame = 0; frame < warmups + samples; frame++) {
          poses(frame);
          const start = performance.now();
          engine.step(1 / 60);
          if (frame >= warmups) rawMs.push(performance.now() - start);
        }
        global.gc();
        const warmHeapDelta = process.memoryUsage().heapUsed - before;
        const steadyDiagnostics = {
          cells: world.tileDiagnostics,
          index: world.tileIndexDiagnostics ?? null,
        };
        for (let frame = 0; frame < samples; frame++) {
          const builds = world.tileIndexDiagnostics?.builds ?? 0;
          const start = performance.now();
          map.set(8, 4, frame % 2 === 0 ? null : 0);
          poses(frame);
          engine.step(0);
          updatesMs.push(performance.now() - start);
          rebuilds.push((world.tileIndexDiagnostics?.builds ?? 0) - builds);
        }
        const response = world.responseDiagnostics;
        engine.dispose();
        global.gc();
        const disposedHeapDelta = process.memoryUsage().heapUsed - before;
        assert.equal(world.tileDiagnostics.retainedCells, 0);
        assert.equal(world.tileIndexDiagnostics?.chunks ?? 0, 0);
        results.push({
          size,
          tiles: size * size,
          collisionCells,
          workload,
          tileSearch,
          actors,
          mapMs,
          coldMs,
          rawMs,
          p50Ms: percentile(rawMs, 0.5),
          p95Ms: percentile(rawMs, 0.95),
          updatesMs,
          updateP50Ms: percentile(updatesMs, 0.5),
          rebuilds,
          warmHeapDelta,
          disposedHeapDelta,
          diagnostics: steadyDiagnostics,
          response,
        });
      }
  const report = {
    source: git("rev-parse", "HEAD"),
    measuredCore: core,
    measuredCoreSource: execFileSync(
      "git",
      ["-C", dirname(core), "rev-parse", "HEAD"],
      { encoding: "utf8" },
    ).trim(),
    baseline,
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      cpu: cpus()[0]?.model,
    },
    conditions: {
      warmups,
      samples,
      chunkSize: 16,
      timers: "performance.now CPU wall time; no renderer/browser",
      memory:
        "forced-GC heap deltas, noisy and fixture still referenced; not a leak proof",
    },
    results,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({ out, rows: results.length, source: report.source }),
  );
} finally {
  await server.close();
}
