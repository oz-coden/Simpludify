import { EngineError, positive } from "../foundation/diagnostics";
import type { TilePoint } from "../game/tilemap";
import type { Point } from "./coordinates";

export interface TileBounds extends Point {
  readonly width: number;
  readonly height: number;
}
export const HexOrientation = { Pointy: "pointy", Flat: "flat" } as const;
export type HexOrientation =
  (typeof HexOrientation)[keyof typeof HexOrientation];
export type TileGeometryKind = "square" | "triangle" | "hex";
function finite(...values: number[]): void {
  if (values.some((v) => !Number.isFinite(v)))
    throw new EngineError(
      "INVALID_VALUE",
      "Tile geometry coordinates must be finite",
    );
}
function integer(x: number, y: number): void {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y))
    throw new EngineError(
      "INVALID_VALUE",
      "Tile coordinates must be safe integers",
    );
}
function rect(b: TileBounds): void {
  finite(b.x, b.y, b.width, b.height, b.x + b.width, b.y + b.height);
  if (b.width < 0 || b.height < 0)
    throw new EngineError(
      "INVALID_VALUE",
      "Tile query extents must be nonnegative",
    );
}
const tile = (x: number, y: number): TilePoint => ({
  space: "tile",
  x: x || 0,
  y: y || 0,
});
const directions = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const;

