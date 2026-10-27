import {
  Actor,
  Component,
  type ComponentType,
  defineComponent,
  Engine,
  Scene,
  Transform,
} from "@simpludify/core";
import { expect, it } from "vitest";

it("stops implicit first-step activation after Engine or Scene disposal, without advancing time", () => {
  for (const target of ["engine", "scene", "pause"] as const) {
    const engine = new Engine();
    let updates = 0;
    engine.scene.onUpdate(() => updates++);
    engine.scene.onActivate(() => {
      if (target === "engine") engine.dispose();
      else if (target === "scene") engine.scene.dispose();
      else engine.pause();
    });
    expect(() => engine.step(1)).not.toThrow();
    expect(updates).toBe(0);
    expect(engine.snapshot().elapsed).toBe(0);
    engine.dispose();
  }
});

it("keeps dependencies readable through component, Actor and Scene teardown, even after cleanup errors", () => {
  for (const mode of ["component", "actor", "scene"] as const) {
    const scene = new Scene("scope"),
      actor = scene.add(new Actor());
    const transform = actor.add(new Transform({ x: 7 }));
    const values: number[] = [];
    class Dependent extends Component {
      static readonly type: ComponentType<Dependent> =
        defineComponent<Dependent>("Dependent", [Transform.type]);
      readonly type = Dependent.type;
      protected onDestroy(): void {
        values.push(this.actor.require(Transform.type).x);
        expect(transform.disposed).toBe(false);
        throw new Error("intentional cleanup failure");
      }
    }
    actor.add(new Dependent());
    expect(() =>
      mode === "component"
        ? actor.remove(Dependent.type)
        : mode === "actor"
          ? actor.dispose()
          : scene.dispose(),
    ).toThrow(AggregateError);
    expect(values).toEqual([7]);
    expect(actor.get(Dependent.type)).toBeUndefined();
    if (mode !== "component") expect(actor.get(Transform.type)).toBeUndefined();
    scene.dispose();
  }
});

it("defers zero timers registered in every running phase to the following step", () => {
  const engine = new Engine(),
    calls: string[] = [];
  class Schedule extends Component {
    readonly type = defineComponent("Schedule");
    done = false;
    update(): void {
      if (!this.done) engine.scene.after(0, () => calls.push("component"));
      this.done = true;
    }
  }
  engine.scene.add(new Actor()).add(new Schedule());
  const once = (
    name: string,
    register: (callback: () => void) => () => void,
  ) => {
    const off = register(() => {
      off();
      engine.scene.after(0, () => calls.push(name));
    });
  };
  once("post", (cb) => engine.scene.onPostUpdate(cb));
  once("scene", (cb) => engine.scene.onUpdate(cb));
  engine.scene.after(0, () => engine.scene.after(0, () => calls.push("timer")));
  engine.step(1);
  expect(calls).toEqual([]);
  engine.step(0);
  expect(calls).toEqual(["component", "post", "timer", "scene"]);
  engine.dispose();
});

it("preserves repeating timer phase across 144Hz, long steps, pause and cancellation", () => {
  const engine = new Engine();
  let count = 0;
  const cancel = engine.scene.every(0.1, () => count++);
  for (let i = 0; i < 144 * 600; i++) engine.step(1 / 144);
  expect(count).toBe(6000);
  engine.step(1.05);
  expect(count).toBe(6001);
  engine.step(0.05);
  expect(count).toBe(6002);
  engine.pause();
  engine.step(100);
  expect(count).toBe(6002);
  engine.resume();
  cancel();
  engine.step(1);
  expect(count).toBe(6002);
  engine.dispose();
});
