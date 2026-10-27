import {
  Action,
  ActionController,
  ActionMovement,
  Actor,
  BodyType,
  Character,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionWorld,
  Component,
  ComponentPhase,
  type ComponentType,
  ContactEnter,
  defineActions,
  defineComponent,
  Engine,
  FixedStepRunner,
  Motion,
  ReplayPlayer,
  ReplayRecorder,
  Scene,
  Transform,
} from "@simpludify/core";
import { expect, it } from "vitest";

const Actions = defineActions({
  Move: Action.axis2D(),
  Sprint: Action.button(),
});
function setup() {
  const engine = new Engine({ seed: 42 }),
    controls = new ActionController(Actions, {
      scene: engine.scene,
      input: engine.input,
    });
  const player = engine.scene.add(
    Character({
      x: 0,
      y: 0,
      speed: 100,
      movement: controls.reader(Actions.Move),
    }),
  );
  return {
    engine,
    controls,
    player,
    source: controls.createSource(),
    motion: player.require(Motion.type),
    movement: player.require(ActionMovement.type),
  };
}
class CustomMove extends Component {
  static readonly type: ComponentType<CustomMove> = defineComponent<CustomMove>(
    "CustomMove",
    [Motion.type],
  );
  readonly type = CustomMove.type;
  constructor(
    private readonly calculate: () => { x: number; y: number; speed: number },
  ) {
    super();
  }
  update(): void {
    const value = this.calculate(),
      motion = this.actor.require(Motion.type);
    motion.speed = value.speed;
    motion.direction.x = value.x;
    motion.direction.y = value.y;
  }
  protected onDisable(): void {
    this.actor.require(Motion.type).direction.x = 0;
    this.actor.require(Motion.type).direction.y = 0;
  }
}
for (const scale of [0, 0.5, 1, 2])
  it(`applies scale ${scale} after logical normalization without modifying the Action`, () => {
    const a = setup();
    a.movement.scale = scale;
    a.source.set(Actions.Move, { x: 1, y: 1 });
    a.engine.step(1);
    expect(Math.hypot(a.player.x, a.player.y)).toBeCloseTo(100 * scale);
    expect(
      Math.hypot(
        a.controls.value(Actions.Move).x,
        a.controls.value(Actions.Move).y,
      ),
    ).toBeCloseTo(1);
    a.source.clear();
    a.engine.step(1);
    expect(Math.hypot(a.player.x, a.player.y)).toBeCloseTo(100 * scale);
    a.engine.dispose();
  });
