import {
  Aspect,
  Character,
  createViewTransform,
  Engine,
  InputState,
  KeyboardController,
  KeyMaps,
  Movement,
  Scene,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";

function travel(steps: number, diagonal = false) {
  const engine = new Engine();
  const player = engine.scene.add(
    Character({ movement: Movement.WASD, x: 0, y: 0, speed: 180 }),
  );
  engine.input.set("KeyD", true);
  if (diagonal) engine.input.set("KeyS", true);
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
  it("does not move without an explicit movement preset", () => {
    const engine = new Engine();
    const player = engine.scene.add(Character());
    engine.input.set("KeyD", true);
    engine.step(1);
    expect(player.x).toBe(400);
  });
  it("rejects invalid configuration and time", () => {
    expect(() => Character({ speed: -1 })).toThrow();
    expect(() => Character({ x: Number.NaN })).toThrow();
    expect(() => Character({ size: 0 })).toThrow();
    expect(() => new Engine().step(-1)).toThrow();
    expect(() => new Engine().step(Infinity)).toThrow();
  });
  it("reproduces engine-managed randomness and snapshots", () => {
    const a = new Engine(42),
      b = new Engine(42);
    for (const engine of [a, b]) {
      engine.scene.add(Character({ movement: Movement.WASD }));
      engine.input.set("KeyW", true);
      engine.step(0.5);
    }
    expect(a.random()).toBe(b.random());
    expect(a.snapshot()).toEqual(b.snapshot());
  });
  it("keeps character key mappings independent from user arrays", () => {
    const right: import("@simpludify/core").KeyCode[] = ["KeyL"];
    const player = Character({ keys: { up: [], down: [], left: [], right } });
    right.length = 0;
    const input = new InputState();
    input.set("KeyL", true);
    expect(
      input.direction(player.require(KeyboardController.type).keys),
    ).toEqual({ x: 1, y: 0 });
  });
});
describe("input", () => {
  it("repeat keydown is idempotent and keyup clears movement", () => {
    const input = new InputState();
    input.set("KeyW", true);
    input.set("KeyW", true);
    expect(input.snapshot()).toEqual(["KeyW"]);
    expect(input.direction(KeyMaps.wasd).y).toBe(-1);
    input.set("KeyW", false);
    expect(input.direction(KeyMaps.wasd)).toEqual({ x: 0, y: 0 });
  });
  it("opposite directions cancel and clear releases all", () => {
    const input = new InputState();
    input.set("ArrowLeft", true);
    input.set("ArrowRight", true);
    expect(input.direction(KeyMaps.arrows).x).toBe(0);
    input.clear();
    expect(input.snapshot()).toEqual([]);
  });
});
describe("scene ownership", () => {
  it("cleans in reverse order, resets keys, and stops updating old scenes", () => {
    const engine = new Engine(),
      calls: string[] = [];
    engine.scene.onDispose(() => calls.push("first"));
    engine.scene.onDispose(() => calls.push("second"));
    engine.scene.onUpdate(() => calls.push("old-update"));
    engine.input.set("KeyW", true);
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
