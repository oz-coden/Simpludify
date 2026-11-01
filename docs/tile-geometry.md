# Tile geometry and color layers

Core and Web export `TileGeometry`, `HexOrientation`, `GeometryTilemap` and `Shape.Hexagon`. Grid remains fixed row-major storage; geometry defines an independent local-space tiling. Existing image-based square `Tilemap`, SpriteSheet readiness/leases and optional circle/box terrain collision retain their contracts.

## Create, draw and edit

```ts verify
import { Game, GeometryTilemap, Grid, TileGeometry } from "@simpludify/web";
const game = new Game();
const map = new GeometryTilemap({
  geometry: TileGeometry.hex({ radius: 24 }),
  tiles: Grid.generate(12, 10, (q, r) => (q + r) % 2 ? 0x397c87 : 0x305c70),
  x: 80,
  y: 90,
}).place(game.engine.scene);
map.set(3, 4, 0xea739e);
const center = map.tileToWorld(3, 4, { center: true });
const selected = map.worldToTile(center.x, center.y);
console.log(selected, map.neighbors(3, 4));
await game.run();
```

A cell is a 24-bit RGB integer (including zero/black), or `null` for no drawing. Both Grid and nonempty rectangular rows are copied. There is no palette/asset/type registry: game-specific kinds can live in an independent Grid, with their colors projected through `set`. Invalid colors or dimensions throw before mutation. `get/set/inBounds`, `width/height`, `copyTiles`, `fill`, `revision`, placement and disposal follow the existing Tilemap conventions. Equal writes/fills are no-ops; fill emits one bulk invalidation. Reads/snapshots remain usable after disposal; mutation and subscriptions reject disposed ownership.

`x/y/zIndex/visible/enabled` are live placement properties; defaults are 0/0/0/true/true. x/y are translation only, in world units. `GeometryTilemap` owns one Actor and a passive placement Component, no Actor per cell. `place(scene)` shares Scene ownership/ID checks; removing/disposal is terminal. Dimensions and immutable geometry cannot be replaced; create a new placement for another tiling. Null or visually hidden cells retain logical coordinates and can still be selected. `screenToTile` only checks the viewport clip and finite-map ownership, not rendering visibility.

## Coordinates and polygon shape

| Geometry factory | Indices / origin | Shape / size |
| --- | --- | --- |
| `TileGeometry.square({width,height?})` | column/row; (0,0) bounding origin (0,0) | half-open rectangular cells; height defaults to width |
| `TileGeometry.triangle({width,height?})` | column/row; horizontal stride width/2, vertical stride height | even column+row points up; odd points down; height defaults to width×√3/2 |
| `TileGeometry.hex({radius,orientation?})` | axial q/r as x/y; (0,0) center (0,0) | regular hexagon; radius is center-to-vertex; default Pointy |

`HexOrientation.Pointy` has horizontal center spacing √3×radius and row contribution half that spacing; vertical row spacing is 1.5×radius. `HexOrientation.Flat` has horizontal q spacing 1.5×radius, vertical r spacing √3×radius, and q contributes half the vertical spacing. Both share axial neighbor/distance logic. Finite hex storage is a q/r parallelogram, not a staggered rectangular screen region. The (0,0) hex extends left/up of its placement origin; use `tileBounds` when positioning the whole map. Raw geometry supports signed safe-integer indices; finite maps use 0≤x<width and 0≤y<height.

`geometry.center(x,y)`, `.vertices(x,y)` and `.bounds(x,y)` return fresh local-space data. Vertices run clockwise in the y-down world. Triangle center means centroid (at 2/3 height for up, 1/3 for down), not bounding-box center. Map `tileToWorld(x,y)` returns its bounding-box origin; `{center:true}` returns the centroid, and `tileVertices/tileBounds` include map translation. The origin of a polygon bounding box need not lie inside that polygon.

### Selection and boundaries

`geometry.worldToTile(x,y)` selects a cell on the infinite tiling. Squares use left/top included and right/bottom excluded, as existing square Tilemap does. Triangles/hexagons test their actual closed polygon, then shared edges/vertices choose the smallest row (y/r), then column (x/q). A cross-product tolerance of 1e-10×width×height stabilizes floating-point shared edges; points within that tolerance use the same tie policy. This is not a configurable gameplay hit slop. Extremely large coordinates relative to tile dimensions can lose floating-point precision and are outside reliable picking.

Finite `map.worldToTile` resolves infinite ownership **before** bounds clipping; it returns undefined when that owner is outside storage. Consequently a finite outer edge can belong to the absent neighbor even when the remaining tile touches it. This keeps picking independent of map size and avoids edges changing ownership after adding data. Nonfinite world inputs throw. Noninteger/out-of-map indexed operations throw GRID_BOUNDS.

```ts verify
import { Game, GeometryTilemap, PointerClick, TileGeometry } from "@simpludify/web";
const game = new Game();
const map = new GeometryTilemap({
  geometry: TileGeometry.triangle({ width: 48 }),
  tiles: [[0x305c70, 0x397c87, 0x305c70]],
  x: 100, y: 100,
}).place(game.engine.scene);
game.pointer.events.on(PointerClick, info => {
  const tile = map.screenToTile(game.view, info.screen);
  if (tile) map.set(tile.x, tile.y, 0xea739e);
}, game.engine.scene);
await game.run();
```

