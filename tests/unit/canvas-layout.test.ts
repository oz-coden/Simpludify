import { Scene } from "@simpludify/core";
import { expect, it } from "vitest";
import {
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasPanel,
  CanvasRow,
} from "../../packages/web/src/canvas-node";
import { CanvasUI } from "../../packages/web/src/canvas-ui";

const metrics = (n: { text: string }) => ({
  width: n.text.length * 10,
  height: 20,
});
const setup = (root: ReturnType<typeof CanvasPanel>, w = 300, h = 200) => {
  const scene = new Scene("layout");
  const ui = new CanvasUI(scene, root);
  ui.layout(w, h, metrics);
  return { ui, scene };
};
it("lays out row padding, gaps, fixed and percentage dimensions", () => {
  const a = CanvasLabel("a", { width: 50 }),
    b = CanvasLabel("b", { width: "50%" });
  setup(CanvasRow([a, b], { padding: 10, gap: 8, align: "start" }));
  expect(a.bounds).toEqual({ x: 10, y: 10, width: 50, height: 20 });
  expect(b.bounds).toEqual({ x: 68, y: 10, width: 140, height: 20 });
});
it("distributes grow and weighted shrink with no negative sizes", () => {
  const a = CanvasLabel("a", { width: 50, grow: 1 }),
    b = CanvasLabel("b", { width: 50, grow: 3 });
  const { ui } = setup(CanvasRow([a, b]));
  expect([a.bounds.width, b.bounds.width]).toEqual([100, 200]);
  a.setStyle({ width: 100, grow: 0 });
  b.setStyle({ width: 200, grow: 0 });
  ui.layout(150, 100, metrics);
  expect([a.bounds.width, b.bounds.width]).toEqual([50, 100]);
});
it("uses column axes, cross align and justify", () => {
  const a = CanvasLabel("a"),
    b = CanvasLabel("b");
  setup(
    CanvasColumn([a, b], {
      align: "center",
      justify: "space-between",
      padding: 10,
    }),
  );
  expect(a.bounds).toEqual({ x: 145, y: 10, width: 10, height: 20 });
  expect(b.bounds).toEqual({ x: 145, y: 170, width: 10, height: 20 });
});
it("wraps explicitly in row and column directions", () => {
  const children = Array.from({ length: 3 }, () =>
    CanvasLabel("a", { width: 90, height: 30, shrink: 0 }),
  );
  const { ui } = setup(
    CanvasRow(children, { wrap: true, gap: 10, align: "start" }),
    200,
    100,
  );
  expect(children.map((n) => [n.bounds.x, n.bounds.y])).toEqual([
    [0, 0],
    [100, 0],
    [0, 40],
  ]);
  ui.root.setStyle({ direction: "column" });
  ui.layout(200, 70, metrics);
  expect(children.map((n) => [n.bounds.x, n.bounds.y])).toEqual([
    [0, 0],
    [0, 40],
    [100, 0],
  ]);
});
it("nests containers, stretches auto cross sizes and respects alignSelf", () => {
  const a = CanvasLabel("abc"),
    b = CanvasLabel("b", { alignSelf: "end" });
  setup(CanvasColumn([CanvasRow([a], { height: 40 }), b], { padding: 10 }));
  expect(a.bounds).toEqual({ x: 10, y: 10, width: 30, height: 40 });
  expect(b.bounds.x).toBe(280);
});
it("does no layout on unchanged frames, relayouts text, hidden children and resize", () => {
  const a = CanvasLabel("one"),
    b = CanvasLabel("two");
  const { ui } = setup(CanvasRow([a, b], { align: "start" }));
  for (let i = 0; i < 100; i++)
    expect(ui.layout(300, 200, metrics)).toBe(false);
  expect(ui.diagnostics.layouts).toBe(1);
  a.setText("longer");
  ui.layout(300, 200, metrics);
  expect(b.bounds.x).toBe(60);
  a.visible = false;
  ui.layout(300, 200, metrics);
  expect(b.bounds.x).toBe(0);
  ui.layout(500, 200, metrics);
  expect(ui.diagnostics.layouts).toBe(4);
});
it("keeps UI scale independent and hit-tests reverse paint order with clipping", () => {
  const button = CanvasButton("hit", () => {}, {
    width: 100,
    height: 40,
    shrink: 0,
  });
  const { ui } = setup(
    CanvasPanel([button], { width: 50, height: 30, clip: true }),
  );
  ui.scale = 2;
  ui.layout(300, 200, metrics);
  expect(ui.hitTest(25, 15)).toBe(button);
  expect(ui.hitTest(60, 15)).toBeUndefined();
  button.enabled = false;
  expect(ui.hitTest(25, 15)).toBeUndefined();
  ui.root.enabled = false;
  expect(ui.hitTest(25, 15)).toBeUndefined();
});
it("blocks or passes empty panels as configured and excludes none subtrees", () => {
  const b = CanvasButton("b", () => {});
  const { ui } = setup(
    CanvasPanel([b], { pointerEvents: "auto", align: "start" }),
  );
  expect(ui.hitTest(250, 150)).toBe(ui.root);
  ui.root.setStyle({ pointerEvents: "children" });
  expect(ui.hitTest(250, 150)).toBeUndefined();
  ui.root.setStyle({ pointerEvents: "none" });
  expect(ui.hitTest(5, 5)).toBeUndefined();
});
it("copies styles and children, validates numbers and single ownership atomically", () => {
  const style = { width: 40 },
    a = CanvasLabel("a", style),
    children = [a],
    parent = CanvasPanel(children);
  style.width = 90;
  children.length = 0;
  expect(a.style.width).toBe(40);
  expect(parent.children.length).toBe(1);
  expect(() => CanvasPanel([a])).toThrow("owned");
  expect(() => parent.add(parent)).toThrow("cycle");
  expect(() => parent.setStyle({ width: NaN })).toThrow();
  expect(() => parent.setStyle({ height: "bogus" as "10%" })).toThrow();
  expect(() => parent.setStyle({ grow: -1 })).toThrow();
  expect(() => parent.setStyle({ fontSize: 0 })).toThrow();
});
it("Scene disposes nodes, subscriptions, pending button task signals and owned sources", () => {
  let signal: AbortSignal | undefined;
  let release = () => {};
  const b = CanvasButton("async", (s) => {
    signal = s;
    return new Promise<void>((r) => {
      release = r;
    });
  });
  const { ui, scene } = setup(CanvasPanel([b]));
  b.activate();
  expect(b.busy).toBe(true);
  scene.dispose();
  expect(signal?.aborted).toBe(true);
  expect(b.disposed).toBe(true);
  expect(ui.disposed).toBe(true);
  expect(ui.diagnostics.nodes).toBe(0);
  release();
});
it("removal disposes subtree and invalidates layout; cleanup continues after a failure", () => {
  const a = CanvasLabel("a"),
    b = CanvasLabel("b");
  const { ui, scene } = setup(CanvasRow([a, b]));
  ui.root.remove(a);
  expect(a.disposed).toBe(true);
  ui.layout(300, 200, metrics);
  expect(b.bounds.x).toBe(0);
  b.onDispose(() => {
    throw Error("test cleanup");
  });
  expect(() => scene.dispose()).toThrow();
  expect(ui.disposed).toBe(true);
  expect(b.disposed).toBe(true);
});
it("sizes nested wrapped rows from their constrained width", () => {
  const children = Array.from({ length: 3 }, () =>
    CanvasLabel("a", { width: 90, height: 30, shrink: 0 }),
  );
  const wrapped = CanvasRow(children, {
    wrap: true,
    gap: 10,
    align: "start",
    shrink: 0,
  });
  const after = CanvasLabel("after");
  setup(CanvasColumn([wrapped, after]), 200, 200);
  expect(wrapped.bounds.height).toBe(70);
  expect(after.bounds.y).toBe(70);
  expect(children[2]?.bounds.y).toBe(40);
});
it("redistributes shrink after an item reaches zero", () => {
  const a = CanvasLabel("a", { width: 100, shrink: 100 }),
    b = CanvasLabel("b", { width: 100, shrink: 1 });
  setup(CanvasRow([a, b]), 10, 100);
  expect(a.bounds.width + b.bounds.width).toBeCloseTo(10);
});
it("remeasures a wrapped descendant after its flex main size grows", () => {
  const children = Array.from({ length: 4 }, () =>
    CanvasLabel("a", { width: 90, height: 30, shrink: 0 }),
  );
  const wrapped = CanvasRow(children, {
    width: 100,
    grow: 1,
    wrap: true,
    align: "start",
  });
  setup(CanvasRow([wrapped], { align: "start" }), 300, 200);
  expect(wrapped.bounds).toEqual({ x: 0, y: 0, width: 300, height: 60 });
  expect(children[3]?.bounds.y).toBe(30);
});
