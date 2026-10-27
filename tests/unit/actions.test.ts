import {
  Action,
  ActionController,
  Actor,
  Component,
  defineActions,
  defineComponent,
  Engine,
  isKeyCode,
  KeyCode,
  Lifetime,
  parseKeyCode,
  Scene,
} from "@simpludify/core";
import { expect, it } from "vitest";

const Actions = defineActions({
  Fire: Action.button(),
  Pause: Action.button(),
  Yaw: Action.axis1D(),
  Move: Action.axis2D(),
  Aim: Action.axis3D(),
  Raw: Action.axis2D({ normalize: false }),
});
const bindings = {
  Fire: { keys: [KeyCode.Space, KeyCode.Enter] },
  Pause: { keys: [KeyCode.P] },
  Yaw: { negative: [KeyCode.Q], positive: [KeyCode.E] },
  Move: {
    x: { negative: [KeyCode.A], positive: [KeyCode.D] },
    y: { negative: [KeyCode.W], positive: [KeyCode.S] },
  },
};
function fixture() {
  const engine = new Engine();
  const controller = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings,
  });
  const source = controller.createSource(engine.scene);
  engine.step(0);
  return { engine, controller, source };
}
it("validates external physical code strings without conflating KeyboardEvent.key", () => {
  expect(KeyCode.W).toBe("KeyW");
  expect(isKeyCode("w")).toBe(false);
  expect(parseKeyCode("KeyW")).toBe(KeyCode.W);
  expect(() => parseKeyCode("KeyInvalid")).toThrow();
});
it("freezes button state per step and retains a complete sub-step tap", () => {
  const { engine, controller: c, source } = fixture();
  source.set(Actions.Fire, true);
  source.set(Actions.Fire, false);
  expect(c.pressed(Actions.Fire)).toBe(false);
  engine.step(0);
  expect(c.button(Actions.Fire)).toEqual({
    held: false,
    pressed: true,
    released: true,
    pressCount: 1,
    releaseCount: 1,
  });
  const frame = c.button(Actions.Fire);
  source.set(Actions.Fire, true);
  expect(c.button(Actions.Fire)).toBe(frame);
  engine.step(0);
  expect(c.pressed(Actions.Fire)).toBe(true);
  expect(c.value(Actions.Fire)).toBe(true);
  engine.step(0);
  expect(c.button(Actions.Fire)).toMatchObject({
    held: true,
    pressed: false,
    released: false,
  });
  engine.dispose();
});
it("keeps multiple fast taps and cross-action event order", () => {
  const { engine, controller: c, source } = fixture();
  for (const a of [Actions.Fire, Actions.Pause, Actions.Fire]) {
    source.set(a, true);
    source.set(a, false);
  }
  engine.step(0);
  expect(c.button(Actions.Fire).pressCount).toBe(2);
  expect(c.events.filter((e) => e.down).map((e) => e.action)).toEqual([
    Actions.Fire,
    Actions.Pause,
    Actions.Fire,
  ]);
  engine.dispose();
});
it("uses the union of keys and physical input sources without spurious releases", () => {
  const { engine, controller: c } = fixture();
  const a = engine.input.createSource(),
    b = engine.input.createSource();
  a.set(KeyCode.Space, true);
  b.set(KeyCode.Enter, true);
  engine.step(0);
  expect(c.button(Actions.Fire).pressCount).toBe(1);
  a.clear();
  engine.step(0);
  expect(c.button(Actions.Fire)).toMatchObject({ held: true, released: false });
  b.dispose();
  engine.step(0);
  expect(c.released(Actions.Fire)).toBe(true);
  engine.dispose();
});
it("composes keyboard, touch and automatic input and releases only the departing source", () => {
  const { engine, controller: c, source } = fixture();
  const touch = c.createSource();
  engine.input.set(KeyCode.Space, true);
  source.set(Actions.Fire, true);
  touch.set(Actions.Fire, true);
  engine.step(0);
  engine.input.clear(); // global reset is intentionally all-source and silent
  engine.step(0);
  expect(c.button(Actions.Fire)).toEqual({
    ...c.button(Actions.Fire),
    held: false,
    pressed: false,
    released: false,
  });
  engine.input.set(KeyCode.Space, true);
  touch.set(Actions.Fire, true);
  engine.step(0);
  engine.input.set(KeyCode.Space, false);
  engine.step(0);
  expect(c.value(Actions.Fire)).toBe(true);
  touch.dispose();
  engine.step(0);
  expect(c.released(Actions.Fire)).toBe(true);
  engine.dispose();
});
it("clamps axis sums, cancels opposites and preserves analog magnitude", () => {
  const { engine, controller: c, source } = fixture();
  const other = c.createSource();
  source.set(Actions.Yaw, 0.8);
  other.set(Actions.Yaw, 0.8);
  source.set(Actions.Move, { x: 1, y: 1 });
  source.set(Actions.Aim, { x: 1, y: 1, z: 1 });
  source.set(Actions.Raw, { x: 1, y: 1 });
  engine.step(0);
  expect(c.value(Actions.Yaw)).toBe(1);
  expect(c.value(Actions.Move).x).toBeCloseTo(Math.SQRT1_2);
  expect(c.value(Actions.Aim).z).toBeCloseTo(1 / Math.sqrt(3));
  expect(c.value(Actions.Raw)).toEqual({ x: 1, y: 1 });
  source.clear();
  other.clear();
  engine.input.set(KeyCode.Q, true);
  engine.input.set(KeyCode.E, true);
  source.set(Actions.Move, { x: 0.2, y: 0.1 });
  engine.step(0);
  expect(c.value(Actions.Yaw)).toBe(0);
  expect(c.value(Actions.Move)).toEqual({ x: 0.2, y: 0.1 });
  engine.dispose();
});
it("does not alias a mutable vector supplied by an input device", () => {
  const { engine, controller: c, source } = fixture();
  const v = { x: 0.4, y: 0.2 };
  source.set(Actions.Move, v);
  v.x = -1;
  engine.step(0);
  expect(c.value(Actions.Move).x).toBe(0.4);
  expect(Object.isFrozen(c.value(Actions.Move))).toBe(true);
  engine.dispose();
});
it("rejects invalid values and foreign action identities at runtime", () => {
  const { engine, controller: c, source } = fixture();
  const Other = defineActions({ Fire: Action.button() });
  expect(() => c.value(Other.Fire)).toThrow("another definition");
  for (const v of [NaN, Infinity, 1.1])
    expect(() => source.set(Actions.Yaw, v)).toThrow();
  // Dynamic JS/configuration remains validated even when compile-time checks are bypassed.
  expect(() => source.set(Actions.Fire, 1 as unknown as boolean)).toThrow();
  expect(() => source.set(Actions.Move, { x: 0, y: NaN })).toThrow();
  engine.dispose();
});
it("rebinds held keys without creating a button press, and preserves logical sources", () => {
  const { engine, controller: c, source } = fixture();
  engine.input.set(KeyCode.Q, true);
  engine.step(0);
  expect(c.value(Actions.Yaw)).toBe(-1);
  c.rebind(Actions.Yaw, { negative: [KeyCode.Y], positive: [KeyCode.I] });
  engine.step(0);
  expect(c.value(Actions.Yaw)).toBe(0);
  engine.input.set(KeyCode.I, true);
  engine.step(0);
  expect(c.value(Actions.Yaw)).toBe(1);
  engine.input.set(KeyCode.I, false);
  source.set(Actions.Yaw, -0.5);
  engine.step(0);
  expect(c.value(Actions.Yaw)).toBe(-0.5);
  engine.input.set(KeyCode.X, true);
  c.rebind(Actions.Fire, { keys: [KeyCode.X] });
  engine.step(0);
  expect(c.value(Actions.Fire)).toBe(true);
  expect(c.pressed(Actions.Fire)).toBe(false);
  engine.dispose();
});
it("supports add/remove/default bindings, deduplication and conflict reporting without prohibition", () => {
  const { engine, controller: c } = fixture();
  c.addBindings(Actions.Fire, { keys: [KeyCode.X, KeyCode.Space, KeyCode.X] });
  expect(c.getBinding(Actions.Fire).keys).toEqual([
    KeyCode.Space,
    KeyCode.Enter,
    KeyCode.X,
  ]);
  c.removeBindings(Actions.Fire, { keys: [KeyCode.Enter] });
  expect(c.getBinding(Actions.Fire).keys).not.toContain(KeyCode.Enter);
  c.rebind(Actions.Pause, { keys: [KeyCode.Space] });
  expect(
    c.conflicts().find((x) => x.key === KeyCode.Space)?.bindings,
  ).toHaveLength(2);
  c.resetBindings();
  expect(c.conflicts()).toEqual([]);
  expect(c.getBinding(Actions.Fire)).toEqual(bindings.Fire);
  engine.dispose();
});
it("loads serialized bindings atomically and validates unknown names, fields and codes", () => {
  const { engine, controller: c } = fixture();
  const saved = JSON.parse(JSON.stringify(c.exportBindings()));
  c.rebind(Actions.Fire, { keys: [KeyCode.X] });
  c.importBindings(saved);
  expect(c.getBinding(Actions.Fire)).toEqual(bindings.Fire);
  for (const modify of [
    (d: typeof saved) => (d.version = 2),
    (d: typeof saved) => (d.bindings.Fire.keys = ["invalid"]),
    (d: typeof saved) => (d.bindings.Unknown = {}),
    (d: typeof saved) => (d.bindings.Fire.axis = 1),
  ]) {
    const bad = structuredClone(saved);
    modify(bad);
    expect(() => c.importBindings(bad)).toThrow();
    expect(c.exportBindings()).toEqual(saved);
  }
  engine.dispose();
});
it("captures all controllers before any input callback or Component can mutate their next frame", () => {
  const { engine, controller: c, source } = fixture();
  const second = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
  });
  const secondSource = second.createSource();
  c.onPressed(Actions.Fire, () => secondSource.set(Actions.Fire, true));
  let observed = false;
  class Change extends Component {
    readonly type = defineComponent("Change");
    update(): void {
      source.set(Actions.Fire, false);
      observed = c.value(Actions.Fire);
    }
  }
  engine.scene.add(new Actor()).add(new Change());
  source.set(Actions.Fire, true);
  engine.step(0);
  expect(observed).toBe(true);
  expect(second.value(Actions.Fire)).toBe(false);
  engine.step(0);
  expect(second.pressed(Actions.Fire)).toBe(true);
  engine.dispose();
});
it("allows pause and resume through the same logical button boundary without stepping simulation", () => {
  const { engine, controller: c, source } = fixture();
  let updates = 0;
  engine.scene.onUpdate(() => updates++);
  c.onPressed(Actions.Pause, () =>
    engine.paused ? engine.resume() : engine.pause(),
  );
  source.set(Actions.Pause, true);
  engine.step(1);
  expect(engine.paused).toBe(true);
  expect(updates).toBe(0);
  source.set(Actions.Pause, true);
  engine.step(1);
  expect(engine.paused).toBe(false);
  expect(updates).toBe(1);
  engine.dispose();
});
it("drops pre-pause edges and held inputs without phantom actions on resume", () => {
  const { engine, controller: c, source } = fixture();
  source.set(Actions.Fire, true);
  source.set(Actions.Fire, false);
  engine.pause();
  engine.resume();
  engine.step(0);
  expect(c.pressed(Actions.Fire)).toBe(false);
  engine.dispose();
});
it("scopes source disposal and permits harmless late releases", () => {
  const { engine, controller: c } = fixture();
  const owner = new Lifetime(),
    source = c.createSource(owner);
  source.set(Actions.Fire, true);
  engine.step(0);
  owner.dispose();
  engine.step(0);
  expect(c.released(Actions.Fire)).toBe(true);
  expect(() => source.set(Actions.Fire, false)).not.toThrow();
  expect(() => source.set(Actions.Fire, true)).toThrow();
  engine.dispose();
  expect(c.disposed).toBe(true);
  expect(engine.input.sourceCount).toBe(0);
});
it("does not route keyboard input to a preparing scene and resets staged contributions on commit", () => {
  const { engine } = fixture();
  const candidate = new Scene("next");
  const c = new ActionController(Actions, {
    scene: candidate,
    input: engine.input,
    bindings: { Fire: { keys: [KeyCode.F] } },
  });
  const source = c.createSource(candidate);
  source.set(Actions.Fire, true);
  expect(engine.input.acceptsKey(KeyCode.F)).toBe(false);
  engine.input.set(KeyCode.F, true);
  engine.step(0);
  expect(c.value(Actions.Fire)).toBe(false);
  engine.activate(candidate);
  expect(engine.input.acceptsKey(KeyCode.F)).toBe(true);
  engine.step(0);
  expect(c.pressed(Actions.Fire)).toBe(false);
  engine.dispose();
  expect(source.disposed).toBe(true);
});
it("retains synthetic keys injected before the implicit default activation", () => {
  const engine = new Engine();
  const c = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings,
  });
  engine.input.set(KeyCode.Space, true);
  engine.step(0);
  expect(c.pressed(Actions.Fire)).toBe(true);
  engine.dispose();
});
it("rejects synchronous reentrancy from input callbacks and still cleans every listener", () => {
  const { engine, controller: c, source } = fixture();
  let delivered = 0;
  c.onPressed(Actions.Fire, () => engine.step(0));
  c.onPressed(Actions.Fire, () => delivered++);
  source.set(Actions.Fire, true);
  expect(() => engine.step(0)).toThrow(AggregateError);
  expect(delivered).toBe(1);
  engine.dispose();
  expect(source.disposed).toBe(true);
});
