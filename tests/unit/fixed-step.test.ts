import {
  Action,
  ActionController,
  Actor,
  defineActions,
  Engine,
  FixedStepRunner,
  Motion,
  Scene,
  Transform,
} from "@simpludify/core";
import { expect, it } from "vitest";

function setup() {
  const engine = new Engine({ seed: 42 }),
    actor = engine.scene.add(new Actor()),
    position = actor.add(new Transform());
  actor.add(new Motion({ speed: 60, x: 1 }));
  const runner = new FixedStepRunner(engine, { step: 1 / 60, maxSteps: 16 });
  return { engine, position, runner };
}
it("produces identical simulation across 30/60/144Hz host frames", () => {
  const results = [];
  for (const hz of [30, 60, 144]) {
    const { engine, position, runner } = setup();
    for (let i = 0; i < hz * 10; i++) runner.advance(1 / hz);
    results.push({ x: position.x, steps: engine.stepCount });
    engine.dispose();
  }
  expect(results).toEqual([
    { x: 600, steps: 600 },
    { x: 600, steps: 600 },
    { x: 600, steps: 600 },
  ]);
});
it("bounds catch-up work, retains fractions and reports dropped time", () => {
  const engine = new Engine({ seed: 1 }),
    runner = new FixedStepRunner(engine, {
      step: 0.1,
      maxSteps: 2,
      maxFrameDelta: 0.5,
    });
  const r = runner.advance(1.05);
  expect(r.steps).toBe(2);
  expect(r.droppedSeconds).toBeCloseTo(0.85);
  expect(r.alpha).toBeCloseTo(0);
  expect(runner.advance(0.05).steps).toBe(0);
  expect(runner.advance(0.05).steps).toBe(1);
  engine.dispose();
});
it("keeps short taps until a real tick and pumps pause controls without accumulating paused time", () => {
  const engine = new Engine({ seed: 1 }),
    a = defineActions({ Pause: Action.button(), Fire: Action.button() }),
    c = new ActionController(a, { scene: engine.scene, input: engine.input }),
    s = c.createSource();
  const runner = new FixedStepRunner(engine, { step: 0.1 });
  c.onPressed(a.Pause, () =>
    engine.paused ? engine.resume() : engine.pause(),
  );
  s.set(a.Fire, true);
  s.set(a.Fire, false);
  runner.advance(0.04);
  expect(engine.stepCount).toBe(0);
  runner.advance(0.06);
  expect(c.pressed(a.Fire)).toBe(true);
  s.set(a.Pause, true);
  s.set(a.Pause, false);
  runner.advance(0.1);
  expect(engine.paused).toBe(true);
  const before = engine.snapshot().elapsed;
  s.set(a.Pause, true);
  s.set(a.Pause, false);
  expect(runner.advance(100).inputPumps).toBe(1);
  expect(engine.paused).toBe(false);
  expect(engine.snapshot().elapsed).toBe(before);
  expect(runner.advance(0.1).steps).toBe(1);
  engine.dispose();
});
it("resets fractions at Scene changes and stops catch-up after disposal", () => {
  const { engine, runner } = setup();
  runner.advance(0.01);
  engine.activate(new Scene("next"));
  expect(runner.advance(0.01).steps).toBe(0);
  engine.scene.onUpdate(() => engine.dispose());
  expect(runner.advance(0.2).steps).toBe(1);
  expect(() => runner.advance(0)).toThrow(/disposed/);
});
it("validates options, deltas and reentrancy", () => {
  const engine = new Engine();
  for (const options of [
    { step: 0 },
    { step: NaN },
    { maxSteps: 0 },
    { maxSteps: 0.5 },
    { step: 1, maxFrameDelta: 0.5 },
  ])
    expect(() => new FixedStepRunner(engine, options)).toThrow();
  const runner = new FixedStepRunner(engine);
  expect(() => runner.advance(-1)).toThrow();
  engine.scene.onUpdate(() =>
    expect(() => runner.advance(0)).toThrow(/reentrant/),
  );
  runner.advance(1 / 60);
  engine.dispose();
});
