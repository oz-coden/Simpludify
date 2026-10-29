import {
  Cancellation,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  CanvasPanel,
  CanvasScroll,
  CanvasUI,
  defineEvent,
  Lifetime,
  PointerRouting,
  Scene,
  ScenePointer,
} from "@simpludify/core";
import { afterEach, expect, it, vi } from "vitest";
import { createPortableScreen } from "../../examples/canvas-ui/portable-screen";

const metrics = (node: { text: string }) => ({
  width: node.text.length * 8,
  height: 20,
});
const mount = (
  root: ReturnType<typeof CanvasPanel>,
  width = 300,
  height = 150,
) => {
  const owner = new Lifetime(),
    ui = new CanvasUI(owner, root);
  const layout = () => ui.layout(width, height, metrics);
  layout();
  return { owner, ui, layout };
};
afterEach(() => vi.unstubAllGlobals());

it("constructs, lays out, operates and disposes a complete portable screen without browser globals", () => {
  vi.stubGlobal("AbortController", undefined);
  vi.stubGlobal("document", undefined);
  vi.stubGlobal("window", undefined);
  const screen = createPortableScreen();
  const f = mount(screen.root, 390, 600);
  expect(screen.list.maxScrollY).toBeGreaterThan(0);
  const entry = screen.list.children[0];
  expect(entry).toBeDefined();
  entry?.activate();
  expect(screen.status.text).toBe("Selected 1");
  screen.add();
  f.layout();
  expect(screen.list.children).toHaveLength(13);
  screen.controls.children[1]?.activate();
  f.layout();
  expect(screen.list.children[0]?.text).toBe("Entry 13");
  screen.controls.children[2]?.activate();
  f.layout();
  expect(entry?.disposed).toBe(true);
  expect(screen.list.children).toHaveLength(12);
  f.owner.dispose();
  expect(screen.root.disposed).toBe(true);
  expect(f.ui.diagnostics.subscriptions).toBe(0);
});
it("scrolls unshrunk content, clips paint/hits, clamps after removal and skips unchanged layouts", () => {
  const buttons = Array.from({ length: 5 }, (_, i) =>
    CanvasButton(String(i), () => {}, { height: 40, padding: 0 }),
  );
  const scroller = CanvasScroll(buttons, { height: 100 });
  const f = mount(scroller, 200, 100);
  expect(scroller.maxScrollY).toBe(100);
  expect(buttons[0]?.bounds.height).toBe(40);
  expect(f.ui.hitTest(10, 10)).toBe(buttons[0]);
  scroller.scrollTo(0, 80);
  f.layout();
  expect(buttons[0]?.bounds.y).toBe(-80);
  expect(f.ui.hitTest(10, 10)).toBe(buttons[2]);
  expect(f.ui.hitTest(10, 101)).toBeUndefined();
  const clips: number[] = [];
  f.ui.walk((_, clip) => clips.push(clip.height));
  expect(clips.every((h) => h === 100)).toBe(true);
  expect(f.layout()).toBe(false);
  buttons[4]?.dispose();
  buttons[3]?.dispose();
  f.layout();
  expect(scroller.maxScrollY).toBe(20);
  expect(scroller.scrollY).toBe(20);
  scroller.clear();
  f.layout();
  expect(scroller.scrollY).toBe(0);
  expect(() => scroller.scrollBy(0, NaN)).toThrow("finite");
  f.owner.dispose();
});
it("routes nested scaled scrolling to the deepest movable viewport, then its ancestor", () => {
  const inner = CanvasScroll([CanvasLabel("a", { height: 160 })], {
    height: 80,
  });
  const outer = CanvasScroll([inner, CanvasLabel("b", { height: 160 })], {
    height: 100,
    pointerEvents: "auto",
  });
  const scene = new Scene("scroll"),
    ui = new CanvasUI(scene, outer, { scale: 2 });
  ui.layout(400, 200, metrics);
  const routing = new PointerRouting();
  routing.setScene(new ScenePointer(scene), ui);
  expect(routing.scroll(20, 20, 0, 100)).toBe(true);
  ui.layout(400, 200, metrics);
  expect(inner.scrollY).toBe(50);
  expect(outer.scrollY).toBe(0);
  routing.scroll(20, 20, 0, 1000);
  ui.layout(400, 200, metrics);
  expect(inner.scrollY).toBe(80);
  routing.scroll(20, 20, 0, 100);
  ui.layout(400, 200, metrics);
  expect(outer.scrollY).toBe(50);
  scene.dispose();
  expect(routing.scroll(20, 20, 0, 100)).toBe(false);
  routing.dispose();
});
it("retains identity, ownership and subscriptions during reorder; clear releases every subtree after errors", () => {
  const Ping = defineEvent<void>("Ping"),
    a = CanvasButton("a", () => {}),
    b = CanvasButton("b", () => {}),
    c = CanvasButton("c", () => {});
  const root = CanvasColumn([a, b, c]);
  const f = mount(root);
  let calls = 0;
  a.events.on(Ping, () => calls++);
  root.move(a, 2);
  f.layout();
  expect(root.children).toEqual([b, c, a]);
  expect(a.disposed).toBe(false);
  a.events.emit(Ping, undefined);
  expect(calls).toBe(1);
  expect(() => root.move(CanvasLabel("other"), 0)).toThrow();
  expect(() => root.move(a, 3)).toThrow();
  a.onDispose(() => {
    throw new Error("cleanup");
  });
  expect(() => root.clear()).toThrow(AggregateError);
  expect(root.children).toHaveLength(0);
  expect([a, b, c].every((n) => n.disposed)).toBe(true);
  expect(a.events.listenerCount()).toBe(0);
  f.owner.dispose();
});
it("owns logical focus, reveals offscreen entries and releases focus immediately when ancestors disable or dispose", () => {
  const buttons = Array.from({ length: 5 }, (_, i) =>
    CanvasButton(String(i), () => {}, { height: 40, padding: 0 }),
  );
  const root = CanvasScroll(buttons, { height: 80 });
  const f = mount(root, 200, 80);
  f.ui.focus(buttons[4]);
  f.layout();
  expect(root.scrollY).toBe(120);
  expect(buttons[4]?.focused).toBe(true);
  expect(f.ui.focusedNode).toBe(buttons[4]);
  expect(f.ui.focusNext()).toBeUndefined();
  expect(f.ui.focusNext(true)).toBe(buttons[3]);
  root.enabled = false;
  expect(f.ui.focusedNode).toBeUndefined();
  root.enabled = true;
  f.ui.focus(buttons[0]);
  f.layout();
  expect(root.scrollY).toBe(0);
  buttons[0]?.dispose();
  expect(f.ui.focusedNode).toBeUndefined();
  expect(() => f.ui.focus(CanvasButton("foreign", () => {}))).toThrow();
  f.owner.dispose();
  expect(() => f.ui.focus()).toThrow();
});
it("Core routes key activation once and cancels unfinished holds on blur/disposal", () => {
  let clicks = 0;
  const button = CanvasButton("click", () => {
    clicks++;
  });
  const scene = new Scene("keys"),
    ui = new CanvasUI(scene, CanvasPanel([button]));
  ui.layout(200, 100, metrics);
  const routing = new PointerRouting();
  routing.setScene(new ScenePointer(scene), ui);
  routing.key(button, "Enter", false);
  expect(clicks).toBe(0);
  routing.key(button, "Enter", true);
  routing.key(button, "Enter", true);
  routing.key(button, "Enter", false);
  expect(clicks).toBe(1);
  routing.key(button, "Space", true);
  routing.releaseKeys(button);
  routing.key(button, "Space", false);
  expect(clicks).toBe(1);
  routing.key(button, "Enter", true);
  button.enabled = false;
  routing.key(button, "Enter", false);
  expect(clicks).toBe(1);
  scene.dispose();
  expect(routing.diagnostics.keyboardNodes).toBe(0);
  routing.dispose();
});
it("cancellation is idempotent, removable, immediate for late listeners and continues after failures", () => {
  const owner = new Cancellation(),
    calls: string[] = [];
  owner.signal.onCancel(() => {
    calls.push("a");
    throw new Error("a");
  });
  owner.signal.onCancel(() => calls.push("b"));
  const off = owner.signal.onCancel(() => calls.push("removed"));
  off();
  expect(() => owner.cancel()).toThrow(AggregateError);
  expect(calls).toEqual(["a", "b"]);
  expect(() => owner.cancel()).not.toThrow();
  owner.signal.onCancel(() => calls.push("late"));
  expect(calls).toEqual(["a", "b", "late"]);
  expect(() => owner.signal.throwIfCancelled()).toThrow();
});
it("horizontal scrolling and resize recompute ranges without introducing negative sizes", () => {
  const root = CanvasScroll([CanvasLabel("wide", { width: 300, height: 30 })], {
    scroll: "horizontal",
    direction: "row",
    width: 100,
    height: 40,
  });
  const f = mount(root, 100, 40);
  expect(root.maxScrollX).toBe(200);
  expect(root.maxScrollY).toBe(0);
  root.scrollTo(300, 10);
  f.layout();
  expect(root.scrollX).toBe(200);
  root.setStyle({ width: 250 });
  f.ui.layout(250, 40, metrics);
  expect(root.maxScrollX).toBe(50);
  expect(root.scrollX).toBe(50);
  f.owner.dispose();
});

it("focus traversal skips permanently clipped and pointer-transparent controls while retaining offscreen scroll entries", () => {
  const first = CanvasButton("first", () => {}, {
    height: 40,
    padding: 0,
    shrink: 0,
  });
  const clipped = CanvasButton("clipped", () => {}, {
    height: 40,
    padding: 0,
    shrink: 0,
  });
  const transparent = CanvasButton("transparent", () => {}, {
    pointerEvents: "children",
    height: 40,
    padding: 0,
  });
  const last = CanvasButton("last", () => {}, { height: 40, padding: 0 });
  const viewport = CanvasColumn([first, clipped], {
    height: 40,
    clip: true,
    shrink: 0,
  });
  const f = mount(CanvasColumn([viewport, transparent, last]), 200, 160);
  expect(f.ui.focusNext()).toBe(first);
  expect(f.ui.focusNext()).toBe(last);
  expect(f.ui.focusNext()).toBeUndefined();
  expect(() => f.ui.focus(clipped)).toThrow();
  expect(() => f.ui.focus(transparent)).toThrow();
  f.owner.dispose();
});
