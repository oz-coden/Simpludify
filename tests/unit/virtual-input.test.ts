import {
  Action,
  ActionController,
  CanvasButton,
  CanvasPanel,
  CanvasUI,
  defineActions,
  Engine,
  KeyboardBindings,
  KeyCode,
  PointerDown,
  type PointerInfo,
  PointerRouting,
  Scene,
  ScenePointer,
  screenPoint,
  VirtualInput,
  VirtualRegions,
  VirtualStickMode,
  worldPoint,
} from "@simpludify/core";
import { describe, expect, it, vi } from "vitest";

const Actions = defineActions({
  Move: Action.axis2D(),
  Aim: Action.axis2D(),
  Fire: Action.button(),
});
const left = { kind: "rect", x: 0, y: 0, width: 0.44, height: 1 } as const;
const right = { kind: "rect", x: 0.56, y: 0, width: 0.44, height: 1 } as const;
const info = (
  id: number,
  x: number,
  y: number,
  type = "touch",
  button = 0,
): PointerInfo => ({
  pointerId: id,
  pointerType: type,
  button,
  buttons: 1,
  screen: screenPoint(x, y),
  world: worldPoint(x, y),
  inside: true,
});
function fixture() {
  const engine = new Engine();
  const controls = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
    bindings: { Move: KeyboardBindings.WASD },
  });
  const pointer = new ScenePointer(engine.scene);
  const virtual = new VirtualInput(pointer, engine.input);
  virtual.refresh({ x: 0, y: 0, width: 1000, height: 600 });
  const release = vi.fn(),
    routing = new PointerRouting(release);
  routing.setScene(pointer);
  engine.step(0);
  return {
    engine,
    controls,
    pointer,
    virtual,
    routing,
    release,
    step: () => engine.step(0),
  };
}

