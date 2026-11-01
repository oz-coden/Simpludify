import {
  Actor,
  actorTween,
  Collider,
  CollisionShape,
  Engine,
  Renderable,
  Shape,
  Transform,
  Tween,
} from "@simpludify/core";
import { expect, it } from "vitest";

it("hexagon appearance retains circle/box physics and uses existing live Tween channels", () => {
  const engine = new Engine(),
    actor = engine.scene.add(new Actor());
  const transform = actor.add(new Transform({ x: 10, y: 20, rotation: 0.3 }));
  const r = actor.add(
    new Renderable({
      source: { kind: "shape", shape: Shape.Hexagon },
      width: 60,
      height: 80,
      color: 0xabcdef,
    }),
  );
  const c = actor.add(
    new Collider({ shape: CollisionShape.Circle, radius: 10 }),
  );
  const old = r.revision;
  r.width = 100;
  r.opacity = 0.4;
  r.rotation = 1;
  r.scaleX = 2;
  r.source = { kind: "shape", shape: Shape.Triangle };
  r.source = { kind: "shape", shape: Shape.Hexagon };
  expect(r.revision).toBeGreaterThan(old);
  expect(c.shape).toBe(CollisionShape.Circle);
  engine.scene.tweens.play(
    Tween.to(actorTween(actor).rotation, 2, { duration: 1 }),
  );
  engine.step(0.5);
  expect(r.rotation).toBeCloseTo(1.5);
  expect(transform.rotation).toBe(0.3);
  engine.dispose();
});
