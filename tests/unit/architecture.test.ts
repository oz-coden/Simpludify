import {
  Action,
  ActionController,
  Actor,
  ActorState,
  Aspect,
  Camera,
  Component,
  ComponentPhase,
  type ComponentType,
  containsScreenPoint,
  createViewTransform,
  defineActions,
  defineComponent,
  defineEvent,
  Engine,
  EventBus,
  KeyCode,
  Lifetime,
  Motion,
  Renderable,
  Scene,
  SceneState,
  screenPoint,
  screenToPhysical,
  screenToWorld,
  Transform,
  type UpdateContext,
  worldPoint,
  worldToScreen,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

class Probe extends Component {
  static readonly type: ComponentType<Probe> = defineComponent<Probe>("Probe");
  readonly type = Probe.type;
  constructor(
    private readonly action: (context: UpdateContext) => void = () => {},
  ) {
    super();
  }
  update(context: UpdateContext): void {
    this.action(context);
  }
}
const Ping = defineEvent<{ amount: number }>("Ping");
describe("ownership and components", () => {
  it("supports nonvisual actors and typed custom components", () => {
    const engine = new Engine();
    const actor = engine.scene.add(new Actor({ id: "logic" }));
    let count = 0;
    const probe = actor.add(new Probe(() => count++));
    engine.step(1);
    expect(actor.get(Probe.type)).toBe(probe);
    expect(count).toBe(1);
    expect(actor.get(Renderable.type)).toBeUndefined();
    expect(actor.state).toBe(ActorState.Attached);
    expect(actor.scene).toBe(engine.scene);
  });
  it("rejects actor sharing, duplicate ids and disposed reattachment", () => {
    const a = new Scene("a"),
      b = new Scene("b"),
      actor = a.add(new Actor({ id: "same" }));
    expect(() => b.add(actor)).toThrow();
    expect(() => a.add(new Actor({ id: "same" }))).toThrow();
    actor.dispose();
    expect(actor.scene).toBeUndefined();
    expect(actor.state).toBe(ActorState.Disposed);
    expect(a.find("same")).toBeUndefined();
    expect(() => b.add(actor)).toThrow();
  });
  it("generates stable per-scene ids and permits explicit reuse only after removal", () => {
    const a = new Scene("a"),
      b = new Scene("b");
    expect(a.add(new Actor()).id).toBe(b.add(new Actor()).id);
    const actor = a.add(new Actor({ id: "named" }));
    a.remove(actor);
    expect(a.add(new Actor({ id: "named" })).id).toBe("named");
  });
  it("diagnoses dependency, duplicate, instance ownership and dependent removal", () => {
    const actor = new Actor(),
      other = new Actor();
    expect(() => actor.add(new Motion())).toThrow();
    const transform = actor.add(new Transform());
    const motion = actor.add(new Motion());
    expect(() => actor.add(new Transform())).toThrow();
    expect(() => other.add(transform)).toThrow();
    expect(other.get(Transform.type)).toBeUndefined();
    expect(() => actor.remove(Transform.type)).toThrow();
    expect(actor.remove(Motion.type)).toBe(true);
    expect(motion.disposed).toBe(true);
    expect(actor.remove(Transform.type)).toBe(true);
    expect(actor.remove(Transform.type)).toBe(false);
    expect(() => actor.add(transform)).toThrow();
  });
  it("diagnoses cycles before reporting missing components", () => {
    const requires: ComponentType[] = [];
    const type: ComponentType = {
      id: Symbol("cyclic"),
      name: "cyclic",
      requires,
    };
    requires.push(type);
    class Cyclic extends Component {
      readonly type = type;
    }
    expect(() => new Actor().add(new Cyclic())).toThrow(
      expect.objectContaining({ code: "COMPONENT_CYCLE" }),
    );
  });
  it("disposes failed attachment subscriptions", () => {
    const bus = new EventBus();
    class Broken extends Component {
      static readonly type: ComponentType<Broken> =
        defineComponent<Broken>("Broken");
      readonly type = Broken.type;
      protected onAttach(): void {
        bus.on(Ping, () => {}, this);
        throw new Error("broken");
      }
    }
    const actor = new Actor();
    const broken = new Broken();
    expect(() => actor.add(broken)).toThrow("broken");
    expect(broken.disposed).toBe(true);
    expect(bus.listenerCount()).toBe(0);
    expect(actor.get(Broken.type)).toBeUndefined();
  });
  it("cleans all components and resources even if cleanup throws", () => {
    const scene = new Scene("cleanup"),
      actor = scene.add(new Actor());
    const calls: string[] = [];
    actor.add(new Transform()).onDispose(() => calls.push("transform"));
    actor.add(new Probe()).onDispose(() => {
      calls.push("probe");
      throw new Error("cleanup");
    });
    actor.onDispose(() => calls.push("actor"));
    scene.onDispose(() => calls.push("scene"));
    expect(() => scene.dispose()).toThrow(AggregateError);
    expect(calls).toEqual(["actor", "probe", "transform", "scene"]);
    expect(scene.actors).toEqual([]);
    expect(actor.disposed).toBe(true);
    expect(() => scene.dispose()).not.toThrow();
  });
});
describe("update consistency", () => {
  it("updates all input components before simulation and scene callbacks", () => {
    const engine = new Engine(),
      calls: string[] = [];
    class InputProbe extends Probe {
      readonly phase = ComponentPhase.Input;
    }
    const a = engine.scene.add(new Actor()),
      b = engine.scene.add(new Actor());
    a.add(new Probe(() => calls.push("simulation")));
    b.add(new InputProbe(() => calls.push("input")));
    engine.scene.onUpdate(() => calls.push("scene"));
    engine.step(0);
    expect(calls).toEqual(["input", "simulation", "scene"]);
  });
  it("freezes Actions for the entire frame and observes writes on the next frame", () => {
    const engine = new Engine();
    const actions = defineActions({ Fire: Action.button() });
    const controls = new ActionController(actions, {
      scene: engine.scene,
      input: engine.input,
      bindings: { Fire: { keys: [KeyCode.A] } },
    });
    const source = controls.createSource();
    const seen: boolean[] = [];
    engine.scene
      .add(new Actor())
      .add(new Probe(() => source.set(actions.Fire, true)));
    engine.scene
      .add(new Actor())
      .add(new Probe(() => seen.push(controls.value(actions.Fire))));
    engine.step(0);
    engine.step(0);
    expect(seen).toEqual([false, true]);
    engine.dispose();
  });
  it("adds actors during update without updating them twice or early", () => {
    const engine = new Engine();
    let added = false,
      ticks = 0;
    engine.scene.add(new Actor()).add(
      new Probe(() => {
        if (!added) {
          added = true;
          engine.scene.add(new Actor()).add(new Probe(() => ticks++));
        }
      }),
    );
    engine.step(0);
    expect(engine.scene.actors).toHaveLength(2);
    expect(ticks).toBe(0);
    engine.step(0);
    expect(ticks).toBe(1);
  });
  it("skips removed actors and newly added components until the next frame", () => {
    const engine = new Engine();
    const first = engine.scene.add(new Actor()),
      second = engine.scene.add(new Actor()),
      third = engine.scene.add(new Actor());
    let ticks = 0;
    first.add(
      new Probe(() => {
        second.dispose();
        if (!third.get(Probe.type)) third.add(new Probe(() => ticks++));
      }),
    );
    second.add(
      new Probe(() => {
        throw new Error("must not update");
      }),
    );
    engine.step(0);
    expect(ticks).toBe(0);
    engine.step(0);
    expect(ticks).toBe(1);
  });
  it("removes components and actors safely from their own updates", () => {
    const engine = new Engine();
    const actor = engine.scene.add(new Actor());
    let ticks = 0;
    actor.add(
      new Probe(() => {
        ticks++;
        actor.remove(Probe.type);
      }),
    );
    engine.step(0);
    engine.step(0);
    expect(ticks).toBe(1);
    actor.add(new Probe(() => actor.dispose()));
    engine.step(0);
    expect(engine.scene.actors).toHaveLength(0);
  });
  it("disables actors immediately and enables previously disabled actors next frame", () => {
    const engine = new Engine();
    const a = engine.scene.add(new Actor()),
      b = engine.scene.add(new Actor({ enabled: false }));
    let ticks = 0;
    a.add(
      new Probe(() => {
        b.enabled = true;
      }),
    );
    b.add(new Probe(() => ticks++));
    engine.step(0);
    expect(ticks).toBe(0);
    engine.step(0);
    expect(ticks).toBe(1);
    b.enabled = false;
    a.enabled = false;
    engine.step(0);
    expect(ticks).toBe(1);
  });
  it("does not permit nested stepping or synchronous transitions during update", () => {
    const engine = new Engine();
    engine.scene.onUpdate(() => {
      expect(() => engine.step(0)).toThrow();
      expect(() => engine.activate(new Scene("bad"))).toThrow();
    });
    engine.step(0);
  });
  it("keeps engine-managed execution reproducible with dynamic objects and timers", () => {
    const run = () => {
      const engine = new Engine({ seed: 9 });
      engine.scene.every(0.1, () => {
        const actor = engine.scene.add(new Actor());
        actor.add(new Transform({ x: engine.random.next() }));
      });
      for (let i = 0; i < 20; i++) engine.step(0.05);
      return engine.snapshot();
    };
    expect(run()).toEqual(run());
  });
});
describe("scene lifecycle and timers", () => {
  it("orders ready, activation, updates, deactivation and destruction", () => {
    const engine = new Engine(),
      scene = new Scene("next"),
      calls: string[] = [];
    expect(scene.state).toBe(SceneState.Preparing);
    scene.markReady();
    expect(scene.state).toBe(SceneState.Ready);
    scene.onActivate(() => {
      calls.push(`activate:${scene.state}`);
    });
    scene.onUpdate(() => calls.push("update"));
    scene.onDeactivate(() => calls.push(`deactivate:${scene.state}`));
    scene.onDispose(() => calls.push(`dispose:${scene.state}`));
    engine.activate(scene);
    engine.activate(scene);
    engine.step(0);
    engine.activate(new Scene("last"));
    expect(calls).toEqual([
      "activate:active",
      "update",
      "deactivate:inactive",
      "dispose:disposed",
    ]);
    expect(() => engine.activate(scene)).toThrow();
  });
  it("rejects a scene owned by another engine without replacing the active scene", () => {
    const a = new Engine(),
      b = new Engine();
    const old = b.scene;
    expect(() => b.activate(a.scene)).toThrow();
    expect(b.scene).toBe(old);
  });
  it("commits activation despite lifecycle callback errors and cleans every old resource", () => {
    const engine = new Engine();
    engine.step(0);
    const old = engine.scene,
      next = new Scene("next");
    let cleaned = 0,
      activated = false;
    old.onDeactivate(() => {
      throw new Error("deactivate");
    });
    old.onDispose(() => cleaned++);
    next.onActivate(() => {
      activated = true;
      throw new Error("activate");
    });
    expect(() => engine.activate(next)).toThrow(AggregateError);
    expect(engine.scene).toBe(next);
    expect(next.state).toBe(SceneState.Active);
    expect(old.disposed).toBe(true);
    expect(cleaned).toBe(1);
    expect(activated).toBe(true);
  });
  it("runs timers after components, before scene updates, only while active", () => {
    const engine = new Engine(),
      calls: string[] = [];
    engine.scene.add(new Actor()).add(new Probe(() => calls.push("component")));
    engine.scene.after(0.1, () => calls.push("timer"));
    engine.scene.onUpdate(() => calls.push("scene"));
    engine.step(0.1);
    expect(calls).toEqual(["component", "timer", "scene"]);
  });
  it("cancels timers with actor owners and scene disposal; missed intervals are not replayed", () => {
    const engine = new Engine();
    const actor = engine.scene.add(new Actor());
    let count = 0;
    engine.scene.after(0.1, () => count++, actor);
    actor.dispose();
    engine.scene.every(0.1, () => count++);
    engine.step(1);
    expect(count).toBe(1);
    engine.step(0.1);
    expect(count).toBe(2);
    engine.dispose();
    expect(() => engine.step(1)).toThrow();
  });
  it("defers timers created by callbacks and aggregates timer errors", () => {
    const engine = new Engine();
    const calls: number[] = [];
    engine.scene.after(0, () => {
      engine.scene.after(0, () => calls.push(2));
      calls.push(1);
      throw new Error("timer");
    });
    engine.scene.after(0, () => calls.push(3));
    expect(() => engine.step(0)).toThrow(AggregateError);
    expect(calls).toEqual([1, 3]);
    engine.step(0);
    expect(calls).toEqual([1, 3, 2]);
  });
});
describe("typed events", () => {
  it("uses token identity, registration order and synchronous delivery", () => {
    const bus = new EventBus(),
      calls: number[] = [];
    const other = defineEvent<{ amount: number }>("Ping");
    bus.on(Ping, (payload) => calls.push(payload.amount));
    bus.on(Ping, () => calls.push(2));
    bus.on(other, () => calls.push(3));
    bus.emit(Ping, { amount: 1 });
    expect(calls).toEqual([1, 2]);
  });
  it("unsubscribes manually and automatically for scene, actor and component owners", () => {
    const bus = new EventBus(),
      scene = new Scene("owner"),
      actor = scene.add(new Actor()),
      component = actor.add(new Probe());
    let calls = 0;
    bus.on(Ping, () => calls++, scene);
    bus.on(Ping, () => calls++, actor);
    const off = bus.on(Ping, () => calls++, component);
    off();
    expect(bus.listenerCount()).toBe(2);
    scene.dispose();
    expect(bus.listenerCount()).toBe(0);
    bus.emit(Ping, { amount: 1 });
    expect(calls).toBe(0);
  });
  it("disposes local buses and rejects resource acquisition after disposal", () => {
    const actor = new Actor(),
      bus = actor.events;
    bus.on(Ping, () => {});
    actor.dispose();
    expect(bus.listenerCount()).toBe(0);
    expect(() => bus.emit(Ping, { amount: 1 })).toThrow();
    expect(() => bus.on(Ping, () => {})).toThrow();
  });
  it("skips removed listeners and defers listeners added during delivery", () => {
    const bus = new EventBus(),
      calls: string[] = [];
    let off = () => {};
    bus.on(Ping, () => {
      calls.push("first");
      off();
      bus.on(Ping, () => calls.push("late"));
    });
    off = bus.on(Ping, () => calls.push("removed"));
    bus.emit(Ping, { amount: 0 });
    expect(calls).toEqual(["first"]);
    bus.emit(Ping, { amount: 0 });
    expect(calls).toEqual(["first", "first", "late"]);
  });
  it("continues after handler failures and rejects recursive same-token events", () => {
    const bus = new EventBus();
    let called = false;
    bus.on(Ping, () => bus.emit(Ping, { amount: 0 }));
    bus.on(Ping, () => {
      called = true;
    });
    expect(() => bus.emit(Ping, { amount: 1 })).toThrow(AggregateError);
    expect(called).toBe(true);
  });
  it("supports nested different-token delivery and releases owner registrations on bus disposal", () => {
    const bus = new EventBus(),
      owner = new Lifetime(),
      Other = defineEvent<number>("Other"),
      calls: number[] = [];
    bus.on(
      Ping,
      () => {
        calls.push(1);
        bus.emit(Other, 2);
        calls.push(3);
      },
      owner,
    );
    bus.on(Other, (amount) => calls.push(amount));
    bus.emit(Ping, { amount: 0 });
    expect(calls).toEqual([1, 2, 3]);
    bus.dispose();
    expect(() => owner.dispose()).not.toThrow();
  });
});
describe("camera and coordinate spaces", () => {
  it.each([Aspect.Fit, Aspect.Fill, Aspect.Adaptive])(
    "round trips with %s and an offset viewport",
    (aspect) => {
      const view = createViewTransform({
        viewport: { x: 31, y: 47, width: 390, height: 844 },
        camera: new Camera({ x: -80, y: 120, zoom: 1.7 }),
        aspect,
      });
      const original = worldPoint(-12.4, 840);
      const result = screenToWorld(view, worldToScreen(view, original));
      expect(result.x).toBeCloseTo(original.x, 10);
      expect(result.y).toBeCloseTo(original.y, 10);
    },
  );
  it("moves the view with the camera and zooms around the nominal world center", () => {
    const viewport = { x: 0, y: 0, width: 800, height: 450 };
    const camera = new Camera();
    camera.x = 100;
    camera.y = 50;
    camera.zoom = 2;
    const view = createViewTransform({ viewport, camera });
    expect(worldToScreen(view, worldPoint(500, 275))).toEqual(
      screenPoint(400, 225),
    );
    expect(() => {
      camera.zoom = 0;
    }).toThrow();
    expect(() => {
      camera.x = NaN;
    }).toThrow();
  });
  it("handles viewport resize independently from DPI and detects bars", () => {
    const view = createViewTransform({
      viewport: { x: 20, y: 10, width: 400, height: 800 },
    });
    expect(containsScreenPoint(view, screenPoint(21, 11))).toBe(false);
    expect(containsScreenPoint(view, screenPoint(220, 410))).toBe(true);
    expect(screenToPhysical(screenPoint(20, 30), 2)).toEqual({
      space: "physical",
      x: 40,
      y: 60,
    });
    expect(
      createViewTransform({
        viewport: { x: 0, y: 0, width: 1600, height: 900 },
      }).scale,
    ).toBe(2);
  });
});
// Compile-time contracts are checked by npm run check; they never execute.
function typeContracts(bus: EventBus, actor: Actor): void {
  const transform: Transform | undefined = actor.get(Transform.type);
  void transform;
  // @ts-expect-error Event payload must match its token.
  bus.emit(Ping, { amount: "wrong" });
  const view = createViewTransform({
    viewport: { x: 0, y: 0, width: 1, height: 1 },
  });
  // @ts-expect-error Screen points are not world points.
  worldToScreen(view, screenPoint(0, 0));
}
void typeContracts;

it("rejects structural component mutation during onAttach without corrupting ownership", () => {
  class Nested extends Component {
    static readonly type: ComponentType<Nested> =
      defineComponent<Nested>("Nested");
    readonly type = Nested.type;
    protected onAttach(): void {
      this.actor.add(new Transform());
    }
  }
  const actor = new Actor(),
    nested = new Nested();
  expect(() => actor.add(nested)).toThrow();
  expect(actor.get(Nested.type)).toBeUndefined();
  expect(actor.get(Transform.type)).toBeUndefined();
  expect(nested.disposed).toBe(true);
});
it("rejects attachment if the owner destroys itself during onAttach", () => {
  class SelfDestruct extends Component {
    static readonly type: ComponentType<SelfDestruct> =
      defineComponent<SelfDestruct>("SelfDestruct");
    readonly type = SelfDestruct.type;
    protected onAttach(): void {
      this.actor.dispose();
    }
  }
  const actor = new Actor(),
    component = new SelfDestruct();
  expect(() => actor.add(component)).toThrow();
  expect(actor.disposed).toBe(true);
  expect(component.disposed).toBe(true);
});
it("rolls back subscriptions and timers when an external owner rejects registration", () => {
  const owner = {
    disposed: false,
    onDispose: () => {
      throw new Error("registration");
    },
  };
  const bus = new EventBus(),
    scene = new Scene("scope");
  expect(() => bus.on(Ping, () => {}, owner)).toThrow();
  expect(bus.listenerCount()).toBe(0);
  let called = false;
  expect(() =>
    scene.after(
      0,
      () => {
        called = true;
      },
      owner,
    ),
  ).toThrow();
  const engine = new Engine();
  engine.activate(scene);
  engine.step(0);
  expect(called).toBe(false);
});

it("diagnoses async event handlers without unhandled rejections and still delivers other handlers", () => {
  const bus = new EventBus();
  let called = false;
  bus.on(Ping, async () => {
    throw new Error("async failure");
  });
  bus.on(Ping, () => {
    called = true;
  });
  expect(() => bus.emit(Ping, { amount: 1 })).toThrow(AggregateError);
  expect(called).toBe(true);
});
it("requires activation hooks to be registered before activation", () => {
  const engine = new Engine();
  engine.step(0);
  expect(() => engine.scene.onActivate(() => {})).toThrow();
});