describe("virtual gestures through the existing PointerRouting and ActionSource", () => {
  it("keeps two crossing pointers assigned to their starting sticks", () => {
    const f = fixture();
    const move = f.virtual.stick(f.controls, Actions.Move, {
      region: left,
      mode: VirtualStickMode.Floating,
      radius: 50,
      deadZone: 0,
    });
    const aim = f.virtual.stick(f.controls, Actions.Aim, {
      region: right,
      mode: VirtualStickMode.Floating,
      radius: 50,
      deadZone: 0,
    });
    f.routing.down(info(11, 100, 200));
    f.routing.down(info(22, 900, 200));
    f.routing.move(info(11, 900, 200));
    f.routing.move(info(22, 100, 200));
    f.step();
    expect(move.pointerId).toBe(11);
    expect(aim.pointerId).toBe(22);
    expect(f.controls.value(Actions.Move)).toEqual({ x: 1, y: 0 });
    expect(f.controls.value(Actions.Aim)).toEqual({ x: -1, y: 0 });
    f.routing.up(info(11, 900, 200));
    f.step();
    expect(f.controls.value(Actions.Move)).toEqual({ x: 0, y: 0 });
    expect(f.controls.value(Actions.Aim).x).toBe(-1);
    f.routing.cancel(22, false);
    f.step();
    expect(f.controls.value(Actions.Aim)).toEqual({ x: 0, y: 0 });
    expect(f.routing.diagnostics.virtualDrags).toBe(0);
    f.engine.dispose();
  });
  it("normalizes fixed-stick magnitudes radially and rescales its dead zone", () => {
    const f = fixture();
    const s = f.virtual.stick(f.controls, Actions.Move, {
      region: left,
      position: { space: "screen", x: 100, y: 100 },
      radius: 50,
      deadZone: 0.2,
    });
    f.routing.down(info(1, 100, 100, "mouse"));
    f.routing.move(info(1, 110, 100, "mouse"));
    f.step();
    expect(s.value).toEqual({ x: 0, y: 0 });
    f.routing.move(info(1, 130, 100, "mouse"));
    f.step();
    expect(s.value.x).toBeCloseTo(0.5);
    f.routing.move(info(1, 200, 200, "mouse"));
    f.step();
    expect(Math.hypot(s.value.x, s.value.y)).toBeCloseTo(1);
    expect(s.center).toEqual(screenPoint(100, 100));
    expect(Math.hypot(s.knob.x - 100, s.knob.y - 100)).toBeCloseTo(50);
    f.routing.up(info(1, 200, 200, "mouse"));
    f.step();
    expect(s.value).toEqual({ x: 0, y: 0 });
    f.engine.dispose();
  });
  it.each([VirtualStickMode.Floating, VirtualStickMode.Follow])(
    "starts %s at the down point, with explicit radius and follow behavior",
    (mode) => {
      const f = fixture();
      const s = f.virtual.stick(f.controls, Actions.Move, {
        region: left,
        mode,
        radius: 50,
        deadZone: 0,
      });
      f.routing.down(info(1, 50, 80));
      expect(s.center).toEqual(screenPoint(50, 80));
      f.routing.move(info(1, 150, 80));
      f.step();
      expect(s.value).toEqual({ x: 1, y: 0 });
      expect(s.center).toEqual(
        screenPoint(mode === VirtualStickMode.Follow ? 100 : 50, 80),
      );
      f.routing.move(info(1, 100, 80));
      f.step();
      expect(s.value.x).toBe(mode === VirtualStickMode.Follow ? 0 : 1);
      f.engine.dispose();
    },
  );
  it("suppresses a second pointer on an occupied control through physical release", () => {
    const f = fixture();
    const s = f.virtual.stick(f.controls, Actions.Move, {
      region: left,
      mode: VirtualStickMode.Floating,
    });
    const world = vi.fn();
    f.pointer.events.on(PointerDown, world);
    f.routing.down(info(1, 50, 100));
    f.routing.down(info(2, 100, 100));
    expect(f.routing.owns(2)).toBe(true);
    expect(f.routing.has(2)).toBe(false);
    f.routing.up(info(1, 50, 100));
    f.routing.move(info(2, 300, 100));
    expect(s.pressed).toBe(false);
    expect(world).not.toHaveBeenCalled();
    f.routing.up(info(2, 300, 100));
    f.routing.down(info(2, 100, 100));
    expect(s.pointerId).toBe(2);
    f.engine.dispose();
  });
  it("keeps central gaps and secondary mouse buttons in world routing", () => {
    const f = fixture();
    f.virtual.stick(f.controls, Actions.Move, { region: left });
    f.virtual.stick(f.controls, Actions.Aim, { region: right });
    const down = vi.fn();
    f.pointer.events.on(PointerDown, down);
    f.routing.down(info(1, 500, 200));
    f.routing.down(info(2, 100, 200, "mouse", 2));
    expect(down).toHaveBeenCalledTimes(2);
    expect(f.routing.diagnostics.virtualDrags).toBe(0);
    f.engine.dispose();
  });
  it("gives Canvas UI precedence, then virtual buttons, then broad sticks", () => {
    const f = fixture();
    const s = f.virtual.stick(f.controls, Actions.Move, { region: left });
    const b = f.virtual.button(f.controls, Actions.Fire, {
      region: { kind: "circle", space: "screen", x: 200, y: 100, radius: 40 },
    });
    const button = CanvasButton("Native mirror", () => {});
    const ui = new CanvasUI(
      f.engine.scene,
      CanvasPanel([button], { width: 100, height: 80, pointerEvents: "auto" }),
    );
    ui.layout(1000, 600, () => ({ width: 80, height: 44 }));
    f.routing.setScene(f.pointer, ui);
    f.routing.down(info(1, 20, 20));
    f.step();
    expect(s.pressed).toBe(false);
    expect(b.pressed).toBe(false);
    expect(button.held).toBe(true);
    f.routing.down(info(2, 200, 100));
    f.step();
    expect(b.pressed).toBe(true);
    expect(s.pressed).toBe(false);
    expect(f.controls.pressed(Actions.Fire)).toBe(true);
    f.routing.down(info(3, 300, 300));
    expect(s.pressed).toBe(true);
    f.engine.dispose();
  });
  it("supports directionless press, a one-shot long hold, and normal-release confirmation", () => {
    const f = fixture();
    const b = f.virtual.button(f.controls, Actions.Fire, {
      region: VirtualRegions.Left,
      holdDelay: 0.3,
    });
    const hold = vi.fn(),
      end = vi.fn(),
      cancel = vi.fn();
    b.onHold(hold);
    b.onCommit(end);
    b.onCancel(cancel);
    f.routing.down(info(1, 100, 100));
    f.step();
    expect(f.controls.button(Actions.Fire).held).toBe(true);
    expect(b.direction).toEqual({ x: 0, y: 0 });
    f.virtual.advance(0.29);
    expect(hold).not.toHaveBeenCalled();
    f.virtual.advance(0.02);
    f.virtual.advance(1);
    expect(hold).toHaveBeenCalledTimes(1);
    f.routing.move(info(1, 900, 500));
    f.routing.up(info(1, 900, 500));
    f.step();
    expect(end).toHaveBeenCalledTimes(1);
    expect(end.mock.calls[0]?.[0].direction).toEqual({ x: 0, y: 0 });
    expect(cancel).not.toHaveBeenCalled();
    expect(f.controls.released(Actions.Fire)).toBe(true);
    f.engine.dispose();
  });
  it("retains the final optional drag direction in confirmation and does not confirm cancelled drags", () => {
    const f = fixture();
    const b = f.virtual.button(f.controls, Actions.Fire, {
      region: VirtualRegions.Right,
      direction: true,
      radius: 80,
      deadZone: 0,
    });
    const commit = vi.fn(),
      cancel = vi.fn();
    b.onCommit(commit);
    b.onCancel(cancel);
    f.routing.down(info(1, 700, 200));
    f.routing.move(info(1, 740, 200));
    f.routing.up(info(1, 740, 200));
    f.step();
    expect(commit.mock.calls[0]?.[0].direction).toEqual({ x: 0.5, y: 0 });
    expect(b.direction).toEqual({ x: 0, y: 0 });
    f.routing.down(info(2, 700, 200));
    f.routing.move(info(2, 700, 160));
    b.cancel();
    f.step();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(f.routing.has(2)).toBe(false);
    expect(f.routing.owns(2)).toBe(true);
    expect(f.controls.value(Actions.Fire)).toBe(false);
    f.engine.dispose();
  });
  it("separates visibility from enablement and does not revive an interrupted pointer", () => {
    const f = fixture();
    const s = f.virtual.stick(f.controls, Actions.Move, {
      region: left,
      mode: VirtualStickMode.Floating,
    });
    s.visible = false;
    f.virtual.visible = false;
    f.routing.down(info(1, 100, 100));
    f.routing.move(info(1, 200, 100));
    f.step();
    expect(f.controls.value(Actions.Move).x).toBe(1);
    s.enabled = false;
    f.step();
    expect(f.controls.value(Actions.Move).x).toBe(0);
    s.enabled = true;
    f.routing.move(info(1, 200, 100));
    f.step();
    expect(s.pressed).toBe(false);
    f.routing.up(info(1, 200, 100));
    f.routing.down(info(2, 100, 100));
    f.routing.move(info(2, 200, 100));
    f.virtual.enabled = false;
    f.step();
    expect(f.controls.value(Actions.Move).x).toBe(0);
    f.engine.dispose();
  });
  it("composes with keyboard and independent program sources without replacing its reader", () => {
    const f = fixture();
    const reader = f.controls.reader(Actions.Move),
      program = f.controls.createSource(),
      keyboard = f.engine.input.createKeyboardSource();
    const s = f.virtual.stick(f.controls, Actions.Move, {
      region: left,
      mode: VirtualStickMode.Floating,
      deadZone: 0,
    });
    program.set(Actions.Move, { x: -0.25, y: 0 });
    keyboard.set(KeyCode.D, true);
    f.routing.down(info(1, 100, 100));
    f.routing.move(info(1, 50, 100));
    f.step();
    expect(reader.value().x).toBeCloseTo(-0.03125);
    s.enabled = false;
    f.step();
    expect(reader.value().x).toBe(0.75);
    f.controls.keyboardEnabled = false;
    f.step();
    expect(reader.value().x).toBe(-0.25);
    f.engine.dispose();
  });
  it("clears on input resets and Scene replacement without stale button edges or axis values", () => {
    const f = fixture();
    const s = f.virtual.stick(f.controls, Actions.Move, {
      region: left,
      mode: VirtualStickMode.Floating,
    });
    const b = f.virtual.button(f.controls, Actions.Fire, { region: right });
    f.routing.down(info(1, 100, 100));
    f.routing.move(info(1, 200, 100));
    f.routing.down(info(2, 700, 100));
    f.step();
    f.engine.input.clear();
    f.step();
    expect(s.pressed).toBe(false);
    expect(b.pressed).toBe(false);
    expect(f.controls.button(Actions.Fire)).toMatchObject({
      held: false,
      pressed: false,
      released: false,
    });
    f.routing.move(info(1, 200, 100));
    f.step();
    expect(f.controls.value(Actions.Move)).toEqual({ x: 0, y: 0 });
    f.engine.activate(new Scene("next"));
    expect(f.virtual.disposed).toBe(true);
    expect(s.disposed).toBe(true);
    expect(b.disposed).toBe(true);
    expect(f.routing.diagnostics.captures).toBe(0);
    expect(f.engine.input.sourceCount).toBe(0);
    f.engine.dispose();
  });
  it("cancels on geometry changes and rejects an invalid resize atomically", () => {
    const f = fixture();
    const s = f.virtual.stick(f.controls, Actions.Move, {
      region: left,
      mode: VirtualStickMode.Floating,
    });
    f.routing.down(info(1, 100, 100));
    f.routing.move(info(1, 200, 100));
    f.step();
    f.virtual.refresh({ x: 10, y: 20, width: 500, height: 300 });
    f.step();
    expect(s.pressed).toBe(false);
    expect(f.controls.value(Actions.Move).x).toBe(0);
    expect(s.center).toEqual(screenPoint(120, 170));
    const other = f.virtual.stick(f.controls, Actions.Aim, {
      region: {
        kind: "rect",
        space: "screen",
        x: 400,
        y: 20,
        width: 50,
        height: 40,
      },
    });
    expect(() =>
      f.virtual.refresh({ x: 0, y: 0, width: 2000, height: 300 }),
    ).toThrow(/overlap/);
    expect(f.virtual.viewport.width).toBe(500);
    expect(other.disposed).toBe(false);
    f.engine.dispose();
  });
  it("rejects overlapping same-priority regions and leaves configuration/sources untouched", () => {
    const f = fixture();
    const s = f.virtual.stick(f.controls, Actions.Move, { region: left });
    const count = f.engine.input.sourceCount;
    expect(() =>
      f.virtual.stick(f.controls, Actions.Aim, { region: VirtualRegions.Left }),
    ).toThrow(/overlap/);
    expect(f.engine.input.sourceCount).toBe(count);
    const other = f.virtual.stick(f.controls, Actions.Aim, { region: right });
    expect(() => {
      other.region = left;
    }).toThrow(/overlap/);
    expect(other.region).toEqual(right);
    expect(s.disposed).toBe(false);
    f.engine.dispose();
  });
  it("uses exact circle/rectangle intersections and conservative custom bounds", () => {
    const f = fixture();
    f.virtual.stick(f.controls, Actions.Move, {
      region: { kind: "circle", space: "screen", x: 100, y: 100, radius: 50 },
    });
    const other = f.virtual.stick(f.controls, Actions.Aim, {
      region: {
        kind: "rect",
        space: "screen",
        x: 150,
        y: 50,
        width: 100,
        height: 100,
      },
    });
    expect(() => {
      other.region = {
        kind: "circle",
        space: "screen",
        x: 199,
        y: 100,
        radius: 50,
      };
    }).toThrow(/overlap/);
    expect(() => {
      other.region = {
        kind: "custom",
        bounds: () => ({ x: 100, y: 100, width: 100, height: 100 }),
        contains: () => false,
      };
    }).toThrow(/overlap/);
    f.engine.dispose();
  });
  it("refreshes custom layout bounds, restricts predicates to those bounds, and cancels changed layouts", () => {
    const f = fixture();
    let x = 0;
    const custom = {
      kind: "custom",
      bounds: () => ({ x, y: 0, width: 100, height: 100 }),
      contains: () => true,
    } as const;
    const s = f.virtual.stick(f.controls, Actions.Move, {
      region: custom,
      mode: VirtualStickMode.Floating,
    });
    f.routing.down(info(1, 50, 50));
    expect(s.pressed).toBe(true);
    x = 200;
    f.virtual.refresh();
    expect(s.pressed).toBe(false);
    f.routing.down(info(2, 150, 50));
    expect(s.pressed).toBe(false);
    f.routing.down(info(3, 250, 50));
    expect(s.pressed).toBe(true);
    f.engine.dispose();
  });
  it("retains cleanup after callback failure and permits cancellation/disposal from callbacks", () => {
    const f = fixture();
    const b = f.virtual.button(f.controls, Actions.Fire, { region: right });
    const changed = vi.fn();
    b.onStart(() => b.cancel());
    b.onChange(changed);
    f.routing.down(info(1, 700, 200));
    f.step();
    expect(changed).not.toHaveBeenCalled();
    expect(f.controls.value(Actions.Fire)).toBe(false);
    const s = f.virtual.stick(f.controls, Actions.Move, { region: left });
    s.onCancel(() => {
      throw Error("observer");
    });
    f.routing.down(info(2, 100, 100));
    expect(() => f.routing.release()).toThrow();
    f.step();
    expect(f.controls.value(Actions.Move)).toEqual({ x: 0, y: 0 });
    expect(f.routing.diagnostics.virtualDrags).toBe(0);
    f.engine.dispose();
  });
  it("rejects invalid action kinds, cross-Scene controllers and duplicate providers before allocation", () => {
    const f = fixture();
    const foreign = new ActionController(Actions, {
      scene: new Scene("foreign"),
      input: f.engine.input,
    });
    const count = f.engine.input.sourceCount;
    expect(() =>
      f.virtual.stick(foreign, Actions.Move, { region: left }),
    ).toThrow(/own Scene/);
    expect(() => new VirtualInput(f.pointer, f.engine.input)).toThrow(
      /already/,
    );
    expect(() =>
      f.virtual.stick(f.controls, Actions.Move, { region: left, radius: 0 }),
    ).toThrow();
    expect(() =>
      f.virtual.stick(f.controls, Actions.Move, { region: left, deadZone: 1 }),
    ).toThrow();
    expect(f.engine.input.sourceCount).toBe(count);
    foreign.dispose();
    f.engine.dispose();
  });
});