it("changes speed/scale during play and stops at zero speed", () => {
  const a = setup();
  a.source.set(Actions.Move, { x: 1, y: 0 });
  for (const [speed, scale] of [
    [100, 1],
    [100, 2],
    [200, 0.5],
    [0, 2],
  ] as const) {
    a.motion.speed = speed;
    a.movement.scale = scale;
    a.engine.step(1);
  }
  expect(a.player.x).toBe(400);
  expect(a.motion.speed).toBe(0);
  a.engine.dispose();
});
it("uses the constructor scale and rejects invalid numeric writes without changing state", () => {
  const a = setup();
  expect(
    new ActionMovement(a.controls.reader(Actions.Move), { scale: 2 }).scale,
  ).toBe(2);
  for (const value of [NaN, Infinity, -Infinity, -1]) {
    expect(() => {
      a.motion.speed = value;
    }).toThrow();
    expect(() => {
      a.movement.scale = value;
    }).toThrow();
    expect(() => new Motion({ speed: value })).toThrow();
    expect(
      () =>
        new ActionMovement(a.controls.reader(Actions.Move), { scale: value }),
    ).toThrow();
  }
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(() => {
      a.motion.direction.x = value;
    }).toThrow();
    expect(() => {
      a.motion.direction.y = value;
    }).toThrow();
  }
  expect(a.motion.speed).toBe(100);
  expect(a.movement.scale).toBe(1);
  expect(a.motion.direction).toEqual({ x: 0, y: 0 });
  a.engine.dispose();
});
it("rejects derived overflow before committing either position axis", () => {
  const engine = new Engine(),
    actor = engine.scene.add(new Actor());
  const t = actor.add(new Transform({ x: 3, y: 4 }));
  actor.add(new Motion({ speed: 2, x: 1, y: Number.MAX_VALUE }));
  expect(() => engine.step(1)).toThrow(/Motion result y/);
  expect([t.x, t.y]).toEqual([3, 4]);
  engine.dispose();
});
it("supports autonomous unnormalized directions and mutable speed without any Action", () => {
  const engine = new Engine(),
    actor = engine.scene.add(Character({ x: 0, y: 0, speed: 5 }));
  const m = actor.require(Motion.type);
  m.direction.x = -2;
  m.direction.y = 3;
  engine.step(2);
  expect([actor.x, actor.y]).toEqual([-20, 30]);
  expect(actor.get(ActionMovement.type)).toBeUndefined();
  engine.dispose();
});
it("integrates a default Update writer added after Motion in the same first step", () => {
  const engine = new Engine(),
    actor = engine.scene.add(Character({ x: 0, y: 0 }));
  let speed = 180;
  actor.add(new CustomMove(() => ({ x: 0.5, y: -1, speed })));
  engine.step(0.5);
  expect([actor.x, actor.y]).toEqual([45, -90]);
  speed = 300;
  engine.step(0.5);
  expect([actor.x, actor.y]).toEqual([120, -240]);
  engine.dispose();
});
it("allows custom Action mapping, sprint and directional restrictions without ActionMovement", () => {
  const a = setup();
  a.player.remove(ActionMovement.type);
  a.player.add(
    new CustomMove(() => ({
      x: Math.max(0, a.controls.value(Actions.Move).x),
      y: 0,
      speed: a.controls.value(Actions.Sprint) ? 300 : 180,
    })),
  );
  a.source.set(Actions.Move, { x: -1, y: 1 });
  a.source.set(Actions.Sprint, true);
  a.engine.step(1);
  expect([a.player.x, a.player.y]).toEqual([0, 0]);
  a.source.set(Actions.Move, { x: 1, y: 0 });
  a.engine.step(1);
  expect(a.player.x).toBe(300);
  a.engine.dispose();
});
it("applies an Input-phase scale policy before the standard Update adapter", () => {
  const a = setup();
  class Sprint extends Component {
    static readonly type: ComponentType<Sprint> = defineComponent<Sprint>(
      "Sprint",
      [ActionMovement.type],
    );
    readonly type = Sprint.type;
    readonly phase = ComponentPhase.Input;
    update() {
      a.movement.scale = a.controls.value(Actions.Sprint) ? 2 : 1;
    }
  }
  a.player.add(new Sprint());
  a.source.set(Actions.Move, { x: 1, y: 0 });
  a.source.set(Actions.Sprint, true);
  a.engine.step(1);
  expect(a.player.x).toBe(200);
  a.engine.dispose();
});
it("orders global phases before contacts, timers and Scene callbacks", () => {
  const engine = new Engine(),
    calls: string[] = [];
  for (const phase of [
    ComponentPhase.LateUpdate,
    ComponentPhase.Integrate,
    ComponentPhase.Update,
    ComponentPhase.Input,
  ]) {
    class Probe extends Component {
      readonly type = defineComponent("PhaseProbe");
      constructor(readonly phase: ComponentPhase) {
        super();
      }
      update() {
        calls.push(this.phase);
      }
    }
    engine.scene.add(new Actor()).add(new Probe(phase));
  }
  engine.scene.onPostUpdate(() => calls.push("contacts"));
  engine.scene.after(0, () => calls.push("timer"));
  engine.scene.onUpdate(() => calls.push("scene"));
  engine.step(0);
  expect(calls).toEqual([
    "input",
    "update",
    "integrate",
    "late-update",
    "contacts",
    "timer",
    "scene",
  ]);
  engine.dispose();
});
it("documents intentional competing writers as insertion-ordered last writes", () => {
  const a = setup();
  a.source.set(Actions.Move, { x: 1, y: 0 });
  a.player.add(new CustomMove(() => ({ x: -1, y: 0, speed: 50 })));
  a.engine.step(1);
  expect(a.player.x).toBe(-50);
  a.engine.dispose();
});
it("keeps disable, resume, removal and Scene destruction contracts", () => {
  const a = setup();
  a.source.set(Actions.Move, { x: 1, y: 0 });
  a.engine.step(1);
  a.movement.enabled = false;
  a.engine.step(1);
  expect(a.player.x).toBe(100);
  a.movement.enabled = true;
  a.engine.step(1);
  expect(a.player.x).toBe(200);
  a.motion.enabled = false;
  a.engine.step(1);
  expect(a.player.x).toBe(200);
  a.motion.enabled = true;
  a.engine.pause();
  a.engine.step(10);
  expect(a.player.x).toBe(200);
  a.engine.resume();
  a.engine.step(1);
  expect(a.player.x).toBe(200);
  a.source.set(Actions.Move, { x: 1, y: 0 });
  a.engine.step(1);
  expect(a.player.x).toBe(300);
  a.player.remove(ActionMovement.type);
  a.engine.step(1);
  expect(a.player.x).toBe(300);
  a.engine.activate(new Scene("next"));
  expect(a.player.disposed).toBe(true);
  expect(a.motion.disposed).toBe(true);
  a.engine.dispose();
  expect(a.engine.input.sourceCount).toBe(0);
});
it("defers new integrators and suppresses removed/disabled Actors immediately", () => {
  const engine = new Engine(),
    a = engine.scene.add(new Actor()),
    b = engine.scene.add(Character({ x: 0, y: 0 }));
  const t = a.add(new Transform());
  let added = false;
  class Add extends Component {
    readonly type = defineComponent("AddMotion");
    update() {
      if (!added) {
        added = true;
        a.add(new Motion({ speed: 10, x: 1 }));
        b.enabled = false;
      }
    }
  }
  a.add(new Add());
  b.require(Motion.type).direction.x = 1;
  engine.step(1);
  expect(t.x).toBe(0);
  expect(b.x).toBe(0);
  engine.step(1);
  expect(t.x).toBe(10);
  engine.dispose();
});
it("corrects Solid positions after integration without changing intent; Static still permits scripted motion", () => {
  const a = setup();
  a.player.add(new CollisionBody());
  a.player.add(
    new Collider({ width: 10, height: 10, response: CollisionResponse.Solid }),
  );
  const wall = a.engine.scene.add(new Actor());
  wall.add(new Transform({ x: 15 }));
  wall.add(
    new Collider({ width: 10, height: 100, response: CollisionResponse.Solid }),
  );
  new CollisionWorld(a.engine.scene);
  let x = -1;
  a.player.require(Collider.type).events.on(ContactEnter, () => {
    x = a.player.x;
  });
  a.source.set(Actions.Move, { x: 1, y: 0 });
  a.engine.step(0.1);
  expect(a.player.x).toBeCloseTo(5);
  expect(x).toBeCloseTo(5);
  expect(a.motion.direction.x).toBe(1);
  a.player.remove(CollisionBody.type);
  a.player.add(new CollisionBody({ motion: BodyType.Static }));
  a.engine.step(0.1);
  expect(a.player.x).toBeCloseTo(15);
  a.engine.dispose();
});
it("matches fixed/variable subdivisions for constant intent and replays scaled movement", () => {
  const a = setup(),
    b = setup();
  for (const run of [a, b]) {
    run.source.set(Actions.Move, { x: 0.6, y: 0.8 });
    run.movement.scale = 2;
  }
  const rec = new ReplayRecorder(a.engine, {
    controllers: { player: a.controls },
  });
  const fixed = new FixedStepRunner(a.engine, { step: 0.01, maxSteps: 20 });
  for (let i = 0; i < 10; i++) fixed.advance(0.1);
  for (const dt of [0.17, 0.23, 0.1, 0.5]) b.engine.step(dt);
  expect(a.player.x).toBeCloseTo(120);
  expect(a.player.y).toBeCloseTo(b.player.y);
  expect(b.player.x).toBeCloseTo(120);
  const data = JSON.parse(JSON.stringify(rec.finish())),
    c = setup();
  c.movement.scale = 2;
  const player = new ReplayPlayer(c.engine, data, {
    controllers: { player: c.controls },
  });
  while (player.step()) {}
  expect(c.engine.snapshot()).toEqual(a.engine.snapshot());
  player.dispose();
  for (const run of [a, b, c]) run.engine.dispose();
});

it("replays an independent custom movement policy from logical Actions", () => {
  const create = () => {
    const engine = new Engine({ seed: 42 }),
      controls = new ActionController(Actions, {
        scene: engine.scene,
        input: engine.input,
      }),
      player = engine.scene.add(Character({ x: 0, y: 0 }));
    player.add(
      new CustomMove(() => ({
        x: controls.value(Actions.Move).x,
        y: 0,
        speed: controls.value(Actions.Sprint) ? 300 : 180,
      })),
    );
    return { engine, controls, player, source: controls.createSource() };
  };
  const a = create(),
    rec = new ReplayRecorder(a.engine, { controllers: { player: a.controls } });
  a.source.set(Actions.Move, { x: 1, y: 1 });
  a.engine.step(0.2);
  a.source.set(Actions.Sprint, true);
  a.engine.step(0.5);
  a.source.set(Actions.Move, { x: -1, y: 0 });
  a.engine.step(0.1);
  const b = create(),
    data = JSON.parse(JSON.stringify(rec.finish())),
    replay = new ReplayPlayer(b.engine, data, {
      controllers: { player: b.controls },
    });
  while (replay.step()) {}
  expect(b.engine.snapshot()).toEqual(a.engine.snapshot());
  replay.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
