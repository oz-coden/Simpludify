import { samePolicy } from "./collision-policy";
import type { TileRange } from "./tile-collision-geometry";
import type { Tilemap } from "./tilemap";
import type { ResolvedTileCollision } from "./tilemap-collision";

const chunkSize = 16;
/** @internal Inclusive tile bounds, independent of placement translation and image frames. */
export interface TileCollisionRegion extends TileRange {
  readonly policy: ResolvedTileCollision;
}
interface Chunk {
  readonly regions: TileCollisionRegion[];
  readonly ids: Set<number | string>;
  readonly cells: number;
}
/**
 * Optional candidate index. Equal-policy horizontal runs extend vertically only
 * when their extents match. Cell manifolds/events remain the World's authority.
 */
export class TileCollisionIndex {
  private readonly chunks = new Map<number, Chunk>();
  private readonly columns: number;
  private readonly off: (() => void)[];
  private builds = 0;
  private builtCells = 0;
  private disposed = false;
  constructor(private readonly map: Tilemap<string>) {
    this.columns = Math.ceil(map.width / chunkSize);
    this.off = [
      map.onCollisionChanged((change) => {
        if (change.kind === "cell") this.invalidate(change.index);
        else if (change.kind === "all") this.chunks.clear();
        else
          for (const [key, chunk] of this.chunks)
            if (chunk.ids.has(change.tile)) this.chunks.delete(key);
      }),
      // Equal-policy image edits still change which future ID-default edits matter.
      map.onTilesChanged((index) => {
        if (index === null) this.chunks.clear();
        else this.invalidate(index);
      }),
      map.onDispose(() => this.dispose()),
    ];
  }
  private key(x: number, y: number): number {
    return Math.floor(y / chunkSize) * this.columns + Math.floor(x / chunkSize);
  }
  private invalidate(index: number): void {
    this.chunks.delete(
      this.key(index % this.map.width, Math.floor(index / this.map.width)),
    );
  }
  private build(cx: number, cy: number): Chunk {
    const map = this.map;
    const x0 = cx * chunkSize,
      y0 = cy * chunkSize;
    const x1 = Math.min(map.width, x0 + chunkSize),
      y1 = Math.min(map.height, y0 + chunkSize);
    const regions: TileCollisionRegion[] = [],
      ids = new Set<number | string>();
    let previous = new Map<string, TileCollisionRegion>();
    let cells = 0;
    for (let y = y0; y < y1; y++) {
      const current = new Map<string, TileCollisionRegion>();
      for (let x = x0; x < x1; ) {
        const start = x,
          policy = map.getCollision(x, y);
        const remember = (tx: number) => {
          const id = map.get(tx, y);
          if (id !== null) ids.add(id);
        };
        remember(x++);
        if (!policy) continue;
        while (x < x1 && samePolicy(policy, map.getCollision(x, y)))
          remember(x++);
        cells += x - start;
        const key = `${start}:${x}:${policy.response}:${policy.layer}:${policy.mask}`;
        let region = previous.get(key);
        if (region) region.y1 = y;
        else {
          region = { x0: start, x1: x - 1, y0: y, y1: y, policy };
          regions.push(region);
        }
        current.set(key, region);
      }
      previous = current;
    }
    this.builds++;
    this.builtCells += (x1 - x0) * (y1 - y0);
    return { regions, ids, cells };
  }
  /** @internal Produces each eligible cell once, in the same row-major order as direct search. */
  query(
    range: TileRange,
    accept: (region: TileCollisionRegion) => boolean,
    out: number[],
  ): void {
    out.length = 0;
    if (this.disposed) return;
    for (
      let cy = Math.floor(range.y0 / chunkSize);
      cy <= Math.floor(range.y1 / chunkSize);
      cy++
    )
      for (
        let cx = Math.floor(range.x0 / chunkSize);
        cx <= Math.floor(range.x1 / chunkSize);
        cx++
      ) {
        const key = cy * this.columns + cx;
        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = this.build(cx, cy);
          this.chunks.set(key, chunk);
        }
        for (const region of chunk.regions) {
          const x0 = Math.max(range.x0, region.x0),
            x1 = Math.min(range.x1, region.x1);
          const y0 = Math.max(range.y0, region.y0),
            y1 = Math.min(range.y1, region.y1);
          if (x0 > x1 || y0 > y1 || !accept(region)) continue;
          for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) out.push(y * this.map.width + x);
        }
      }
    out.sort((a, b) => a - b);
  }
  get diagnostics() {
    let regions = 0,
      cells = 0;
    for (const chunk of this.chunks.values()) {
      regions += chunk.regions.length;
      cells += chunk.cells;
    }
    return {
      chunks: this.chunks.size,
      regions,
      cells,
      builds: this.builds,
      builtCells: this.builtCells,
    };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.off) off();
    this.chunks.clear();
  }
}
