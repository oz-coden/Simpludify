import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname } from "node:path";
import { createServer } from "vite";

const args = process.argv.slice(2),
  output = args[0] === "--out" && args.length === 2 ? args[1] : undefined;
assert(
  args.length === 0 || output,
  "Usage: node --expose-gc scripts/benchmark-replay-memory.mjs [--out report.json]",
);
assert.equal(typeof globalThis.gc, "function", "Run with --expose-gc");
const server = await createServer({
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const {
    Engine,
    Action,
    ActionController,
    defineActions,
    ReplayRecorder,
    RandomManager,
  } = await server.ssrLoadModule("/packages/core/src/index.ts");
  const actions = defineActions({
    Move: Action.axis2D(),
    Fire: Action.button(),
    Pause: Action.button(),
  });
  const collect = () => {
    globalThis.gc();
    globalThis.gc();
    return process.memoryUsage().heapUsed;
  };
  const profile = (recording) => {
    const engine = new Engine({ seed: 42 }),
      controls = new ActionController(actions, {
        scene: engine.scene,
        input: engine.input,
      }),
      source = controls.createSource();
    let recorder = recording
      ? new ReplayRecorder(engine, {
          controllers: { player: controls },
          metadata: { gameVersion: "memory-profile-1" },
          maxSteps: 100000,
        })
      : undefined;
    const before = collect(),
      begin = performance.now();
    for (let i = 0; i < 100000; i++) {
      if (i % 1000 === 0) {
        source.set(actions.Fire, true);
        source.set(actions.Fire, false);
      }
      engine.step(1 / 120);
    }
    const steppingMs = performance.now() - begin,
      held = collect();
    let data,
      text,
      jsonBytes = 0;
    const finish = performance.now();
    if (recorder) data = recorder.finish();
    const finishMs = performance.now() - finish,
      exported = collect();
    if (data) {
      text = JSON.stringify(data);
      jsonBytes = Buffer.byteLength(text);
    }
    const serialized = collect();
    data = undefined;
    text = undefined;
    recorder?.dispose();
    recorder = undefined;
    engine.dispose();
    assert.equal(engine.input.sourceCount, 0);
    return {
      recording,
      steps: 100000,
      simulationSeconds: 100000 / 120,
      steppingMs,
      finishMs,
      jsonBytes,
      heapBytes: {
        before,
        heldAfterSteps: held,
        afterFinish: exported,
        afterSerialization: serialized,
        afterRelease: collect(),
      },
      remainingSources: engine.input.sourceCount,
    };
  };
  profile(false);
  profile(true); // warm both paths before sampling
  const profiles = [profile(false), profile(true)];
  const random = new RandomManager(42);
  random.stream("enemy");
  let begin = performance.now();
  for (let i = 0; i < 1000000; i++) random.stream("enemy");
  const lookupMs = performance.now() - begin;
  begin = performance.now();
  for (let i = 0; i < 10000; i++) random.stream(`stream-${i}`);
  const createMs = performance.now() - begin;
  random.dispose();
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
      "Isolated Core/SSR, no Actors/rendering, 100000 repeated logical boundaries; forced GC stage observations are not true peak memory or leak proof. No other local tests/builds during recording.",
    profiles,
    random: {
      cachedLookups: 1000000,
      lookupMs,
      createdNamedStreams: 10000,
      createMs,
    },
  };
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await server.close();
}
