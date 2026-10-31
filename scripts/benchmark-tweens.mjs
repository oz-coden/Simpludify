import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname } from "node:path";
import { performance } from "node:perf_hooks";
import { createServer } from "vite";

const output = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : undefined;
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
try {
  const { Tween, TweenScheduler } = await server.ssrLoadModule(
    "/packages/core/src/index.ts",
  );
  const rows = [];
  for (const count of [0, 1000, 10000]) {
    const scheduler = new TweenScheduler(),
      targets = [];
    for (let i = 0; i < count; i++) {
      const target = { value: 0 };
      targets.push(target);
      scheduler.play(
        Tween.to(Tween.property(target, "value"), 1, {
          duration: 1,
          repeat: Infinity,
          yoyo: true,
        }),
      );
    }
    for (let i = 0; i < 300; i++) scheduler.advance(1 / 60);
    const samples = [];
    for (let i = 0; i < 600; i++) {
      const start = performance.now();
      scheduler.advance(1 / 60);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    rows.push({
      count,
      updates: 600,
      p50: samples[299],
      p95: samples[569],
      p99: samples[593],
      active: scheduler.diagnostics.active,
    });
    scheduler.dispose();
    assert.equal(scheduler.diagnostics.active, 0);
    assert.ok(targets.every((t) => Number.isFinite(t.value)));
  }
  const report = {
    date: new Date().toISOString(),
    node: process.version,
    platform: platform(),
    cpu: cpus()[0]?.model,
    logicalCPUs: cpus().length,
    conditions:
      "Vite SSR; Core numeric records; one channel/handle; 300 warmup + 600 timed updates at 1/60 sec; synchronous CPU milliseconds per update; no rendering, GPU or native-memory measurement; no concurrent builds/tests",
    rows,
  };
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await server.close();
}