/** Immutable local-space tiling; x/y are axial q/r for hexagons. No cell storage. */
export class TileGeometry {
  private constructor(
    readonly kind: TileGeometryKind,
    readonly width: number,
    readonly height: number,
    readonly orientation: HexOrientation = HexOrientation.Pointy,
  ) {
    positive(width, "tile width");
    positive(height, "tile height");
    Object.freeze(this);
  }
  static square(options: { width: number; height?: number }): TileGeometry {
    return new TileGeometry(
      "square",
      options.width,
      options.height ?? options.width,
    );
  }
  static triangle(options: { width: number; height?: number }): TileGeometry {
    return new TileGeometry(
      "triangle",
      options.width,
      options.height ?? (options.width * Math.sqrt(3)) / 2,
    );
  }
  static hex(options: {
    radius: number;
    orientation?: HexOrientation;
  }): TileGeometry {
    const radius = positive(options.radius, "hex radius");
    const orientation = options.orientation ?? HexOrientation.Pointy;
    if (!Object.values(HexOrientation).includes(orientation))
      throw new EngineError("INVALID_VALUE", "Unknown hex orientation");
    return new TileGeometry(
      "hex",
      radius * (orientation === HexOrientation.Pointy ? Math.sqrt(3) : 2),
      radius * (orientation === HexOrientation.Pointy ? 2 : Math.sqrt(3)),
      orientation,
    );
  }
  /** Triangle orientation is invariant under negative coordinates too. */
  pointsUp(x: number, y: number): boolean {
    integer(x, y);
    if (this.kind !== "triangle")
      throw new EngineError(
        "INVALID_VALUE",
        "pointsUp requires triangle geometry",
      );
    return (x + y) % 2 === 0;
  }
  center(x: number, y: number): Point {
    integer(x, y);
    let cx: number, cy: number;
    if (this.kind === "hex") {
      cx =
        this.width *
        (this.orientation === HexOrientation.Pointy ? x + y / 2 : 0.75 * x);
      cy =
        this.height *
        (this.orientation === HexOrientation.Pointy ? 0.75 * y : y + x / 2);
    } else {
      cx = (x * (this.kind === "triangle" ? 0.5 : 1) + 0.5) * this.width;
      cy =
        (y +
          (this.kind === "triangle"
            ? this.pointsUp(x, y)
              ? 2 / 3
              : 1 / 3
            : 0.5)) *
        this.height;
    }
    finite(cx, cy);
    return { x: cx, y: cy };
  }
  bounds(x: number, y: number): TileBounds {
    const c = this.center(x, y);
    const top =
      this.kind === "triangle" ? y * this.height : c.y - this.height / 2;
    return {
      x: c.x - this.width / 2,
      y: top,
      width: this.width,
      height: this.height,
    };
  }
  vertices(x: number, y: number): readonly Point[] {
    const b = this.bounds(x, y),
      w = this.width,
      h = this.height;
    const coords =
      this.kind === "square"
        ? [
            [0, 0],
            [w, 0],
            [w, h],
            [0, h],
          ]
        : this.kind === "triangle"
          ? this.pointsUp(x, y)
            ? [
                [w / 2, 0],
                [w, h],
                [0, h],
              ]
            : [
                [0, 0],
                [w, 0],
                [w / 2, h],
              ]
          : this.orientation === HexOrientation.Pointy
            ? [
                [w / 2, 0],
                [w, h / 4],
                [w, (3 * h) / 4],
                [w / 2, h],
                [0, (3 * h) / 4],
                [0, h / 4],
              ]
            : [
                [w / 4, 0],
                [(3 * w) / 4, 0],
                [w, h / 2],
                [(3 * w) / 4, h],
                [w / 4, h],
                [0, h / 2],
              ];
    return coords.map(([dx, dy]) => ({
      x: b.x + (dx ?? 0),
      y: b.y + (dy ?? 0),
    }));
  }
  neighbors(x: number, y: number): readonly TilePoint[] {
    integer(x, y);
    if (this.kind === "hex")
      return directions.map(([dx, dy]) => tile(x + dx, y + dy));
    if (this.kind === "triangle")
      return [
        tile(x - 1, y),
        tile(x + 1, y),
        tile(x, y + (this.pointsUp(x, y) ? 1 : -1)),
      ];
    return [tile(x + 1, y), tile(x, y + 1), tile(x - 1, y), tile(x, y - 1)];
  }
  /** Hex graph distance; square/triangle do not silently use a different metric. */
  distance(a: Point, b: Point): number {
    integer(a.x, a.y);
    integer(b.x, b.y);
    if (this.kind !== "hex")
      throw new EngineError("INVALID_VALUE", "distance requires hex geometry");
    const x = a.x - b.x,
      y = a.y - b.y;
    return (Math.abs(x) + Math.abs(y) + Math.abs(x + y)) / 2;
  }
  /** Infinite tiling ownership. Square is half-open; polygon ties use lowest y then x. */
  worldToTile(x: number, y: number): TilePoint {
    finite(x, y);
    if (this.kind === "square")
      return tile(Math.floor(x / this.width), Math.floor(y / this.height));
    let q = (x * 2) / this.width,
      r = y / this.height;
    if (this.kind === "hex") {
      if (this.orientation === HexOrientation.Pointy) {
        r = y / (this.height * 0.75);
        q = x / this.width - r / 2;
      } else {
        q = x / (this.width * 0.75);
        r = y / this.height - q / 2;
      }
    }
    const col = Math.floor(q),
      row = Math.floor(r);
    integer(col, row);
    // A small closed-polygon search handles shared edges/vertices deterministically.
    for (let ty = row - 1; ty <= row + 1; ty++)
      for (let tx = col - 2; tx <= col + 1; tx++) {
        const v = this.vertices(tx, ty);
        let inside = true;
        for (let i = 0; i < v.length; i++) {
          const a = v[i],
            b = v[(i + 1) % v.length];
          if (!a || !b) continue;
          const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
          if (cross < -1e-10 * this.width * this.height) {
            inside = false;
            break;
          }
        }
        if (inside) return tile(tx, ty);
      }
    throw new EngineError(
      "INVALID_VALUE",
      "Point exceeds reliable tile geometry precision",
    );
  }
  /** Bounding-box candidates, row-major, optionally clipped to a finite coordinate rectangle.
   * Touching bounds are included. No full-map scan; exact polygon picking uses worldToTile.
   */
  *tilesInBounds(
    bounds: TileBounds,
    limit?: TileBounds,
  ): IterableIterator<TilePoint> {
    rect(bounds);
    if (limit) {
      rect(limit);
      integer(limit.x, limit.y);
      integer(limit.width, limit.height);
    }
    if (
      !bounds.width ||
      !bounds.height ||
      (limit && (!limit.width || !limit.height))
    )
      return;
    const w = this.width,
      h = this.height;
    let top: number, bottom: number;
    if (this.kind !== "hex") {
      top = Math.ceil(bounds.y / h) - 1;
      bottom = Math.floor((bounds.y + bounds.height) / h);
    } else if (this.orientation === HexOrientation.Pointy) {
      top = Math.ceil((bounds.y - h / 2) / (h * 0.75));
      bottom = Math.floor((bounds.y + bounds.height + h / 2) / (h * 0.75));
    } else {
      top = Math.ceil(
        (bounds.y - h / 2) / h - (bounds.x + bounds.width + w / 2) / (w * 1.5),
      );
      bottom = Math.floor(
        (bounds.y + bounds.height + h / 2) / h - (bounds.x - w / 2) / (w * 1.5),
      );
    }
    if (limit) {
      top = Math.max(top, limit.y);
      bottom = Math.min(bottom, limit.y + limit.height - 1);
    }
    integer(top, bottom);
    for (let y = top; y <= bottom; y++) {
      let left: number, right: number;
      if (this.kind !== "hex") {
        const step = w * (this.kind === "triangle" ? 0.5 : 1);
        left = Math.ceil((bounds.x - w) / step);
        right = Math.floor((bounds.x + bounds.width) / step);
      } else if (this.orientation === HexOrientation.Pointy) {
        left = Math.ceil((bounds.x - w / 2) / w - y / 2);
        right = Math.floor((bounds.x + bounds.width + w / 2) / w - y / 2);
      } else {
        left = Math.max(
          Math.ceil((bounds.x - w / 2) / (w * 0.75)),
          Math.ceil(2 * ((bounds.y - h / 2) / h - y)),
        );
        right = Math.min(
          Math.floor((bounds.x + bounds.width + w / 2) / (w * 0.75)),
          Math.floor(2 * ((bounds.y + bounds.height + h / 2) / h - y)),
        );
      }
      if (limit) {
        left = Math.max(left, limit.x);
        right = Math.min(right, limit.x + limit.width - 1);
      }
      integer(left, right);
      for (let x = left; x <= right; x++) yield tile(x, y);
    }
  }
  /** Inclusive axial disk, row-major, including its center. */
  *withinRadius(
    x: number,
    y: number,
    radius: number,
  ): IterableIterator<TilePoint> {
    integer(x, y);
    integer(radius, 0);
    if (this.kind !== "hex" || radius < 0)
      throw new EngineError(
        "INVALID_VALUE",
        "withinRadius requires hex geometry and a nonnegative integer radius",
      );
    for (let dy = -radius; dy <= radius; dy++)
      for (
        let dx = Math.max(-radius, -dy - radius);
        dx <= Math.min(radius, -dy + radius);
        dx++
      )
        yield tile(x + dx, y + dy);
  }
}
