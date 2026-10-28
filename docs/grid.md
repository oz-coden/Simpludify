# Fixed-size Grid data

`Grid<T>` is a dense, fixed-size two-dimensional data structure exported by `@simpludify/core` and re-exported by Web. It needs no Engine, Scene, Actor, Component, renderer, browser or lifecycle. Use it for board cells, terrain IDs, passability or coordinate-indexed state. It does not render tiles or manage the lifetime/control of stored objects.

## Construction and coordinates

```ts verify
import { Grid } from "@simpludify/core";
const scores = new Grid<number>(10, 20, 0);
scores.set(3, 5, 42);
const score: number = scores.get(3, 5);
console.log(scores.width, scores.height, score);
```

Coordinates are integer indices: `(0,0)` is top-left, x increases right, y increases down. They are not pixels or world positions. Storage is one private Array with `index = y * width + x`. Width/height are read-only and never resize. Both dimensions must be positive safe integers, and their product must be safe and at most `Grid.maxCells` (16,777,216). Zero-sized grids are rejected. This deliberate dense-allocation limit rejects oversized requests before allocation; it does not guarantee that the host has enough memory for every accepted request or its stored objects.

The constructor requires an explicit initial value and stores that same value in every cell. No cloning or freezing occurs. Primitive numbers, strings, booleans, null and undefined are ordinary values. Functions are stored, never implicitly called as factories.

```ts verify
import { Grid } from "@simpludify/core";
const shared = { blocked: false };
const aliases = new Grid(2, 2, shared);
aliases.get(0, 0).blocked = true; // all four cells refer to shared
const independent = Grid.generate(2, 2, (x, y) => ({
  x,
  y,
  blocked: false,
}));
independent.get(0, 0).blocked = true; // other cells remain false
const callbacks = new Grid(2, 2, () => 123); // function-valued cells
console.log(aliases.get(1, 1), independent.get(1, 1), callbacks.get(0, 0)());
```

`Grid.generate(width,height,initialize)` invokes `initialize(x,y)` once per cell in row-major order. It returns only after every synchronous invocation succeeds; an exception propagates unchanged and stops construction. Generic T has no runtime schema: any returned value, including undefined or an intentionally shared object, is stored. TypeScript checks the declared/inferred T, but JavaScript/any callers remain responsible for value types. Promise-valued cells are possible; Grid does not await them.

## Bounds and errors

| Operation                | Contract                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| `get(x,y): T`            | Returns the cell, or throws `EngineError` with `GRID_BOUNDS`                   |
| `set(x,y,value): void`   | Validates coordinates before writing; never silently ignores/clips             |
| `inBounds(x,y): boolean` | False for noninteger, nonfinite or out-of-range coordinates                    |
| `fill(value): void`      | Replaces every cell with the same value/reference; does not dispose old values |
| `Grid.generate(w,h,f)`   | Separate factory API, avoiding ambiguity with function-valued T                |

Negative coordinates, coordinates at width/height, fractions, NaN and infinities are invalid. Grid size errors use `GRID_SIZE` with width/height/maxCells. Bounds errors carry x/y, grid width/height and the operation; rectangle errors also carry rectWidth/rectHeight. Nonfunction initializers/visitors use `INVALID_VALUE`.

Strict get keeps a bad coordinate distinct from a valid cell storing undefined. A separate tryGet would merge those cases without an additional result wrapper; it is omitted. Check inBounds when a candidate may legitimately be outside:

```ts verify
import { Grid } from "@simpludify/core";
const cells = new Grid<number | undefined>(3, 2, undefined);
const x = -1,
  y = 0;
if (cells.inBounds(x, y)) console.log(cells.get(x, y));
// Application-defined four-neighbor topology; Grid does not assume wrapping.
const directions = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
for (const [dx, dy] of directions) {
  const nx = 1 + dx,
    ny = 1 + dy;
  if (cells.inBounds(nx, ny)) cells.set(nx, ny, 1);
}
```

## Traversal and rectangular edits

`forEach((value,x,y)=>...)` visits left-to-right, then top-to-bottom. `forEachRect(x,y,width,height,visit)` uses original grid coordinates and the same order within a fully contained rectangle. Extents must be nonnegative safe integers. An empty rectangle is valid, including a zero-sized region at the right/bottom edge. Rectangles are checked completely before the first callback; there is no clipping.

```ts verify
import { Grid } from "@simpludify/core";
const terrain = Grid.generate(8, 6, () => ({ blocked: false }));
terrain.forEachRect(1, 2, 3, 2, (cell) => {
  cell.blocked = true;
});
let blocked = 0;
terrain.forEach((cell) => {
  if (cell.blocked) blocked++;
});
// A row and a column without exposing/reallocating backing storage:
terrain.forEachRect(0, 2, terrain.width, 1, (cell, x) => {
  if (x === 0) cell.blocked = false;
});
terrain.forEachRect(3, 0, 1, terrain.height, (cell) => {
  cell.blocked = false;
});
console.log(blocked);
```

Traversal reads live values. Replacing a future cell affects its later visit; earlier cells are not revisited. Callback exceptions stop immediately and propagate unchanged; prior changes remain, without rollback. Nested traversals are allowed because dimensions do not change. Visitor return values are ignored, and async visitors are not awaited; use an explicitly controlled loop for asynchronous work. There is no implicit snapshot, per-cell coordinate object/entry allocation, change tracking or exclusive ownership.

Only forEach/forEachRect/fill are included. map, entries, values, row/column copies, public index conversion, neighbor objects and rectangular copy/fill helpers are omitted until a concrete use needs them. The rectangle visitor already supports row/column scans and selective edits. Stored objects remain mutable references; Grid protects its own backing Array/dimensions, not the interior of T.

## Practical example and existing games

[The data-only placement example](../examples/grid/logic.ts) builds independent `{blocked,building}` cells, marks terrain rectangles, tests building footprints, places a building without partial out-of-bounds writes, and removes its occupied cells. [Executable tests](../tests/unit/grid.test.ts) cover successful placement, blocked/overlapping/outside footprints and removal. It does not create Actors or implement rendering, collision, pathfinding or a Tilemap.

Blockfall retains its existing 10×20 `Cell[][]`. Its line clear naturally filters/splices complete rows, and pieces may occupy negative y above the visible board. Migrating it would add row movement/reconstruction and snapshot adaptation without a demonstrated benefit. Prism Raid uses continuous world positions, Actors and combat collections; a dense integer Grid is not a replacement for those structures. No existing game logic is rewritten merely to use Grid.

## Cost and responsibility boundaries

get/set/inBounds are O(1); construction, generate, fill and full traversal are O(width×height). Rectangle traversal is O(rectWidth×rectHeight), with constant validation. Storage is O(width×height), without one Array per row. get/set pay numeric/range checks; callback scans cost more than direct unchecked loops. generate deliberately initializes its private array before overwriting it with factory results, rather than adding a second construction protocol. Actual costs and heap observations are in [Grid measurements](grid-performance.md).

Grid never acquires, releases or disposes stored objects. It has no dispose method, control-right system, lifecycle, Module/Plugin requirement, raw storage view, resizing or generic N-dimensional backing layer. Tilemap may later combine a Grid of IDs/attributes with separate rendering/layers/world transforms. Sparse/infinite/chunked data should be separate structures with their own storage/absence contracts, not compatibility abstractions added to this dense Grid.
