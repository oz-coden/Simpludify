import {
  Actor,
  actorTween,
  CollisionBody,
  Engine,
  Motion,
  Renderable,
  Scene,
  SpriteAnimation,
  SpriteSheet,
  Transform,
  Tween,
} from "@simpludify/core";
import { expect, it } from "vitest";

function actor(scene: Scene) {
  const actor = scene.add(new Actor());
  actor.add(new Transform());
  actor.add(new Renderable({ width: 16, height: 16 }));
  return actor;
}
it("draw-only tween coexists with Motion and collision-body ownership without changing world intent", () => {
  const engine = new Engine(),
    a = actor(engine.scene),
    view = a.require(Renderable.type),
    t = a.require(Transform.type);
  a.add(new Motion({ x: 1, speed: 10 }));
  a.add(new CollisionBody());
  engine.scene.tweens.play(
    Tween.parallel(
      Tween.to(actorTween(a).offsetX, 100, { duration: 1 }),
      Tween.to(actorTween(a).rotation, Math.PI, { duration: 1 }),
      Tween.to(actorTween(a).opacity, 0.5, { duration: 1 }),
    ),
  );
  engine.step(0.5);
  expect(t.x).toBe(5);
  expect(view.offsetX).toBe(50);
  expect(view.rotation).toBe(Math.PI / 2);
  expect(t.rotation).toBe(0);
  expect(view.opacity).toBe(0.75);
  engine.dispose();
});
it("SpriteAnimation changes source while render tweens change rotation/scale; neither steals the other", () => {
  const e = new Engine(),
    a = actor(e.scene),
    v = a.require(Renderable.type),
    sheet = SpriteSheet.grid("frames.png", {
      frameWidth: 16,
      frameHeight: 16,
    });
  const animation = a.add(
    new SpriteAnimation({
      sheet,
      clips: { walk: { frames: [0, 1], fps: 2 } },
      initial: "walk",
    }),
  );
  e.scene.tweens.play(Tween.to(actorTween(a).scaleX, 2, { duration: 1 }));
  e.step(0.5);
  expect(animation.frameIndex).toBe(1);
  expect(v.source.kind).toBe("image");
  expect(v.scaleX).toBe(1.5);
  e.dispose();
});
it("Renderable removal and Scene disposal cancel playback and allow no later writes", () => {
  const e = new Engine(),
    a = actor(e.scene),
    v = a.require(Renderable.type),
    clock = e.scene.tweens,
    p = clock.play(Tween.to(actorTween(a).offsetX, 30, { duration: 1 }));
  a.remove(Renderable.type);
  expect(p.state).toBe("cancelled");
  e.step(0.5);
  expect(v.offsetX).toBe(0);
  expect(clock.diagnostics.active).toBe(0);
  e.dispose();
});
it("rejects cross-Scene adapter playback, unsafe class property reflection and invalid visual endpoints", () => {
  const e = new Engine(),
    other = new Scene("other"),
    a = actor(other);
  expect(() =>
    e.scene.tweens.play(Tween.to(actorTween(a).offsetX, 2, { duration: 1 })),
  ).toThrow();
  expect(() => Tween.property(a, "x" as never)).toThrow();
  expect(() => Tween.to(actorTween(a).opacity, 2, { duration: 1 })).toThrow();
  for (const key of [
    "offsetX",
    "offsetY",
    "rotation",
    "scaleX",
    "scaleY",
  ] as const)
    expect(() => {
      a.require(Renderable.type)[key] = NaN;
    }).toThrow();
  other.dispose();
  e.dispose();
});
