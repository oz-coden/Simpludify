import { EngineError } from "../foundation/diagnostics";
import { Grid } from "../foundation/grid";
import {
  containsScreenPoint,
  type ScreenPoint,
  screenToWorld,
  type ViewTransform,
  type WorldPoint,
  worldPoint,
} from "../graphics/coordinates";
import type { TileBounds, TileGeometry } from "../graphics/tile-geometry";
import { Actor, type ActorOptions } from "../scene/actor";
import {
  Component,
  type ComponentType,
  defineComponent,
} from "../scene/component";
import type { Scene } from "../scene/scene";
import type { TilePoint } from "./tilemap";

export type TileColor = number | null;
export interface GeometryTilemapOptions extends ActorOptions {
  geometry: TileGeometry;
  tiles: Grid<TileColor> | readonly (readonly TileColor[])[];
  x?: number;
  y?: number;
  zIndex?: number;
  visible?: boolean;
}
function color(value: TileColor): TileColor {
  if (
    value !== null &&
    (!Number.isInteger(value) || value < 0 || value > 0xffffff)
  )
    throw new EngineError(
      "INVALID_VALUE",
      "Tile color must be a 24-bit RGB integer or null",
    );
  return value;
}
function finite(value: number): number {
  if (!Number.isFinite(value))
    throw new EngineError("INVALID_VALUE", "Map placement must be finite");
  return value;
}
/** One Scene-owned color layer. Geometry is independent of copied finite Grid data.
 * Hex x/y indices mean axial q/r; the finite map is a q/r parallelogram.
 * No sheet/image ownership or automatic terrain collision is attached.
 */
