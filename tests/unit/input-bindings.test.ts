import {
  Action,
  ActionController,
  defineActions,
  Engine,
  isMouseButton,
  KeyboardBindings,
  KeyCode,
  Lifetime,
  MouseButton,
  parseMouseButton,
  Scene,
} from "@simpludify/core";
import { expect, it } from "vitest";
import {
  GamepadBindings,
  GamepadButton,
} from "../../packages/web/src/gamepad-bindings";
import { GamepadInput } from "../../packages/web/src/gamepads";

const A = defineActions({
  Jump: Action.button(),
  Attack: Action.button(),
  Move: Action.axis2D(),
  Depth: Action.axis3D(),
  Scalar: Action.axis1D(),
});
function fixture() {
  const engine = new Engine({ seed: 16 });
  const c = new ActionController(A, {
    scene: engine.scene,
    input: engine.input,
    bindings: {
      Jump: {
        keys: [KeyCode.Space],
        mouse: [MouseButton.Back],
        gamepad: { buttons: [GamepadButton.South] },
      },
      Attack: {
        keys: [KeyCode.Space],
        mouse: [MouseButton.Left],
        gamepad: { buttons: [GamepadButton.South] },
      },
      Move: { ...KeyboardBindings.WASD, gamepad: GamepadBindings.LeftStick },
    },
  });
  const keys = engine.input.createKeyboardSource(),
    mouse = engine.input.createMouseSource(),
    program = c.createSource();
  const pad = {
    index: 0,
    id: "Test pad",
    connected: true,
    mapping: "standard",
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
  };
  const pads = new GamepadInput(engine.input, {
    poll: () => [pad],
    events: new EventTarget(),
  });
  const source = pads.bind(c, { index: 0, deadZone: 0 });
  const button = (index: number, pressed: boolean) => {
    pad.buttons[index] = { value: Number(pressed), pressed };
  };
  engine.step(0);
  return { engine, c, keys, mouse, program, pad, pads, source, button };
}
it("validates standard mouse indices without inventing keyboard codes", () => {
  expect(Object.values(MouseButton)).toEqual([0, 1, 2, 3, 4]);
  for (const button of Object.values(MouseButton))
    expect(parseMouseButton(button)).toBe(button);
  for (const bad of [-1, 5, 1.5, NaN, "0", null]) {
    expect(isMouseButton(bad)).toBe(false);
    expect(() => parseMouseButton(bad)).toThrow();
  }
});
it("ORs keyboard, mouse and managed gamepad holds without intermediate edges", () => {
  const f = fixture();
  f.keys.set(KeyCode.Space, true);
  f.engine.step(0);
  expect(f.c.button(A.Jump)).toMatchObject({
    held: true,
    pressCount: 1,
    releaseCount: 0,
  });
  f.mouse.set(MouseButton.Back, true);
  f.button(0, true);
  f.engine.step(0);
  expect(f.c.button(A.Jump)).toMatchObject({
    held: true,
    pressCount: 0,
    releaseCount: 0,
  });
  f.keys.set(KeyCode.Space, false);
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(true);
  expect(f.c.released(A.Jump)).toBe(false);
  f.mouse.set(MouseButton.Back, false);
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(true);
  expect(f.c.released(A.Jump)).toBe(false);
  f.button(0, false);
  f.engine.step(0);
  expect(f.c.button(A.Jump)).toMatchObject({
    held: false,
    pressCount: 0,
    releaseCount: 1,
  });
  f.engine.dispose();
});
it("lets one mouse button and one pad button feed multiple Actions independently", () => {
  const f = fixture();
  f.c.addBindings(A.Jump, { mouse: [MouseButton.Left] });
  f.mouse.set(MouseButton.Left, true);
  f.engine.step(0);
  expect([f.c.value(A.Jump), f.c.value(A.Attack)]).toEqual([true, true]);
  f.mouse.set(MouseButton.Left, false);
  f.button(0, true);
  f.engine.step(0);
  expect([f.c.value(A.Jump), f.c.value(A.Attack)]).toEqual([true, true]);
  f.engine.dispose();
});
it("retains a complete mouse tap and suppresses repeated held writes", () => {
  const f = fixture();
  f.mouse.set(MouseButton.Left, true);
  f.mouse.set(MouseButton.Left, true);
  f.mouse.set(MouseButton.Left, false);
  f.engine.step(0);
  expect(f.c.button(A.Attack)).toMatchObject({
    held: false,
    pressCount: 1,
    releaseCount: 1,
  });
  f.mouse.set(MouseButton.Left, true);
  f.engine.step(0);
  f.engine.step(5);
  expect(f.c.button(A.Attack)).toMatchObject({
    held: true,
    pressCount: 0,
    releaseCount: 0,
  });
  f.engine.dispose();
});
it("combines digital mouse directions with keyboard and analog axes for every Action kind", () => {
  const f = fixture();
  f.c.addBindings(A.Move, {
    x: { mousePositive: [MouseButton.Right] },
    y: { mouseNegative: [MouseButton.Middle] },
  });
  f.c.rebind(A.Scalar, {
    mouseNegative: [MouseButton.Forward],
    gamepad: { axis: 2, deadZone: 0 },
  });
  f.c.rebind(A.Depth, { z: { mousePositive: [MouseButton.Forward] } });
  f.mouse.set(MouseButton.Right, true);
  f.mouse.set(MouseButton.Middle, true);
  f.mouse.set(MouseButton.Forward, true);
  f.engine.step(0);
  expect(f.c.value(A.Move).x).toBeCloseTo(Math.SQRT1_2, 12);
  expect(f.c.value(A.Move).y).toBeCloseTo(-Math.SQRT1_2, 12);
  expect(f.c.value(A.Scalar)).toBe(-1);
  expect(f.c.value(A.Depth)).toEqual({ x: 0, y: 0, z: 1 });
  f.mouse.clear();
  f.pad.axes[0] = 0.5;
  f.pad.axes[2] = 0;
  f.engine.step(0);
  f.pad.axes[2] = 0.25;
  f.engine.step(0);
  expect(f.c.value(A.Scalar)).toBe(0.25);
  f.keys.set(KeyCode.D, true);
  f.engine.step(0);
  expect(f.c.value(A.Move)).toEqual({ x: 1, y: 0 });
  f.engine.dispose();
});
it("gates keyboard and mouse independently and requires fresh mouse input after reenabling", () => {
  const f = fixture();
  f.mouse.set(MouseButton.Back, true);
  f.keys.set(KeyCode.Space, true);
  f.engine.step(0);
  f.c.keyboardEnabled = false;
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(true);
  f.c.mouseEnabled = false;
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(false);
  f.c.mouseEnabled = true;
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(false);
  f.mouse.set(MouseButton.Back, false);
  f.mouse.set(MouseButton.Back, true);
  f.engine.step(0);
  expect(f.c.pressed(A.Jump)).toBe(true);
  f.engine.dispose();
});
it("releases only the disposed/disabled physical source contribution", () => {
  const f = fixture(),
    owner = new Lifetime();
  const second = f.engine.input.createMouseSource(owner);
  f.mouse.set(MouseButton.Back, true);
  second.set(MouseButton.Back, true);
  f.engine.step(0);
  f.mouse.enabled = false;
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(true);
  owner.dispose();
  f.engine.step(0);
  expect(f.c.released(A.Jump)).toBe(true);
  f.mouse.enabled = true;
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(false);
  expect(() => second.set(MouseButton.Back, true)).toThrow();
  second.set(MouseButton.Back, false);
  f.engine.dispose();
  expect(f.engine.input.sourceCount).toBe(0);
});
it("preserves unchanged held pad Actions while another managed Action is rebound", () => {
  const f = fixture();
  f.button(0, true);
  f.pad.axes[0] = 0.5;
  f.engine.step(0);
  f.c.rebind(A.Move, { gamepad: GamepadBindings.RightStick });
  f.engine.step(0);
  expect(f.c.button(A.Jump)).toMatchObject({
    held: true,
    pressCount: 0,
    releaseCount: 0,
  });
  expect(f.c.value(A.Move)).toEqual({ x: 0, y: 0 });
  f.pad.axes[2] = 0.5;
  f.engine.step(0);
  expect(f.c.value(A.Move)).toEqual({ x: 0.5, y: 0 });
  f.c.addBindings(A.Jump, { keys: [KeyCode.Enter] });
  f.engine.step(0);
  expect(f.c.button(A.Jump)).toMatchObject({
    held: true,
    pressCount: 0,
    releaseCount: 0,
  });
  f.engine.dispose();
});
it("does not adopt an already-held newly assigned gamepad button until neutral", () => {
  const f = fixture();
  f.button(1, true);
  f.engine.step(0);
  f.c.rebind(A.Jump, { gamepad: { buttons: [1] } });
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(false);
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(false);
  f.button(1, false);
  f.engine.step(0);
  f.button(1, true);
  f.engine.step(0);
  expect(f.c.pressed(A.Jump)).toBe(true);
  f.engine.dispose();
});
it("keeps explicit legacy gamepad mappings independent and can opt back into common settings", () => {
  const f = fixture();
  f.source.rebind({ Jump: { buttons: [1] } });
  f.engine.step(0);
  f.c.rebind(A.Jump, { gamepad: { buttons: [2] } });
  f.engine.step(0);
  f.button(1, true);
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(true);
  f.button(1, false);
  f.source.rebind();
  f.engine.step(0);
  f.button(2, true);
  f.engine.step(0);
  expect(f.c.value(A.Jump)).toBe(true);
  f.engine.dispose();
});
it("adds/removes nested gamepad controls without resetting existing scalar settings or keyboard bindings", () => {
  const f = fixture();
  const initial = f.c.getBinding(A.Move);
  f.c.rebind(A.Move, {
    ...KeyboardBindings.WASD,
    gamepad: {
      x: { axis: 0, invert: true, negative: [14] },
      y: { axis: 1, deadZone: 0.2 },
    },
  });
  f.c.addBindings(A.Move, { gamepad: { x: { positive: [15] } } });
  expect(f.c.getBinding(A.Move).gamepad).toMatchObject({
    x: { axis: 0, invert: true, negative: [14], positive: [15] },
    y: { axis: 1, deadZone: 0.2 },
  });
  expect(f.c.getBinding(A.Move).x).toEqual(KeyboardBindings.WASD.x);
  f.c.removeBindings(A.Move, { gamepad: { x: { axis: 0, positive: [15] } } });
  expect(f.c.getBinding(A.Move).gamepad?.x?.axis).toBeUndefined();
  expect(f.c.getBinding(A.Move).gamepad?.x?.invert).toBe(true);
  f.c.resetBindings(A.Move);
  expect(f.c.getBinding(A.Move)).toEqual(initial);
  f.engine.dispose();
});
it("roundtrips common version-1 settings atomically and rejects malformed device fields", () => {
  const f = fixture(),
    saved = JSON.parse(JSON.stringify(f.c.exportBindings()));
  f.c.rebind(A.Jump, {});
  f.c.importBindings(saved);
  expect(f.c.exportBindings()).toEqual(saved);
  for (const badBinding of [
    { mouse: [9] },
    { mouse: [0.1] },
    { gamepad: { buttons: [-1] } },
    { gamepad: { buttons: [{ button: 0, threshold: 0 }] } },
    { gamepad: { axis: 0 } },
    { chord: [KeyCode.ShiftLeft, KeyCode.E] },
  ]) {
    const bad = structuredClone(saved);
    bad.bindings.Jump = badBinding;
    expect(() => f.c.importBindings(bad)).toThrow();
    expect(f.c.exportBindings()).toEqual(saved);
  }
  f.engine.dispose();
});
it("still accepts old keyboard-only persisted data with exactly its old normalized shape", () => {
  const engine = new Engine(),
    actions = defineActions({ Run: Action.button() });
  const c = new ActionController(actions, {
    scene: engine.scene,
    input: engine.input,
  });
  const data = {
    version: 1,
    bindings: { Run: { keys: [KeyCode.ShiftLeft, KeyCode.Escape] } },
  };
  c.importBindings(data);
  expect(c.exportBindings()).toEqual(data);
  engine.dispose();
});
it("reports device conflicts without rejecting shared bindings or changing legacy keyboard results", () => {
  const f = fixture();
  f.c.addBindings(A.Jump, { mouse: [MouseButton.Left] });
  const legacy = f.c.conflicts();
  expect(legacy[0]).toMatchObject({ key: KeyCode.Space });
  expect(legacy[0]).not.toHaveProperty("device");
  expect(f.c.conflicts("mouse")[0]).toMatchObject({
    device: "mouse",
    button: MouseButton.Left,
  });
  expect(f.c.conflicts("gamepad")[0]).toMatchObject({
    device: "gamepad",
    kind: "button",
    index: 0,
  });
  expect(f.c.conflicts("all").map((x) => x.device)).toEqual([
    "keyboard",
    "mouse",
    "gamepad",
  ]);
  f.engine.dispose();
});
it("capture gating clears physical holds and queued edges but preserves explicit program values", () => {
  const f = fixture();
  f.program.set(A.Jump, true);
  f.mouse.set(MouseButton.Left, true);
  f.keys.set(KeyCode.Space, true);
  f.engine.step(0);
  let cancelled = 0;
  const release = f.engine.input.suspendLiveInput(() => {
    cancelled++;
  });
  expect(f.engine.input.liveInput).toBe(false);
  expect(f.engine.input.acceptsKey(KeyCode.Space)).toBe(false);
  f.mouse.set(MouseButton.Left, true);
  f.keys.set(KeyCode.Space, true);
  f.button(0, true);
  f.engine.step(0);
  expect(f.c.value(A.Attack)).toBe(false);
  expect(f.c.button(A.Jump)).toMatchObject({
    held: true,
    pressCount: 0,
    releaseCount: 0,
  });
  expect(() => f.engine.input.suspendLiveInput(() => {})).toThrow();
  release();
  release();
  f.engine.step(0);
  expect(f.c.value(A.Attack)).toBe(false);
  f.program.set(A.Jump, false);
  f.engine.step(0);
  expect(f.c.released(A.Jump)).toBe(true);
  expect(cancelled).toBe(0);
  f.engine.dispose();
});
it("global reset and Scene replacement cancel capture safely and leave no input residue", () => {
  const f = fixture();
  let cancelled = 0;
  const release = f.engine.input.suspendLiveInput(() => {
    cancelled++;
    release();
  });
  f.engine.input.clear();
  expect(cancelled).toBe(1);
  expect(f.engine.input.liveInput).toBe(true);
  f.engine.input.suspendLiveInput(() => {
    cancelled++;
  });
  f.engine.activate(new Scene("next"));
  expect(cancelled).toBe(2);
  expect(f.c.disposed).toBe(true);
  f.engine.dispose();
  expect(f.engine.input.sourceCount).toBe(0);
});
