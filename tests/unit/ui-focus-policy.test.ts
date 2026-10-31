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
