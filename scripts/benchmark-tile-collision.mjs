import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

const out = process.argv[2] ?? "benchmarks/tile-collision/results.json";
assert.ok(process.argv.length <= 3);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain"),
  "",
  "Commit and push before recording measurements",
);
const revision = git("rev-parse", "HEAD"),
  warmups = 10,
  samples = 20;
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
const percentile = (values) => {
  const a = [...values].sort((a, b) => a - b),
    n = a.length;
  return {
    p50: (a[Math.floor((n - 1) / 2)] + a[Math.floor(n / 2)]) / 2,
    p95: a[Math.ceil(0.95 * n) - 1],
  };
};
try {
  const sdk = await server.ssrLoadModule("/packages/core/src/index.ts");
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
    TileContactEnter,
    TileContactStay,
    TileContactExit,
    Tilemap,
    Transform,
  } = sdk;
  const { runWallScenario } = await server.ssrLoadModule(
    "/tests/helpers/tile-wall-scenario.ts",
  );
  const sheet = SpriteSheet.grid("never-loaded.png", {
    frameWidth: 16,
    frameHeight: 16,
  });
  function setup(size, pattern, actors, instrument) {
    const engine = new Engine(),
      world = new CollisionWorld(engine.scene);
    const start = performance.now();
    const grid = Grid.generate(size, size, (x, y) =>
      y % 4 !== 1 &&
      (pattern === "dense" ||
        ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) %
          8 ===
          0)
        ? 0
        : null,
    );
    let solids = 0;
    const floors = [];
    grid.forEach((id, x, y) => {
      if (id !== null) {
        solids++;
        if (y % 4 === 2 && x > 0 && x < size - 1) floors.push({ x, y });
      }
    });
    assert.ok(floors.length >= 8);
    const map = new Tilemap({
      sheet,
      tiles: grid,
      tileWidth: 32,
      tileHeight: 32,
      collision: { tiles: [{ tile: 0, response: R.Solid, layer: 2, mask: 1 }] },
    }).place(engine.scene);
    const buildMapMs = performance.now() - start,
      bodies = [],
      events = { enter: 0, stay: 0, exit: 0 };
    const startActors = performance.now();
    let seed = 0x4f31a2;
    for (let i = 0; i < actors; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const floor = floors[(seed >>> 8) % floors.length];
      const actor = engine.scene.add(new Actor()),
        t = actor.add(new Transform());
      actor.add(new CollisionBody());
      const c = actor.add(
        new Collider({
          shape: CollisionShape.Circle,
          radius: 10,
          response: R.Solid,
          layer: 1,
          mask: 2,
        }),
      );
      for (const [token, key] of [
        [TileContactEnter, "enter"],
        [TileContactStay, "stay"],
        [TileContactExit, "exit"],
      ])
        c.events.on(token, () => events[key]++);
      bodies.push({ t, floor, i });
    }
    const buildActorsMs = performance.now() - startActors;
    // Benchmark-only wrappers, not a public timing API or Core host clock dependency.
    const timings = {
      capture: 0,
      actorQuery: 0,
      tileQuery: 0,
      response: 0,
      delivery: 0,
    };
    if (instrument)
      for (const [method, key] of [
        ["capture", "capture"],
        ["scanActors", "actorQuery"],
        ["scanTiles", "tileQuery"],
        ["correct", "response"],
        ["deliver", "delivery"],
      ]) {
        const original = world[method];
        assert.equal(typeof original, "function");
        world[method] = function (...args) {
          const start = performance.now();
          try {
            return Reflect.apply(original, this, args);
          } finally {
            timings[key] += performance.now() - start;
          }
        };
      }
    function poses(frame) {
      for (const { t, floor, i } of bodies) {
        t.x = floor.x * 32 + 16 + Math.sin(frame * 0.3 + i) * 10;
        t.y = floor.y * 32 - 8;
      }
    }
    poses(0);
    const first = performance.now();
    engine.step(0);
    const firstStepMs = performance.now() - first;
    return {
      engine,
      world,
      map,
      poses,
      floors,
      events,
      timings,
      buildMapMs,
      buildActorsMs,
      firstStepMs,
      solids,
    };
  }
  function measure(size, pattern, actors, dynamic, instrument) {
    const f = setup(size, pattern, actors, instrument),
      records = [];
    let solidCells = f.solids;
    for (let frame = 0; frame < warmups + samples; frame++) {
      f.poses(frame);
      f.events.enter = f.events.stay = f.events.exit = 0;
      for (const key of Object.keys(f.timings)) f.timings[key] = 0;
      const start = performance.now();
      if (dynamic)
        for (const { x, y } of f.floors.slice(0, 8)) {
          const id = f.map.get(x, y);
          f.map.set(x, y, id === null ? 0 : null);
          solidCells += id === null ? 1 : -1;
        }
      const afterEdit = performance.now();
      f.engine.step(1 / 60);
      const end = performance.now();
      if (frame >= warmups)
        records.push({
          editMs: afterEdit - start,
          stepMs: end - afterEdit,
          totalMs: end - start,
          solidCells,
          actorCandidates: f.world.diagnostics.candidates,
          actorNarrowTests: f.world.diagnostics.narrowTests,
          ...f.world.tileDiagnostics,
          passes: f.world.responseDiagnostics.passes,
          enter: f.events.enter,
          stay: f.events.stay,
          exit: f.events.exit,
          ...(instrument ? { phases: { ...f.timings } } : {}),
        });
    }
    const disposeStart = performance.now();
    f.engine.dispose();
    const disposeMs = performance.now() - disposeStart;
    const released = {
      actors: f.engine.scene.actors.length,
      maps: f.world.tileDiagnostics.maps,
      contacts: f.world.tileDiagnostics.contacts,
      retainedCells: f.world.tileDiagnostics.retainedCells,
      inputSources: f.engine.input.sourceCount,
    };
    assert.deepEqual(released, {
      actors: 0,
      maps: 0,
      contacts: 0,
      retainedCells: 0,
      inputSources: 0,
    });
    return {
      mapCells: size * size,
      initialSolidCells: f.solids,
      buildMapMs: f.buildMapMs,
      buildActorsMs: f.buildActorsMs,
      firstStepMs: f.firstStepMs,
      disposeMs,
      released,
      editMs: percentile(records.map((r) => r.editMs)),
      stepMs: percentile(records.map((r) => r.stepMs)),
      totalMs: percentile(records.map((r) => r.totalMs)),
      records,
    };
  }
  const results = [],
    raw = new Map();
  for (let repeat = 0; repeat < 3; repeat++)
    for (const size of [32, 100, 256])
      for (const pattern of ["dense", "scattered"])
        for (const actors of [1, 128])
          for (const dynamic of [false, true]) {
            const plain = measure(size, pattern, actors, dynamic, false),
              profiled = measure(size, pattern, actors, dynamic, true);
            for (let i = 0; i < samples; i++)
              for (const key of [
                "candidateCells",
                "narrowTests",
                "responseTests",
                "corrections",
                "contacts",
                "unresolved",
                "enter",
                "stay",
                "exit",
              ])
                assert.equal(
                  plain.records[i][key],
                  profiled.records[i][key],
                  `${key}: profiled path changed behavior`,
                );
            const file = `${size}-${pattern}.json`,
              group = raw.get(file) ?? [];
            group.push({
              actors,
              dynamic,
              repeat,
              plain: plain.records,
              profiled: profiled.records,
            });
            raw.set(file, group);
            const { records: _plain, ...summary } = plain;
            const phases = Object.fromEntries(
              Object.keys(profiled.records[0].phases).map((key) => [
                key,
                percentile(profiled.records.map((r) => r.phases[key])),
              ]),
            );
            results.push({
              size,
              pattern,
              actors,
              dynamic,
              repeat,
              samples: `samples/${file}`,
              ...summary,
              profiledPhasesMs: phases,
            });
          }
  const seams = [];
  for (const corner of [false, true])
    for (const circle of [true, false])
      for (const rotation of circle ? [0] : [0.37, -0.64])
        for (const horizontal of [false, true])
          for (const side of [-1, 1])
            for (const tangent of [-1, 1])
              for (const [tileWidth, tileHeight] of [
                [32, 32],
                [48, 20],
              ]) {
                const result = runWallScenario({
                  corner,
                  circle,
                  rotation,
                  horizontal,
                  side,
                  tangent,
                  tileWidth,
                  tileHeight,
                });
                assert.ok(result.maxError < 1e-6);
                assert.equal(result.maxUnresolved, 0);
                seams.push(result);
              }
  const report = {
    status: "formal CollisionWorld / headless Engine measurements",
    environment: {
      date: new Date().toISOString(),
      node: process.version,
      platform: platform(),
      cpu: cpus()[0]?.model,
      sourceRevision: revision,
      sourceCleanAtStart: true,
    },
    methodology: {
      repeats: 3,
      warmups,
      samples,
      actorCounts: [1, 128],
      dimensions: [32, 100, 256],
      cellSize: [32, 32],
      collider:
        "radius-10 Solid circle, dynamic mass1; Actor layer1/mask2, terrain layer2/mask1",
      dense: "75% filled, one free corridor row per four rows",
      scattered: "coordinate hash 1/8 occupancy except free corridors",
      movement:
        "deterministic poses reset outside timed region each step, press 2 units into a floor; endpoint response, no Motion component",
      edits:
        "8 distinct floor image cells toggle Solid/null per dynamic step; no render subscriptions",
      phases:
        "separate instrumented runs wrap internal methods with performance.now; query includes filtering/narrow phase/contact recording, response includes recompute/features/translation; delivery includes event handlers. Wrapper overhead affects profiled times. Plain Engine.step timings are not instrumented.",
      build:
        "map time includes input Grid construction, initial Solid/floor inventory and Tilemap copied-grid validation; actor time includes components/subscriptions; first step includes registration/pair creation",
      percentiles: "ordinary median and nearest-rank p95; raw samples retained",
    },
    results,
    seams,
    limitations: [
      "Shared Linux/Node JIT host; no browser/GPU/FPS or hardware guarantee",
      "One map, static axis-aligned terrain and radius10 circles, masks intentionally exclude Actor/Actor response; existing Actor Solver has separate regression evidence",
      "Phased timings are diagnostic instrumented observations, not zero-overhead production costs; components of profiled and plain runs must not be summed together",
      "Pose resets keep comparable repeated endpoint penetrations; this is not a full game/session or CCD workload",
      "Retained cell/pair counters are logical resources, not heap/native/GPU byte measurements; no long soak measured",
      "The dense map contains free corridors; it is not a claim of recovery from arbitrary fully embedded terrain",
    ],
  };
  mkdirSync(resolve(dirname(out), "samples"), { recursive: true });
  for (const [file, group] of raw)
    writeFileSync(
      resolve(dirname(out), "samples", file),
      `${JSON.stringify(group, null, 2)}\n`,
    );
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        out,
        cases: results.length,
        rawPasses: results.length * samples * 2,
        seamScenarios: seams.length,
        maxSeamError: Math.max(...seams.map((r) => r.maxError)),
        source: revision,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
