import { Engine, Grid, Scene, SpriteSheet, Tilemap } from "@simpludify/core";
import { expect, it } from "vitest";

const sheet = SpriteSheet.grid("tiles.svg", {
  frameWidth: 16,
  frameHeight: 16,
  names: { grass: 0, water: 1 },
});
const create = () =>
  new Tilemap({
    sheet,
    tiles: [
      ["grass", null],
      [1, "water"],
    ],
    tileWidth: 20,
    tileHeight: 10,
    x: -10,
    y: 5,
  });
it("copies rows and Grids; snapshots are independent and reusable across Scenes", () => {
  const input = new Grid<number | null>(2, 2, 0);
  const map = new Tilemap({
    sheet,
    tiles: input,
    tileWidth: 16,
    tileHeight: 16,
  });
  input.set(0, 0, null);
  expect(map.get(0, 0)).toBe(0);
  const copy = map.copyTiles();
  copy.set(0, 0, 1);
  expect(map.get(0, 0)).toBe(0);
  const scene = new Scene("field");
  map.place(scene);
  scene.dispose();
  expect(map.disposed).toBe(true);
  expect(() => map.set(0, 0, 1)).toThrow();
  expect(
    new Tilemap({ sheet, tiles: copy, tileWidth: 16, tileHeight: 16 }).get(
      0,
      0,
    ),
  ).toBe(1);
  const rows = [[0, null]];
  const a = new Tilemap({ sheet, tiles: rows, tileWidth: 16, tileHeight: 16 });
  rows[0]?.fill(1);
  expect(a.get(1, 0)).toBe(null);
});
it("tracks edits, semantic no-ops, atomic invalid writes and bulk fill", () => {
  const map = create();
  const changes: (number | null)[] = [];
  const off = map.onTilesChanged((i) => changes.push(i));
  map.set(0, 0, "grass");
  expect(map.revision).toBe(0);
  map.set(1, 0, 0);
  expect(changes).toEqual([1]);
  expect([...map.tileIds()]).toContain(0);
  expect(() => map.set(0, 0, "bad" as "grass")).toThrow();
  expect(map.get(0, 0)).toBe("grass");
  map.fill(null);
  expect([...map.tileIds()]).toEqual([]);
  expect(changes).toEqual([1, null]);
  map.fill(null);
  expect(map.revision).toBe(2);
  off();
  map.set(0, 0, 1);
  expect(changes).toHaveLength(2);
});
it("keeps tile/world coordinates separate with negative origin and half-open bounds", () => {
  const map = create();
  expect(map.tileToWorld(1, 1)).toEqual({ space: "world", x: 10, y: 15 });
  expect(map.tileToWorld(1, 1, { center: true })).toEqual({
    space: "world",
    x: 20,
    y: 20,
  });
  expect(map.worldToTile(-10, 5)).toEqual({ space: "tile", x: 0, y: 0 });
  expect(map.worldToTile(10, 15)).toEqual({ space: "tile", x: 1, y: 1 });
  for (const [x, y] of [
    [-10.1, 5],
    [30, 5],
    [-10, 25],
  ])
    expect(map.worldToTile(x as number, y as number)).toBeUndefined();
  expect(() => map.worldToTile(NaN, 0)).toThrow();
});
it("rejects malformed rows, values, coordinates and placement before mutation", () => {
  for (const tiles of [
    [],
    [[0], []],
    new Array(2),
    [[undefined]],
    [new Array(3)],
  ])
    expect(
      () =>
        new Tilemap({
          sheet,
          tiles: tiles as number[][],
          tileWidth: 16,
          tileHeight: 16,
        }),
    ).toThrow();
  const map = create();
  for (const [x, y] of [
    [-1, 0],
    [2, 0],
    [0.5, 0],
    [NaN, 0],
  ]) {
    expect(() => map.get(x as number, y as number)).toThrow();
    expect(() => map.set(x as number, y as number, 0)).toThrow();
  }
  expect(() => {
    map.x = Infinity;
  }).toThrow();
  expect(map.x).toBe(-10);
  expect(
    () => new Tilemap({ sheet, tiles: [[0]], tileWidth: 0, tileHeight: 1 }),
  ).toThrow();
});
it("uses exactly one passive Actor per map and normal Scene ownership", () => {
  const engine = new Engine();
  const a = create(),
    b = create();
  a.place(engine.scene);
  b.place(engine.scene);
  expect(engine.scene.actors.length).toBe(2);
  expect(engine.scene.actors[0]?.hasUpdates).toBe(false);
  expect(() => a.place(new Scene("other"))).toThrow();
  engine.step(1);
  engine.dispose();
  expect(a.disposed && b.disposed).toBe(true);
});
