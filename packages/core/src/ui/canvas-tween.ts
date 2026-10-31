import { Tween, tweenFinite } from "../animation/tween";
import { EngineError } from "../foundation/diagnostics";
import type { CanvasSliderNode } from "./canvas-input";
import type { CanvasNode } from "./canvas-node";
/** Translation is projected together with scroll and inherited by descendants; no Flex property is written. */
export function canvasTween(node: CanvasNode) {
  const bind = (key: "offsetX" | "offsetY" | "opacity") =>
    Tween.bind({
      target: node,
      key: `presentation.${key}`,
      owner: node,
      scope: () => node.ui?.scene,
      read: () => node.presentation[key],
      write: (value) => {
        node.setPresentation({ [key]: value });
        return Object.is(node.presentation[key], value);
      },
      validate: (value) => {
        tweenFinite(value, key);
        if (key === "opacity" && (value < 0 || value > 1))
          throw new EngineError("INVALID_TWEEN", "Opacity must be 0..1");
      },
    });
  return Object.freeze({
    offsetX: bind("offsetX"),
    offsetY: bind("offsetY"),
    opacity: bind("opacity"),
  });
}
/** Logical and display modes reserve the same channel, so a Slider has one animation authority. */
export function sliderTween(
  node: CanvasSliderNode,
  mode: "value" | "display" = "value",
) {
  if (mode !== "value" && mode !== "display")
    throw new EngineError("INVALID_TWEEN", "Unknown Slider animation mode");
  return Tween.bind({
    target: node,
    key: "slider-value",
    owner: node,
    scope: () => node.ui?.scene,
    read: () => (mode === "value" ? node.value : node.displayValue),
    write: (value) =>
      mode === "value"
        ? node.writeAnimatedValue(value)
        : node.writeAnimatedDisplayValue(value),
    valid: () => node.available && !node.editing,
    stamp: () => node.animationRevision,
    watch: (invalidate) => {
      const removers = [
        node.observeValueIntent(() => invalidate("external-write")),
      ];
      for (let p: CanvasNode | undefined = node; p; p = p.parent)
        removers.push(
          p.observeMutation(() => {
            if (!node.available) invalidate("target-unavailable");
          }),
        );
      return () => {
        for (const remove of removers) remove();
      };
    },
  });
}
