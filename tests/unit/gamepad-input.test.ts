import {
  Action,
  ActionController,
  Character,
  defineActions,
  Engine,
  KeyboardBindings,
  KeyCode,
  ReplayPlayer,
  ReplayRecorder,
  Scene,
  Transform,
} from "@simpludify/core";
import { expect, it, vi } from "vitest";
import {
  GamepadBindings,
  GamepadButton,
} from "../../packages/web/src/gamepad-bindings";
import { gamepadButtonLabel } from "../../packages/web/src/gamepad-layout";
import { GamepadInput } from "../../packages/web/src/gamepads";

const Actions = defineActions({
  Move: Action.axis2D(),
  Fire: Action.button(),
  Trigger: Action.axis1D(),
  Aim: Action.axis3D(),
  Pause: Action.button(),
});
function pad(index = 0, id = "Xbox test", mapping = "standard") {
  return {
    id,
    index,
    mapping,
    connected: true,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
  };
}
function fixture(start = true) {
  const engine = new Engine({ seed: 12 });
  const a = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings: { Move: KeyboardBindings.WASD, Fire: { keys: [KeyCode.Space] } },
  });
  const b = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    keyboard: false,
  });
  const first = pad(),
    second = pad(1, "DualSense test");
  let snapshots: (ReturnType<typeof pad> | null)[] = [first, second],
    allowed = true,
    failed = false;
  const poll = vi.fn(() => {
    if (failed) throw new Error("denied");
    return snapshots;
  });
  const events = new EventTarget();
  const gamepads = new GamepadInput(engine.input, {
    poll,
    active: () => allowed,
    events,
  });
  const bindings = {
    Move: GamepadBindings.Move,
    Fire: { buttons: [GamepadButton.South] },
    Trigger: { positive: [GamepadButton.RightTrigger], deadZone: 0 },
    Aim: { z: { axis: 3, invert: true, deadZone: 0 } },
    Pause: { buttons: [GamepadButton.Start] },
  };
  const one = gamepads.bind(a, { index: 0, bindings, deadZone: 0.2 });
  const two = gamepads.bind(b, { index: 1, bindings, deadZone: 0.2 });
  const button = (p: ReturnType<typeof pad>, index: number, value: number) => {
    p.buttons[index] = { value, pressed: value >= 0.5 };
  };
  const event = (type: string, p: ReturnType<typeof pad>) => {
    const e = new Event(type);
    Object.defineProperty(e, "gamepad", { value: p });
    events.dispatchEvent(e);
  };
  if (start) engine.step(0);
  return {
    engine,
    a,
    b,
    first,
    second,
    gamepads,
    one,
    two,
    poll,
    button,
    event,
    set snapshots(v: typeof snapshots) {
      snapshots = v;
    },
    set allowed(v: boolean) {
      allowed = v;
    },
    set failed(v: boolean) {
      failed = v;
    },
  };
}
it("gates logical and keyboard sources, retaining frozen frames and ordinary release edges", () => {
  const f = fixture(),
    source = f.a.createSource(),
    keys = f.engine.input.createKeyboardSource();
  source.set(Actions.Fire, true);
  source.set(Actions.Move, { x: 1, y: 0 });
  f.engine.step(0);
  source.enabled = false;
  expect(f.a.value(Actions.Fire)).toBe(true);
  source.set(Actions.Fire, true);
  f.engine.step(0);
  expect(f.a.button(Actions.Fire)).toMatchObject({
    held: false,
    released: true,
  });
  expect(f.a.value(Actions.Move)).toEqual({ x: 0, y: 0 });
  source.enabled = true;
  f.engine.step(0);
  expect(f.a.pressed(Actions.Fire)).toBe(false);
  source.set(Actions.Fire, true);
  source.enabled = false;
  source.enabled = true;
  f.engine.step(0);
  expect(f.a.button(Actions.Fire)).toMatchObject({
    held: false,
    pressCount: 1,
    releaseCount: 1,
  });
  keys.set(KeyCode.Space, true);
  f.engine.step(0);
  keys.enabled = false;
  f.engine.step(0);
  expect(f.a.released(Actions.Fire)).toBe(true);
  keys.set(KeyCode.Space, true);
  keys.enabled = true;
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  keys.set(KeyCode.Space, true);
  f.engine.step(0);
  expect(f.a.pressed(Actions.Fire)).toBe(true);
  f.engine.dispose();
  expect(source.disposed).toBe(true);
  expect(keys.disposed).toBe(true);
  expect(() => {
    source.enabled = true;
  }).toThrow();
});
it("isolates per-controller keyboard routing and requires a fresh held key after re-enable", () => {
  const f = fixture(),
    keys = f.engine.input.createKeyboardSource();
  f.b.rebind(Actions.Fire, { keys: [KeyCode.Space] });
  keys.set(KeyCode.Space, true);
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(true);
  expect(f.b.value(Actions.Fire)).toBe(false);
  f.b.keyboardEnabled = true;
  f.a.keyboardEnabled = false;
  f.engine.step(0);
  expect(f.a.released(Actions.Fire)).toBe(true);
  expect(f.b.value(Actions.Fire)).toBe(false);
  keys.set(KeyCode.Space, false);
  keys.set(KeyCode.Space, true);
  f.engine.step(0);
  expect(f.b.pressed(Actions.Fire)).toBe(true);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.a.keyboardEnabled = true;
  keys.set(KeyCode.Space, false);
  keys.set(KeyCode.Space, true);
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(true);
  expect(f.b.value(Actions.Fire)).toBe(true);
  f.engine.dispose();
});
it("samples once before every controller freezes; keyboard, pad and program contributions share one reader", () => {
  const f = fixture(),
    program = f.a.createSource(),
    keys = f.engine.input.createKeyboardSource();
  const actor = f.engine.scene.add(
    Character({ movement: f.a.reader(Actions.Move) }),
  );
  const identity = actor.require(Transform.type);
  const calls = f.poll.mock.calls.length;
  f.first.axes[0] = 0.6;
  f.second.axes[1] = -1;
  program.set(Actions.Move, { x: 0.1, y: 0 });
  keys.set(KeyCode.D, true);
  f.button(f.first, GamepadButton.South, 1);
  f.a.onPressed(Actions.Fire, () => {
    expect(f.b.value(Actions.Move)).toEqual({ x: 0, y: -1 });
    program.set(Actions.Move, { x: -1, y: 0 });
  });
  f.engine.step(0.1);
  expect(f.poll.mock.calls.length - calls).toBe(1);
  expect(f.a.value(Actions.Move)).toEqual({ x: 1, y: 0 });
  expect(actor.require(Transform.type)).toBe(identity);
  f.one.enabled = false;
  f.a.keyboardEnabled = false;
  program.set(Actions.Move, { x: -1, y: 0 });
  const x = identity.x;
  f.engine.step(0.1);
  expect(identity.x).toBeLessThan(x);
  expect(f.b.value(Actions.Move)).toEqual({ x: 0, y: -1 });
  f.engine.dispose();
});
it("normalizes analog axes, DPad, triggers and thresholds without losing sub-unit magnitudes", () => {
  const f = fixture();
  f.first.axes = [0.6, -0.2, NaN, 0.25];
  f.button(f.first, 7, 0.3);
  f.engine.step(0);
  expect(f.a.value(Actions.Move).x).toBeCloseTo(0.5);
  expect(f.a.value(Actions.Move).y).toBe(0);
  expect(f.a.value(Actions.Trigger)).toBe(0.3);
  expect(f.a.value(Actions.Aim)).toEqual({ x: 0, y: 0, z: -0.25 });
  f.button(f.first, 15, 1);
  f.button(f.first, 13, 1);
  f.engine.step(0);
  expect(
    Math.hypot(f.a.value(Actions.Move).x, f.a.value(Actions.Move).y),
  ).toBeCloseTo(1);
  f.one.rebind({ Fire: { buttons: [{ button: 7, threshold: 0.7 }] } });
  f.button(f.first, 7, 0);
  f.engine.step(0);
  f.button(f.first, 7, 0.6);
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.button(f.first, 7, 0.8);
  f.engine.step(0);
  expect(f.a.pressed(Actions.Fire)).toBe(true);
  f.engine.dispose();
});
it("releases disconnects immediately and ignores stale event snapshots until safe reconnection", () => {
  const f = fixture();
  f.first.axes[0] = 1;
  f.button(f.first, 0, 1);
  f.engine.step(0);
  f.event("gamepaddisconnected", f.first);
  expect(f.one.connected).toBe(false);
  f.engine.step(0);
  expect(f.a.released(Actions.Fire)).toBe(true);
  expect(f.a.value(Actions.Move).x).toBe(0);
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.event("gamepadconnected", f.first);
  f.snapshots = [null, f.second];
  f.engine.step(0);
  expect(f.one.connected).toBe(false);
  f.snapshots = [f.first, f.second];
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.first.axes[0] = 0;
  f.button(f.first, 0, 0);
  f.engine.step(0);
  f.button(f.first, 0, 1);
  f.engine.step(0);
  expect(f.a.pressed(Actions.Fire)).toBe(true);
  f.engine.dispose();
});
it("detects polled removal, changed identities, missing API and focus interruptions without event dependence", () => {
  const f = fixture();
  f.button(f.first, 0, 1);
  f.engine.step(0);
  f.failed = true;
  f.engine.step(0);
  expect(f.gamepads.available).toBe(false);
  expect(f.a.released(Actions.Fire)).toBe(true);
  f.failed = false;
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.button(f.first, 0, 0);
  f.engine.step(0);
  f.button(f.first, 0, 1);
  f.engine.step(0);
  expect(f.a.pressed(Actions.Fire)).toBe(true);
  f.allowed = false;
  f.engine.step(0);
  expect(f.a.released(Actions.Fire)).toBe(true);
  f.allowed = true;
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.first.id = "Replacement";
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.snapshots = [null];
  f.engine.step(0);
  expect(f.gamepads.devices).toEqual([]);
  f.engine.dispose();
});
it("keeps players isolated, supports deliberate fan-out and reassigns devices without resetting Actors", () => {
  const f = fixture(),
    shared = f.gamepads.bind(f.a, {
      index: 1,
      bindings: { Fire: { buttons: [0] } },
    });
  f.engine.step(0);
  f.button(f.first, 0, 1);
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(true);
  expect(f.b.value(Actions.Fire)).toBe(false);
  f.button(f.second, 0, 1);
  f.engine.step(0);
  f.one.assign(1);
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(true);
  shared.dispose();
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  expect(f.b.value(Actions.Fire)).toBe(true);
  f.button(f.second, 0, 0);
  f.engine.step(0);
  f.button(f.second, 0, 1);
  f.engine.step(0);
  expect(f.a.pressed(Actions.Fire)).toBe(true);
  f.one.enabled = false;
  f.engine.step(0);
  expect(f.a.released(Actions.Fire)).toBe(true);
  expect(f.b.value(Actions.Fire)).toBe(true);
  f.one.enabled = true;
  f.engine.step(0);
  expect(f.a.value(Actions.Fire)).toBe(false);
  f.engine.dispose();
});
it("requires neutral after pause/resume but permits a fresh gamepad pause action to resume", () => {
  const f = fixture();
  let toggles = 0;
  f.a.onPressed(Actions.Pause, () => {
    toggles++;
    f.engine.paused ? f.engine.resume() : f.engine.pause();
  });
  f.first.axes[0] = 1;
  f.button(f.first, 9, 1);
  f.engine.step(0);
  expect(f.engine.paused).toBe(true);
  f.engine.step(0);
  expect(toggles).toBe(1);
  f.first.axes[0] = 0;
  f.button(f.first, 9, 0);
  f.engine.step(0);
  f.button(f.first, 9, 1);
  f.engine.step(0);
  expect(f.engine.paused).toBe(false);
  expect(toggles).toBe(2);
  f.engine.step(0);
  expect(toggles).toBe(2);
  f.engine.dispose();
});
it("keeps raw nonstandard mapping opt-in and preserves browser facts independently of inferred labels", () => {
  const f = fixture();
  f.first.mapping = "";
  f.first.index = 7;
  f.snapshots = [null, f.first];
  f.one.assign(7);
  f.first.axes[0] = 1;
  f.engine.step(0);
  expect(f.one.connected).toBe(true);
  expect(f.one.usable).toBe(false);
  expect(f.a.value(Actions.Move).x).toBe(0);
  const raw = f.gamepads.bind(f.b, {
    index: 7,
    mapping: "raw",
    deadZone: 0,
    bindings: { Move: { x: { axis: 0 } } },
  });
  f.first.axes[0] = 0;
  f.engine.step(0);
  f.first.axes[0] = 1;
  f.engine.step(0);
  expect(f.b.value(Actions.Move).x).toBe(1);
  expect(raw.info).toMatchObject({
    id: "Xbox test",
    index: 7,
    mapping: "",
    standardMapping: false,
    buttonCount: 17,
    axisCount: 4,
    inferredLayout: "xbox",
  });
  for (const [layout, expected] of [
    ["xbox", ["A", "B", "X", "Y"]],
    ["playstation", ["×", "○", "□", "△"]],
    ["nintendo", ["B", "A", "Y", "X"]],
  ] as const)
    expect(
      [0, 1, 2, 3].map((button) => gamepadButtonLabel(button, { layout })),
    ).toEqual(expected);
  expect(gamepadButtonLabel(0)).toBe("South");
  expect(gamepadButtonLabel(99)).toBe("Button 99");
  expect(gamepadButtonLabel(0, { overrides: { 0: "Confirm" } })).toBe(
    "Confirm",
  );
  expect(() =>
    gamepadButtonLabel(0, { layout: "toString" as never }),
  ).toThrow();
  f.engine.dispose();
});
it("validates bindings atomically, rejects cross-Engine assignment and releases every lifetime", () => {
  const f = fixture(),
    other = new Engine(),
    c = new ActionController(Actions, {
      scene: other.scene,
      input: other.input,
    });
  const count = f.engine.input.sourceCount;
  for (const bindings of [
    { Move: { x: { axis: -1 } } },
    { Fire: { buttons: [{ button: 0, threshold: 0 }] } },
    { Trigger: { deadZone: 1 } },
    { Move: { z: { axis: 0 } } },
    { unknown: {} },
  ])
    expect(() =>
      f.gamepads.bind(f.a, { index: 0, bindings: bindings as never }),
    ).toThrow();
  expect(f.engine.input.sourceCount).toBe(count);
  expect(() => f.gamepads.bind(c, { index: 0, bindings: {} })).toThrow();
  expect(() => f.one.assign(-1)).toThrow();
  expect(f.one.index).toBe(0);
  f.one.dispose();
  expect(f.engine.input.sourceCount).toBe(count - 1);
  const next = new Scene("replacement");
  f.engine.activate(next);
  expect(f.two.disposed).toBe(true);
  f.engine.dispose();
  expect(f.gamepads.disposed).toBe(true);
  other.dispose();
});
it("records the composed frames and excludes live gamepad polling during Replay playback", () => {
  const f = fixture(false),
    recorder = new ReplayRecorder(f.engine, {
      controllers: { a: f.a, b: f.b },
    });
  f.engine.step(0);
  f.first.axes[0] = 0.6;
  f.button(f.first, 0, 1);
  f.engine.step(0.1);
  f.button(f.first, 0, 0);
  f.engine.step(0.1);
  const data = recorder.finish();
  const p = fixture(false),
    player = new ReplayPlayer(p.engine, data, {
      controllers: { a: p.a, b: p.b },
    });
  p.first.axes[0] = -1;
  p.button(p.first, 0, 1);
  while (!player.done) player.step();
  expect(p.poll).not.toHaveBeenCalled();
  expect(p.a.frame()).toEqual(f.a.frame());
  player.dispose();
  p.engine.step(0);
  expect(p.a.value(Actions.Move).x).toBe(0);
  f.engine.dispose();
  p.engine.dispose();
});

it("notifies device facts only when they change and scopes observers to their owner", () => {
  const f = fixture(),
    owner = new Scene("observer"),
    changed = vi.fn();
  f.gamepads.onChange(changed, owner);
  f.engine.step(0);
  expect(changed).not.toHaveBeenCalled();
  f.first.id = "Unknown pad";
  f.engine.step(0);
  expect(changed).toHaveBeenCalledTimes(1);
  expect(f.one.info?.inferredLayout).toBe("generic");
  owner.dispose();
  f.first.id = "Xbox again";
  f.engine.step(0);
  expect(changed).toHaveBeenCalledTimes(1);
  f.engine.dispose();
});
it("keeps absent and malformed providers safe and neutral", () => {
  const engine = new Engine(),
    input = new GamepadInput(engine.input, { poll: () => null as never });
  engine.step(0);
  expect(input.available).toBe(false);
  expect(input.devices).toEqual([]);
  engine.dispose();
  expect(input.disposed).toBe(true);
});
