import {
  Camera,
  CollisionWorld,
  createViewTransform,
  Engine,
  GeometryTilemap,
  Grid,
  HexOrientation,
  Scene,
  screenPoint,
  TileGeometry,
  worldToScreen,
} from "@simpludify/core";
import { expect, it, vi } from "vitest";
import { GeometryTilemapVisual } from "../../packages/web/src/geometry-tilemap-visual";

const geometries = [
  TileGeometry.square({ width: 32 }),
  TileGeometry.triangle({ width: 32 }),
  ...Object.values(HexOrientation).map((orientation) =>
    TileGeometry.hex({ radius: 20, orientation }),
  ),
];
for (const geometry of geometries) {
  it(`${geometry.kind}/${geometry.orientation} copies cells, updates locally and owns lifecycle`, () => {
    const input = new Grid<number | null>(64, 48, 0xff0000),
      scene = new Scene("map");
    const m = new GeometryTilemap({
      geometry,
      tiles: input,
      x: -40,
      y: 20,
    }).place(scene);
    input.fill(null);
    expect(m.get(1, 1)).toBe(0xff0000);
    const changed = vi.fn(),
      off = m.onTilesChanged(changed);
    m.set(1, 1, 0xff0000);
    m.set(1, 1, null);
    expect(changed.mock.calls).toEqual([[65]]);
    const rev = m.revision;
    expect(() => m.set(1, 1, -1)).toThrow();
    expect(m.revision).toBe(rev);
    expect(m.get(1, 1)).toBe(null);
    m.fill(0x112233);
    m.fill(0x112233);
    expect(changed.mock.calls).toEqual([[65], [null]]);
    const saved = m.copyTiles();
    saved.fill(null);
    expect(m.get(1, 1)).toBe(0x112233);
    off();
    m.set(1, 1, 0);
    expect(changed).toHaveBeenCalledTimes(2);
    for (const camera of [
      new Camera(),
      new Camera({ x: -80, y: 30, zoom: 1.8 }),
    ]) {
      const view = createViewTransform({
        viewport: { x: 20, y: 30, width: 800, height: 450 },
        camera,
      });
      const center = m.tileToWorld(10, 10, { center: true }),
        p = worldToScreen(view, center);
      expect(m.worldToTile(center.x, center.y)).toMatchObject({ x: 10, y: 10 });
      const visible =
        p.x >= view.clip.x &&
        p.x < view.clip.x + view.clip.width &&
        p.y >= view.clip.y &&
        p.y < view.clip.y + view.clip.height;
      expect(m.screenToTile(view, p)).toEqual(
        visible ? { space: "tile", x: 10, y: 10 } : undefined,
      );
      expect(m.screenToTile(view, screenPoint(-10, -10))).toBeUndefined();
    }
    expect(m.worldToTile(-10000, -10000)).toBeUndefined();
    expect(m.neighbors(0, 0).every((t) => m.inBounds(t.x, t.y))).toBe(true);
    const b = m.tileBounds(1, 1),
      v = m.tileVertices(1, 1);
    expect(v.every((p) => p.space === "world" && p.x >= b.x - 1e-10)).toBe(
      true,
    );
    scene.dispose();
    expect(m.disposed).toBe(true);
    expect(() => m.set(0, 0, 0)).toThrow();
    expect(() => m.onTilesChanged(() => {})).toThrow();
    m.dispose();
  });
  it(`${geometry.kind}/${geometry.orientation} retains visible Graphics, ignores offscreen edits and refreshes bulk/hidden edits`, () => {
    const m = new GeometryTilemap({
      geometry,
      tiles: new Grid<number | null>(200, 200, 0xff0000),
    });
    const release = vi.fn(),
      v = new GeometryTilemapVisual(m, release);
    const view = createViewTransform({
      viewport: { x: 0, y: 0, width: 800, height: 450 },
    });
    v.render(view);
    const n = v.stats.visitedCells,
      g = v.graphics.get(201),
      context = g?.context;
    expect(v.graphics.size).toBeLessThan(2000);
    v.render(view);
    expect(v.stats.visitedCells).toBe(n);
    m.set(190, 190, null);
    v.render(view);
    expect(v.stats.visitedCells).toBe(n);
    m.set(1, 1, 0);
    v.render(view);
    expect(v.stats.visitedCells).toBe(n + 1);
    expect(v.graphics.get(201)).toBe(g);
    m.fill(0x112233);
    v.render(view);
    expect(v.stats.updatedTiles).toBeGreaterThan(n + 1);
    m.visible = false;
    v.render(view);
    m.set(1, 1, null);
    v.render(view);
    m.visible = true;
    v.render(view);
    expect(v.graphics.has(201)).toBe(false);
    expect(context?.destroyed).toBe(true);
    m.set(1, 1, 0xffffff);
    v.render(view);
    expect(v.graphics.has(201)).toBe(true);
    m.x = -5000;
    v.render(view);
    expect(v.graphics.size).toBeLessThan(2000);
    m.dispose();
    expect(v.disposed).toBe(true);
    expect(v.graphics.size).toBe(0);
    expect(release).toHaveBeenCalledTimes(1);
  });
}
it("color layers do not enter the rectangle collision index", () => {
  const engine = new Engine(),
    world = new CollisionWorld(engine.scene, { tileSearch: "rectangles" });
  new GeometryTilemap({
    geometry: TileGeometry.hex({ radius: 10 }),
    tiles: [[0]],
  }).place(engine.scene);
  engine.step(0);
  expect(world.tileIndexDiagnostics).toMatchObject({
    chunks: 0,
    cells: 0,
    builds: 0,
  });
  engine.dispose();
});
it("rejects malformed data and invalid indexed access without mutation", () => {
  const geometry = TileGeometry.triangle({ width: 10 });
  for (const tiles of [[], [[]], [[0], [0, 1]], [[NaN]], [[0xffffff + 1]]])
    expect(() => new GeometryTilemap({ geometry, tiles })).toThrow();
  const m = new GeometryTilemap({ geometry, tiles: [[0]] });
  expect(() => m.get(-1, 0)).toThrow();
  expect(() => m.tileBounds(0.5, 0)).toThrow();
  expect(() => m.set(1, 0, 0)).toThrow();
  expect(() => {
    m.x = Infinity;
  }).toThrow();
  expect(m.x).toBe(0);
});

it("releases ownership even when presentation destruction throws", () => {
  const m = new GeometryTilemap({
    geometry: TileGeometry.hex({ radius: 10 }),
    tiles: [[0]],
  });
  const release = vi.fn(),
    v = new GeometryTilemapVisual(m, release);
  v.render(
    createViewTransform({ viewport: { x: 0, y: 0, width: 800, height: 450 } }),
  );
  const destroy = vi.spyOn(v.display, "destroy").mockImplementationOnce(() => {
    throw Error("cleanup failed");
  });
  expect(() => m.dispose()).toThrow();
  expect(release).toHaveBeenCalledTimes(1);
  expect(v.disposed).toBe(true);
  destroy.mockRestore();
  v.display.destroy({ children: true, context: true });
  v.dispose();
  expect(release).toHaveBeenCalledTimes(1);
});
