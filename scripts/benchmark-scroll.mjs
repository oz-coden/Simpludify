import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { createServer } from "vite";

const root = process.cwd();
assert(global.gc, "Run with --expose-gc");
assert.equal(
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  "",
  "Commit checkpoint before measuring",
);
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
const percentile = (xs, p) =>
  [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * p) - 1];
try {
  const { CanvasLabel, CanvasScroll, CanvasUI, Lifetime } =
    await server.ssrLoadModule("/packages/core/src/index.ts");
  const workloads = [];
  for (const count of [100, 1000, 5000]) {
    const owner = new Lifetime();
    const nodes = Array.from({ length: count }, (_, i) =>
      CanvasLabel(String(i), { height: 28, shrink: 0 }),
    );
    const root = CanvasScroll(nodes, { height: 300, gap: 2 });
    const ui = new CanvasUI(owner, root);
    let measurements = 0;
    const measure = () => {
      measurements++;
      return { width: 100, height: 20 };
    };
    ui.layout(800, 600, measure);
    for (let i = 0; i < 10; i++) {
      root.scrollTo(0, 120 + i);
      ui.layout(800, 600, measure);
    }
    global.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const before = ui.diagnostics;
    const oldMeasurements = measurements;
    const times = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      root.scrollTo(0, 120 + i);
      ui.layout(800, 600, measure);
      times.push(performance.now() - start);
    }
    global.gc();
    workloads.push({
      count,
      samples: 100,
      warmup: 10,
      p50ms: percentile(times, 0.5),
      p95ms: percentile(times, 0.95),
      layouts: ui.diagnostics.layouts - before.layouts,
      measurements: measurements - oldMeasurements,
      retainedHeapDelta: process.memoryUsage().heapUsed - heapBefore,
      rawMs: times,
    });
    owner.dispose();
  }
  const result = {
    revision: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    node: process.version,
    platform: platform(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
    units:
      "milliseconds per offset update plus CanvasUI.layout/presentation projection flush; no Pixi/GPU",
    workloads,
  };
  writeFileSync(
    process.argv[2] ?? "benchmarks/canvas-scroll/after.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      ...result,
      workloads: workloads.map(({ rawMs, ...w }) => w),
    }),
  );
} finally {
  await server.close();
}
