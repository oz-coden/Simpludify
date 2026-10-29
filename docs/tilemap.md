# Tilemap

Tilemap is an optional finite placed image grid, exported by Core and Web. It does not replace the game's world; collision is optional and absent by default. Ground, walls and decorations can be independent overlapping maps of different sizes/origins.

## Small public API

```ts verify
import { Game, SpriteSheet, Tilemap } from "@simpludify/web";
const game = new Game();
const sheet = SpriteSheet.grid("terrain.png", {
  frameWidth: 32,
  frameHeight: 32,
  names: { grass: 0, wall: 1 },
});
const ground = new Tilemap({
  sheet,
  tiles: [
    ["grass", "grass", 0],
    [0, "wall", null],
  ],
  tileWidth: 32,
  tileHeight: 24,
  x: -32,
  y: 64,
  zIndex: -1,
}).place(game.engine.scene);
ground.set(2, 1, "grass");
const origin = ground.tileToWorld(2, 1);
const center = ground.tileToWorld(2, 1, { center: true });
const tile = ground.worldToTile(center.x, center.y);
console.log(ground.get(2, 1), origin, tile);
await game.run();
```

The image must contain the requested frames. `sheet` accepts grid or arbitrary-rectangle SpriteSheet, including inferred names. Cell images stretch to exactly tileWidth/tileHeight; this intentionally does not preserve each frame's original aspect ratio. Empty cells are exactly null, not undefined, negative IDs or magic zero. Zero is an ordinary first-frame ID. Frame dimensions use decoded image pixels; cell dimensions and x/y use world units.

Use `map.place(scene)` once, during setup or runtime; it returns the same facade. `map.dispose()` removes/destroys the placement. `.scene`, `.disposed` and `.enabled` reflect its internal Actor. `.visible` affects drawing; `.enabled` gates the placement through existing Actor semantics. Neither is a collision switch. x/y, zIndex and visible are validated live values; defaults are 0,0,0,true. id/enabled are forwarded Actor options. Dimensions and sheet are readonly. There is no implicit Transform/rotation/scale. Game code does not obtain Pixi objects, register drawing, update the map each frame or release Textures manually.

The facade owns one internal Actor with one passive TilemapLayer Component. This reuses Scene IDs, exclusive membership, removal, disposal and structural reconciliation. It adds no second Scene registry. Keeping the facade distinct avoids colliding with Actor.get(ComponentType) and the map's get(x,y); per-cell Actors/Components are never created. Do not construct the internal TilemapLayer yourself. [Design comparison](tilemap-design.md) record the alternatives.

## Data and errors

```ts verify
import { Grid, Scene, SpriteSheet, Tilemap } from "@simpludify/core";
const sheet = SpriteSheet.rects("atlas.png", {
  floor: { x: 0, y: 0, width: 16, height: 16 },
  wall: { x: 16, y: 0, width: 16, height: 24 },
} as const);
const input = new Grid<number | null>(100, 100, 0);
const map = new Tilemap({ sheet, tiles: input, tileWidth: 32, tileHeight: 32 });
input.fill(null); // no change to map
map.place(new Scene("terrain"));
map.set(3, 4, "wall");
map.fill("floor");
const saved = map.copyTiles();
map.dispose();
const next = new Tilemap({
  sheet,
  tiles: saved,
  tileWidth: 32,
  tileHeight: 32,
});
console.log(next.width, next.height);
```

Rows must be a nonempty rectangle, read as rows[y][x]. Grid dimensions retain Grid's maxCells limit (16,777,216). Both inputs are copied; no writable backing Grid is exposed. `copyTiles()` returns an independent Grid for snapshots, reuse or ordinary Grid traversal. Stored IDs are numbers/strings/null, so no object cloning/ownership is needed. Snapshot/read operations remain usable after disposal; mutation/placement acquisition does not.

`get`, `set`, `inBounds`, `width`, `height` use Grid contracts. Out-of-range/fractional coordinates throw GRID_BOUNDS; malformed/empty rows throw GRID_SIZE. Invalid frame definitions/references retain SpriteSheet errors. Positive finite cell dimensions and finite positions/depth are required; derived map extents must remain finite. No clipping/wrapping/silent invalid writes is performed. set validates before mutation; equal IDs and already-equal fills are revision no-ops. A fill is one bulk invalidation. `revision` tracks cell content only, not movement/visibility/depth.

