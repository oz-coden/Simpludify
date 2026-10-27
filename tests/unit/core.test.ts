import {
  Action,
  ActionController,
  Aspect,
  Character,
  createViewTransform,
  defineActions,
  Engine,
  KeyboardBindings,
  KeyCode,
  Scene,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";
import { keyboard } from "../helpers/keyboard";

const Actions = defineActions({ Move: Action.axis2D() });
function controls(engine: Engine) {
  return new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings: { Move: KeyboardBindings.WASD },
  });
}
function travel(steps: number, diagonal = false) {
  const engine = new Engine(),
    input = controls(engine);
  const player = engine.scene.add(
    Character({ movement: input.reader(Actions.Move), x: 0, y: 0, speed: 180 }),
  );
  input.createSource().set(Actions.Move, { x: 1, y: diagonal ? 1 : 0 });
  for (let i = 0; i < steps; i++) engine.step(1 / steps);
  const distance = Math.hypot(player.x, player.y);
  engine.dispose();
  return distance;
}
describe("simulation", () => {
  it("moves at the same speed at 30, 60 and 144 steps per second", () => {
    for (const steps of [30, 60, 144])
      expect(travel(steps)).toBeCloseTo(180, 10);
  });
  it("normalizes diagonal speed", () =>
    expect(travel(60, true)).toBeCloseTo(travel(60), 10));
  it("does not move without an explicit Action reader", () => {
    const engine = new Engine(),
      player = engine.scene.add(Character());
    keyboard(engine).set(KeyCode.D, true);
    engine.step(1);
    expect(player.x).toBe(400);
    engine.dispose();
  });
  it("rejects invalid configuration and time", () => {
    expect(() => Character({ speed: -1 })).toThrow();
    expect(() => Character({ x: NaN })).toThrow();
    expect(() => Character({ size: 0 })).toThrow();
    expect(() => new Engine().step(-1)).toThrow();
    expect(() => new Engine().step(Infinity)).toThrow();
  });
  it("reproduces engine-managed randomness and snapshots", () => {
    const a = new Engine(42),
      b = new Engine(42);
    for (const engine of [a, b]) {
      const input = controls(engine);
      engine.scene.add(Character({ movement: input.reader(Actions.Move) }));
      input.createSource().set(Actions.Move, { x: 0, y: -1 });
      engine.step(0.5);
    }
    expect(a.random()).toBe(b.random());
    expect(a.snapshot()).toEqual(b.snapshot());
    a.dispose();
    b.dispose();
  });
  it("copies bindings independently from user arrays", () => {
    const engine = new Engine(),
      input = controls(engine),
      right: KeyCode[] = [KeyCode.L];
    input.rebind(Actions.Move, { x: { positive: right } });
    right.length = 0;
    keyboard(engine).set(KeyCode.L, true);
    engine.step(0);
    expect(input.value(Actions.Move)).toEqual({ x: 1, y: 0 });
    engine.dispose();
  });
});
describe("input", () => {
  it("repeated writes are idempotent and release clears movement", () => {
    const engine = new Engine(),
      input = controls(engine),
      source = input.createSource();
    source.set(Actions.Move, { x: 0, y: -1 });
    source.set(Actions.Move, { x: 0, y: -1 });
    engine.step(0);
    expect(input.value(Actions.Move).y).toBe(-1);
    source.clear();
    engine.step(0);
    expect(input.value(Actions.Move)).toEqual({ x: 0, y: 0 });
    engine.dispose();
  });
  it("opposite device directions cancel and clear releases all", () => {
    const engine = new Engine(),
      input = controls(engine),
      device = keyboard(engine);
    device.set(KeyCode.A, true);
    device.set(KeyCode.D, true);
    engine.step(0);
    expect(input.value(Actions.Move).x).toBe(0);
    engine.input.clear();
    expect(engine.input.snapshot()).toEqual([]);
    engine.dispose();
  });
});
describe("scene ownership", () => {
  it("cleans in reverse order, resets keys, and stops updating old scenes", () => {
    const engine = new Engine(),
      calls: string[] = [];
    engine.scene.onDispose(() => calls.push("first"));
    engine.scene.onDispose(() => calls.push("second"));
    engine.scene.onUpdate(() => calls.push("old-update"));
    keyboard(engine).set("KeyW", true);
    const next = new Scene("next");
    next.onUpdate(() => calls.push("new-update"));
    engine.activate(next);
    engine.step(1);
    expect(calls).toEqual(["second", "first", "new-update"]);
    expect(engine.input.snapshot()).toEqual([]);
  });
  it("dispose is idempotent and executes remaining cleanup after errors", () => {
    const engine = new Engine(),
      calls: number[] = [];
    engine.scene.onDispose(() => calls.push(1));
    engine.scene.onDispose(() => {
      throw new Error("cleanup");
    });
    expect(() => engine.dispose()).toThrow(AggregateError);
    expect(calls).toEqual([1]);
    expect(() => engine.dispose()).not.toThrow();
    expect(() => engine.step(0)).toThrow();
    expect(() => engine.scene.add(Character())).toThrow();
  });
  it("rejects duplicate entities and dead scenes", () => {
    const scene = new Scene("one");
    const player = scene.add(Character({ id: "player" }));
    expect(() => scene.add(player)).toThrow();
    expect(() => scene.add(Character({ id: "player" }))).toThrow();
    scene.dispose();
    expect(() => new Engine().activate(scene)).toThrow();
  });
});
describe("world mapping", () => {
  it("fits and fills without stretching", () => {
    const viewport = { x: 0, y: 0, width: 400, height: 800 };
    const fit = createViewTransform({ viewport, aspect: Aspect.Fit });
    expect(fit).toMatchObject({
      scale: 0.5,
      x: 0,
      y: 287.5,
      logicalWidth: 800,
      logicalHeight: 450,
    });
    const fill = createViewTransform({ viewport, aspect: Aspect.Fill });
    expect(fill.scale).toBeCloseTo(800 / 450);
    expect(fill.x).toBeLessThan(0);
  });
  it("adaptive uses viewport CSS-pixel logical units", () => {
    expect(
      createViewTransform({
        viewport: { x: 0, y: 0, width: 390, height: 844 },
        aspect: Aspect.Adaptive,
      }),
    ).toMatchObject({
      scale: 1,
      x: 0,
      y: 0,
      logicalWidth: 390,
      logicalHeight: 844,
    });
  });
  it("rejects degenerate dimensions", () =>
    expect(() =>
      createViewTransform({ viewport: { x: 0, y: 0, width: 0, height: 100 } }),
    ).toThrow());
});