`screenToTile(view, screenPoint)` checks `view.clip`, calls the existing inverse Camera/ViewTransform and then polygon picking. Screen units are host-local CSS pixels, not client coordinates or backing pixels. `PointerClick.info.screen` already has this conversion and follows existing Canvas/DOM UI ownership. Alternatively use `game.pointerToWorld(event)` then `map.worldToTile`. Camera movement/zoom, viewport offsets and Fit letterboxing are handled by the same projection used for drawing. Reuse the current `game.view`; DPR never belongs in geometry.

## Neighbors, ranges and distance

`geometry.neighbors(x,y)` returns 4 square, 3 triangle or 6 hex edge neighbors. Triangle order is left, right, then vertical across its horizontal edge (down for up-facing tiles, up for down-facing tiles). Hex axial direction order is (1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1), independent of orientation. `map.neighbors` excludes indices outside storage.

`hex.distance(a,b)` is (|dq|+|dr|+|dq+dr|)/2. `hex.withinRadius(q,r,radius)` lazily enumerates an inclusive graph-distance disk, row-major; radius must be a nonnegative safe integer. These two methods reject non-hex geometry. `triangle.pointsUp(x,y)` exposes parity and rejects other geometries. No terrain costs or pathfinding are attached.

`geometry.tilesInBounds(localBounds, coordinateLimit?)` lazily enumerates cells whose **bounding rectangles** intersect a rectangle, including touching boundaries; this is a conservative culling/search API, not exact polygon/rectangle intersection. The optional integer `{x,y,width,height}` limit bounds indices. `map.tilesInBounds(worldBounds)` applies translation and finite storage clipping. Queries require finite nonnegative extents; zero extent returns no cells. Callers should bound query size; a deliberately huge query/disk still yields many cells. Per-row intervals avoid scanning all map cells or a large empty slanted axial bounding region.

## Rendering, updates and lifetime

Web draws the actual polygon fill with Pixi Graphics on WebGL or Canvas2D. It does not place rectangular images at hex centers. Maps share the existing Camera world container and depth ordering with image Tilemaps and ordinary Actors; equal zIndex uses Scene insertion order. Each layer is one ordering group. There is no stroke, overlap padding, image mask or polygon atlas contract.

Only visible bounding candidates retain Graphics. Unchanged views with no edits perform zero cell reconciliation visits. A changed visible cell redraws its retained Graphics (or creates/removes it for null transitions); offscreen edits cause no cell visits. Camera/placement changes enumerate visible candidates, retain unchanged cells and destroy outgoing contexts. Bulk fill and edits made while hidden refresh visible cells on return. This does not eliminate normal Pixi drawing cost. There are no chunk meshes or speculative pools.

`PixiRenderer.geometryTilemapDiagnostics` reports live maps/Graphics and live-entry visitedCells/updatedTiles/createdGraphics/destroyedGraphics counters. Existing renderer and image-Tilemap diagnostics retain their schemas. Scene/placement/Game disposal removes observers and destroys Graphics/contexts; color layers hold no textures, image leases, pending loads or readiness promises. Existing SpriteSheet ownership is not duplicated.

## Actor Hexagon

```ts verify
import { Actor, Renderable, Shape, Transform } from "@simpludify/core";
const actor = new Actor();
actor.add(new Transform({ x: 100, y: 100, rotation: Math.PI / 6 }));
const view = actor.add(new Renderable({
  source: { kind: "shape", shape: Shape.Hexagon },
  width: 60, height: 70, color: 0xea739e, opacity: 0.8,
}));
view.source = { kind: "shape", shape: Shape.Triangle };
view.source = { kind: "shape", shape: Shape.Hexagon };
```

Hexagon is pointy and centered on Transform, with full bounding width/height. For a regular pointy hex use width=√3×radius and height=2×radius; independent dimensions stretch it. Rotation can turn it flat. Existing Transform and Renderable draw offsets/rotation/scale, opacity, color, visibility, live revision and `actorTween` work unchanged. There is no separate radius or polygon-physics option. Existing Triangle still points up in its centered width/height box. Add existing circle/box Collider approximations independently when appropriate.

## Scope and validation

Color square/triangle/hex layers are supported; arbitrary image/SpriteSheet/UV mapping inside polygons is deferred. Existing square image Tilemap remains the image path. No triangle/hex/N-gon Collider, SAT, automatic polygon terrain Collision, pathfinding, strategy state or new Scene scheduler is introduced. Map rotation/scaling, infinite streaming, texture masks and native/mobile browser hardware verification remain outside this implementation.

[Tile geometry lab](../examples/tile-geometry/README.md) demonstrates both hex orientations, selection/painting, edge-neighbor highlights, null visibility, Camera pan/zoom, Scene recreation, Canvas UI and rotating Triangle/Hexagon Actors. [Work report](work-reports/2026-11-01-tilemap-geometry.md) records actual test/benchmark evidence and integration status.
