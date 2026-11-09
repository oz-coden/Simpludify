import {
  cleanupAll,
  type GeometryTilemap,
  type ViewTransform,
} from "@simpludify/core";
import { Container, Graphics } from "pixi.js";

/** Visible-cell Graphics with no image/UV contract; no full Grid walk per frame. */
export class GeometryTilemapVisual {
  readonly display = new Container();
  readonly graphics = new Map<number, Graphics>();
  readonly stats = {
    visitedCells: 0,
    updatedTiles: 0,
    createdGraphics: 0,
    destroyedGraphics: 0,
  };
  order = 0;
  depth = NaN;
  disposed = false;
  private readonly dirty = new Set<number>();
  private visibleCells = new Set<number>();
  private invalid = true;
  private boundsKey = "";
  private readonly off: () => void;
  private readonly offDispose: () => void;
  constructor(
    readonly map: GeometryTilemap,
    private readonly released: () => void,
  ) {
    this.off = map.onTilesChanged((index) => {
      if (index === null) {
        this.invalid = true;
        this.bulk = true;
        this.dirty.clear();
      } else if (this.visibleCells.has(index)) this.dirty.add(index);
    });
    this.offDispose = map.onDispose(() => this.dispose());
  }
  private remove(index: number): void {
    const g = this.graphics.get(index);
    if (g) {
      this.graphics.delete(index);
      g.destroy({ context: true });
      this.stats.destroyedGraphics++;
    }
  }
  private cell(x: number, y: number): void {
    this.stats.visitedCells++;
    const index = y * this.map.width + x,
      color = this.map.get(x, y);
    if (color === null) {
      this.remove(index);
      return;
    }
    let g = this.graphics.get(index);
    if (!g) {
      g = new Graphics();
      this.graphics.set(index, g);
      this.display.addChild(g);
      this.stats.createdGraphics++;
    }
    g.clear()
      .poly(
        this.map.geometry.vertices(x, y).flatMap((p) => [p.x, p.y]),
        true,
      )
      .fill(color);
    this.stats.updatedTiles++;
  }
  render(view: ViewTransform, enabled = true): void {
    if (this.disposed) return;
    const m = this.map;
    this.display.position.set(m.x, m.y);
    this.display.visible = enabled && m.visible && m.enabled;
    if (!this.display.visible) {
      this.invalid = true;
      this.bulk = true;
      this.dirty.clear();
      return;
    }
    const c = view.clip;
    const bounds = {
      x: (c.x - view.x) / view.scale,
      y: (c.y - view.y) / view.scale,
      width: c.width / view.scale,
      height: c.height / view.scale,
    };
    const key = [
      bounds.x - m.x,
      bounds.y - m.y,
      bounds.width,
      bounds.height,
    ].join(",");
    if (this.invalid || key !== this.boundsKey) {
      this.boundsKey = key;
      this.invalid = false;
      const retained = new Set<number>();
      for (const p of m.tilesInBounds(bounds)) {
        const index = p.y * m.width + p.x;
        retained.add(index);
        if (!this.graphics.has(index) || this.dirty.has(index) || this.bulk)
          this.cell(p.x, p.y);
      }
      for (const index of this.graphics.keys())
        if (!retained.has(index)) this.remove(index);
      this.visibleCells = retained;
      this.bulk = false;
    } else
      for (const index of this.dirty) {
        const x = index % m.width,
          y = Math.floor(index / m.width),
          b = m.tileBounds(x, y);
        if (
          b.x <= bounds.x + bounds.width &&
          b.x + b.width >= bounds.x &&
          b.y <= bounds.y + bounds.height &&
          b.y + b.height >= bounds.y
        )
          this.cell(x, y);
      }
    this.dirty.clear();
  }
  private bulk = false;
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stats.destroyedGraphics += this.graphics.size;
    this.graphics.clear();
    this.visibleCells.clear();
    this.dirty.clear();
    cleanupAll(
      [
        this.off,
        this.offDispose,
        () => this.display.removeFromParent(),
        () => this.display.destroy({ children: true, context: true }),
        this.released,
      ],
      "Geometry tilemap cleanup failed",
    );
  }
}
