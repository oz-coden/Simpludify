import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname } from "node:path";
import { createServer } from "vite";

const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 2 && args[0] === "--out"));
const output = args[1];
assert.equal(typeof globalThis.gc, "function", "Run with node --expose-gc");
const server = await createServer({
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const {
    Action,
    ActionController,
    ActionMovement,
    Actor,
    Component,
    ComponentPhase,
    defineActions,
    defineComponent,
    Engine,
    Motion,
    Transform,
  } = await server.ssrLoadModule("/packages/core/src/index.ts");
  const { recordMission } = await server.ssrLoadModule(
    "/examples/prism-raid/replay.ts",
  );
  const actions = defineActions({ Move: Action.axis2D() });
  class Steer extends Component {
    static type = defineComponent("BenchmarkSteer", [Motion.type]);
    type = Steer.type;
    // Explicit Input is supported by both revisions; default Update is tested separately.
    phase = ComponentPhase.Input;
    motion;
    constructor(reader) {
      super();
      this.reader = reader;
    }
    onAttach() {
      this.motion = this.actor.require(Motion.type);
    }
    update() {
      const value = this.reader.value();
      this.motion.direction.x = value.x;
      this.motion.direction.y = value.y;
    }
  }
  const workload = (mode) => {
    const engine = new Engine({ seed: 42 });
    const controls = new ActionController(actions, {
      scene: engine.scene,
      input: engine.input,
    });
    controls.createSource().set(actions.Move, { x: 0.6, y: 0.8 });
    for (let i = 0; i < 1000; i++) {
      const actor = engine.scene.add(new Actor());
      actor.add(new Transform());
      actor.add(new Motion({ speed: 120, x: 0.6, y: 0.8 }));
      if (mode === "standard")
        actor.add(new ActionMovement(controls.reader(actions.Move)));
      if (mode === "custom")
        actor.add(new Steer(controls.reader(actions.Move)));
    }
    for (let i = 0; i < 300; i++) engine.step(1 / 120);
    globalThis.gc();
    const before = process.memoryUsage().heapUsed;
    const begin = performance.now();
    for (let i = 0; i < 1000; i++) engine.step(1 / 120);
    const elapsed = performance.now() - begin;
    globalThis.gc();
    const held = process.memoryUsage().heapUsed;
    const position = engine.scene.actors[0].require(Transform.type);
    assert(
      Math.abs(position.x - 780) < 1e-8 && Math.abs(position.y - 1040) < 1e-8,
    );
    engine.dispose();
    assert.equal(engine.input.sourceCount, 0);
    return {
      mode,
      actors: 1000,
      warmupSteps: 300,
      measuredSteps: 1000,
      stepSeconds: 1 / 120,
      milliseconds: elapsed,
      microsecondsPerActorStep: elapsed / 1000,
      heapBefore: before,
      heapAfter: held,
      remainingSources: engine.input.sourceCount,
    };
  };
  const measurements = [
    workload("autonomous"),
    workload("standard"),
    workload("custom"),
  ];
  const fingerprint = (options) => {
    const mission = recordMission(options);
    // Engine/Action schemas may intentionally evolve; compare game rules and positions here.
    return {
      options,
      steps: mission.data.steps.length,
      status: mission.snapshot.status,
      score: mission.snapshot.score,
      gameStateSha256: createHash("sha256")
        .update(JSON.stringify(mission.snapshot))
        .digest("hex"),
    };
  };
  const report = {
    environment: {
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
    },
    scope:
      "Isolated Core/SSR, no renderer or colliders in microbenchmarks; one million Actor steps per mode after warmup. No other local tests/builds during recorded runs. Heap samples include tooling and are not peak/leak proof.",
    measurements,
    gameFingerprints: [
      fingerprint({ seed: 2026 }),
      fingerprint({ seed: 42, automatic: false }),
    ],
  };
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await server.close();
}
