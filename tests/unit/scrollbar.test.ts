import {
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasScroll,
  CanvasUI,
  canvasScrollbars,
  PointerRouting,
  Scene,
  ScenePointer,
  screenPoint,
  worldPoint,
} from "@simpludify/core";
import { expect, it } from "vitest";

const measure = () => ({ width: 50, height: 20 });
const point = (x: number, y: number, id = 1, button = 0) => ({
  pointerId: id,
  pointerType: "touch",
  button,
  buttons: 1,
  screen: screenPoint(x, y),
  world: worldPoint(x, y),
  inside: true,
  time: 1,
});
function fixture(
  axis: "vertical" | "horizontal" | "both" = "vertical",
  mode: "auto" | "always" | "hidden" = "auto",
) {
  const scene = new Scene("bars");
  let clicks = 0;
  const child = CanvasButton(
    "large",
    () => {
      clicks++;
    },
    { width: 400, height: 500, padding: 0, shrink: 0 },
  );
  const node = CanvasScroll([child], {
    width: 120,
    height: 100,
    scroll: axis,
    scrollbar: mode,
    direction: axis === "horizontal" ? "row" : "column",
  });
  const ui = new CanvasUI(scene, node),
    routing = new PointerRouting();
  routing.setScene(new ScenePointer(scene), ui);
  const flush = () => ui.layout(120, 100, measure);
  flush();
  return {
    scene,
    node,
    ui,
    routing,
    child,
    flush,
    get clicks() {
      return clicks;
    },
  };
}
it.each(["vertical", "horizontal", "both"] as const)(
  "computes overlay thumb ratios and exact end positions for %s",
  (axis) => {
    const f = fixture(axis);
    const bars = canvasScrollbars(f.node);
    expect(bars).toHaveLength(axis === "both" ? 2 : 1);
    for (const bar of bars) {
      expect(bar.enabled).toBe(true);
      expect(
        bar.axis === "vertical" ? bar.thumb.height : bar.thumb.width,
      ).toBeGreaterThanOrEqual(24);
    }
    f.node.scrollTo(f.node.maxScrollX, f.node.maxScrollY);
    f.flush();
    for (const b of canvasScrollbars(f.node))
      expect(
        b.axis === "vertical"
          ? b.thumb.y + b.thumb.height
          : b.thumb.x + b.thumb.width,
      ).toBeCloseTo(
        b.axis === "vertical"
          ? b.track.y + b.track.height
          : b.track.x + b.track.width,
        10,
      );
    f.scene.dispose();
  },
);
it.each(["auto", "always", "hidden"] as const)(
  "defines %s visibility without changing scroll availability",
  (mode) => {
    const f = fixture("vertical", mode);
    expect(canvasScrollbars(f.node).length).toBe(mode === "hidden" ? 0 : 1);
    expect(f.node.scrollBy(0, 40)).toBe(true);
    f.flush();
    expect(f.node.scrollY).toBe(40);
    f.node.clear();
    f.flush();
    const bars = canvasScrollbars(f.node);
    expect(bars.length).toBe(mode === "always" ? 1 : 0);
    if (mode === "always") {
      const bar = bars[0];
      expect(bar?.enabled).toBe(false);
      expect(bar?.thumb).toEqual(bar?.track);
      f.routing.down(point(115, 20));
      expect(f.routing.diagnostics.scrollDrags).toBe(0);
      f.routing.up(point(115, 20));
    }
    f.scene.dispose();
  },
);
it.each(["vertical", "horizontal"] as const)(
  "drags a %s thumb directly, suppresses content clicks, and never starts momentum",
  (axis) => {
    const f = fixture(axis);
    const bar = canvasScrollbars(f.node)[0];
    if (!bar) throw Error("bar missing");
    const x = bar.thumb.x + bar.thumb.width / 2,
      y = bar.thumb.y + bar.thumb.height / 2;
    f.routing.down(point(x, y));
    f.routing.move(
      point(axis === "horizontal" ? 500 : x, axis === "vertical" ? 500 : y),
    );
    f.flush();
    expect(axis === "vertical" ? f.node.scrollY : f.node.scrollX).toBe(
      axis === "vertical" ? f.node.maxScrollY : f.node.maxScrollX,
    );
    f.routing.up({ ...point(500, 500), time: 1.02 });
    expect(f.node.coasting).toBe(false);
    expect(f.clicks).toBe(0);
    expect(f.routing.diagnostics.scrollDrags).toBe(0);
    f.scene.dispose();
  },
);
it("pages on track press, expands the cross-axis hit area and blocks the button underneath", () => {
  const f = fixture();
  const bar = canvasScrollbars(f.node)[0];
  if (!bar) throw Error("bar missing");
  const x = bar.track.x - 5,
    y = bar.track.y + bar.track.height - 1;
  expect(f.ui.pick(x, y).bar?.node).toBe(f.node);
  f.routing.down(point(x, y));
  expect(f.node.scrollY).toBe(90);
  f.routing.up(point(x, y));
  expect(f.clicks).toBe(0);
  f.scene.dispose();
});
it("keeps later overlays above bars in the shared hit/paint ordering", () => {
  const scene = new Scene("overlay"),
    scroller = CanvasScroll([CanvasLabel("long", { height: 500 })], {
      height: 100,
      width: 120,
    }),
    top = CanvasButton("top", () => {}, { height: 100, width: 120 });
  const root = CanvasColumn([scroller, top], { height: 100 });
  const ui = new CanvasUI(scene, root);
  ui.layout(120, 100, measure);
  // Make an overlapping overlay as a Host layout fixture using the existing resolved-box model.
  top.boundsValue = Object.freeze({
    ...top.bounds,
    x: 0,
    y: 0,
    width: 120,
    height: 100,
  });
  expect(ui.pick(115, 20).node).toBe(top);
  expect(ui.pick(115, 20).bar).toBeUndefined();
  scene.dispose();
});
it.each(["hidden", "axis", "resize", "disabled"] as const)(
  "releases thumb capture safely after %s changes",
  (reason) => {
    const f = fixture();
    const bar = canvasScrollbars(f.node)[0];
    if (!bar) throw Error("bar missing");
    const p = point(bar.thumb.x + 4, bar.thumb.y + 4);
    f.routing.down(p);
    expect(f.routing.diagnostics.scrollDrags).toBe(1);
    if (reason === "hidden") f.node.setStyle({ scrollbar: "hidden" });
    else if (reason === "axis") f.node.setStyle({ scroll: "horizontal" });
    else if (reason === "disabled") f.node.enabled = false;
    else {
      f.child.setStyle({ height: 20 });
      f.flush();
    }
    expect(f.routing.diagnostics.scrollDrags).toBe(0);
    f.routing.up(p);
    expect(f.clicks).toBe(0);
    f.scene.dispose();
  },
);
it("content drag disabling leaves scrollbar input available; secondary buttons never move it", () => {
  const f = fixture();
  f.node.setStyle({ dragScroll: false });
  const bar = canvasScrollbars(f.node)[0];
  if (!bar) throw Error("bar missing");
  const x = bar.thumb.x + 4,
    y = bar.thumb.y + 4;
  f.routing.down(point(x, y, 1, 2));
  f.routing.move(point(x, 90, 1, 2));
  f.routing.up(point(x, 90, 1, 2));
  expect(f.node.scrollY).toBe(0);
  f.routing.down(point(x, y));
  f.routing.move(point(x, 90));
  expect(f.node.scrollY).toBeGreaterThan(0);
  f.routing.up(point(x, 90));
  f.scene.dispose();
});
it("keyboard scrolling works with hidden bars and runtime policy changes are validated atomically", () => {
  const f = fixture("vertical", "hidden");
  expect(f.ui.scrollKey(f.child, "PageDown")).toBe(true);
  expect(f.node.scrollY).toBe(90);
  expect(f.ui.scrollKey(f.child, "End")).toBe(true);
  expect(f.node.scrollY).toBe(f.node.maxScrollY);
  expect(f.ui.scrollKey(f.child, "Home")).toBe(true);
  expect(f.node.scrollY).toBe(0);
  const style = f.node.style;
  expect(() => f.node.setStyle({ scrollbar: "invalid" as "auto" })).toThrow();
  expect(() => f.node.setStyle({ dragThreshold: NaN })).toThrow();
  expect(f.node.style).toBe(style);
  f.scene.dispose();
});

it("keeps disabled bars visible and dim without allowing their input", () => {
  const f = fixture("vertical", "always");
  f.node.enabled = false;
  const bars = canvasScrollbars(f.node);
  expect(bars).toHaveLength(1);
  expect(bars[0]?.enabled).toBe(false);
  expect(f.ui.pick(115, 20).bar).toBeUndefined();
  f.node.visible = false;
  expect(canvasScrollbars(f.node)).toHaveLength(0);
  f.scene.dispose();
});
