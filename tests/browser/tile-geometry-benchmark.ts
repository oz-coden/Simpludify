import {
  GeometryTilemap,
  Grid,
  HexOrientation,
  TileGeometry,
} from "@simpludify/web";
import { fixture } from "./renderable-fixture";

const summary = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return {
    median: s[Math.floor(s.length / 2)],
    p95: s[Math.floor(s.length * 0.95)],
    samples: a,
  };
};
export async function measure() {
  const f = await fixture();
  f.actor.dispose();
  const rows = [];
  for (const geometry of [
    TileGeometry.square({ width: 24 }),
    TileGeometry.triangle({ width: 28 }),
    ...Object.values(HexOrientation).map((orientation) =>
      TileGeometry.hex({ radius: 14, orientation }),
    ),
  ]) {
    for (const [mode, size] of [
      ...[32, 100, 256].map((size) => ["fixed", size] as const),
      ...[16, 32, 64].map((size) => ["all-visible", size] as const),
    ]) {
      const start = performance.now();
      const m = new GeometryTilemap({
        geometry,
        tiles: new Grid<number | null>(size, size, 0x397c87),
        x: 20,
        y: 20,
      }).place(f.game.engine.scene);
      const createMs = performance.now() - start;
      f.game.camera.x = f.game.camera.y = 0;
      f.game.camera.zoom = 1;
      if (mode === "all-visible") {
        const a = m.tileBounds(0, 0),
          b = m.tileBounds(size - 1, size - 1);
        f.game.camera.x = (a.x + b.x + b.width) / 2 - 200;
        f.game.camera.y = (a.y + b.y + b.height) / 2 - 150;
        f.game.camera.zoom =
          Math.min(400 / (b.x + b.width - a.x), 300 / (b.y + b.height - a.y)) *
          0.95;
      }
      const first = performance.now();
      f.game.setViewport();
      const firstRenderMs = performance.now() - first;
      const c = m.tileToWorld(3, 3, { center: true });
      const durations = {
        static: [] as number[],
        edit: [] as number[],
        pick1000: [] as number[],
        range: [] as number[],
      };
      for (let i = 0; i < 12; i++) f.game.setViewport();
      const baseline = f.renderer.geometryTilemapDiagnostics;
      for (let i = 0; i < 40; i++) {
        let t = performance.now();
        f.game.setViewport();
        durations.static.push(performance.now() - t);
        t = performance.now();
        m.set(3, 3, i % 2 ? 0xea739e : 0x55d9d1);
        f.game.setViewport();
        durations.edit.push(performance.now() - t);
        t = performance.now();
        for (let j = 0; j < 1000; j++) m.worldToTile(c.x + (j % 5) * 0.1, c.y);
        durations.pick1000.push(performance.now() - t);
        t = performance.now();
        let n = 0;
        for (let batch = 0; batch < 100; batch++)
          for (const _ of m.tilesInBounds({
            x: 20,
            y: 20,
            width: 400,
            height: 300,
          }))
            n++;
        durations.range.push(performance.now() - t);
        if (!n) throw Error("Empty range");
      }
      const after = f.renderer.geometryTilemapDiagnostics;
      const off = performance.now();
      m.set(size - 1, size - 1, null);
      f.game.setViewport();
      const offscreenEditMs = performance.now() - off;
      rows.push({
        kind: geometry.kind,
        orientation: geometry.orientation,
        size,
        cells: size * size,
        createMs,
        firstRenderMs,
        visibleGraphics: after.graphics,
        staticAndEditCellVisits: after.visitedCells - baseline.visitedCells,
        farCellEditMs: offscreenEditMs,
        mode,
        static: summary(durations.static),
        edit: summary(durations.edit),
        pick1000: summary(durations.pick1000),
        range: summary(durations.range),
      });
      m.dispose();
      f.game.setViewport();
    }
  }
  const result = {
    rows,
    errors: f.errors,
    remaining: f.renderer.geometryTilemapDiagnostics,
  };
  f.game.dispose();
  return result;
}
