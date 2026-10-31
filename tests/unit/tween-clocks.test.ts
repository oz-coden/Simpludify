import { Engine, Scene, Tween } from "@simpludify/core";
import { expect, it } from "vitest";

it("simulation and display clocks are independent during pause and use explicit seconds/speed", () => {
  const engine = new Engine(),
    s = engine.scene,
    state = { sim: 0, ui: 0 };
  s.tweens.play(Tween.to(Tween.property(state, "sim"), 10, { duration: 1 }));
  s.presentationTweens.play(
    Tween.to(Tween.property(state, "ui"), 10, { duration: 1 }),
  );
  engine.step(0.25);
  s.advancePresentation(0.1);
  expect(state).toEqual({ sim: 2.5, ui: 1 });
  engine.pause();
  engine.step(0.5);
  s.advancePresentation(0.4);
  expect(state).toEqual({ sim: 2.5, ui: 5 });
  engine.resume();
  s.tweens.speed = 0.5;
  engine.step(0.5);
  expect(state.sim).toBe(5);
  engine.dispose();
});
it("captures simulation eligibility before input/update, steps after contacts and before timers", () => {
  const engine = new Engine(),
    s = engine.scene,
    state = { x: 0, y: 0 },
    observed: number[] = [];
  let queued = false;
  s.onPostUpdate(() => {
    observed.push(state.x);
    if (!queued) {
      queued = true;
      s.tweens.play(Tween.to(Tween.property(state, "y"), 1, { duration: 0 }));
    }
  });
  s.tweens.play(Tween.to(Tween.property(state, "x"), 1, { duration: 0 }));
  s.after(0, () => observed.push(state.x));
  engine.step(0);
  expect(observed).toEqual([0, 1]);
  expect(state.y).toBe(0);
  engine.step(0);
  expect(state.y).toBe(1);
  engine.dispose();
});
it("Scene replacement cancels both clocks, paused work and pending children without completion", () => {
  const engine = new Engine(),
    old = engine.scene,
    state = { x: 0, y: 0 },
    events: string[] = [];
  const a = old.tweens.play(
    Tween.sequence(
      Tween.delay(5),
      Tween.to(Tween.property(state, "x"), 1, { duration: 1 }),
    ),
    {
      onComplete: () => events.push("bad"),
      onCancel: () => events.push("sim"),
    },
  );
  const b = old.presentationTweens.play(
    Tween.to(Tween.property(state, "y"), 1, { duration: 1 }),
    { onCancel: () => events.push("display") },
  );
  a.pause();
  engine.step(0);
  engine.activate(new Scene("next"));
  expect(a.state).toBe("cancelled");
  expect(b.state).toBe("cancelled");
  expect(events).toEqual(["sim", "display"]);
  expect(state).toEqual({ x: 0, y: 0 });
  expect(() => old.advancePresentation(1)).toThrow();
  engine.dispose();
});
it("a completion callback that disposes the Scene suppresses later timer callbacks", () => {
  const engine = new Engine(),
    s = engine.scene,
    state = { x: 0 };
  let timers = 0;
  s.tweens.play(Tween.to(Tween.property(state, "x"), 1, { duration: 0 }), {
    onComplete: () => s.dispose(),
  });
  s.after(0, () => {
    timers++;
  });
  engine.step(0);
  expect(timers).toBe(0);
  engine.dispose();
});
