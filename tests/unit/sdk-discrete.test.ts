import { Engine, Scene } from "@simpludify/core";
import { expect, it } from "vitest";
import { createDiscreteDemo } from "../../examples/sdk-integration/model";

it("commits frozen integer state before interpolation and preserves it under fractional presentation", () => {
  const engine = new Engine(),
    scene = engine.scene;
  engine.step(0);
  const demo = createDiscreteDemo(scene);
  const initial = demo.world;
  demo.step();
  const committed = demo.world;
  expect(Object.isFrozen(committed.cells)).toBe(true);
  expect(committed).toEqual({ step: 1, cells: [1, 2] });
  expect(demo.sample().map((v) => v.x)).toEqual([0, 0]);
  scene.advancePresentation(0.175);
  expect(demo.sample().map((v) => v.x)).toEqual([0.5, 1]);
  expect(demo.world).toBe(committed);
  expect(initial.cells).toEqual([0, 0]);
  engine.dispose();
});
it("finishes rapid steps, cancels restart endpoints and animates display through simulation pause", () => {
  const engine = new Engine(),
    scene = engine.scene;
  engine.step(0);
  const demo = createDiscreteDemo(scene);
  for (let i = 0; i < 6; i++) {
    demo.step();
    scene.advancePresentation(0.01);
  }
  expect(demo.world.cells).toEqual([6, 6]);
  expect(scene.presentationTweens.diagnostics.active).toBe(1);
  const old = demo.playback;
  demo.restart();
  expect(old?.state).toBe("cancelled");
  scene.advancePresentation(10);
  expect(demo.sample()).toEqual([
    { x: 0, opacity: 1 },
    { x: 0, opacity: 1 },
  ]);
  engine.pause();
  demo.step();
  engine.step(1);
  scene.advancePresentation(0.35);
  expect(demo.progress).toBe(1);
  expect(demo.world.step).toBe(1);
  demo.step();
  demo.playback?.pause();
  scene.advancePresentation(0.2);
  expect(demo.progress).toBe(0);
  demo.playback?.resume();
  scene.advancePresentation(0.35);
  expect(demo.progress).toBe(1);
  demo.step();
  const pending = demo.playback;
  const scheduler = scene.presentationTweens;
  engine.activate(new Scene("next"));
  expect(pending?.state).toBe("cancelled");
  expect(scheduler.diagnostics.active).toBe(0);
  engine.dispose();
});
it("fades escaped displays without mutating committed occupancy", () => {
  const engine = new Engine();
  engine.step(0);
  const demo = createDiscreteDemo(engine.scene);
  for (let i = 0; i < 3; i++) demo.step();
  engine.scene.advancePresentation(0.175);
  expect(demo.world.cells).toEqual([3, 6]);
  expect(demo.sample()[1]?.opacity).toBeCloseTo(0.5);
  engine.scene.advancePresentation(0.175);
  expect(demo.sample()[1]?.opacity).toBe(0);
  engine.dispose();
});
