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
