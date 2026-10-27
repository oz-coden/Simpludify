import {
  Action,
  ActionController,
  ActionMovement,
  Actor,
  Character,
  Component,
  type ComponentType,
  defineActions,
  defineComponent,
  Engine,
  KeyboardBindings,
  KeyCode,
  Motion,
  Scene,
} from "@simpludify/core";
import { expect, it } from "vitest";

const Actions = defineActions({
  Steer: Action.axis2D(),
  Fire: Action.button(),
});
function setup() {
  const engine = new Engine();
  const controls = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings: { Steer: KeyboardBindings.WASD, Fire: { keys: [KeyCode.Space] } },
  });
  return { engine, controls };
}
it("shares a read-only Action between Components without consuming edges", () => {
  const { engine, controls } = setup(),
    calls: boolean[] = [];
  class Reader extends Component {
    static readonly type: ComponentType<Reader> =
      defineComponent<Reader>("Reader");
    readonly type: ComponentType<Reader> = Reader.type;
    update() {
      calls.push(controls.pressed(Actions.Fire));
    }
  }
  for (let i = 0; i < 2; i++) engine.scene.add(new Actor()).add(new Reader());
  const source = controls.createSource();
  source.set(Actions.Fire, true);
  source.set(Actions.Fire, false);
  engine.step(0);
  engine.step(0);
  expect(calls).toEqual([true, true, false, false]);
  engine.dispose();
});
it("applies remapped keys to Character and releases movement on Component removal", () => {
  const { engine, controls } = setup();
  const reader = controls.reader(Actions.Steer);
  const player = engine.scene.add(
    Character({ x: 0, y: 0, speed: 10, movement: reader }),
  );
  const device = engine.input.createKeyboardSource();
  device.set(KeyCode.D, true);
  engine.step(1);
  expect(player.x).toBe(10);
  controls.rebind(Actions.Steer, { y: { negative: [KeyCode.I] } });
  engine.step(1);
  expect(player.x).toBe(10);
  device.set(KeyCode.I, true);
  engine.step(1);
  expect(player.y).toBe(-10);
  player.remove(ActionMovement.type);
  expect(player.require(Motion.type).direction).toEqual({ x: 0, y: 0 });
  engine.step(1);
  expect(player.y).toBe(-10);
  engine.dispose();
});
it("stops a surviving movement Component after its Action controller is disposed", () => {
  const { engine, controls } = setup(),
    player = engine.scene.add(
      Character({ x: 0, movement: controls.reader(Actions.Steer) }),
    );
  controls.createSource().set(Actions.Steer, { x: 1, y: 0 });
  engine.step(1);
  const x = player.x;
  controls.dispose();
  expect(() => engine.step(1)).not.toThrow();
  expect(player.x).toBe(x);
  engine.dispose();
});
it("diagnoses cross-Scene Action injection instead of reading stale Scene state", () => {
  const { engine, controls } = setup(),
    next = new Scene("next");
  next.add(Character({ movement: controls.reader(Actions.Steer) }));
  engine.activate(next);
  expect(() => engine.step(1)).toThrow(/another Scene/);
  engine.dispose();
});
it("freezes every controller before callbacks and retains device writes for the next boundary", () => {
  const { engine, controls } = setup();
  const other = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings: { Fire: { keys: [KeyCode.Enter] } },
  });
  const device = engine.input.createKeyboardSource();
  controls.onPressed(Actions.Fire, () => device.set(KeyCode.Enter, true));
  device.set(KeyCode.Space, true);
  engine.step(0);
  expect(other.value(Actions.Fire)).toBe(false);
  engine.step(0);
  expect(other.pressed(Actions.Fire)).toBe(true);
  engine.dispose();
});
it("releases a keyboard atomically without transient events when another keyboard holds aliases", () => {
  const { engine, controls } = setup();
  controls.addBindings(Actions.Fire, { keys: [KeyCode.Enter] });
  const a = engine.input.createKeyboardSource(engine.scene),
    b = engine.input.createKeyboardSource();
  a.set(KeyCode.Space, true);
  a.set(KeyCode.Enter, true);
  b.set(KeyCode.Space, true);
  engine.step(0);
  a.dispose();
  engine.step(0);
  expect(controls.button(Actions.Fire)).toMatchObject({
    held: true,
    released: false,
    pressed: false,
  });
  b.dispose();
  engine.step(0);
  expect(controls.button(Actions.Fire).releaseCount).toBe(1);
  engine.dispose();
});
it("does not allocate new continuous Action vectors when there is no input change", () => {
  const { engine, controls } = setup();
  controls.createSource().set(Actions.Steer, { x: 0.2, y: 0.3 });
  engine.step(0);
  const frame = controls.value(Actions.Steer);
  for (let i = 0; i < 100; i++) engine.step(0);
  expect(controls.value(Actions.Steer)).toBe(frame);
  engine.dispose();
});
it("does not expose legacy raw-state or keyboard movement APIs", async () => {
  const api = await import("@simpludify/core");
  for (const name of [
    "InputState",
    "InputSource",
    "InputReader",
    "KeyMap",
    "KeyMaps",
    "Movement",
    "KeyboardController",
  ])
    expect(Object.hasOwn(api, name)).toBe(false);
  const { engine } = setup();
  expect("set" in engine.input).toBe(false);
  expect("capture" in engine.input).toBe(false);
  engine.dispose();
});
it("rejects malformed physical keys at the adapter boundary", () => {
  const { engine } = setup(),
    source = engine.input.createKeyboardSource();
  expect(() => source.set("Invalid" as KeyCode, true)).toThrow(/code/);
  expect(engine.input.snapshot()).toEqual([]);
  engine.dispose();
});

it("captures an already-held device key when a controller is added to the active Scene", () => {
  const engine = new Engine();
  engine.step(0);
  const device = engine.input.createKeyboardSource();
  device.set(KeyCode.Space, true);
  const controls = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings: { Fire: { keys: [KeyCode.Space] } },
  });
  engine.step(0);
  expect(controls.pressed(Actions.Fire)).toBe(true);
  expect(controls.value(Actions.Fire)).toBe(true);
  engine.dispose();
});
