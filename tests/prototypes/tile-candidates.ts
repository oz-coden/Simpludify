/** Isolated candidate-search comparison. Not exported by Core/Web. */
import type { Grid } from "@simpludify/core";

export interface Range {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export interface Placement {
  width: number;
  height: number;
  x: number;
  y: number;
  tileWidth: number;
  tileHeight: number;
}
/** Closed contact bounds differ intentionally from Tilemap.worldToTile's half-open point bounds. */
export function candidateRange(
  map: Placement,
  a: Bounds,
  tolerance = 1e-7,
): Range | undefined {
  const x0 = Math.max(
    0,
    Math.ceil((a.minX - map.x - tolerance) / map.tileWidth) - 1,
  );
  const y0 = Math.max(
    0,
    Math.ceil((a.minY - map.y - tolerance) / map.tileHeight) - 1,
  );
  const x1 = Math.min(
    map.width - 1,
    Math.floor((a.maxX - map.x + tolerance) / map.tileWidth),
  );
  const y1 = Math.min(
    map.height - 1,
    Math.floor((a.maxY - map.y + tolerance) / map.tileHeight),
  );
  return x0 <= x1 && y0 <= y1 ? { x0, y0, x1, y1 } : undefined;
}
interface Rect extends Range {
  id: number;
}
export type Strategy = "direct" | "merged" | "chunked";
export interface QueryStats {
  visitedCells: number;
  testedRectangles: number;
  bucketReferences: number;
  hits: number;
  checksum: number;
}
const emptyStats = (): QueryStats => ({
  visitedCells: 0,
  testedRectangles: 0,
  bucketReferences: 0,
  hits: 0,
  checksum: 0,
});

/** Row-run merging, extended vertically only for exactly matching spans. */
function merge(
  grid: Grid<boolean>,
  range: Range,
  nextId: () => number,
): Rect[] {
  const result: Rect[] = [];
  let previous = new Map<string, Rect>();
  for (let y = range.y0; y <= range.y1; y++) {
    const current = new Map<string, Rect>();
    let x = range.x0;
    while (x <= range.x1) {
      if (!grid.get(x, y)) {
        x++;
        continue;
      }
      const x0 = x;
      while (x <= range.x1 && grid.get(x, y)) x++;
      const key = `${x0}:${x - 1}`;
      let rect = previous.get(key);
      if (rect) rect.y1 = y;
      else {
        rect = { x0, y0: y, x1: x - 1, y1: y, id: nextId() };
        result.push(rect);
      }
      current.set(key, rect);
    }
    previous = current;
  }
  return result;
}

/** B also has spatial buckets: do not compare A to a deliberately global linear rectangle scan. */
export class CandidateProbe {
  private readonly buckets = new Map<number, Rect[]>();
  private readonly dirty = new Set<number>();
  private serial = 0;
  readonly chunkSize = 16;
  readonly columns: number;
  rebuildCells = 0;
  rebuiltChunks = 0;
  constructor(
    readonly grid: Grid<boolean>,
    readonly strategy: Strategy,
  ) {
    this.columns = Math.ceil(grid.width / this.chunkSize);
    if (strategy === "merged") this.rebuildGlobal();
    if (strategy === "chunked") {
      for (let y = 0; y < grid.height; y += this.chunkSize)
        for (let x = 0; x < grid.width; x += this.chunkSize)
          this.rebuildChunk(
            Math.floor(y / this.chunkSize) * this.columns +
              Math.floor(x / this.chunkSize),
          );
    }
  }
  private nextId = () => ++this.serial;
  private range(key: number): Range {
    const x0 = (key % this.columns) * this.chunkSize;
    const y0 = Math.floor(key / this.columns) * this.chunkSize;
    return {
      x0,
      y0,
      x1: Math.min(this.grid.width - 1, x0 + this.chunkSize - 1),
      y1: Math.min(this.grid.height - 1, y0 + this.chunkSize - 1),
    };
  }
  private keys(range: Range, visit: (key: number) => void): void {
    for (
      let cy = Math.floor(range.y0 / this.chunkSize);
      cy <= Math.floor(range.y1 / this.chunkSize);
      cy++
    )
      for (
        let cx = Math.floor(range.x0 / this.chunkSize);
        cx <= Math.floor(range.x1 / this.chunkSize);
        cx++
      )
        visit(cy * this.columns + cx);
  }
  private rebuildGlobal(): void {
    this.buckets.clear();
    this.serial = 0;
    this.rebuildCells += this.grid.width * this.grid.height;
    const rects = merge(
      this.grid,
      { x0: 0, y0: 0, x1: this.grid.width - 1, y1: this.grid.height - 1 },
      this.nextId,
    );
    for (const rect of rects)
      this.keys(rect, (key) => {
        let bucket = this.buckets.get(key);
        if (!bucket) {
          bucket = [];
          this.buckets.set(key, bucket);
        }
        bucket.push(rect);
      });
  }
  private rebuildChunk(key: number): void {
    const range = this.range(key);
    this.rebuildCells += (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1);
    this.rebuiltChunks++;
    const rects = merge(this.grid, range, this.nextId);
    if (rects.length) this.buckets.set(key, rects);
    else this.buckets.delete(key);
  }
  set(x: number, y: number, solid: boolean): void {
    if (this.grid.get(x, y) === solid) return;
    this.grid.set(x, y, solid);
    this.dirty.add(
      Math.floor(y / this.chunkSize) * this.columns +
        Math.floor(x / this.chunkSize),
    );
  }
  commit(): void {
    this.rebuildCells = this.rebuiltChunks = 0;
    if (this.dirty.size) {
      if (this.strategy === "merged") this.rebuildGlobal();
      if (this.strategy === "chunked")
        for (const key of this.dirty) this.rebuildChunk(key);
      this.dirty.clear();
    }
  }
  get retained() {
    const ids = new Set<number>();
    let references = 0;
    for (const bucket of this.buckets.values())
      for (const rect of bucket) {
        ids.add(rect.id);
        references++;
      }
    return {
      rectangles: ids.size,
      bucketReferences: references,
      buckets: this.buckets.size,
    };
  }
  query(range: Range | undefined, cells?: number[]): QueryStats {
    const out = emptyStats();
    if (!range) return out;
    const hit = (x: number, y: number) => {
      const index = y * this.grid.width + x;
      out.hits++;
      out.checksum += index + 1;
      cells?.push(index);
    };
    if (this.strategy === "direct") {
      for (let y = range.y0; y <= range.y1; y++)
        for (let x = range.x0; x <= range.x1; x++) {
          out.visitedCells++;
          if (this.grid.get(x, y)) hit(x, y);
        }
    } else {
      const seen = new Set<number>();
      this.keys(range, (key) => {
        for (const rect of this.buckets.get(key) ?? []) {
          out.bucketReferences++;
          if (seen.has(rect.id)) continue;
          seen.add(rect.id);
          out.testedRectangles++;
          const x0 = Math.max(range.x0, rect.x0),
            x1 = Math.min(range.x1, rect.x1);
          const y0 = Math.max(range.y0, rect.y0),
            y1 = Math.min(range.y1, rect.y1);
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) {
              out.visitedCells++;
              hit(x, y);
            }
        }
      });
    }
    return out;
  }
}
