import {
  Action,
  ActionController,
  defineActions,
  Engine,
  Scene,
  screenPoint,
  worldPoint,
} from "@simpludify/core";
import { expect, it } from "vitest";
import {
  PointerCancel,
  PointerClick,
  PointerDown,
  PointerEnter,
  type PointerInfo,
  PointerLeave,
  PointerMove,
  PointerRouting,
  PointerUp,
  ScenePointer,
} from "../../packages/core/src/interaction/pointer-routing";
import {
  CanvasButton,
  CanvasHoldButton,
  CanvasPanel,
} from "../../packages/core/src/ui/canvas-node";
import { CanvasUI } from "../../packages/core/src/ui/canvas-ui";

const data = (id = 1, x = 10, y = 10, inside = true): PointerInfo => ({
  pointerId: id,
  pointerType: "touch",
  button: 0,
  buttons: 1,
  screen: screenPoint(x, y),
  world: worldPoint(x + 500, y + 300),
  inside,
});
function fixture() {
  const scene = new Scene("ui"),
    holds: boolean[] = [],
    clicks: string[] = [];
  const button = CanvasHoldButton("hold", (v) => holds.push(v), {
    width: 80,
    height: 40,
  });
  const click = CanvasButton(
    "click",
    () => {
      clicks.push("clicked");
    },
    { width: 80, height: 40 },
  );
  const ui = new CanvasUI(
    scene,
    CanvasPanel([button, click], { gap: 10, align: "start" }),
  );
  ui.layout(300, 200, () => ({ width: 30, height: 20 }));
  const channel = new ScenePointer(scene),
    released: number[] = [],
    routing = new PointerRouting((id) => released.push(id));
  routing.setScene(channel, ui);
  return {
    scene,
    ui,
    button,
    click,
    channel,
    routing,
    released,
    holds,
    clicks,
  };
}
it("locks UI ownership across outside movement and release; never leaks to world", () => {
  const f = fixture(),
    uiEvents: string[] = [],
    world: string[] = [];
  for (const [type, label] of [
    [PointerDown, "down"],
    [PointerMove, "move"],
    [PointerUp, "up"],
    [PointerClick, "click"],
  ] as const) {
    f.button.events.on(type, () => uiEvents.push(label));
    f.channel.events.on(type, () => world.push(label));
  }
  f.routing.down(data());
  f.routing.move(data(1, 200, 150));
  f.routing.up(data(1, 200, 150));
  expect(uiEvents).toEqual(["down", "move", "up"]);
  expect(world).toEqual([]);
  expect(f.holds).toEqual([true, false]);
  expect(f.released).toEqual([1]);
});
it("locks world ownership when dragged over an interactive UI target", () => {
  const f = fixture(),
    world: string[] = [];
  for (const [type, label] of [
    [PointerDown, "down"],
    [PointerMove, "move"],
    [PointerUp, "up"],
    [PointerClick, "click"],
  ] as const)
    f.channel.events.on(type, () => world.push(label));
  f.routing.down(data(1, 200, 150));
  f.routing.move(data());
  f.routing.up(data());
  expect(world).toEqual(["down", "move", "up", "click"]);
  expect(f.holds).toEqual([]);
});
it("keeps multiple pointers and keyboard contributions held independently", () => {
  const f = fixture();
  f.routing.down(data(1));
  f.routing.down(data(2));
  f.routing.key(f.button, "Space", true);
  f.routing.up(data(1));
  f.routing.cancel(2);
  expect(f.holds).toEqual([true]);
  f.routing.key(f.button, "Space", false);
  expect(f.holds).toEqual([true, false]);
  expect(f.routing.diagnostics.captures).toBe(0);
});
it("clicks only on release inside original clipped target", () => {
  const f = fixture();
  f.routing.down(data(1, 20, 60));
  f.routing.up(data(1, 20, 60));
  f.routing.down(data(1, 20, 60));
  f.routing.up(data(1, 200, 150));
  expect(f.clicks).toEqual(["clicked"]);
});
it("routes hover enter/leave without stealing an existing gesture", () => {
  const f = fixture(),
    events: string[] = [];
  f.button.events.on(PointerEnter, () => events.push("enter"));
  f.button.events.on(PointerLeave, () => events.push("leave"));
  f.routing.move(data());
  f.routing.move(data());
  f.routing.move(data(1, 200, 150));
  expect(events).toEqual(["enter", "leave"]);
  f.routing.down(data(1, 200, 150));
  f.routing.move(data());
  expect(events).toEqual(["enter", "leave"]);
});
it("cancels on disabled/hidden ancestor and never retargets that pointer", () => {
  const f = fixture(),
    events: string[] = [];
  f.button.events.on(PointerCancel, () => events.push("cancel"));
  f.routing.down(data());
  f.ui.root.enabled = false;
  f.routing.up(data(1, 200, 150));
  expect(f.holds).toEqual([true, false]);
  expect(events).toEqual(["cancel"]);
  expect(f.routing.diagnostics.captures).toBe(0);
});
it("releases disposed targets before event buses/sources vanish and suppresses follow-up", () => {
  const f = fixture();
  let after = 0;
  f.button.events.on(PointerDown, () => f.button.dispose());
  f.button.events.on(PointerDown, () => after++);
  f.routing.down(data());
  f.routing.up(data());
  expect(after).toBe(0);
  expect(f.holds).toEqual([true, false]);
  expect(f.routing.diagnostics.captures).toBe(0);
});
it("Scene replacement cancels holds, capture and hover before new input", () => {
  const f = fixture();
  f.routing.down(data());
  f.routing.move(data(2));
  f.scene.dispose();
  expect(f.holds).toEqual([true, false]);
  expect(f.routing.diagnostics).toMatchObject({
    captures: 0,
    hoverPointers: 0,
    heldNodes: 0,
  });
  const next = new ScenePointer(new Scene("next"));
  f.routing.setScene(next);
  let received = 0;
  next.events.on(PointerDown, () => received++);
  f.routing.down(data());
  expect(received).toBe(1);
});
it("continues cancel cleanup after a throwing user hold callback", () => {
  const scene = new Scene("error"),
    b = CanvasHoldButton(
      "bad",
      (v) => {
        if (!v) throw Error("release");
      },
      { width: 100, height: 40 },
    );
  const ui = new CanvasUI(scene, CanvasPanel([b]));
  ui.layout(300, 200, () => ({ width: 10, height: 10 }));
  const r = new PointerRouting();
  r.setScene(new ScenePointer(scene), ui);
  r.down(data());
  expect(() => r.reset()).toThrow();
  expect(r.diagnostics).toMatchObject({ captures: 0, heldNodes: 0 });
});
it("uses existing Action capture, source union, short-tap and pause semantics", () => {
  const e = new Engine(),
    A = defineActions({ Fire: Action.button() }),
    c = new ActionController(A, { scene: e.scene, input: e.input });
  const automatic = c.createSource(),
    s = c.createSource(),
    b = CanvasHoldButton("fire", (v) => s.set(A.Fire, v), {
      width: 80,
      height: 40,
    });
  const ui = new CanvasUI(e.scene, CanvasPanel([b]));
  ui.layout(300, 200, () => ({ width: 10, height: 10 }));
  const r = new PointerRouting();
  r.setScene(new ScenePointer(e.scene), ui);
  e.step(0);
  r.down(data());
  r.up(data());
  e.step(0);
  expect(c.button(A.Fire)).toMatchObject({
    held: false,
    pressed: true,
    released: true,
  });
  automatic.set(A.Fire, true);
  r.down(data());
  e.step(0);
  r.cancel(1);
  e.step(0);
  expect(c.button(A.Fire)).toMatchObject({ held: true, released: false });
  automatic.clear();
  e.step(0);
  expect(c.released(A.Fire)).toBe(true);
  r.down(data());
  e.pause();
  e.step(0);
  expect(c.value(A.Fire)).toBe(false);
  r.up(data());
  e.resume();
  e.step(0);
  expect(c.pressed(A.Fire)).toBe(false);
  e.dispose();
});
it("does not route outside-viewport world downs but still permits screen UI in bars", () => {
  const f = fixture();
  f.routing.down(data(1, 200, 150, false));
  expect(f.routing.has(1)).toBe(false);
  f.routing.down(data(2, 10, 10, false));
  expect(f.routing.has(2)).toBe(true);
  expect(f.holds).toEqual([true]);
});
it("snapshots coordinate payloads without returning mutable DOM objects", () => {
  const f = fixture();
  let payload: PointerInfo | undefined;
  f.button.events.on(PointerDown, (e) => {
    payload = e;
  });
  f.routing.down(data());
  expect(payload?.world).toEqual(worldPoint(510, 310));
  expect(payload?.screen).toEqual(screenPoint(10, 10));
  expect(Object.isFrozen(payload)).toBe(true);
});
it("does not transfer a canceled gesture to the world or a replacement Scene before release", () => {
  const f = fixture(),
    world: string[] = [];
  f.routing.down(data());
  f.button.enabled = false;
  f.channel.events.on(PointerMove, () => world.push("move"));
  f.channel.events.on(PointerUp, () => world.push("up"));
  f.routing.move(data(1, 200, 150));
  expect(world).toEqual([]);
  f.routing.setScene(new ScenePointer(new Scene("next")));
  expect(f.routing.diagnostics.suppressedPointers).toBe(1);
  f.routing.move(data(1, 200, 150));
  f.routing.up(data(1, 200, 150));
  expect(f.routing.diagnostics.suppressedPointers).toBe(0);
});
it("secondary mouse buttons never activate or hold a UI button", () => {
  const f = fixture(),
    right = { ...data(1, 20, 60), button: 2, buttons: 2 };
  f.routing.down(right);
  f.routing.up(right);
  expect(f.clicks).toEqual([]);
  f.routing.down({ ...right, screen: screenPoint(10, 10) });
  f.routing.up({ ...right, screen: screenPoint(10, 10) });
  expect(f.holds).toEqual([]);
});
