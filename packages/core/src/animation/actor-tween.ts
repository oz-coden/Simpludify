import { EngineError } from "../foundation/diagnostics";
import { Tween, tweenFinite } from "../foundation/tween";
import { Renderable } from "../graphics/components";
import type { Actor } from "../scene/actor";
/** Explicit draw-only channels. World Transform/Motion/CollisionBody are never tweened. */
export function actorTween(actor: Actor) {
  const view = actor.require(Renderable.type);
  const bind = (
    key: "offsetX" | "offsetY" | "rotation" | "scaleX" | "scaleY" | "opacity",
  ) =>
    Tween.bind({
      target: view,
      key,
      owner: view,
      scope: () => actor.scene,
      read: () => view[key],
      write: (value) => {
        view[key] = value;
        return Object.is(view[key], value);
      },
      valid: () => !actor.disposed && actor.get(Renderable.type) === view,
      validate: (value) => {
        tweenFinite(value, key);
        if (key === "opacity" && (value < 0 || value > 1))
          throw new EngineError("INVALID_TWEEN", "Opacity must be 0..1");
      },
    });
  return Object.freeze({
    offsetX: bind("offsetX"),
    offsetY: bind("offsetY"),
    rotation: bind("rotation"),
    scaleX: bind("scaleX"),
    scaleY: bind("scaleY"),
    opacity: bind("opacity"),
  });
}
