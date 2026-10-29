import {
  Actor,
  Collider,
  CollisionBody,
  CollisionResponse,
  CollisionWorld,
  Component,
  ComponentPhase,
  ContactEnter,
  ContactExit,
  defineComponent,
  Engine,
  Renderable,
  Transform,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

function setup() {
  const engine = new Engine();
  const world = new CollisionWorld(engine.scene);
  function add(x = 0, y = 0) {
    const actor = engine.scene.add(new Actor());
    const transform = actor.add(new Transform({ x, y }));
    const collider = actor.add(new Collider());
    return { actor, transform, collider };
  }
  return { engine, world, add };
}

describe("reviewed Actor collision boundary contracts", () => {
  it("does not install a world implicitly", () => {
    const engine = new Engine();
    const a = engine.scene.add(new Actor());
    a.add(new Transform());
    const collider = a.add(new Collider());
    const b = engine.scene.add(new Actor());
    b.add(new Transform());
    b.add(new Collider());
    let enters = 0;
    collider.events.on(ContactEnter, () => enters++);
    engine.step(0);
    expect(enters).toBe(0);
    new CollisionWorld(engine.scene);
    engine.step(0);
    expect(enters).toBe(1);
    engine.dispose();
  });
  it("ignores Transform.enabled and rendering visibility for collision eligibility", () => {
    const { engine, world, add } = setup();
    const a = add();
    add();
    a.transform.enabled = false;
    a.actor.add(new Renderable({ visible: false }));
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(1);
    engine.dispose();
  });
  it("uses discovery order even when Actor creation and geometry order differ", () => {
    const { engine, add } = setup();
    const first = add(0);
    first.actor.remove(Collider.type);
    const second = add(10);
    const calls: string[] = [];
    second.collider.events.on(ContactEnter, () => calls.push("second"));
    engine.step(0); // second is discovered before first acquires a Collider.
    first.actor
      .add(new Collider())
      .events.on(ContactEnter, () => calls.push("first"));
    engine.step(0);
    expect(calls).toEqual(["second", "first"]);
    engine.dispose();
  });
  it("retains the captured pair geometry when an earlier recipient teleports it", () => {
    const { engine, world, add } = setup();
    const a = add(),
      b = add(20);
    const calls: string[] = [];
    a.collider.events.on(ContactEnter, () => {
      b.transform.x = 1000;
    });
    b.collider.events.on(ContactEnter, (contact) => {
      calls.push("enter");
      expect(b.transform.x).toBe(1000);
      expect(contact.depth).toBe(12);
    });
    b.collider.events.on(ContactExit, () => calls.push("exit"));
    engine.step(0);
    expect(world.contactsFor(a.collider)).toHaveLength(1);
    engine.step(0);
    expect(calls).toEqual(["enter", "exit"]);
    engine.dispose();
  });
  it("suppresses a disabled pair's second Enter without inventing an unmatched Exit", () => {
    const { engine, add } = setup();
    const a = add(),
      b = add();
    const calls: string[] = [];
    a.collider.events.on(ContactEnter, () => {
      calls.push("a enter");
      a.collider.enabled = false;
    });
    a.collider.events.on(ContactExit, () => calls.push("a exit"));
    b.collider.events.on(ContactEnter, () => calls.push("b enter"));
    b.collider.events.on(ContactExit, () => calls.push("b exit"));
    engine.step(0);
    engine.step(0);
    expect(calls).toEqual(["a enter", "a exit"]);
    engine.dispose();
  });
  it("immediately suppresses later listeners when the receiving Collider is destroyed", () => {
    const { engine, add } = setup();
    const a = add(),
      b = add();
    const calls: string[] = [];
    a.collider.events.on(ContactEnter, () => {
      calls.push("first");
      a.collider.dispose();
    });
    a.collider.events.on(ContactEnter, () => calls.push("removed listener"));
    b.collider.events.on(ContactEnter, () => calls.push("invalid pair"));
    engine.step(0);
    engine.step(0);
    expect(calls).toEqual(["first"]);
    engine.dispose();
  });
  it("treats remove/re-add as a new identity even on the same Actor", () => {
    const { engine, add } = setup();
    const a = add(),
      b = add();
    const calls: string[] = [];
    a.collider.events.on(ContactEnter, () => calls.push("enter"));
    a.collider.events.on(ContactExit, () => calls.push("exit"));
    engine.step(0);
    b.collider.dispose();
    b.actor.add(new Collider());
    engine.step(0);
    expect(calls).toEqual(["enter", "exit", "enter"]);
    engine.dispose();
  });
  it("documents current failed-pass observation rather than transactional snapshots", () => {
    const { engine, world, add } = setup();
    const a = add(),
      b = add();
    engine.step(0);
    b.transform.x = Number.NaN;
    expect(() => engine.step(0)).toThrow();
    expect(world.diagnostics.contacts).toBe(1);
    expect(world.contactsFor(a.collider)).toEqual([]);
    b.transform.x = 0;
    engine.step(0);
    expect(world.contactsFor(a.collider)).toHaveLength(1);
    engine.dispose();
  });
  it("keeps ordinary updates and late movement ahead of collision capture", () => {
    const { engine, world, add } = setup();
    add();
    const b = add(100);
    class LateTeleport extends Component {
      static readonly type = defineComponent("LateTeleport");
      readonly type = LateTeleport.type;
      readonly phase = ComponentPhase.LateUpdate;
      update() {
        b.transform.x = 0;
      }
    }
    b.actor.add(new LateTeleport());
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(1);
    engine.dispose();
  });
  it("supports the highest unsigned layer bit and symmetric masks", () => {
    const { engine, world, add } = setup();
    const a = add(),
      b = add();
    a.collider.dispose();
    b.collider.dispose();
    a.actor.add(new Collider({ layer: 0x80000000, mask: 2 }));
    b.actor.add(new Collider({ layer: 2, mask: 0x80000000 }));
    engine.step(0);
    expect(world.diagnostics.contacts).toBe(1);
    engine.dispose();
  });
  it("does not equate resolved to absence of penetration for an impossible gap", () => {
    const { engine, world, add } = setup();
    const left = add(-15),
      right = add(15),
      middle = add();
    for (const entry of [left, right, middle]) {
      entry.collider.dispose();
      entry.actor.add(
        new Collider({
          width: 20,
          height: entry === middle ? 20 : 1000,
          response: CollisionResponse.Solid,
        }),
      );
    }
    middle.actor.add(new CollisionBody());
    engine.step(0);
    expect(world.responseDiagnostics.unresolved).toBeGreaterThan(0);
    expect(
      world
        .contactsFor(middle.actor.require(Collider.type))
        .some((c) => c.resolved),
    ).toBe(true);
    engine.dispose();
  });
  it("exposes quadratic X candidates independently from Y rejection", () => {
    const { engine, world, add } = setup();
    for (let i = 0; i < 100; i++) add(0, i * 40);
    engine.step(0);
    expect(world.diagnostics).toMatchObject({
      candidates: 4950,
      narrowTests: 0,
      contacts: 0,
    });
    engine.dispose();
  });
});
