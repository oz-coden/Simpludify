import {
  Actor,
  BodyType,
  Collider,
  CollisionBody,
  CollisionShape,
  CollisionWorld,
  Engine,
  Grid,
  Motion,
  CollisionResponse as R,
  SpriteSheet,
  TileContactEnter,
  TileContactExit,
  TileContactStay,
  Tilemap,
  Transform,
} from "@simpludify/core";
import { describe, expect, it } from "vitest";
import { TileCollisionIndex } from "../../packages/core/src/game/tile-collision-index";
import { runWallScenario } from "../helpers/tile-wall-scenario";

const sheet = SpriteSheet.grid("never-loaded.png", {
  frameWidth: 16,
  frameHeight: 16,
});
const solid = { response: R.Solid };
const make = (size = 40) =>
  new Tilemap({
    sheet,
    tiles: new Grid<number | null>(size, size, 0),
    tileWidth: 24,
    tileHeight: 16,
    x: -70,
    y: -100,
    collision: { tiles: [{ tile: 0, ...solid }] },
  });
function all(map: Tilemap, index: TileCollisionIndex) {
  const cells: number[] = [];
  const regions: unknown[] = [];
  index.query(
    { x0: 0, y0: 0, x1: map.width - 1, y1: map.height - 1 },
    (r) => {
      regions.push({ ...r });
      return true;
    },
    cells,
  );
  return { cells, regions };
}
describe("rectangle candidate geometry", () => {
  it("merges both axes without per-cell Collider allocations and keeps chunk boundaries", () => {
    const map = make(32),
      index = new TileCollisionIndex(map);
    const result = all(map, index);
    expect(result.cells).toEqual(Array.from({ length: 1024 }, (_, i) => i));
    expect(index.diagnostics).toMatchObject({
      regions: 4,
      cells: 1024,
      chunks: 4,
      builds: 4,
    });
    expect(result.regions[0]).toMatchObject({ x0: 0, y0: 0, x1: 15, y1: 15 });
    map.dispose();
    expect(index.diagnostics.chunks).toBe(0);
    expect(all(map, index).cells).toEqual([]);
  });
  it("covers randomized holes, stairs, checkerboards and complete policy boundaries exactly once", () => {
    let seed = 2345;
    for (let trial = 0; trial < 20; trial++) {
      const map = make(19);
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const kind = seed % 5;
          map.setCollision(
            x,
            y,
            kind === 0
              ? null
              : {
                  response: kind === 1 ? R.Trigger : R.Solid,
                  layer: kind === 2 ? 2 : 1,
                  mask: kind === 3 ? 0 : 0xffffffff,
                },
          );
        }
      const index = new TileCollisionIndex(map),
        result: number[] = [],
        expected: number[] = [];
      index.query(
        { x0: 2, y0: 3, x1: 18, y1: 17 },
        (region) => {
          for (let y = region.y0; y <= region.y1; y++)
            for (let x = region.x0; x <= region.x1; x++)
              expect(map.getCollision(x, y)).toEqual(region.policy);
          return true;
        },
        result,
      );
      for (let y = 3; y <= 17; y++)
        for (let x = 2; x <= 18; x++)
          if (map.getCollision(x, y)) expected.push(y * map.width + x);
      expect(result).toEqual(expected);
      map.dispose();
    }
  });
  it("rebuilds one touched chunk and retains unrelated regions through movement", () => {
    const map = make(32),
      index = new TileCollisionIndex(map);
    all(map, index);
    map.setCollision(3, 4, null);
    expect(index.diagnostics).toMatchObject({ builds: 4, chunks: 3 });
    expect(all(map, index).cells).toHaveLength(1023);
    expect(index.diagnostics).toMatchObject({ builds: 5, builtCells: 1280 });
    map.x += 120;
    map.y -= 24;
    all(map, index);
    expect(index.diagnostics.builds).toBe(5);
    map.dispose();
  });
  it("tracks ID defaults after equal-policy image changes, sparse overrides and bulk edits", () => {
    const map = make(32),
      index = new TileCollisionIndex(map);
    map.setTileCollision(1, solid);
    all(map, index);
    map.set(0, 0, 1); // same collision value; future ID edits must still invalidate.
    all(map, index);
    map.setTileCollision(1, null);
    expect(all(map, index).cells).toHaveLength(1023);
    map.setCollision(0, 0, { response: R.Trigger });
    expect(all(map, index).cells).toHaveLength(1024);
    map.resetCollision(0, 0);
    expect(all(map, index).cells).toHaveLength(1023);
    map.fill(null);
    expect(all(map, index).cells).toEqual([]);
    map.setCollision(31, 31, solid);
    expect(all(map, index).cells).toEqual([1023]);
    index.dispose();
    index.dispose();
    map.dispose();
  });
});
function simulation(tileSearch: "cells" | "rectangles", circle: boolean) {
  const engine = new Engine(),
    world = new CollisionWorld(engine.scene, { tileSearch });
  const map = new Tilemap({
    sheet,
    tiles: Grid.generate(40, 32, (x, y) =>
      x === 16 || y === 16 ? 0 : (x + y) % 7 === 0 ? 1 : null,
    ),
    tileWidth: 24,
    tileHeight: 16,
    x: -70,
    y: -100,
    collision: {
      tiles: [
        { tile: 0, ...solid },
        { tile: 1, response: R.Trigger },
      ],
    },
  }).place(engine.scene);
  const log: unknown[] = [],
    bodies: Transform[] = [];
  const colliders: Collider[] = [];
  for (let i = 0; i < 4; i++) {
    const actor = engine.scene.add(new Actor());
    bodies.push(
      actor.add(
        new Transform({ x: 275 + i * 12, y: 100 + i * 9, rotation: i * 0.31 }),
      ),
    );
    actor.add(new Motion({ x: 1, y: 1, speed: 100 }));
    actor.add(
      new CollisionBody({
        motion: i === 2 ? BodyType.Static : BodyType.Dynamic,
      }),
    );
    const c = actor.add(
      new Collider({
        ...(circle
          ? { shape: CollisionShape.Circle, radius: 11 }
          : { width: 24, height: 13 }),
        response: i === 3 ? R.Trigger : R.Solid,
      }),
    );
    colliders.push(c);
    for (const [token, phase] of [
      [TileContactEnter, "enter"],
      [TileContactStay, "stay"],
      [TileContactExit, "exit"],
    ] as const)
      c.events.on(token, (contact) => {
        const {
          tileX,
          tileY,
          tileId,
          response,
          normalX,
          normalY,
          depth,
          resolved,
          policy,
        } = contact;
        log.push({
          i,
          phase,
          tileX,
          tileY,
          tileId,
          response,
          normalX,
          normalY,
          depth,
          resolved,
          policy,
        });
        // Edit during delivery: later captured contacts must not change in this pass.
        if (i === 0 && phase === "enter") map.setCollision(tileX, tileY, null);
      });
  }
  return { engine, world, map, log, bodies, colliders };
}
describe("shared solver equivalence", () => {
  it.each([true, false])(
    "retains exact trajectories and ordered cell events across dynamic edits (circle=%s)",
    (circle) => {
      const a = simulation("cells", circle),
        b = simulation("rectangles", circle);
      for (let frame = 0; frame < 100; frame++) {
        for (const f of [a, b]) {
          if (frame === 15) f.map.set(16, 14, null);
          if (frame === 20) f.map.setCollision(15, 14, solid);
          if (frame === 25)
            f.map.setTileCollision(1, { response: R.Solid, mask: 0 });
          if (frame === 30) f.engine.pause();
          if (frame === 32) f.engine.resume();
          if (frame === 40) f.map.collisionEnabled = false;
          if (frame === 42) f.map.collisionEnabled = true;
          if (frame === 50) f.map.x += 3;
          if (frame === 60) f.map.visible = false;
          if (frame === 70) f.map.enabled = false;
          if (frame === 72) f.map.enabled = true;
          if (frame === 80) f.map.fill(1);
          f.engine.step(1 / 60);
        }
        expect(b.bodies.map((t) => [t.x, t.y])).toEqual(
          a.bodies.map((t) => [t.x, t.y]),
        );
        expect(b.log).toEqual(a.log);
        expect(b.world.responseDiagnostics).toEqual(
          a.world.responseDiagnostics,
        );
        a.log.length = b.log.length = 0;
      }
      a.engine.dispose();
      b.engine.dispose();
      expect(b.world.tileIndexDiagnostics.chunks).toBe(0);
      expect(b.world.tileDiagnostics.retainedCells).toBe(0);
      expect(() => b.map.set(0, 0, 0)).toThrow();
    },
  );
  it("matches existing Actor wall/corner trajectories through merged chunk seams", () => {
    for (const circle of [true, false])
      for (const rotation of circle ? [0] : [0.37, -0.64])
        for (const horizontal of [false, true])
          for (const side of [-1, 1] as const)
            for (const tangent of [-1, 1] as const)
              for (const corner of [true, false]) {
                const result = runWallScenario({
                  circle,
                  rotation,
                  horizontal,
                  side,
                  tangent,
                  corner,
                  tileWidth: 48,
                  tileHeight: 20,
                  tileSearch: "rectangles",
                });
                expect(result.maxError).toBeLessThan(1e-6);
                expect(result.maxUnresolved).toBe(0);
              }
  });
  it("keeps discrete tunneling and next-pass new-wall correction explicit in both modes", () => {
    for (const tileSearch of ["cells", "rectangles"] as const) {
      const f = simulation(tileSearch, true),
        t = f.bodies[0];
      if (!t) throw Error();
      t.x = -1000;
      t.y = -1000;
      f.engine.step(0);
      t.x = 700;
      t.y = 0; // teleported past the complete wall; no swept contact.
      f.engine.step(0);
      expect(t.x).toBe(700);
      f.map.setCollision(32, 6, solid);
      t.x = 32 * 24 - 70 - 5;
      t.y = 6 * 16 - 100 + 8;
      const before = t.x;
      expect(t.x).toBe(before);
      f.engine.step(0);
      expect(t.x).toBeLessThan(before);
      f.engine.dispose();
    }
  });
  it("validates search mode before acquiring the Scene hook", () => {
    const engine = new Engine();
    expect(
      () => new CollisionWorld(engine.scene, { tileSearch: "bad" as "cells" }),
    ).toThrow();
    const world = new CollisionWorld(engine.scene, {
      tileSearch: "rectangles",
    });
    world.dispose();
    new CollisionWorld(engine.scene).dispose();
    engine.dispose();
  });
});
it("returns validated independent cell rectangles at negative origins and half-open endpoints", () => {
  const map = make(2),
    bounds = map.tileBounds(1, 1);
  expect(bounds).toEqual({ x: -46, y: -84, width: 24, height: 16 });
  bounds.x = 123;
  expect(map.tileBounds(1, 1).x).toBe(-46);
  expect(map.worldToTile(-46, -84)).toMatchObject({ x: 1, y: 1 });
  expect(map.worldToTile(-22, -68)).toBeUndefined();
  for (const x of [-1, 2, 0.5, NaN, Infinity])
    expect(() => map.tileBounds(x, 0)).toThrow();
  map.dispose();
});
