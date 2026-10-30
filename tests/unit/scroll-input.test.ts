import {
  CanvasButton,
  CanvasHoldButton,
  CanvasLabel,
  CanvasRow,
  CanvasScroll,
  CanvasUI,
  PointerCancel,
  PointerClick,
  PointerRouting,
  Scene,
  ScenePointer,
  screenPoint,
  worldPoint,
} from "@simpludify/core";
import { expect, it } from "vitest";

const metrics = () => ({ width: 30, height: 20 });
const point = (id = 1, x = 20, y = 50, time?: number) => ({
  pointerId: id,
  pointerType: "touch",
  button: 0,
  buttons: 1,
  screen: screenPoint(x, y),
  world: worldPoint(x, y),
  inside: true,
  ...(time === undefined ? {} : { time }),
});
function setup(hold = false, scale = 1) {
  const scene = new Scene("scroll"),
    holds: boolean[] = [];
  let clicks = 0,
    cancels = 0,
    worldClicks = 0;
  const released: number[] = [];
  const button = hold
    ? CanvasHoldButton("hold", (v) => holds.push(v), { height: 80, padding: 0 })
    : CanvasButton(
        "tap",
        () => {
          clicks++;
        },
        { height: 80, padding: 0 },
      );
  const root = CanvasScroll(
    [
      button,
      ...Array.from({ length: 6 }, () => CanvasLabel("row", { height: 40 })),
    ],
    { height: 100 },
  );
  const ui = new CanvasUI(scene, root, { scale }),
    routing = new PointerRouting((id) => released.push(id)),
    channel = new ScenePointer(scene);
  routing.setScene(channel, ui);
  button.events.on(PointerCancel, () => cancels++);
  channel.events.on(PointerClick, () => worldClicks++);
  const flush = () => ui.layout(300 * scale, 100 * scale, metrics);
  flush();
  return {
    scene,
    root,
    ui,
    routing,
    button,
    holds,
    released,
    flush,
    get clicks() {
      return clicks;
    },
    get cancels() {
      return cancels;
    },
    get worldClicks() {
      return worldClicks;
    },
  };
}
it("retains taps and subthreshold movement, then transfers drag ownership without clicks or native capture release", () => {
  const f = setup();
  f.routing.down(point());
  f.routing.move(point(1, 20, 45));
  f.routing.up(point(1, 20, 45));
  expect(f.clicks).toBe(1);
  f.routing.down(point());
  f.routing.move(point(1, 20, 20));
  f.flush();
  expect(f.root.scrollY).toBe(30);
  expect(f.cancels).toBe(1);
  expect(f.routing.diagnostics.scrollDrags).toBe(1);
  expect(f.released).toEqual([1]);
  f.routing.up(point(1, 20, 20));
  expect(f.clicks).toBe(1);
  expect(f.worldClicks).toBe(0);
  expect(f.released).toEqual([1, 1]);
  expect(f.routing.diagnostics.scrollDrags).toBe(0);
  f.scene.dispose();
});
it.each(["release", "cancel", "blur", "disable", "hide", "dispose"] as const)(
  "releases an immediate HoldButton exactly once when scrolling ends via %s",
  (end) => {
    const f = setup(true);
    f.routing.down(point());
    expect(f.holds).toEqual([true]);
    f.routing.move(point(1, 20, 10));
    expect(f.holds).toEqual([true, false]);
    if (end === "release") f.routing.up(point(1, 20, 10));
    else if (end === "cancel") f.routing.cancel(1, false);
    else if (end === "blur") f.routing.release();
    else if (end === "disable") f.root.enabled = false;
    else if (end === "hide") f.root.visible = false;
    else f.scene.dispose();
    f.routing.up(point(1, 20, 10));
    expect(f.holds).toEqual([true, false]);
    expect(f.cancels).toBe(1);
    expect(f.routing.diagnostics.captures).toBe(0);
    f.scene.dispose();
    f.routing.dispose();
  },
);
it("keeps an ordinary long hold and short tap compatible when no scroll gesture wins", () => {
  const f = setup(true);
  f.routing.down(point(1, 20, 50, 0));
  f.routing.move(point(1, 20, 49, 2));
  expect(f.holds).toEqual([true]);
  f.routing.up(point(1, 20, 49, 3));
  expect(f.holds).toEqual([true, false]);
  f.routing.down(point());
  f.routing.up(point());
  expect(f.holds).toEqual([true, false, true, false]);
  f.scene.dispose();
});
it("ignores movement on an unsupported axis and uses the same screen threshold at UI scale 2", () => {
  const f = setup(false, 2);
  f.routing.down(point(1, 20, 80));
  f.routing.move(point(1, 100, 80));
  expect(f.root.scrollY).toBe(0);
  expect(f.routing.diagnostics.scrollDrags).toBe(0);
  f.routing.cancel(1, false);
  f.routing.down(point(1, 20, 80));
  f.routing.move(point(1, 20, 74));
  expect(f.routing.diagnostics.scrollDrags).toBe(0);
  f.routing.move(point(1, 20, 68));
  expect(f.routing.diagnostics.scrollDrags).toBe(1);
  expect(f.root.scrollY).toBe(3);
  f.scene.dispose();
});
it.each(["program", "drag-off", "axis", "remove"] as const)(
  "cancels active ownership immediately after %s mutation",
  (change) => {
    const f = setup();
    f.routing.down(point());
    f.routing.move(point(1, 20, 20));
    if (change === "program") f.root.scrollTo(0, 100);
    else if (change === "drag-off") f.root.setStyle({ dragScroll: false });
    else if (change === "axis") f.root.setStyle({ scroll: "horizontal" });
    else f.root.dispose();
    expect(f.routing.diagnostics.scrollDrags).toBe(0);
    const y = f.root.scrollY;
    f.routing.move(point(1, 20, 0));
    f.routing.up(point(1, 20, 0));
    expect(f.root.scrollY).toBe(y);
    expect(f.clicks).toBe(0);
    f.scene.dispose();
  },
);
it("does not steal a world gesture that later crosses a scroll viewport", () => {
  const f = setup();
  f.routing.down(point(1, 400, 50));
  f.routing.move(point(1, 20, 20));
  f.routing.up(point(1, 20, 20));
  expect(f.root.scrollY).toBe(0);
  expect(f.worldClicks).toBe(1);
  f.scene.dispose();
});
it("locks the child for the whole drag, chains at the next gesture and respects orthogonal parent axes", () => {
  const scene = new Scene("nested");
  const inner = CanvasScroll([CanvasLabel("large", { height: 300 })], {
    height: 80,
  });
  const outer = CanvasScroll([inner, CanvasLabel("tail", { height: 300 })], {
    height: 120,
  });
  const ui = new CanvasUI(scene, outer),
    r = new PointerRouting();
  r.setScene(new ScenePointer(scene), ui);
  const flush = () => ui.layout(300, 120, metrics);
  flush();
  r.down(point());
  r.move(point(1, 20, -500));
  flush();
  expect(inner.scrollY).toBe(inner.maxScrollY);
  expect(outer.scrollY).toBe(0);
  r.move(point(1, 20, -600));
  flush();
  expect(outer.scrollY).toBe(0);
  r.up(point(1, 20, -600));
  r.down(point());
  r.move(point(1, 20, 20));
  flush();
  expect(outer.scrollY).toBe(30);
  r.cancel(1, false);
  outer.scrollTo(0, 0);
  inner.scrollTo(0, 0);
  outer.setStyle({ scroll: "horizontal", direction: "row", width: 100 });
  inner.setStyle({ width: 200 });
  flush();
  r.down(point());
  r.move(point(1, -20, 50));
  expect(outer.scrollX).toBe(40);
  expect(inner.scrollY).toBe(0);
  scene.dispose();
});
it("owns independent scrollers per pointer and rejects a second claim on the same viewport", () => {
  const scene = new Scene("two");
  const make = () =>
    CanvasScroll([CanvasLabel("long", { height: 400 })], {
      width: 100,
      height: 100,
    });
  const a = make(),
    b = make();
  const ui = new CanvasUI(scene, CanvasRow([a, b])),
    r = new PointerRouting();
  r.setScene(new ScenePointer(scene), ui);
  ui.layout(200, 100, metrics);
  r.down(point(1, 20, 50));
  r.down(point(2, 120, 50));
  r.move(point(1, 20, 20));
  r.move(point(2, 120, 10));
  expect(a.scrollY).toBe(30);
  expect(b.scrollY).toBe(40);
  expect(r.diagnostics.scrollDrags).toBe(2);
  r.down(point(3, 20, 50));
  r.move(point(3, 20, 20));
  expect(r.has(3)).toBe(false);
  expect(r.owns(3)).toBe(true);
  expect(r.diagnostics.scrollDrags).toBe(2);
  r.cancel(1, false);
  expect(r.diagnostics.scrollDrags).toBe(1);
  r.up(point(2, 120, 10));
  expect(r.diagnostics.scrollDrags).toBe(0);
  scene.dispose();
  r.dispose();
});
it("scrolls cached layout without repeating Flex or measurement and reflows after real structure changes", () => {
  const f = setup();
  const before = f.ui.diagnostics;
  f.root.scrollTo(0, 20);
  f.flush();
  expect(f.ui.diagnostics.layouts).toBe(before.layouts);
  expect(f.ui.diagnostics.scrollProjections).toBeGreaterThan(
    before.scrollProjections,
  );
  expect(f.button.bounds.y).toBe(-20);
  expect(f.ui.hitTest(20, 20)).toBe(f.button);
  f.root.add(CanvasLabel("new", { height: 80 }));
  f.flush();
  expect(f.ui.diagnostics.layouts).toBe(before.layouts + 1);
  f.scene.dispose();
});
it("estimates momentum from recent Host timestamps and stops after its active set empties", () => {
  const f = setup();
  f.root.add(CanvasLabel("tail", { height: 4000 }));
  f.flush();
  f.routing.down(point(1, 20, 70, 0));
  for (let i = 1; i <= 10; i++)
    f.routing.move(point(1, 20, 70 - i * 10, i * 0.01));
  f.routing.up(point(1, 20, -30, 0.1));
  expect(f.ui.diagnostics.activeMomentum).toBe(1);
  const old = f.root.scrollY;
  f.ui.advance(0.05);
  f.flush();
  expect(f.root.scrollY).toBeGreaterThan(old);
  for (let i = 0; i < 200; i++) f.ui.advance(0.016);
  f.flush();
  expect(f.ui.diagnostics.activeMomentum).toBe(0);
  const end = f.root.scrollY;
  f.ui.advance(0.1);
  expect(f.root.scrollY).toBe(end);
  f.scene.dispose();
});
it("integrates the same inertial distance at 30, 60 and 120 Hz", () => {
  const run = (hz: number) => {
    const f = setup();
    f.root.add(CanvasLabel("tail", { height: 4000 }));
    f.flush();
    f.root.scrollTo(0, 500);
    f.root.startScroll(0, 1200);
    for (let i = 0; i < hz * 2; i++) f.ui.advance(1 / hz);
    const y = f.root.scrollY;
    expect(f.ui.diagnostics.activeMomentum).toBe(0);
    f.scene.dispose();
    return y;
  };
  expect(run(30)).toBeCloseTo(run(60), 7);
  expect(run(60)).toBeCloseTo(run(120), 7);
});
it.each([
  "off",
  "wheel",
  "program",
  "down",
  "pause",
  "hidden",
  "removed",
  "direction",
] as const)("interrupts momentum on %s without reviving it", (reason) => {
  const f = setup();
  f.root.startScroll(0, 900);
  expect(f.root.coasting).toBe(true);
  if (reason === "off") f.root.setStyle({ inertia: false });
  else if (reason === "wheel") f.routing.scroll(20, 50, 0, 10);
  else if (reason === "program") f.root.scrollTo(0, f.root.scrollY);
  else if (reason === "down") f.routing.down(point());
  else if (reason === "pause") f.routing.release();
  else if (reason === "hidden") f.root.visible = false;
  else if (reason === "direction") f.root.setStyle({ scroll: "horizontal" });
  else f.root.dispose();
  expect(f.ui.diagnostics.activeMomentum).toBe(0);
  f.ui.advance(0.1);
  expect(f.root.coasting).toBe(false);
  f.scene.dispose();
});
it("disables inertia independently and rejects invalid elapsed time without moving state", () => {
  const f = setup();
  f.root.setStyle({ inertia: false });
  f.root.startScroll(0, 1000);
  expect(f.root.coasting).toBe(false);
  f.root.setStyle({ inertia: true });
  f.root.startScroll(0, 1000);
  const y = f.root.scrollY;
  for (const time of [NaN, Infinity, -1])
    expect(() => f.ui.advance(time)).toThrow("finite");
  expect(f.root.scrollY).toBe(y);
  f.ui.advance(10);
  expect(f.root.coasting).toBe(false);
  expect(f.root.scrollY).toBe(y);
  f.scene.dispose();
  f.ui.advance(0.1);
});
it("does not fling on stale, missing, nonmonotonic or extreme timestamp histories", () => {
  for (const mode of ["missing", "stale", "backwards", "huge"]) {
    const f = setup();
    f.routing.down(point(1, 20, 70, mode === "missing" ? undefined : 1));
    f.routing.move(
      point(
        1,
        20,
        30,
        mode === "missing"
          ? undefined
          : mode === "backwards"
            ? 0.5
            : mode === "huge"
              ? 100
              : 1.02,
      ),
    );
    f.routing.up(
      point(
        1,
        20,
        30,
        mode === "missing"
          ? undefined
          : mode === "stale"
            ? 2
            : mode === "backwards"
              ? 0.5
              : 100,
      ),
    );
    expect(f.root.coasting).toBe(false);
    f.scene.dispose();
  }
});
it("coasts only on enabled axes, stops at boundaries and keeps another scroller's settings independent", () => {
  const f = setup();
  f.root.startScroll(999, 3000);
  for (let i = 0; i < 50; i++) f.ui.advance(0.02);
  expect(f.root.scrollY).toBe(f.root.maxScrollY);
  expect(f.root.scrollX).toBe(0);
  expect(f.root.coasting).toBe(false);
  const other = CanvasScroll([], {
    inertia: false,
    dragScroll: false,
    scrollbar: "hidden",
  });
  f.root.setStyle({ inertia: true, scrollbar: "always" });
  expect(other.style.inertia).toBe(false);
  expect(other.style.scrollbar).toBe("hidden");
  expect(f.root.style.scrollbar).toBe("always");
  other.dispose();
  f.scene.dispose();
});

