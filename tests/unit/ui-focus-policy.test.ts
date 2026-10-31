import {
  CanvasButton,
  CanvasCheckbox,
  CanvasColumn,
  CanvasPanel,
  CanvasRow,
  CanvasScroll,
  CanvasTextInput,
  CanvasUI,
  canvasHoverHighlight,
  Scene,
} from "@simpludify/core";
import { expect, it } from "vitest";

it("default hover paint distinguishes controls from pointer-blocking containers", () => {
  for (const node of [
    CanvasPanel([], { pointerEvents: "auto" }),
    CanvasRow([]),
    CanvasColumn([]),
    CanvasScroll([]),
  ]) {
    node.hovered = true;
    expect(canvasHoverHighlight(node)).toBe(false);
    node.dispose();
  }
  for (const node of [
    CanvasButton("a", () => {}),
    CanvasCheckbox("b"),
    CanvasTextInput(),
  ]) {
    node.hovered = true;
    expect(canvasHoverHighlight(node)).toBe(true);
    node.setStyle({ hoverEffect: "none" });
    expect(canvasHoverHighlight(node)).toBe(false);
    node.dispose();
  }
});
it("explicit container hover is paint-only, validated and does not change focusability", () => {
  const node = CanvasPanel([], { pointerEvents: "auto" }),
    scene = new Scene("hover"),
    ui = new CanvasUI(scene, node);
  ui.layout(400, 400, () => ({ width: 20, height: 20 }));
  const layouts = ui.diagnostics.layouts;
  node.hovered = true;
  node.setStyle({ hoverEffect: "highlight" });
  expect(canvasHoverHighlight(node)).toBe(true);
  ui.layout(400, 400, () => ({ width: 20, height: 20 }));
  expect(ui.diagnostics.layouts).toBe(layouts);
  expect(ui.focusNext()).toBeUndefined();
  expect(() => node.setStyle({ hoverEffect: "invalid" as never })).toThrow();
  scene.dispose();
});

it("traverses nested declaration order, skips unavailable ancestors, retains readonly and leaves boundaries", () => {
  const first = CanvasButton("first", () => {}),
    second = CanvasCheckbox("second", { readOnly: true }),
    hidden = CanvasButton("hidden", () => {}),
    disabled = CanvasButton("disabled", () => {}),
    last = CanvasTextInput({ label: "last" }),
    scene = new Scene("focus"),
    hiddenPanel = CanvasPanel([hidden]),
    root = CanvasColumn([
      CanvasRow([first, second]),
      hiddenPanel,
      disabled,
      CanvasPanel([last]),
    ]),
    ui = new CanvasUI(scene, root);
  hiddenPanel.visible = false;
  disabled.enabled = false;
  ui.layout(800, 800, () => ({ width: 100, height: 30 }));
  expect(ui.focusNext()).toBe(first);
  expect(ui.focusNext()).toBe(second);
  expect(ui.focusNext()).toBe(last);
  expect(ui.focusNext()).toBeUndefined();
  expect(ui.focusedNode).toBe(last);
  expect(ui.focusNext(true)).toBe(second);
  expect(ui.focusNext(true)).toBe(first);
  expect(ui.focusNext(true)).toBeUndefined();
  scene.dispose();
  expect(ui.focusedNode).toBeUndefined();
});
it("recomputes focus order after add, move, removal and recreation", () => {
  const a = CanvasButton("a", () => {}),
    b = CanvasButton("b", () => {}),
    root = CanvasColumn([a, b]),
    scene = new Scene("dynamic"),
    ui = new CanvasUI(scene, root),
    layout = () => ui.layout(800, 800, () => ({ width: 100, height: 30 }));
  layout();
  ui.focus(b);
  root.move(b, 0);
  layout();
  expect(ui.focusNext()).toBe(a);
  const c = CanvasButton("c", () => {});
  root.add(c);
  layout();
  expect(ui.focusNext()).toBe(c);
  root.remove(c);
  layout();
  expect(ui.focusedNode).toBeUndefined();
  expect(ui.focusNext()).toBe(b);
  root.clear();
  root.add(CanvasButton("new", () => {}));
  layout();
  expect(ui.focusNext()?.text).toBe("new");
  scene.dispose();
});
it("declaration traversal reveals offscreen scroll descendants in both directions", () => {
  const nodes = Array.from({ length: 10 }, (_, i) =>
      CanvasButton(String(i), () => {}, { height: 40, shrink: 0 }),
    ),
    scroll = CanvasScroll(nodes, { height: 100, width: 200 }),
    scene = new Scene("scroll-focus"),
    ui = new CanvasUI(scene, CanvasColumn([scroll]));
  const layout = () => ui.layout(300, 200, () => ({ width: 100, height: 30 }));
  layout();
  for (const node of nodes) {
    expect(ui.focusNext()).toBe(node);
    layout();
  }
  expect(scroll.scrollY).toBeGreaterThan(0);
  for (const node of nodes.slice(0, -1).reverse()) {
    expect(ui.focusNext(true)).toBe(node);
    layout();
  }
  expect(scroll.scrollY).toBe(0);
  scene.dispose();
});
