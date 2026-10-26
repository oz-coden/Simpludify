import {
  Actor,
  Collider,
  CollisionShape,
  CollisionWorld,
  Component,
  type ComponentType,
  ContactEnter,
  ContactExit,
  ContactStay,
  defineComponent,
  defineEvent,
  Engine,
  EventBus,
  Lifetime,
  Motion,
  Scene,
  Transform,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

function setup() {
  const engine = new Engine();
  const world = new CollisionWorld(engine.scene);
  return { engine, world, scene: engine.scene };
}
function add(
  scene: Scene,
  options: ConstructorParameters<typeof Collider>[0] = {},
  transform: ConstructorParameters<typeof Transform>[0] = {},
  id?: string,
) {
  const actor = scene.add(new Actor(id ? { id } : {}));
  const position = actor.add(new Transform(transform));
  const collider = actor.add(new Collider(options));
  return { actor, position, collider };
}
const circle = (radius = 10) => ({ shape: CollisionShape.Circle, radius });
describe("contact geometry", () => {
  it.each([
    ["boxes overlap", {}, {}, { x: 20 }, true],
    ["boxes separate", {}, {}, { x: 33 }, false],
    ["boxes touch", {}, {}, { x: 32 }, true],
    ["circles overlap", circle(), circle(), { x: 19 }, true],
    ["circles touch", circle(), circle(), { x: 20 }, true],
    ["circles separate", circle(), circle(), { x: 20.001 }, false],
    ["circle inside box", {}, circle(2), {}, true],
    ["box/circle edge", {}, circle(4), { x: 20 }, true],
    ["box/circle separated corner", {}, circle(4), { x: 19, y: 19 }, false],
    ["box/circle overlap corner", {}, circle(5), { x: 19, y: 19 }, true],
    ["circle/box edge", circle(4), {}, { x: 20 }, true],
  ] as const)("%s", (_name, a, b, t, expected) => {
    const { engine, world, scene } = setup();
    add(scene, a);
    add(scene, b, t);
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(Number(expected));
    engine.dispose();
  });
  it("rotates and nonuniformly scales boxes instead of using only their broad-phase AABBs", () => {
    const { engine, world, scene } = setup();
    add(scene, { width: 80, height: 8 }, { rotation: Math.PI / 4 });
    const other = add(scene, circle(3), { x: 24, y: -24 });
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(0);
    other.position.y = 24;
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(1);
    engine.dispose();
  });
  it("supports rotated offsets, negative scales and zero-scale exclusion", () => {
    const { engine, world, scene } = setup();
    const a = add(
      scene,
      { ...circle(4), offsetX: 10 },
      { rotation: Math.PI / 2, scaleX: -2, scaleY: 2 },
    );
    add(scene, circle(4), { x: 0, y: -20 });
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(1);
    a.position.scaleX = 0;
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(0);
    engine.dispose();
  });
  it("rejects nonuniform circle scaling and invalid dimensions", () => {
    expect(() => new Collider(circle(0))).toThrow();
    expect(() => new Collider({ width: -1 })).toThrow();
    const { engine, scene } = setup();
    add(scene, circle(), { scaleX: 2, scaleY: 1 });
    expect(() => engine.step(0)).toThrow(
      expect.objectContaining({ code: "COLLIDER_SCALE_UNSUPPORTED" }),
    );
    engine.dispose();
  });
  it("filters pairs in both directions using layer/mask", () => {
    const { engine, world, scene } = setup();
    add(scene, { layer: 1, mask: 2 });
    add(scene, { layer: 2, mask: 4 });
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(0);
    expect(() => new Collider({ layer: 0 })).toThrow();
    expect(() => new Collider({ mask: -1 })).toThrow();
    engine.dispose();
  });
});
describe("contact delivery and ownership", () => {
  it("emits enter, stay and exit in stable Actor order", () => {
    const { engine, world, scene } = setup(),
      calls: string[] = [];
    const a = add(scene, {}, {}, "a"),
      b = add(scene, {}, {}, "b");
    for (const entry of [a, b])
      for (const [event, name] of [
        [ContactEnter, "enter"],
        [ContactStay, "stay"],
        [ContactExit, "exit"],
      ] as const)
        entry.collider.events.on(event, (contact) =>
          calls.push(`${contact.selfActor.id}:${name}`),
        );
    engine.step(0);
    engine.step(0);
    b.position.x = 100;
    engine.step(0);
    expect(calls).toEqual([
      "a:enter",
      "b:enter",
      "a:stay",
      "b:stay",
      "a:exit",
      "b:exit",
    ]);
    expect(world.diagnostics.contacts).toBe(0);
    engine.dispose();
  });
  it("finishes movement before contacts and contacts before timers/Scene callbacks", () => {
    const { engine, scene } = setup(),
      calls: string[] = [];
    const a = add(scene, {}, { x: 100 }),
      b = add(scene);
    a.actor.add(new Motion({ speed: 100, x: -1 }));
    a.collider.events.on(ContactEnter, () => calls.push("contact"));
    scene.after(0, () => calls.push("timer"));
    scene.onUpdate(() => calls.push("scene"));
    engine.step(1);
    expect(a.position.x).toBe(0);
    expect(calls).toEqual(["contact", "timer", "scene"]);
    b.actor.dispose();
    engine.dispose();
  });
  it("ends surviving subscriptions after removal and suppresses events to a destroyed participant", () => {
    const { engine, world, scene } = setup(),
      calls: string[] = [];
    const a = add(scene),
      b = add(scene);
    a.collider.events.on(ContactEnter, () => {
      calls.push("enter-a");
      b.actor.dispose();
    });
    a.collider.events.on(ContactExit, (contact) => {
      expect(contact.otherActor.disposed).toBe(true);
      calls.push("exit-a");
    });
    b.collider.events.on(ContactEnter, () => calls.push("enter-b"));
    engine.step(0);
    engine.step(0);
    expect(calls).toEqual(["enter-a", "exit-a"]);
    expect(world.diagnostics.contacts).toBe(0);
    engine.dispose();
  });
  it("delivers exits to a disabled surviving component, then enters again when enabled", () => {
    const { engine, scene } = setup(),
      calls: string[] = [];
    const a = add(scene);
    add(scene);
    a.collider.events.on(ContactEnter, () => calls.push("enter"));
    a.collider.events.on(ContactExit, () => calls.push("exit"));
    engine.step(0);
    a.collider.enabled = false;
    engine.step(0);
    a.collider.enabled = true;
    engine.step(0);
    a.actor.enabled = false;
    engine.step(0);
    expect(calls).toEqual(["enter", "exit", "enter", "exit"]);
    engine.dispose();
  });
  it("defers colliders added by contact callbacks to the next pass", () => {
    const { engine, scene } = setup();
    const a = add(scene);
    add(scene);
    let count = 0,
      spawned = false;
    a.collider.events.on(ContactEnter, () => {
      count++;
      if (!spawned) {
        spawned = true;
        add(scene);
      }
    });
    engine.step(0);
    expect(count).toBe(1);
    engine.step(0);
    expect(count).toBe(2);
    engine.dispose();
  });
  it("continues eligible contacts after handler failures and diagnoses reentry", () => {
    const { engine, world, scene } = setup();
    const a = add(scene),
      b = add(scene);
    let delivered = false;
    a.collider.events.on(ContactEnter, () => world.step());
    b.collider.events.on(ContactEnter, () => {
      delivered = true;
    });
    expect(() => engine.step(0)).toThrow(AggregateError);
    expect(delivered).toBe(true);
    engine.dispose();
    expect(world.disposed).toBe(true);
    expect(world.diagnostics.contacts).toBe(0);
  });
  it("clears silently on Scene replacement and stops delivery when disposed in a handler", () => {
    const { engine, world, scene } = setup();
    const a = add(scene),
      b = add(scene);
    let count = 0;
    a.collider.events.on(ContactEnter, () => scene.dispose());
    b.collider.events.on(ContactEnter, () => count++);
    engine.step(0);
    expect(count).toBe(0);
    expect(world.disposed).toBe(true);
    engine.activate(new Scene("next"));
    engine.step(0);
    engine.dispose();
  });
  it("avoids all-pairs narrow testing for a separated population", () => {
    const { engine, world, scene } = setup();
    for (let i = 0; i < 1000; i++) add(scene, circle(2), { x: i * 20, y: 0 });
    engine.step(0);
    expect(world.diagnostics.narrowTests).toBe(0);
    expect(world.diagnostics.contacts).toBe(0);
    engine.dispose();
  });
});
describe("safety and input sources", () => {
  it("composes input sources and releases only their own keys", () => {
    const engine = new Engine(),
      owner = new Lifetime(),
      a = engine.input.createSource(owner),
      b = engine.input.createSource();
    a.set("KeyW", true);
    b.set("KeyW", true);
    engine.input.set("KeyD", true);
    a.clear();
    expect(engine.input.snapshot()).toEqual(["KeyD", "KeyW"]);
    owner.dispose();
    expect(a.disposed).toBe(true);
    b.dispose();
    expect(engine.input.snapshot()).toEqual(["KeyD"]);
    engine.dispose();
    expect(engine.input.sourceCount).toBe(0);
    expect(() => a.set("KeyA", true)).toThrow();
    expect(() => a.set("KeyA", false)).not.toThrow();
  });
  it("pauses movement, time, timers and contacts and clears held input on resume", () => {
    const { engine, scene } = setup();
    const actor = add(scene);
    actor.actor.add(new Motion({ speed: 10, x: 1 }));
    let fired = false;
    scene.after(1, () => {
      fired = true;
    });
    engine.step(0.25);
    const before = engine.snapshot();
    engine.pause();
    engine.input.set("KeyW", true);
    engine.step(10);
    expect(engine.snapshot().elapsed).toBe(before.elapsed);
    expect(actor.position.x).toBe(2.5);
    expect(fired).toBe(false);
    engine.resume();
    expect(engine.input.snapshot()).toEqual([]);
    engine.step(0.75);
    expect(fired).toBe(true);
    engine.dispose();
  });
  it("releases every external event/timer registration even if unsubscribe throws", () => {
    const event = defineEvent<number>("external"),
      bus = new EventBus();
    let released = 0;
    const owner = {
      disposed: false,
      onDispose: () => () => {
        released++;
        throw new Error("unsubscribe");
      },
    };
    bus.on(event, () => {}, owner);
    bus.on(event, () => {}, owner);
    expect(() => bus.dispose()).toThrow(AggregateError);
    expect(released).toBe(2);
    expect(bus.listenerCount()).toBe(0);
    const engine = new Engine();
    engine.scene.after(1, () => {}, owner);
    engine.scene.after(1, () => {}, owner);
    expect(() => engine.dispose()).toThrow(AggregateError);
    expect(released).toBe(4);
  });
  it("releases a failed custom component without leaking a scoped subscription", () => {
    const event = defineEvent<number>("sample"),
      bus = new EventBus();
    class Failing extends Component {
      static readonly type: ComponentType<Failing> =
        defineComponent<Failing>("Failing");
      readonly type = Failing.type;
      protected onAttach(): void {
        bus.on(event, () => {}, this);
        throw new Error("attach");
      }
    }
    const actor = new Actor();
    expect(() => actor.add(new Failing())).toThrow("attach");
    expect(bus.listenerCount()).toBe(0);
    actor.dispose();
  });
});
it("allows only one automatically registered collision world per scene", () => {
  const scene = new Scene("single");
  const world = new CollisionWorld(scene);
  expect(() => new CollisionWorld(scene)).toThrow();
  world.dispose();
  const next = new CollisionWorld(scene);
  scene.dispose();
  expect(next.disposed).toBe(true);
});
it("uses oriented box axes to reject overlapping AABBs and include true rotated overlap", () => {
  const { engine, scene, world } = setup();
  add(scene, { width: 80, height: 8 }, { rotation: Math.PI / 4 });
  const b = add(
    scene,
    { width: 80, height: 8 },
    {
      x: -Math.SQRT1_2 * 20,
      y: Math.SQRT1_2 * 20,
      rotation: Math.PI / 4,
      scaleX: 1.5,
      scaleY: 0.5,
    },
  );
  engine.step(0);
  expect(world.diagnostics.contacts).toBe(0);
  b.position.x = -Math.SQRT1_2 * 4;
  b.position.y = Math.SQRT1_2 * 4;
  engine.step(0);
  expect(world.diagnostics.contacts).toBe(1);
  engine.dispose();
});

describe("contact failure recovery", () => {
  it("recovers after invalid live geometry without losing established contacts", () => {
    const { engine, world, scene } = setup();
    const a = add(scene, circle()),
      b = add(scene, circle());
    const calls: string[] = [];
    a.collider.events.on(ContactEnter, () => calls.push("enter"));
    a.collider.events.on(ContactStay, () => calls.push("stay"));
    engine.step(0);
    b.position.scaleX = 2;
    expect(() => engine.step(0)).toThrow(
      expect.objectContaining({ code: "COLLIDER_SCALE_UNSUPPORTED" }),
    );
    b.position.scaleY = 2;
    engine.step(0);
    expect(calls).toEqual(["enter", "stay"]);
    expect(world.diagnostics.contacts).toBe(1);
    engine.dispose();
  });
  it("releases a disposed world's hook and permits a replacement", () => {
    const { engine, world, scene } = setup();
    add(scene);
    add(scene);
    expect(() => new CollisionWorld(scene)).toThrow(
      expect.objectContaining({ code: "COLLISION_WORLD_DUPLICATE" }),
    );
    engine.step(0);
    world.dispose();
    world.dispose();
    const next = new CollisionWorld(scene);
    engine.step(0);
    expect(next.diagnostics.contacts).toBe(1);
    expect(world.diagnostics.colliders).toBe(0);
    engine.dispose();
    expect(next.disposed).toBe(true);
  });
  it("tests rotated boxes beyond their overlapping broad-phase rectangles", () => {
    const { engine, world, scene } = setup();
    add(scene, { width: 80, height: 8 }, { rotation: Math.PI / 4 });
    const b = add(
      scene,
      { width: 80, height: 8 },
      { rotation: Math.PI / 4, x: 10, y: -10 },
    );
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(0);
    expect(world.diagnostics.narrowTests).toBe(1);
    b.position.y = 10;
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(1);
    engine.dispose();
  });
});
