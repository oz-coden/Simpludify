import { HexOrientation, TileGeometry } from "@simpludify/core";
import { describe, expect, it } from "vitest";

const geometries = [
  TileGeometry.square({ width: 30, height: 20 }),
  TileGeometry.triangle({ width: 30 }),
  ...Object.values(HexOrientation).map((orientation) =>
    TileGeometry.hex({ radius: 20, orientation }),
  ),
];
for (const g of geometries)
  describe(`${g.kind} ${g.orientation}`, () => {
    it("round-trips negative and positive centers, vertices and bounds", () => {
      for (let y = -12; y <= 12; y++)
        for (let x = -12; x <= 12; x++) {
          const c = g.center(x, y),
            b = g.bounds(x, y),
            v = g.vertices(x, y);
          expect(g.worldToTile(c.x, c.y)).toMatchObject({ x, y });
          expect(v.length).toBe(
            g.kind === "hex" ? 6 : g.kind === "triangle" ? 3 : 4,
          );
          expect(v.reduce((s, p) => s + p.x, 0) / v.length).toBeCloseTo(c.x);
          expect(v.reduce((s, p) => s + p.y, 0) / v.length).toBeCloseTo(c.y);
          for (const p of v) {
            expect(p.x).toBeGreaterThanOrEqual(b.x - 1e-10);
            expect(p.x).toBeLessThanOrEqual(b.x + b.width + 1e-10);
            expect(p.y).toBeGreaterThanOrEqual(b.y - 1e-10);
            expect(p.y).toBeLessThanOrEqual(b.y + b.height + 1e-10);
          }
          const n = g.neighbors(x, y);
          expect(n.length).toBe(
            g.kind === "hex" ? 6 : g.kind === "triangle" ? 3 : 4,
          );
          for (const p of n)
            expect(g.neighbors(p.x, p.y)).toContainEqual({
              space: "tile",
              x,
              y,
            });
        }
    });
    it("matches bounding candidates against a brute force oracle, including clipped slanted rows", () => {
      for (const b of [
        { x: -37, y: -22, width: 73, height: 61 },
        { x: 25, y: 25, width: 1, height: 1 },
        { x: 0, y: 0, width: 100, height: 100 },
      ]) {
        const expected = [];
        for (let y = -15; y < 15; y++)
          for (let x = -15; x < 15; x++) {
            const a = g.bounds(x, y);
            if (
              a.x <= b.x + b.width + 1e-9 &&
              a.x + a.width >= b.x - 1e-9 &&
              a.y <= b.y + b.height + 1e-9 &&
              a.y + a.height >= b.y - 1e-9
            )
              expected.push({ space: "tile", x, y });
          }
        expect([
          ...g.tilesInBounds(b, { x: -15, y: -15, width: 30, height: 30 }),
        ]).toEqual(expected);
      }
    });
    it("assigns every shared polygon edge consistently with a row/column tie break", () => {
      if (g.kind === "square") {
        expect(g.worldToTile(30, 20)).toMatchObject({ x: 1, y: 1 });
        return;
      }
      for (let y = -2; y <= 2; y++)
        for (let x = -2; x <= 2; x++) {
          const vs = g.vertices(x, y);
          for (let i = 0; i < vs.length; i++) {
            const a = vs[i],
              b = vs[(i + 1) % vs.length];
            if (!a || !b) throw Error();
            const px = (a.x + b.x) / 2,
              py = (a.y + b.y) / 2;
            const candidates = [{ x, y }, ...g.neighbors(x, y)]
              .filter(
                (t) =>
                  g
                    .vertices(t.x, t.y)
                    .filter(
                      (v) =>
                        Math.hypot(v.x - a.x, v.y - a.y) < 1e-8 ||
                        Math.hypot(v.x - b.x, v.y - b.y) < 1e-8,
                    ).length === 2,
              )
              .sort((a, b) => a.y - b.y || a.x - b.x);
            expect(candidates.length).toBe(2);
            expect(g.worldToTile(px, py)).toMatchObject(candidates[0] ?? {});
          }
        }
    });
  });
it("triangle parity, hex distances and bounded disks", () => {
  const t = geometries[1];
  expect(t?.pointsUp(0, 0)).toBe(true);
  expect(t?.pointsUp(-1, 0)).toBe(false);
  const h = TileGeometry.hex({ radius: 10 });
  expect(h.distance({ x: -3, y: 2 }, { x: 2, y: -1 })).toBe(5);
  for (let r = 0; r < 5; r++) {
    const cells = [...h.withinRadius(-2, 3, r)];
    expect(cells.length).toBe(1 + 3 * r * (r + 1));
    for (const c of cells)
      expect(h.distance(c, { x: -2, y: 3 })).toBeLessThanOrEqual(r);
  }
});
it("rejects invalid sizes, coordinates, orientation and ranges", () => {
  expect(() => TileGeometry.hex({ radius: 0 })).toThrow();
  expect(() => TileGeometry.square({ width: Infinity })).toThrow();
  for (const g of geometries) {
    expect(() => g.center(0.5, 0)).toThrow();
    expect(() => g.worldToTile(NaN, 0)).toThrow();
    expect(() => [
      ...g.tilesInBounds({ x: 0, y: 0, width: -1, height: 1 }),
    ]).toThrow();
  }
});
