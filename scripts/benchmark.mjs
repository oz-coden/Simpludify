import { writeFileSync } from "node:fs";
import { arch, cpus, platform, release } from "node:os";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { Engine, Character, Action, ActionController, defineActions } =
    await server.ssrLoadModule("/packages/core/src/index.ts");
  const results = [];
  for (const count of [0, 1000]) {
    const engine = new Engine(42);
    const actions = defineActions({ Move: Action.axis2D() });
    const controls = new ActionController(actions, {
      scene: engine.scene,
      input: engine.input,
    });
    const movement = controls.reader(actions.Move);
    for (let i = 0; i < count; i++) engine.scene.add(Character({ movement }));
    controls.createSource().set(actions.Move, { x: 1, y: 0 });
    for (let i = 0; i < 1000; i++) engine.step(1 / 60);
    const durations = [],
      before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 5000; i++) {
      const time = performance.now();
      engine.step(1 / 60);
      durations.push(performance.now() - time);
    }
    const after = process.memoryUsage().heapUsed;
    durations.sort((a, b) => a - b);
    const percentile = (p) => durations[Math.floor((durations.length - 1) * p)];
    results.push({
      workload: count ? "1000 moving characters (core only)" : "idle core",
      samples: durations.length,
      milliseconds: {
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
      },
      heapBefore: before,
      heapAfter: after,
    });
    engine.dispose();
  }
  const report = {
    date: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
    },
    scope:
      "Engine.step only; no rendering, no GC control, no hardware performance guarantee",
    results,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (process.argv.includes("--out"))
    writeFileSync(process.argv[process.argv.indexOf("--out") + 1], output);
  console.log(output);
} finally {
  await server.close();
}
