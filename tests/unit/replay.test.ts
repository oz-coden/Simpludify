import {
  Action,
  ActionController,
  Actor,
  Component,
  type ComponentType,
  defineActions,
  defineComponent,
  Engine,
  KeyCode,
  parseReplayData,
  ReplayPlayer,
  ReplayRecorder,
  Scene,
  Transform,
} from "@simpludify/core";
import { expect, it } from "vitest";

const Actions = defineActions({
  Fire: Action.button(),
  Pause: Action.button(),
  Move: Action.axis2D(),
  Yaw: Action.axis1D(),
  Aim: Action.axis3D(),
});
function setup(seed = 42) {
  const engine = new Engine({ seed }),
    c = new ActionController(Actions, {
      scene: engine.scene,
      input: engine.input,
      bindings: {
        Fire: { keys: [KeyCode.Space, KeyCode.Enter] },
        Move: { x: { positive: [KeyCode.D] } },
      },
    });
  const source = c.createSource();
  const log: { frame: ReturnType<typeof c.frame>; random: number }[] = [];
  c.onPressed(Actions.Pause, () =>
    engine.paused ? engine.resume() : engine.pause(),
  );
  class Probe extends Component {
    static readonly type: ComponentType<Probe> =
      defineComponent<Probe>("Probe");
    readonly type = Probe.type;
    update() {
      log.push({
        frame: c.frame(),
        random: engine.random.stream("enemy").next(),
      });
    }
  }
  const actor = engine.scene.add(new Actor());
  actor.add(new Transform());
  actor.add(new Probe());
  return { engine, c, source, log };
}
function recording() {
  const a = setup(),
    rec = new ReplayRecorder(a.engine, {
      controllers: { player: a.c },
      metadata: { gameVersion: "test-1", difficulty: "hard" },
    });
  rec.record("start", { value: 1 });
  const key = a.engine.input.createKeyboardSource(),
    touch = a.c.createSource();
  key.set(KeyCode.Space, true);
  touch.set(Actions.Fire, true);
  key.set(KeyCode.Space, false);
  touch.set(Actions.Fire, false);
  for (const action of [
    Actions.Fire,
    Actions.Pause,
    Actions.Fire,
    Actions.Pause,
  ]) {
    a.source.set(action, true);
    a.source.set(action, false);
  }
  a.source.set(Actions.Move, { x: 0.25, y: -0.5 });
  a.source.set(Actions.Yaw, -0.75);
  a.source.set(Actions.Aim, { x: 0, y: 0.5, z: 0.25 });
  a.engine.step(1 / 60);
  rec.record("observed", { count: a.log.length });
  a.engine.pause();
  a.engine.step(0.4);
  a.engine.resume();
  for (let i = 0; i < 5; i++) {
    a.source.set(Actions.Fire, i % 2 === 0);
    a.engine.step(1 / 120);
  }
  const data = rec.finish();
  return { ...a, data };
}
it("round-trips JSON, all Action dimensions, composite taps and ordered pause/resume", () => {
  const a = recording(),
    b = setup();
  const player = new ReplayPlayer(
    b.engine,
    JSON.parse(JSON.stringify(a.data)),
    {
      controllers: { player: b.c },
      expectedMetadata: { gameVersion: "test-1" },
    },
  );
  while (player.step()) {}
  expect(b.log).toEqual(a.log);
  expect(b.engine.snapshot()).toEqual(a.engine.snapshot());
  expect(player.done).toBe(true);
  expect(
    a.data.steps[0]?.inputs.player?.events
      .filter((e) => e.down)
      .map((e) => e.name),
  ).toEqual(["Fire", "Fire", "Pause", "Fire", "Pause"]);
  expect(a.data.events.map((e) => [e.step, e.phase, e.type])).toEqual([
    [0, "between", "start"],
    [1, "between", "observed"],
  ]);
  player.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
it("records auxiliary step events without executing them during playback", () => {
  const a = setup();
  let rec: ReplayRecorder | undefined;
  a.engine.scene.onUpdate(() => rec?.record("score", { score: 1 }));
  rec = new ReplayRecorder(a.engine, { controllers: { player: a.c } });
  a.engine.step(0.1);
  const data = rec.finish();
  expect(data.events[0]).toMatchObject({ step: 0, phase: "step", order: 0 });
  const b = setup(),
    player = new ReplayPlayer(b.engine, data, { controllers: { player: b.c } });
  player.step();
  expect(b.log).toHaveLength(1);
  player.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
it("uses controller IDs to disambiguate identical Action names", () => {
  const a = setup(),
    other = new ActionController(Actions, {
      scene: a.engine.scene,
      input: a.engine.input,
    });
  const rec = new ReplayRecorder(a.engine, {
    controllers: { first: a.c, second: other },
  });
  other.createSource().set(Actions.Fire, true);
  a.engine.step(0);
  const data = rec.finish();
  const b = setup(),
    second = new ActionController(Actions, {
      scene: b.engine.scene,
      input: b.engine.input,
    });
  const player = new ReplayPlayer(b.engine, data, {
    controllers: { first: b.c, second },
  });
  player.step();
  expect(b.c.value(Actions.Fire)).toBe(false);
  expect(second.value(Actions.Fire)).toBe(true);
  player.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
it("rejects mid-game, duplicate, foreign and incomplete controller bindings", () => {
  const a = setup(),
    b = setup();
  expect(
    () => new ReplayRecorder(a.engine, { controllers: { foreign: b.c } }),
  ).toThrow();
  expect(
    () => new ReplayRecorder(a.engine, { controllers: { a: a.c, b: a.c } }),
  ).toThrow();
  const incomplete = new ReplayRecorder(a.engine, { controllers: {} });
  expect(() => a.engine.step(0)).toThrow(/exactly/);
  expect(() => incomplete.finish()).toThrow();
  incomplete.dispose();
  a.engine.step(0);
  expect(
    () => new ReplayRecorder(a.engine, { controllers: { player: a.c } }),
  ).toThrow(/new Engine/);
  a.engine.dispose();
  b.engine.dispose();
});
it("rejects incompatible seed, schema, version, metadata and initial random consumption", () => {
  const a = recording();
  const wrong = setup(43);
  expect(
    () =>
      new ReplayPlayer(wrong.engine, a.data, {
        controllers: { player: wrong.c },
      }),
  ).toThrow(/seed/);
  wrong.engine.dispose();
  const b = setup();
  expect(
    () => new ReplayPlayer(b.engine, a.data, { controllers: { wrongID: b.c } }),
  ).toThrow(/Controller/);
  expect(
    () =>
      new ReplayPlayer(b.engine, a.data, {
        controllers: { player: b.c },
        expectedMetadata: { gameVersion: "different" },
      }),
  ).toThrow(/Metadata/);
  b.engine.random.next();
  const player = new ReplayPlayer(b.engine, a.data, {
    controllers: { player: b.c },
  });
  expect(() => player.step()).toThrow(/initial random/);
  player.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
it("locks live input, validates supplied deltas, and releases the lock on disposal", () => {
  const a = recording(),
    b = setup();
  const player = new ReplayPlayer(b.engine, a.data, {
    controllers: { player: b.c },
  });
  expect(() => b.source.set(Actions.Fire, true)).toThrow(/disabled/);
  expect(b.engine.input.acceptsKey(KeyCode.Space)).toBe(false);
  expect(() => b.engine.step(0.5)).toThrow(/delta/);
  player.dispose();
  b.source.set(Actions.Fire, true);
  a.engine.dispose();
  b.engine.dispose();
});
it("rejects malformed JSON data and inconsistent Button transitions", () => {
  const a = recording();
  // biome-ignore lint/suspicious/noExplicitAny: deliberately corrupt parsed JSON to exercise runtime validation.
  const modify = (fn: (v: any) => void) => {
    const v = JSON.parse(JSON.stringify(a.data));
    fn(v);
    expect(() => parseReplayData(v)).toThrow();
  };
  modify((v) => {
    v.formatVersion = 2;
  });
  modify((v) => {
    v.random.algorithm = "unknown";
  });
  modify((v) => {
    v.steps[0].dt = -1;
  });
  modify((v) => {
    v.steps[0].index = 2;
  });
  modify((v) => {
    v.steps[0].inputs.player.values.Aim = { x: 0, y: 0 };
  });
  modify((v) => {
    v.steps[0].inputs.player.values.Fire = 3;
  });
  modify((v) => {
    v.steps[0].inputs.player.events = [
      { name: "Fire", down: true },
      { name: "Fire", down: true },
    ];
  });
  modify((v) => {
    v.steps[0].inputs.player.events = [{ name: "unknown", down: true }];
  });
  modify((v) => {
    v.steps[0].inputs.player.values.unknown = false;
  });
  modify((v) => {
    v.controllers.push(v.controllers[0]);
  });
  modify((v) => {
    v.events[0].order = 4;
  });
  modify((v) => {
    v.events[0].payload = NaN;
  });
  modify((v) => {
    v.random.streams[0].seed = 4;
  });
  a.engine.dispose();
});
it("cleans active sessions on Engine disposal and aborts rather than exporting failed execution", () => {
  const a = setup(),
    rec = new ReplayRecorder(a.engine, { controllers: { player: a.c } });
  a.engine.dispose();
  expect(rec.disposed).toBe(true);
  expect(() => rec.finish()).toThrow();
  const b = setup();
  b.engine.scene.onUpdate(() => {
    throw Error("game failure");
  });
  const failed = new ReplayRecorder(b.engine, { controllers: { player: b.c } });
  expect(() => b.engine.step(0)).toThrow(/game failure/);
  expect(() => failed.finish()).toThrow();
  failed.dispose();
  expect(
    () => new ReplayRecorder(b.engine, { controllers: { player: b.c } }),
  ).toThrow(/new Engine/);
  b.engine.dispose();
});
it("rejects Scene replacement even when its ID and empty controller roster are unchanged", () => {
  const engine = new Engine({ seed: 1 }),
    rec = new ReplayRecorder(engine, { controllers: {} });
  engine.step(0);
  expect(() => engine.activate(new Scene("default"))).toThrow(/one Scene/);
  rec.dispose();
  engine.dispose();
});
it("enforces a recording budget and rejects non-JSON metadata/events", () => {
  const a = setup(),
    rec = new ReplayRecorder(a.engine, {
      controllers: { player: a.c },
      maxSteps: 1,
    });
  expect(() => rec.record("x", undefined as never)).toThrow(/JSON/);
  a.engine.step(0);
  const data = rec.finish();
  expect(rec.length).toBe(1);
  expect(data.steps).toHaveLength(1);
  a.engine.dispose();
});

it("does no frame or random snapshot traversal with recording disabled", () => {
  const engine = new Engine({ seed: 42 });
  const c = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
  });
  const a = { engine, c };
  let frameReads = 0,
    snapshotReads = 0;
  const frame = a.c.frame.bind(a.c),
    snapshot = a.engine.random.snapshot.bind(a.engine.random);
  a.c.frame = () => {
    frameReads++;
    return frame();
  };
  a.engine.random.snapshot = () => {
    snapshotReads++;
    return snapshot();
  };
  for (let i = 0; i < 10000; i++) a.engine.step(1 / 120);
  expect(frameReads).toBe(0);
  expect(snapshotReads).toBe(0);
  a.engine.dispose();
});
it("canonicalizes metadata key order and checks game/engine versions before attachment", () => {
  const a = recording(),
    b = setup();
  const data = JSON.parse(JSON.stringify(a.data));
  data.engineVersion = "different";
  expect(
    () => new ReplayPlayer(b.engine, data, { controllers: { player: b.c } }),
  ).toThrow(/version/);
  const c = new ActionController(defineActions({ Changed: Action.button() }), {
    scene: b.engine.scene,
    input: b.engine.input,
  });
  expect(
    () => new ReplayPlayer(b.engine, a.data, { controllers: { player: c } }),
  ).toThrow(/Controller/);
  c.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
it("bounds playback host-time work without skipping recorded frames", () => {
  const a = recording(),
    b = setup(),
    player = new ReplayPlayer(b.engine, a.data, {
      controllers: { player: b.c },
    });
  expect(player.advance(100, 1)).toBe(1);
  expect(player.index).toBe(1);
  for (let i = 0; i < 100 && !player.done; i++) player.advance(0.25, 2);
  expect(player.done).toBe(true);
  expect(b.log).toEqual(a.log);
  player.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