export class GeometryTilemap {
  private readonly owner: Actor;
  readonly geometry: TileGeometry;
  private readonly cells: Grid<TileColor>;
  private readonly listeners = new Set<(index: number | null) => void>();
  private version = 0;
  private left = 0;
  private top = 0;
  private depth = 0;
  private shown = true;
  constructor(options: GeometryTilemapOptions) {
    this.owner = new Actor(options);
    this.geometry = options.geometry;
    const input = options.tiles;
    if (input instanceof Grid) {
      this.cells = Grid.generate(input.width, input.height, (x, y) =>
        color(input.get(x, y)),
      );
    } else {
      if (
        !Array.isArray(input) ||
        !input.length ||
        !Array.isArray(input[0]) ||
        !input[0].length ||
        input.some(
          (row) => !Array.isArray(row) || row.length !== input[0]?.length,
        )
      )
        throw new EngineError(
          "GRID_SIZE",
          "GeometryTilemap rows must form a nonempty rectangle",
        );
      this.cells = Grid.generate(input[0].length, input.length, (x, y) =>
        color(input[y]?.[x] as TileColor),
      );
    }
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.zIndex = options.zIndex ?? 0;
    this.visible = options.visible ?? true;
    this.owner.add(new GeometryTilemapLayer(this));
  }
  place(scene: Scene): this {
    scene.add(this.owner);
    return this;
  }
  get scene(): Scene | undefined {
    return this.owner.scene;
  }
  get disposed(): boolean {
    return this.owner.disposed;
  }
  get enabled(): boolean {
    return this.owner.enabled;
  }
  set enabled(value: boolean) {
    this.owner.enabled = value;
  }
  dispose(): void {
    this.owner.dispose();
  }
  onDispose(callback: () => void): () => void {
    return this.owner.onDispose(callback);
  }
  private alive(): void {
    if (this.disposed)
      throw new EngineError(
        "ACTOR_DISPOSED",
        "GeometryTilemap has been disposed",
      );
  }
  get width(): number {
    return this.cells.width;
  }
  get height(): number {
    return this.cells.height;
  }
  get revision(): number {
    return this.version;
  }
  get x(): number {
    return this.left;
  }
  set x(value: number) {
    this.alive();
    finite(value);
    const b = this.geometry.bounds(this.width - 1, this.height - 1);
    finite(value + b.x + b.width);
    this.left = value;
  }
  get y(): number {
    return this.top;
  }
  set y(value: number) {
    this.alive();
    finite(value);
    const b = this.geometry.bounds(this.width - 1, this.height - 1);
    finite(value + b.y + b.height);
    this.top = value;
  }
  get zIndex(): number {
    return this.depth;
  }
  set zIndex(value: number) {
    this.alive();
    this.depth = finite(value);
  }
  get visible(): boolean {
    return this.shown;
  }
  set visible(value: boolean) {
    this.alive();
    if (typeof value !== "boolean")
      throw new EngineError("INVALID_VALUE", "visible must be boolean");
    this.shown = value;
  }
  inBounds(x: number, y: number): boolean {
    return this.cells.inBounds(x, y);
  }
  get(x: number, y: number): TileColor {
    return this.cells.get(x, y);
  }
  set(x: number, y: number, value: TileColor): void {
    this.alive();
    const previous = this.cells.get(x, y);
    color(value);
    if (previous === value) return;
    this.cells.set(x, y, value);
    this.version++;
    for (const notify of this.listeners) notify(y * this.width + x);
  }
  fill(value: TileColor): void {
    this.alive();
    color(value);
    let changed = false;
    this.cells.forEach((old) => {
      if (old !== value) changed = true;
    });
    if (!changed) return;
    this.cells.fill(value);
    this.version++;
    for (const notify of this.listeners) notify(null);
  }
  copyTiles(): Grid<TileColor> {
    return Grid.generate(this.width, this.height, (x, y) => this.get(x, y));
  }
  /** Bounding-box origin by default; center is the polygon centroid. */
  tileToWorld(
    x: number,
    y: number,
    options: { center?: boolean } = {},
  ): WorldPoint {
    this.cells.get(x, y);
    const p = options.center
      ? this.geometry.center(x, y)
      : this.geometry.bounds(x, y);
    return worldPoint(p.x + this.x, p.y + this.y);
  }
  tileBounds(x: number, y: number): TileBounds {
    this.cells.get(x, y);
    const b = this.geometry.bounds(x, y);
    return { ...b, x: b.x + this.x, y: b.y + this.y };
  }
  tileVertices(x: number, y: number): readonly WorldPoint[] {
    this.cells.get(x, y);
    return this.geometry
      .vertices(x, y)
      .map((p) => worldPoint(p.x + this.x, p.y + this.y));
  }
  /** Hidden/null cells are still selectable. Infinite-tiling ties resolve before map clipping. */
  worldToTile(x: number, y: number): TilePoint | undefined {
    const t = this.geometry.worldToTile(finite(x) - this.x, finite(y) - this.y);
    return this.inBounds(t.x, t.y) ? t : undefined;
  }
  screenToTile(view: ViewTransform, point: ScreenPoint): TilePoint | undefined {
    if (!containsScreenPoint(view, point)) return undefined;
    const p = screenToWorld(view, point);
    return this.worldToTile(p.x, p.y);
  }
  neighbors(x: number, y: number): readonly TilePoint[] {
    this.cells.get(x, y);
    return this.geometry.neighbors(x, y).filter((t) => this.inBounds(t.x, t.y));
  }
  /** World-space bounding candidates clipped to finite storage. */
  tilesInBounds(bounds: TileBounds): IterableIterator<TilePoint> {
    return this.geometry.tilesInBounds(
      { ...bounds, x: bounds.x - this.x, y: bounds.y - this.y },
      { x: 0, y: 0, width: this.width, height: this.height },
    );
  }
  /** @internal Same changed-cell/lifetime contract as textured Tilemap. */
  onTilesChanged(notify: (index: number | null) => void): () => void {
    this.alive();
    this.listeners.add(notify);
    const unregister = this.onDispose(() => this.listeners.delete(notify));
    return () => {
      unregister();
      this.listeners.delete(notify);
    };
  }
}
/** @internal Passive placement component; not a collider. */
export class GeometryTilemapLayer extends Component {
  static readonly type: ComponentType<GeometryTilemapLayer> =
    defineComponent<GeometryTilemapLayer>("GeometryTilemapLayer");
  readonly type = GeometryTilemapLayer.type;
  constructor(readonly map: GeometryTilemap) {
    super();
  }
}
