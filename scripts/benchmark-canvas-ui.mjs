import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform } from "node:os";
import { dirname } from "node:path";
import { createServer } from "vite";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain"),
  "",
  "Commit/push the workload before recording",
);
assert(global.gc, "Run with --expose-gc");
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
const out = process.argv[2] ?? "benchmarks/canvas-ui/model.json";
const summarize = (values) => {
  const v = [...values].sort((a, b) => a - b);
  return {
    p50: (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2,
    p95: v[Math.ceil(v.length * 0.95) - 1],
    raw: values,
  };
};
try {
  const { Scene, screenPoint, worldPoint } = await server.ssrLoadModule(
    "/packages/core/src/index.ts",
  );
  const { CanvasButton, CanvasPanel, CanvasRow } = await server.ssrLoadModule(
    "/packages/web/src/canvas-node.ts",
  );
  const { CanvasUI } = await server.ssrLoadModule(
    "/packages/web/src/canvas-ui.ts",
  );
  const { PointerRouting, ScenePointer, PointerDown } =
    await server.ssrLoadModule("/packages/web/src/pointer-routing.ts");
  const measure = () => ({ width: 30, height: 20 });
  function setup(count) {
    const scene = new Scene("ui-benchmark"),
      nodes = Array.from({ length: count }, (_, i) =>
        CanvasButton(String(i), () => {}, {
          width: 60,
          height: 24,
          padding: 0,
          shrink: 0,
        }),
      );
    const root = CanvasRow(nodes, { wrap: true, gap: 4 }),
      ui = new CanvasUI(scene, root),
      routing = new PointerRouting();
    routing.setScene(new ScenePointer(scene), ui);
    ui.layout(1000, 1000, measure);
    return { scene, nodes, root, ui, routing };
  }
  const workloads = [];
  for (const count of [10, 100, 1000, 5000]) {
    const f = setup(count),
      layout = [],
      staticCalls = [],
      edit = [],
      pointer = [],
      dispose = [];
    for (let i = 0; i < 110; i++) {
      const start = performance.now();
      f.root.setStyle({ gap: i % 2 ? 4 : 5 });
      f.ui.layout(1000, 1000, measure);
      const elapsed = performance.now() - start;
      if (i >= 10) layout.push(elapsed);
    }
    const beforeStatic = f.ui.diagnostics;
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      for (let j = 0; j < 1000; j++)
        assert.equal(f.ui.layout(1000, 1000, measure), false);
      staticCalls.push((performance.now() - start) / 1000);
    }
    assert.equal(f.ui.diagnostics.layouts, beforeStatic.layouts);
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      f.nodes[count - 1].setText(`edit ${i}`);
      f.ui.layout(1000, 1000, measure);
      edit.push(performance.now() - start);
    }
    let down = 0;
    f.nodes[0].events.on(PointerDown, () => down++);
    const p = {
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      buttons: 1,
      screen: screenPoint(10, 10),
      world: worldPoint(10, 10),
      inside: true,
    };
    const before = f.ui.diagnostics;
    for (let i = 0; i < 110; i++) {
      const start = performance.now();
      f.routing.down(p);
      for (let j = 0; j < 5; j++) f.routing.move(p);
      f.routing.up(p);
      if (i >= 10) pointer.push(performance.now() - start);
    }
    assert.equal(down, 110);
    const after = f.ui.diagnostics;
    const start = performance.now();
    f.scene.dispose();
    dispose.push(performance.now() - start);
    f.routing.dispose();
    const released = {
      nodes: f.ui.diagnostics.nodes,
      subscriptions: f.ui.diagnostics.subscriptions,
      captures: f.routing.diagnostics.captures,
      suppressed: f.routing.diagnostics.suppressedPointers,
      listeners: f.nodes.reduce((sum, n) => sum + n.events.listenerCount(), 0),
    };
    assert.deepEqual(released, {
      nodes: 0,
      subscriptions: 0,
      captures: 0,
      suppressed: 0,
      listeners: 0,
    });
    workloads.push({
      buttons: count,
      totalNodes: count + 1,
      width: 1000,
      height: 1000,
      layoutMs: summarize(layout),
      idleCallMs: summarize(staticCalls),
      singleTextEditAndLayoutMs: summarize(edit),
      gesture7InputEventsMs: summarize(pointer),
      gestureHitTests: (after.hitTests - before.hitTests) / 110,
      gestureHitVisits: (after.hitVisits - before.hitVisits) / 110,
      layoutCounters: after,
      disposeMs: dispose[0],
      released,
    });
  }
  const deep = [];
  for (const depth of [16, 32, 64]) {
    const leaf = CanvasButton("leaf", () => {});
    let root = leaf;
    for (let i = 1; i < depth; i++) root = CanvasPanel([root]);
    const scene = new Scene("nested"),
      ui = new CanvasUI(scene, root),
      raw = [];
    for (let i = 0; i < 110; i++) {
      root.setStyle({ padding: i % 2 });
      const start = performance.now();
      ui.layout(1000, 1000, measure);
      if (i >= 10) raw.push(performance.now() - start);
    }
    deep.push({ depth, layoutMs: summarize(raw), counters: ui.diagnostics });
    scene.dispose();
  }
  for (let i = 0; i < 5; i++) global.gc();
  const initial = process.memoryUsage().heapUsed,
    heap = [];
  for (let cycle = 0; cycle < 100; cycle++) {
    const f = setup(100);
    f.scene.dispose();
    f.routing.dispose();
    assert.equal(f.ui.diagnostics.nodes, 0);
    if ((cycle + 1) % 10 === 0) {
      global.gc();
      heap.push({ cycle: cycle + 1, heapUsed: process.memoryUsage().heapUsed });
    }
  }
  for (let i = 0; i < 5; i++) global.gc();
  const report = {
    revision: git("rev-parse", "HEAD"),
    time: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      cpu: cpus()[0].model,
    },
    scope:
      "Node model/layout/router only, synthetic fixed text metrics, no DOM/Pixi/GPU/FPS. 10 warmups and 100 recorded samples. Idle times divide 1000 calls including assertion. Gestures: down, five moves, up; click also delivered. Full root dirty layout, counters distinguish arrange/intrinsic/constrained work. One disposal observation per size.",
    workloads,
    deep,
    memory: {
      cycles: 100,
      buttonsPerScene: 100,
      initialHeap: initial,
      samples: heap,
      finalHeap: process.memoryUsage().heapUsed,
      scope:
        "Forced-GC managed heap includes Vite/SSR/tooling; no leak-freedom or native/GPU allocation claim",
    },
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({
      out,
      revision: report.revision,
      workloads: workloads.map((w) => ({
        buttons: w.buttons,
        layout: w.layoutMs.p50,
        idle: w.idleCallMs.p50,
        gesture: w.gesture7InputEventsMs.p50,
        hitVisits: w.gestureHitVisits,
        dispose: w.disposeMs,
      })),
      memory: report.memory,
    }),
  );
} finally {
  await server.close();
}