it("cancels drags/momentum on scale changes and malformed coordinates without corrupting position", () => {
  const f = setup();
  f.routing.down(point());
  f.routing.move(point(1, 20, 20));
  f.ui.scale = 2;
  expect(f.routing.diagnostics.scrollDrags).toBe(0);
  f.routing.up(point(1, 20, 20));
  f.root.startScroll(0, 900);
  f.ui.scale = 1;
  expect(f.root.coasting).toBe(false);
  f.flush();
  f.routing.down(point());
  f.routing.move(point(1, 20, 20));
  const y = f.root.scrollY;
  expect(() =>
    f.routing.move({ ...point(), screen: { space: "screen", x: NaN, y: 10 } }),
  ).toThrow("finite");
  expect(f.routing.diagnostics.captures).toBe(0);
  expect(f.root.scrollY).toBe(y);
  f.scene.dispose();
});
it("continues safe cleanup when the old target's cancellation handler throws during ownership transfer", () => {
  const f = setup(true);
  f.button.events.on(PointerCancel, () => {
    throw Error("cancel handler");
  });
  f.routing.down(point());
  expect(() => f.routing.move(point(1, 20, 10))).toThrow();
  expect(f.holds).toEqual([true, false]);
  expect(f.routing.diagnostics.scrollDrags).toBe(1);
  f.routing.cancel(1, false);
  expect(f.routing.diagnostics.scrollDrags).toBe(0);
  expect(f.cancels).toBe(1);
  f.scene.dispose();
});
