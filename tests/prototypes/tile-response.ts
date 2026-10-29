/** Naive cell response probe: intentionally exposes seams/deep-embedding limits. Not a solver API. */
import { CollisionShape, Grid } from "@simpludify/core";
import {
  contactManifold,
  createGeometry,
  type ManifoldEntry,
} from "../../packages/core/src/game/collision-geometry";
import { correctPositions } from "../../packages/core/src/game/collision-response";
import { candidateRange } from "./tile-candidates";

interface Position {
  x: number;
  y: number;
}
type Shape =
  | { shape: "circle"; radius: number }
  | { shape: "box"; width: number; height: number };
function entry(position: Position, shape: Shape): ManifoldEntry {
  const g = createGeometry();
  g.x = position.x;
  g.y = position.y;
  if (shape.shape === "circle") g.radius = shape.radius;
  else {
    g.hx = shape.width / 2;
    g.hy = shape.height / 2;
  }
  const ex = shape.shape === "circle" ? g.radius : g.hx;
  const ey = shape.shape === "circle" ? g.radius : g.hy;
  g.minX = g.x - ex;
  g.maxX = g.x + ex;
  g.minY = g.y - ey;
  g.maxY = g.y + ey;
  return { collider: { shape: shape.shape }, geometry: g };
}
export function solveCells(
  grid: Grid<boolean>,
  position: Position,
  shape: Shape,
  iterations = 6,
) {
  const map = {
    width: grid.width,
    height: grid.height,
    x: 0,
    y: 0,
    tileWidth: 32,
    tileHeight: 32,
  };
  const manifold = { normalX: 0, normalY: 0, depth: 0 };
  let corrections = 0,
    unresolved = 0,
    visits = 0;
  const touched = new Set<number>();
  const scan = (solve: boolean) => {
    const bounds = candidateRange(map, entry(position, shape).geometry);
    if (!bounds) return false;
    let changed = false;
    for (let y = bounds.y0; y <= bounds.y1; y++)
      for (let x = bounds.x0; x <= bounds.x1; x++) {
        visits++;
        if (!grid.get(x, y)) continue;
        const center = { x: x * 32 + 16, y: y * 32 + 16 };
        const tile = entry(center, { shape: "box", width: 32, height: 32 });
        if (!contactManifold(entry(position, shape), tile, manifold, 1e-7))
          continue;
        touched.add(y * grid.width + x);
        if (manifold.depth <= 1e-7) continue;
        if (solve) {
          changed =
            correctPositions(position, center, manifold, 1, 0) || changed;
          corrections++;
        } else unresolved++;
      }
    return changed;
  };
  for (let i = 0; i < iterations; i++) if (!scan(true)) break;
  scan(false);
  return {
    position: { ...position },
    corrections,
    unresolved,
    visits,
    touched: [...touched].sort((a, b) => a - b),
  };
}
export function responseFindings() {
  const wall = Grid.generate(4, 8, (x) => x === 2);
  const trace = (shape: Shape) => {
    const position = { x: 54, y: 16 };
    let corrections = 0,
      unresolved = 0;
    for (let step = 0; step < 60; step++) {
      position.x += 2;
      position.y += 2;
      const result = solveCells(wall, position, shape);
      corrections += result.corrections;
      unresolved += result.unresolved;
    }
    return {
      final: position,
      expectedTangentY: 136,
      tangentError: position.y - 136,
      corrections,
      unresolved,
    };
  };
  return {
    single: solveCells(
      new Grid(1, 1, true),
      { x: -5, y: 16 },
      { shape: "circle", radius: 10 },
    ),
    circleSlide: trace({ shape: CollisionShape.Circle, radius: 10 }),
    boxSlide: trace({ shape: CollisionShape.Box, width: 20, height: 20 }),
    embedded: solveCells(
      new Grid(6, 6, true),
      { x: 96, y: 96 },
      { shape: "circle", radius: 10 },
    ),
  };
}