Numeric grid-frame upper bounds and decoded rectangle bounds cannot be known before image decoding. Web validates all unique IDs used in the map, including offscreen/hidden cells, before readiness succeeds. A runtime invalid edit rejects Game.whenReady and reaches onError, retaining the previous display until corrected; game logic keeps running. Failed staged preparation disposes its candidate and preserves the active Scene. Changing to a valid ID permits recovery. Data edits do not reload an already loaded sheet.

## Tile/world/screen coordinates

Integer tile (0,0) is the map's top-left; x grows right, y down. x/y placement can be negative. tileToWorld requires an in-bounds tile and returns a branded WorldPoint at its top-left, or its center with `{center:true}`. `worldToTile(x,y)` floors the translated/scaled coordinates and returns a branded TilePoint or undefined outside. Left/top boundaries are included; right/bottom are excluded. Exact internal boundaries select the cell to the right/below. Nonfinite input is rejected. Negative world coordinates are valid when within a negatively placed map.

Screen conversion remains Game.screenToWorld/pointerToWorld/worldToScreen, using the existing Camera, Viewport, logical resolution and DPR contracts. No screen or physical pixel coordinate is interpreted as a tile index. Move x/y to translate a map; map rotation, scaling, isometric and hexagonal projection are outside this foundation.

## Ordering, culling, edits and resources

Higher zIndex draws above lower across Tilemaps and Renderables. Equal values use Scene Actor insertion order. Each map is one draw group: ordinary Actors may appear between ground and decorations, not inside the individual cell ordering of one map. Tile images fill their cells, so in-map Sprites do not overlap.

The renderer inverts view.clip to find the intersecting tile rectangle and creates Sprites only for nonempty visible cells. A stable view with no edits performs zero tile-cell visits; visible set edits are processed once per changed index. Offscreen edits are realized when entering view. A moved visible tile range scans that visible range and destroys outgoing Sprites. Bulk fill invalidates the visible range. This implementation does not yet pool outgoing Sprites, update only incoming scroll strips or use GPU chunk meshes. Pixi still draws the visible Sprite set each frame; zero reconciliation visits does not mean zero rendering cost.

Each placement holds one sheet-image lease, including an empty, hidden or disabled map. Existing SharedImages coalesces loads by resolved URL across maps, Actors and staged Scenes. Grid/rect frame Textures share their TextureSource and rectangle cache. Removal/Scene/Game disposal cancels only the relevant pending consumers, destroys map display objects and releases its lease. Final base-image reference destroys cached crops and the source. Late non-abortable results release without committing. Copying data/SpriteSheet metadata alone acquires no GPU resource.

`PixiRenderer.diagnostics` keeps its existing schema/meaning. Additional `tilemapDiagnostics` reports live maps/Sprites/visibleTiles and aggregate live-entry counters visitedCells, updatedTiles, createdSprites, destroyedSprites and validatedFrames. Counters are logical reconciliation work, not draw calls, GPU uploads, bytes or lifetime totals after entries are disposed. Unique frame validation caches remain attached to each live placement. Raw counts and [measured limits](tilemap-performance.md) distinguish full/partial visibility and static/dynamic workloads.

## Sample and limits

```sh
npm run dev -- --example tilemap
npm run build -- --target web --example tilemap --base /Simpludify/
```

[Tile trail](../examples/tilemap/README.md) uses original artwork, three maps, animated WASD movement, camera follow, tile editing and Scene round trips. Stone/tree terrain is Solid and water is a pass-through Trigger. [Tilemap collision](tilemap-collision.md) documents optional ID defaults, cell overrides, dedicated TileContact events and the shared CollisionWorld. Visibility/rendering and collision remain independent.

No infinite streaming, atlas file parser, autotiling, editor, animation tiles, physics rewrite, generic ControlGuard or new UI framework is introduced. Large all-visible Canvas2D maps remain expensive; native/GPU memory and mobile/Safari/Firefox hardware have not been verified.
