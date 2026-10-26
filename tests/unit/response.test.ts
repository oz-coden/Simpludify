import {
  Actor,
  BodyType,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionShape,
  CollisionWorld,
  ContactEnter,
  ContactExit,
  ContactStay,
  Engine,
  Motion,
  Scene,
  Transform,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

function setup(options: ConstructorParameters<typeof CollisionWorld>[1] = {}) {
  const engine = new Engine(),
    world = new CollisionWorld(engine.scene, options);
  return { engine, world, scene: engine.scene };
}
function body(
  scene: Scene,
  x = 0,
  y = 0,
  options: ConstructorParameters<typeof Collider>[0] = {},
  mass?: number,
) {
  const actor = scene.add(new Actor()),
    t = actor.add(new Transform({ x, y }));
  const collider = actor.add(
    new Collider(
      options.shape === CollisionShape.Circle
        ? { ...options, response: options.response ?? CollisionResponse.Solid }
        : {
            width: 20,
            height: 20,
            ...options,
            response: options.response ?? CollisionResponse.Solid,
          },
    ),
  );
  const b =
    mass === undefined ? undefined : actor.add(new CollisionBody({ mass }));
  return { actor, t, collider, b };
}
const circle = { shape: CollisionShape.Circle, radius: 10 } as const;
describe("response policy and body ownership", () => {
  it.each([
    [CollisionResponse.Trigger, CollisionResponse.Trigger],
    [CollisionResponse.Trigger, CollisionResponse.Solid],
    [CollisionResponse.Solid, CollisionResponse.Trigger],
  ] as const)("detects %s / %s without correction", (aResponse, bResponse) => {
    const { engine, world, scene } = setup();
    const a = body(scene, 0, 0, { response: aResponse }, 1),
      b = body(scene, 15, 0, { response: bResponse });
    let n = 0;
    a.collider.events.on(ContactEnter, (c) => {
      n++;
      expect(c.response).toBe(CollisionResponse.Trigger);
      expect(c.resolved).toBe(false);
    });
    engine.step(0);
    expect(n).toBe(1);
    expect(a.t.x).toBe(0);
    expect(b.t.x).toBe(15);
    expect(world.responseDiagnostics.corrections).toBe(0);
    engine.dispose();
  });
  it("preserves trigger defaults and keeps body participation separate", () => {
    const { engine, scene } = setup();
    const a = body(scene, 0, 0, {}, 1);
    a.actor.remove(Collider.type);
    a.actor.add(new Collider());
    body(scene, 0);
    engine.step(0);
    expect(a.t.x).toBe(0);
    engine.dispose();
  });
  it("keeps unbodied and explicit static objects fixed", () => {
    const { engine, world, scene } = setup();
    const a = body(scene),
      b = body(scene, 5);
    b.actor.add(new CollisionBody({ motion: BodyType.Static }));
    engine.step(0);
    expect(a.t.x).toBe(0);
    expect(b.t.x).toBe(5);
    expect(world.diagnostics.contacts).toBe(1);
    engine.dispose();
  });
  it("distributes correction by inverse mass", () => {
    const { engine, scene } = setup();
    const a = body(scene, 0, 0, {}, 1),
      b = body(scene, 10, 0, {}, 3);
    engine.step(0);
    expect(a.t.x).toBeCloseTo(-7.5);
    expect(b.t.x).toBeCloseTo(12.5);
    engine.dispose();
  });
  it("treats a disabled body as fixed without disabling contact", () => {
    const { engine, scene } = setup();
    const a = body(scene, 0, 0, {}, 1),
      b = body(scene, 10, 0, {}, 1);
    if (!b.b) throw Error();
    b.b.enabled = false;
    engine.step(0);
    expect(a.t.x).toBeCloseTo(-10);
    expect(b.t.x).toBe(10);
    engine.dispose();
  });
  it("validates configuration and structural dependencies", () => {
    expect(() => new CollisionBody({ mass: 0 })).toThrow();
    expect(() => new CollisionBody({ mass: Number.MIN_VALUE })).toThrow();
    expect(() => new Actor().add(new CollisionBody())).toThrow(
      expect.objectContaining({ code: "COMPONENT_MISSING" }),
    );
    const engine = new Engine();
    expect(() => new CollisionWorld(engine.scene, { iterations: 0 })).toThrow();
    expect(() => new CollisionWorld(engine.scene, { tolerance: -1 })).toThrow();
    expect(
      () => new Collider({ response: "bad" as typeof CollisionResponse.Solid }),
    ).toThrow();
    engine.dispose();
  });
});
describe("minimum translation geometry", () => {
  it.each([
    [{}, {}],
    [circle, circle],
    [{}, circle],
    [circle, {}],
  ])("separates geometry %j / %j", (aShape, bShape) => {
    const { engine, world, scene } = setup();
    const a = body(scene, 0, 0, aShape, 1),
      b = body(scene, 15, 0, bShape);
    engine.step(0);
    expect(a.t.x).toBeCloseTo(-5);
    expect(b.t.x).toBe(15);
    expect(world.contactsFor(a.collider)[0]).toMatchObject({
      normalX: 1,
      depth: 5,
      response: "solid",
      resolved: true,
    });
    expect(world.contactsFor(a.collider)[0]?.normalY ?? 0).toBeCloseTo(0);
    expect(world.responseDiagnostics.unresolved).toBe(0);
    engine.dispose();
  });
  it("pushes a contained circle through its nearest box face", () => {
    const { engine, scene } = setup();
    body(scene, 0, 0, { width: 100, height: 40 });
    const b = body(scene, 0, 5, circle, 1);
    engine.step(0);
    expect(b.t.y).toBeCloseTo(30);
    expect(b.t.x).toBe(0);
    engine.dispose();
  });
  it("handles coincident circles deterministically", () => {
    const { engine, scene } = setup();
    const a = body(scene, 0, 0, circle, 1),
      b = body(scene, 0, 0, circle, 1);
    engine.step(0);
    expect(a.t.x).toBe(-10);
    expect(b.t.x).toBe(10);
    engine.dispose();
  });
  it("uses a rotated wall normal and preserves tangent displacement", () => {
    const { engine, world, scene } = setup();
    const wall = body(scene, 0, 0, { width: 100, height: 10 });
    wall.t.rotation = Math.PI / 4;
    const a = body(
      scene,
      -4,
      4,
      { shape: CollisionShape.Circle, radius: 5 },
      1,
    );
    engine.step(0);
    expect(a.t.x).toBeCloseTo(-Math.SQRT1_2 * 10);
    expect(a.t.y).toBeCloseTo(Math.SQRT1_2 * 10);
    expect(world.responseDiagnostics.unresolved).toBe(0);
    engine.dispose();
  });
  it("slides along an axis wall and remains stable across repeated corner pressure", () => {
    const { engine, world, scene } = setup();
    body(scene, 100, 0, { width: 10, height: 1000 });
    body(scene, 0, 100, { width: 1000, height: 10 });
    const a = body(scene, 80, 0, circle, 1);
    a.actor.add(new Motion({ speed: 100, x: 1, y: 1 }));
    for (let i = 0; i < 30; i++) engine.step(1 / 60);
    expect(a.t.x).toBeCloseTo(85);
    expect(a.t.y).toBeCloseTo(50);
    for (let i = 0; i < 1000; i++) engine.step(1 / 60);
    expect(a.t.x).toBeCloseTo(85);
    expect(a.t.y).toBeCloseTo(85);
    expect(world.responseDiagnostics.unresolved).toBe(0);
    engine.dispose();
  });
  it("discovers contacts introduced by earlier corrections", () => {
    const { engine, world, scene } = setup({ iterations: 32 });
    body(scene, 0, 0);
    const a = body(scene, 15, 0, {}, 1),
      b = body(scene, 35, 0, {}, 1);
    engine.step(0);
    expect(a.t.x).toBeCloseTo(20, 5);
    expect(b.t.x).toBeCloseTo(40, 5);
    expect(world.diagnostics.contacts).toBe(2);
    engine.dispose();
  });
  it("validates all geometry before modifying positions", () => {
    const { engine, scene } = setup();
    const a = body(scene, 0, 0, {}, 1);
    body(scene, 10);
    const bad = body(scene, 100, 0, circle);
    bad.t.scaleX = 2;
    expect(() => engine.step(0)).toThrow();
    expect(a.t.x).toBe(0);
    bad.t.scaleX = 1;
    engine.step(0);
    expect(a.t.x).toBeCloseTo(-10);
    engine.dispose();
  });
});
describe("contact delivery after response", () => {
  it("notifies both participants after correction, once per Engine step", () => {
    const { engine, scene } = setup();
    const a = body(scene, 0, 0, {}, 1);
    const b = body(scene, 10);
    const calls: string[] = [];
    a.collider.events.on(ContactEnter, (c) => {
      expect(a.t.x).toBeCloseTo(-10);
      expect(c.normalX).toBe(1);
      calls.push("a");
    });
    b.collider.events.on(ContactEnter, (c) => {
      expect(c.normalX).toBe(-1);
      calls.push("b");
    });
    a.collider.events.on(ContactStay, () => calls.push("stay"));
    a.collider.events.on(ContactExit, () => calls.push("exit"));
    engine.step(0);
    engine.step(0);
    a.t.x = -100;
    engine.step(0);
    expect(calls).toEqual(["a", "b", "stay", "exit"]);
    engine.dispose();
  });
  it("detects triggers at corrected positions", () => {
    const { engine, world, scene } = setup();
    const a = body(scene, 0, 0, {}, 1);
    body(scene, 15);
    body(scene, -5, 0, {
      response: CollisionResponse.Trigger,
      width: 2,
      height: 2,
    });
    engine.step(0);
    expect(a.t.x).toBe(-5);
    expect(
      world
        .contactsFor(a.collider)
        .filter((c) => c.response === CollisionResponse.Trigger),
    ).toHaveLength(1);
    engine.dispose();
  });
  it("returns owned snapshots without requiring event subscriptions", () => {
    const { engine, world, scene } = setup();
    const a = body(scene, 0, 0, {}, 1);
    body(scene, 10);
    engine.step(0);
    const contact = world.contactsFor(a.collider)[0];
    expect(contact?.depth).toBe(10);
    engine.step(0);
    expect(world.contactsFor(a.collider)[0]?.depth).toBe(0);
    expect(contact?.depth).toBe(10);
    engine.dispose();
  });
  it("suppresses removed recipients and delivers survivor exits next step", () => {
    const { engine, world, scene } = setup();
    const a = body(scene, 0, 0, {}, 1),
      b = body(scene, 10);
    const calls: string[] = [];
    a.collider.events.on(ContactEnter, () => {
      calls.push("a");
      b.actor.dispose();
    });
    b.collider.events.on(ContactEnter, () => calls.push("b"));
    a.collider.events.on(ContactExit, () => calls.push("exit"));
    engine.step(0);
    expect(world.contactsFor(a.collider)).toHaveLength(0);
    engine.step(0);
    expect(calls).toEqual(["a", "exit"]);
    engine.dispose();
  });
  it("retains correction after handler errors and can step again", () => {
    const { engine, scene } = setup();
    const a = body(scene, 0, 0, {}, 1),
      b = body(scene, 10);
    a.collider.events.on(ContactEnter, () => {
      throw Error("handler");
    });
    let called = false;
    b.collider.events.on(ContactEnter, () => {
      called = true;
    });
    expect(() => engine.step(0)).toThrow(AggregateError);
    expect(a.t.x).toBe(-10);
    expect(called).toBe(true);
    expect(() => engine.step(0)).not.toThrow();
    engine.dispose();
  });
  it("stops delivery and clears all solver state on scene disposal", () => {
    const { engine, world, scene } = setup();
    const a = body(scene, 0, 0, {}, 1),
      b = body(scene, 10);
    a.collider.events.on(ContactEnter, () => scene.dispose());
    b.collider.events.on(ContactEnter, () => {
      throw Error("must not deliver");
    });
    engine.step(0);
    expect(world.disposed).toBe(true);
    expect(world.contactsFor(a.collider)).toHaveLength(0);
    engine.activate(new Scene("next"));
    engine.step(0);
    engine.dispose();
  });
  it("documents discrete tunneling and verifies bounded movement steps", () => {
    const run = (steps: number) => {
      const { engine, scene } = setup();
      body(scene, 100, 0, { width: 10, height: 100 });
      const a = body(
        scene,
        0,
        0,
        { shape: CollisionShape.Circle, radius: 5 },
        1,
      );
      a.actor.add(new Motion({ speed: 1000, x: 1 }));
      for (let i = 0; i < steps; i++) engine.step(0.2 / steps);
      const x = a.t.x;
      engine.dispose();
      return x;
    };
    expect(run(1)).toBe(200);
    expect(run(60)).toBeCloseTo(90);
  });
  it("replays response deterministically", () => {
    const run = () => {
      const { engine, scene } = setup();
      body(scene, 100, 0);
      const a = body(scene, 0, 0, {}, 1);
      a.actor.add(new Motion({ x: 1, speed: 100 }));
      for (let i = 0; i < 1000; i++) engine.step(1 / 60);
      const snapshot = engine.snapshot();
      engine.dispose();
      return snapshot;
    };
    expect(run()).toEqual(run());
  });
});

it("applies layer/mask filtering before Solid correction", () => {
  const { engine, world, scene } = setup();
  const a = body(scene, 0, 0, { mask: 0 }, 1);
  body(scene, 10);
  engine.step(0);
  expect(a.t.x).toBe(0);
  expect(world.diagnostics.contacts).toBe(0);
  engine.dispose();
});
it("suppresses collider recipients removed during a Solid event", () => {
  const { engine, scene } = setup();
  const a = body(scene, 0, 0, {}, 1),
    b = body(scene, 10);
  let exits = 0,
    other = 0;
  a.collider.events.on(ContactEnter, () => b.actor.remove(Collider.type));
  a.collider.events.on(ContactExit, () => exits++);
  b.collider.events.on(ContactEnter, () => other++);
  engine.step(0);
  engine.step(0);
  expect(exits).toBe(1);
  expect(other).toBe(0);
  expect(b.actor.disposed).toBe(false);
  engine.dispose();
});
