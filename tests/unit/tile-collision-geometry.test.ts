import {
  Actor,
  Collider,
  CollisionShape,
  Grid,
  CollisionResponse as R,
  SpriteSheet,
  Tilemap,
  Transform,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";
import {
  contactManifold,
  createGeometry,
  type GeometryEntry,
  updateGeometry,
} from "../../packages/core/src/game/collision-geometry";
import { correctPositions } from "../../packages/core/src/game/collision-response";
import {
  exposedFaces,
  TileFace,
  tileGeometry,
  tileRange,
  tileResponseManifold,
} from "../../packages/core/src/game/tile-collision-geometry";

const sheet = SpriteSheet.grid("unloaded.png", {
  frameWidth: 16,
  frameHeight: 16,
});
function entry(circle: boolean, rotation = 0): GeometryEntry {
  const actor = new Actor();
  const transform = actor.add(new Transform({ rotation }));
  const collider = actor.add(
    new Collider(
      circle
        ? { shape: CollisionShape.Circle, radius: 10, response: R.Solid }
        : { width: 20, height: 12, response: R.Solid },
    ),
  );
  return { actor, transform, collider, geometry: createGeometry() };
}
function slide(
  circle: boolean,
  rotation: number,
  horizontal: boolean,
  side: number,
  tangent: number,
  w: number,
  h: number,
) {
  const map = new Tilemap({
    sheet,
    tiles: Grid.generate(horizontal ? 24 : 5, horizontal ? 5 : 24, (x, y) =>
      (horizontal ? y : x) === 2 ? 0 : null,
    ),
    tileWidth: w,
    tileHeight: h,
    collision: { tiles: [{ tile: 0, response: R.Solid }] },
  });
  const a = entry(circle, rotation),
    ref = entry(circle, rotation);
  updateGeometry(a);
  const extent = horizontal
    ? (a.geometry.maxY - a.geometry.minY) / 2
    : (a.geometry.maxX - a.geometry.minX) / 2;
  const normal =
    side > 0
      ? (horizontal ? 2 * h : 2 * w) - extent
      : (horizontal ? 3 * h : 3 * w) + extent;
  const along =
    tangent > 0 ? (horizontal ? w : h) / 2 : 23 * (horizontal ? w : h);
  a.transform.x = ref.transform.x = horizontal ? along : normal;
  a.transform.y = ref.transform.y = horizontal ? normal : along;
  const wall = createGeometry();
  wall.minX = horizontal ? 0 : 2 * w;
  wall.maxX = horizontal ? 24 * w : 3 * w;
  wall.minY = horizontal ? 2 * h : 0;
  wall.maxY = horizontal ? 3 * h : 24 * h;
  wall.x = (wall.minX + wall.maxX) / 2;
  wall.y = (wall.minY + wall.maxY) / 2;
  wall.hx = (wall.maxX - wall.minX) / 2;
  wall.hy = (wall.maxY - wall.minY) / 2;
  const reference = { collider: { shape: CollisionShape.Box }, geometry: wall };
  const tile = {
    collider: { shape: CollisionShape.Box },
    geometry: createGeometry(),
  };
  const range = { x0: 0, y0: 0, x1: 0, y1: 0 },
    m = { normalX: 0, normalY: 0, depth: 0 };
  let maxError = 0;
  for (let step = 0; step < 60; step++) {
    for (const e of [a, ref]) {
      e.transform.x += horizontal ? tangent * 2 : side * 2;
      e.transform.y += horizontal ? side * 2 : tangent * 2;
    }
    updateGeometry(ref);
    if (contactManifold(ref, reference, m, 1e-7))
      correctPositions(ref.transform, wall, m, 1, 0);
    for (let i = 0; i < 6; i++) {
      updateGeometry(a);
      let changed = false;
      if (!tileRange(map, a.geometry, 1e-7, range)) break;
      for (let y = range.y0; y <= range.y1; y++)
        for (let x = range.x0; x <= range.x1; x++) {
          const policy = map.getCollision(x, y);
          if (!policy) continue;
          tileGeometry(map, x, y, tile.geometry);
          updateGeometry(a);
          if (
            tileResponseManifold(
              a,
              tile,
              exposedFaces(map, x, y, policy),
              m,
              1e-7,
            ) &&
            m.depth > 1e-7
          )
            changed =
              correctPositions(a.transform, tile.geometry, m, 1, 0) || changed;
        }
      if (!changed) break;
    }
    maxError = Math.max(
      maxError,
      Math.abs(a.transform.x - ref.transform.x),
      Math.abs(a.transform.y - ref.transform.y),
    );
  }
  map.dispose();
  a.actor.dispose();
  ref.actor.dispose();
  return maxError;
}
describe("exposed tile response features", () => {
  for (const circle of [true, false])
    for (const rotation of circle ? [0] : [0.37, -0.64])
      for (const horizontal of [false, true])
        for (const side of [-1, 1])
          for (const tangent of [-1, 1])
            it(`matches continuous wall: ${circle ? "circle" : "OBB"} rot=${rotation} horizontal=${horizontal} side=${side} tangent=${tangent}`, () => {
              expect(
                slide(circle, rotation, horizontal, side, tangent, 32, 32),
              ).toBeLessThan(1e-6);
              expect(
                slide(circle, rotation, horizontal, side, tangent, 48, 20),
              ).toBeLessThan(1e-6);
            });
  it("retains a convex corner's exact non-axis manifold", () => {
    const a = entry(true);
    a.transform.x = -5;
    a.transform.y = -5;
    updateGeometry(a);
    const tile = {
      collider: { shape: CollisionShape.Box },
      geometry: createGeometry(),
    };
    const map = new Tilemap({
      sheet,
      tiles: [[0], [0]],
      tileWidth: 32,
      tileHeight: 32,
      collision: { tiles: [{ tile: 0, response: R.Solid }] },
    });
    tileGeometry(map, 0, 0, tile.geometry);
    const m = { normalX: 0, normalY: 0, depth: 0 };
    const policy = map.getCollision(0, 0);
    if (!policy) throw Error("policy");
    expect(
      tileResponseManifold(a, tile, exposedFaces(map, 0, 0, policy), m, 1e-7),
    ).toBe(true);
    expect(m.normalX).toBeCloseTo(Math.SQRT1_2);
    expect(m.normalY).toBeCloseTo(Math.SQRT1_2);
    map.dispose();
    a.actor.dispose();
  });
  it("does not remove faces for a neighbor with different response or filters", () => {
    const map = new Tilemap({
      sheet,
      tiles: [[0, 0]],
      tileWidth: 32,
      tileHeight: 16,
      collision: { tiles: [{ tile: 0, response: R.Solid }] },
    });
    const policy = map.getCollision(0, 0);
    if (!policy) throw Error("policy");
    expect(exposedFaces(map, 0, 0, policy) & TileFace.Right).toBe(0);
    for (const neighbor of [
      { response: R.Trigger },
      { response: R.Solid, layer: 2 },
      { response: R.Solid, mask: 0 },
    ]) {
      map.setCollision(1, 0, neighbor);
      expect(exposedFaces(map, 0, 0, policy)).toBe(TileFace.All);
    }
    map.dispose();
  });
  it("includes both sides of contact boundaries in translated non-square maps", () => {
    const map = new Tilemap({
      sheet,
      tiles: [[0, 0]],
      tileWidth: 32,
      tileHeight: 16,
      x: -100,
      y: 50,
    });
    const g = createGeometry();
    g.minX = g.maxX = -68;
    g.minY = g.maxY = 66;
    const range = { x0: 0, y0: 0, x1: 0, y1: 0 };
    expect(tileRange(map, g, 1e-7, range)).toBe(true);
    expect(range).toEqual({ x0: 0, x1: 1, y0: 0, y1: 0 });
    map.dispose();
  });
});
