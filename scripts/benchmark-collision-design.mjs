/** Isolated search/identity cost probe. No browser or production Tilemap physics claim. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

const out = process.argv[2] ?? "benchmarks/collision-design/results.json";
assert.ok(
  process.argv.length <= 3,
  "usage: node scripts/benchmark-collision-design.mjs [output.json]",
);
const command = (...args) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(
  command("status", "--porcelain"),
  "",
  "commit/push all work before recording measurements",
);
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
function percentiles(values) {
  const sorted = [...values].sort((a, b) => a - b),
    n = sorted.length;
  return {
    p50: (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2,
    p95: sorted[Math.ceil(0.95 * n) - 1],
  };
}
try {
  const { CandidateProbe } = await server.ssrLoadModule(
    "/tests/prototypes/tile-candidates.ts",
  );
  const { responseFindings } = await server.ssrLoadModule(
    "/tests/prototypes/tile-response.ts",
  );
  const { Grid, Engine, Actor, Collider, CollisionWorld, Transform } =
    await server.ssrLoadModule("/packages/core/src/index.ts");
  const workloads = [];
  for (const size of [32, 100, 256])
    for (const pattern of ["uniform", "scattered"])
      workloads.push({ size, pattern, actors: 32, side: 1 });
  for (const pattern of ["uniform", "scattered"]) {
    workloads.push({ size: 256, pattern, actors: 256, side: 1 });
    workloads.push({ size: 256, pattern, actors: 32, side: 16 });
    workloads.push({ size: 32, pattern, actors: 1, side: 8 });
  }
  const results = [];
  const warmups = 10,
    samples = 20;
  for (let repeat = 0; repeat < 3; repeat++)
    for (const workload of workloads) {
      const { size, pattern, actors, side } = workload;
      let seed = 0x12345678;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
      };
      const ranges = Array.from({ length: actors }, () => {
        const x0 = (random() >>> 8) % (size - side + 1),
          y0 = (random() >>> 8) % (size - side + 1);
        return { x0, y0, x1: x0 + side - 1, y1: y0 + side - 1 };
      });
      // Hash avoids the accidental LCG low-bit correlation of x/y actor positions.
      const solid = (x, y) =>
        pattern === "uniform" ||
        ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) %
          8 ===
          0;
      const first = ranges[0];
      const edits = Array.from({ length: 8 }, (_, i) => ({
        x: (first.x0 + i) % size,
        y: (first.y0 + Math.floor(i / 4)) % size,
      }));
      for (const dynamic of [false, true]) {
        // Rotate timing order between repetitions; equivalent grids/poses/edit sequences for every path.
        const strategies = ["direct", "merged", "chunked"];
        const expected = [];
        for (let strategyIndex = 0; strategyIndex < 3; strategyIndex++) {
          const strategy = strategies[(strategyIndex + repeat) % 3];
          const grid = Grid.generate(size, size, solid);
          let solidCells = 0;
          grid.forEach((value) => {
            if (value) solidCells++;
          });
          const startBuild = performance.now();
          const probe = new CandidateProbe(grid, strategy);
          const buildMs = performance.now() - startBuild;
          const records = [];
          for (let frame = 0; frame < warmups + samples; frame++) {
            const start = performance.now();
            if (dynamic)
              for (const { x, y } of edits) probe.set(x, y, !grid.get(x, y));
            probe.commit();
            const afterEdit = performance.now();
            const counters = {
              visitedCells: 0,
              testedRectangles: 0,
              bucketReferences: 0,
              hits: 0,
              checksum: 0,
            };
            for (const range of ranges) {
              const result = probe.query(range);
              for (const key of Object.keys(counters))
                counters[key] += result[key];
            }
            const end = performance.now();
            if (strategyIndex === 0)
              expected[frame] = {
                hits: counters.hits,
                checksum: counters.checksum,
              };
            else
              assert.deepEqual(
                { hits: counters.hits, checksum: counters.checksum },
                expected[frame],
              );
            if (frame >= warmups)
              records.push({
                editMs: afterEdit - start,
                queryMs: end - afterEdit,
                totalMs: end - start,
                ...counters,
                rebuildCells: probe.rebuildCells,
                rebuiltChunks: probe.rebuiltChunks,
              });
          }
          results.push({
            ...workload,
            repeat,
            dynamic,
            strategy,
            mapCells: size * size,
            initialSolidCells: solidCells,
            footprintCellsPerPass: actors * side * side,
            changedCellsPerPass: dynamic ? 8 : 0,
            buildMs,
            retained: probe.retained,
            editMs: percentiles(records.map((r) => r.editMs)),
            queryMs: percentiles(records.map((r) => r.queryMs)),
            totalMs: percentiles(records.map((r) => r.totalMs)),
            records,
          });
        }
      }
    }
  const actorSweep = [];
  for (const distribution of ["horizontal", "vertical", "coincident"]) {
    const engine = new Engine(),
      world = new CollisionWorld(engine.scene);
    for (let i = 0; i < 1000; i++) {
      const actor = engine.scene.add(new Actor());
      actor.add(
        new Transform({
          x: distribution === "horizontal" ? i * 40 : 0,
          y: distribution === "vertical" ? i * 40 : 0,
        }),
      );
      actor.add(new Collider());
    }
    for (let i = 0; i < 3; i++) engine.step(0);
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      engine.step(0);
      times.push(performance.now() - start);
    }
    actorSweep.push({
      distribution,
      actors: 1000,
      times,
      milliseconds: percentiles(times),
      ...world.diagnostics,
    });
    engine.dispose();
    assert.equal(world.diagnostics.colliders, 0);
    assert.equal(world.diagnostics.contacts, 0);
  }
  const report = {
    status: "isolated prototype; not production Tilemap collision",
    environment: {
      measuredAt: new Date().toISOString(),
      node: process.version,
      platform: platform(),
      cpu: cpus()[0]?.model,
      sourceRevision: command("rev-parse", "HEAD"),
      sourceCleanAtStart: true,
    },
    methodology: {
      warmups,
      samples,
      repeats: 3,
      cellUnits:
        "integer cell ranges, each body queries side*side cells; no Camera or renderer",
      chunkSize: 16,
      patterns:
        "uniform=all Solid; scattered=deterministic coordinate hash modulo 8",
      identity:
        "all strategies enumerate semantic cell IDs after geometry search; checksums/hit counts asserted equal each pass; exact sets checked in unit tests",
      timing:
        "one pass over all actor footprints; edit+index commit and search+cell enumeration separated; excludes input Grid generation, production policy/filter/narrow phase/solver/pair events",
      percentiles:
        "p50 ordinary median, p95 nearest-rank ceil(.95*n)-1; raw values retained",
    },
    results,
    actorSweep,
    responseProbe: responseFindings(),
    limitations: [
      "Shared Linux host / Node JIT, not real-time FPS or browser/hardware claim",
      "One map, static axis-aligned boolean cells, footprint axis-aligned boxes, no mixed policies",
      "Merged is greedy row-run + spatial buckets, not globally optimal rectangle cover; chunked merges inside 16x16 chunks",
      "Per-cell identity enumeration prevents claiming rectangle count alone as whole-system cost",
      "No native memory/GC bytes, long soak, full terrain physics or GPU work measured",
    ],
  };
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const groups = new Map();
  for (const row of report.results) {
    const name = `${row.size}-${row.pattern}-${row.actors}-${row.side}.json`;
    const group = groups.get(name) ?? [];
    group.push({
      strategy: row.strategy,
      repeat: row.repeat,
      dynamic: row.dynamic,
      records: row.records,
    });
    groups.set(name, group);
    delete row.records;
    row.samples = `samples/${name}`;
  }
  mkdirSync(resolve(dirname(out), "samples"), { recursive: true });
  for (const [name, group] of groups)
    writeFileSync(
      resolve(dirname(out), "samples", name),
      `${JSON.stringify(group)}\n`,
    );
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        out,
        runs: results.length,
        source: report.environment.sourceRevision,
        response: report.responseProbe,
        actorSweep: actorSweep.map(({ times, ...rest }) => rest),
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
