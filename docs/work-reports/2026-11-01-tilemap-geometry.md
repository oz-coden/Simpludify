# Tile geometry and polygon rendering — 2026-11-01

## Baseline and scope

- Starting main: `86f5a28f19f67688f564598353c73650d9e1b18b`.
- Branch: `feat/tilemap-geometry-2026-11-01`.
- Status: investigation complete; implementation and validation pending.

## Existing implementation review

`Grid<T>` owns copied fixed-size row-major data with checked integer access and no host or Scene dependency. `Tilemap` copies grids/rows, validates SpriteSheet IDs, tracks used frames and revision/changed-cell notifications, and places one Actor/TilemapLayer in a Scene. `TilemapVisual` maintains visible Sprite cells and dirty-cell updates. Renderer leases come from SharedImages; sheet frames share their texture source, preparation is asynchronous, and Actor/Scene disposal cancels pending owners and releases leases. Scene Core lifecycle stays synchronous.

`Tilemap.tileToWorld` uses a rectangular top-left origin by default and optional center; `worldToTile` uses half-open rectangular bounds. Camera/ViewTransform and screenToWorld already separate CSS screen units, world units, viewport clips and DPR. PointerRouting provides world events after UI ownership decisions. This conversion pipeline can be reused.

`Renderable` validates immutable sources and versions live properties. Triangle rendering is centered and points upward, with Transform and draw-only offsets/rotation/scale composed by Web. SpriteAnimation and Tween already mutate existing components. CollisionShape has circles and rotated boxes independently of Shape. `CollisionWorld` observes only TilemapLayer for terrain: direct cell search is default; optional equal-policy rectangle merging uses lazy 16×16 chunks. These paths must remain unchanged.

Core is DOM/Node/Pixi independent; Web owns Graphics/Sprites, readiness, culling and resource cleanup. CI runs quality/unit, desktop/narrow browser shards, production builds, and both site bases before main Pages deployment. Site config builds existing examples and routes Japanese/English docs. Existing square Tile trail, triangle, tile collision and Tween/UI fixtures provide regression coverage.

## Design decisions

- Add immutable local-space square/triangle/hex geometry independent of Grid storage and Scene ownership.
- Triangle coordinates use integer column/row with alternating up/down orientation; hex coordinates use axial q/r represented by x/y. Hex supports pointy and flat orientation through the same formulas.
- Add a finite `GeometryTilemap` color layer using existing Grid, Actor/Component placement, changed-cell subscriptions, Scene lifecycle, Camera projection and renderer depth ordering. Keep textured square Tilemap and physics entirely on their current paths.
- Geometry color cells are 24-bit RGB values or null (hidden). Polygon texture masks/UV/atlas design is deferred; existing rectangular SpriteSheet rendering is unchanged. No polygon Collider or polygon terrain physics is introduced.
- Square geometry keeps half-open ownership. Shared triangle/hex edges use a documented deterministic row-then-column tie break on the infinite tiling before finite-map clipping.
- Cull by geometry-derived per-row candidate intervals and polygon bounding rectangles. Retain visible Graphics and update changed visible cells only; avoid one Actor per tile or full-map scans per frame.

## Validation and measurements

Pending. No new tests, benchmarks or public acceptance checks have run at this checkpoint.

## Checkpoints and handoff

1. Investigation/design checkpoint (this report). Next: implement Geometry and invariant tests, then renderer/picking, Actor Hexagon, sample/docs, measurements and complete CI.
2. Integration must wait for major checks; record actual results and links here before merging.

### Geometry checkpoint

Implemented `TileGeometry.square/triangle/hex`, centers, vertices, bounds, deterministic picking, neighbor enumeration, hex distance/disks, and clipped per-row bounding candidates. Hex pointy/flat both supported. Fourteen targeted geometry tests pass (625 signed-coordinate centers per geometry, shared edge ownership, symmetric adjacency and brute-force range oracle). Initial tests caught negative zero in candidate output; tile coordinates now canonicalize zero. Renderer/map integration is next. Design commit: `f898a0259f8fd2c9c656b0f093d08d9de006c2a9`.

### Color layer / picking checkpoint

Added `GeometryTilemap`, a copied finite RGB/null Grid placed via one passive Actor/Component, and a Web visible-cell Graphics presentation. Existing textured square Tilemap rendering/data/Collision files are unchanged; only renderer reconciliation/depth ordering recognizes the new layer. Map API includes set/fill/snapshot, world/screen picking, centers, vertices, bounds, finite neighbors and world-bounds candidates. Cell changes retain Graphics; unchanged frames and offscreen edits cause no cell visits. Hidden edits and fill refresh visible geometry. Disposal explicitly destroys Graphics contexts and removes subscriptions.

Targeted geometry/map/square/index regression: 41 tests passed; TypeScript passed. Initial new test used a nonexistent index diagnostic field; corrected it to assert actual chunks/cells/builds all remain zero for polygon layers. Local Playwright browser download failed (truncated/invalid ZIP); browser checks remain pending, not waived. Geometry commit: `ab6d2c9c14c18ba1f21c11075ecc61bca324570d`.
