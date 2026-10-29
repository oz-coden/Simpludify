import {
  Actor,
  Collider,
  CollisionBody,
  CollisionShape,
  CollisionWorld,
  Engine,
  Grid,
  Motion,
  CollisionResponse as R,
  SpriteSheet,
  Tilemap,
  Transform,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";
import { runWallScenario } from "../helpers/tile-wall-scenario";

describe("formal CollisionWorld continuous tile boundaries", () => {
  for (const circle of [true, false])
    for (const rotation of circle ? [0] : [0.37, -0.64])
      for (const horizontal of [false, true])
        for (const side of [-1, 1] as const)
          for (const tangent of [-1, 1] as const)
            it(`matches Actor wall: circle=${circle}, rot=${rotation}, horizontal=${horizontal}, side=${side}, tangent=${tangent}`, () => {
              for (const [tileWidth, tileHeight] of [
                [32, 32],
                [48, 20],
              ]) {
                if (!tileWidth || !tileHeight) throw Error();
                const result = runWallScenario({
                  circle,
                  rotation,
                  horizontal,
                  side,
                  tangent,
                  tileWidth,
                  tileHeight,
                });
                expect(result.maxError).toBeLessThan(1e-6);
                expect(result.maxUnresolved).toBe(0);
              }
            });
  for (const circle of [true, false])
    for (const rotation of circle ? [0] : [0.37, -0.64])
      for (const horizontal of [false, true])
        for (const side of [-1, 1] as const)
          for (const tangent of [-1, 1] as const)
            it(`matches convex Actor corner: circle=${circle}, rot=${rotation}, horizontal=${horizontal}, side=${side}, tangent=${tangent}`, () => {
              for (const [tileWidth, tileHeight] of [
                [32, 32],
                [48, 20],
              ]) {
                if (!tileWidth || !tileHeight) throw Error();
                const result = runWallScenario({
                  corner: true,
                  circle,
                  rotation,
                  horizontal,
                  side,
                  tangent,
                  tileWidth,
                  tileHeight,
                });
                expect(result.maxError).toBeLessThan(1e-6);
                expect(result.maxUnresolved).toBe(0);
              }
            });
  it.each([true, false])(
    "stops at concave wall corners without seam displacement (circle=%s)",
    (circle) => {
      const engine = new Engine(),
        world = new CollisionWorld(engine.scene);
      new Tilemap({
        sheet: SpriteSheet.grid("unused", { frameWidth: 16, frameHeight: 16 }),
        tiles: Grid.generate(6, 6, (x, y) => (x === 2 || y === 2 ? 0 : null)),
        tileWidth: 32,
        tileHeight: 32,
        collision: { tiles: [{ tile: 0, response: R.Solid }] },
      }).place(engine.scene);
      const actor = engine.scene.add(new Actor()),
        rotation = circle ? 0 : 0.37;
      const t = actor.add(new Transform({ x: 45, y: 45, rotation }));
      actor.add(new Motion({ x: 1, y: 1, speed: 120 }));
      actor.add(new CollisionBody());
      actor.add(
        new Collider(
          circle
            ? { shape: CollisionShape.Circle, radius: 10, response: R.Solid }
            : { width: 20, height: 12, response: R.Solid },
        ),
      );
      for (let step = 0; step < 90; step++) engine.step(1 / 60);
      const ex = circle ? 10 : Math.cos(rotation) * 10 + Math.sin(rotation) * 6;
      const ey = circle ? 10 : Math.sin(rotation) * 10 + Math.cos(rotation) * 6;
      expect(t.x).toBeCloseTo(64 - ex);
      expect(t.y).toBeCloseTo(64 - ey);
      expect(world.tileDiagnostics.unresolved).toBe(0);
      engine.dispose();
    },
  );
});
