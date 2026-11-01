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

### Dynamic updates / Actor shape checkpoint

Added `Shape.Hexagon` to the existing immutable Renderable source union and existing Graphics branch (pointy, width/height bounding box, centered). All Transform, draw-only transform, color/opacity, live source changes and Tween behavior is reused. Circle/box Collider types are untouched. Added a headless Hexagon/Tween/Collider composition test and included Hexagon in the existing real-pixel Triangle fixture. Eighteen targeted Actor/renderable/Tween tests and TypeScript pass. The old invalid-source test treated the literal "hexagon" as unsupported; its unsupported case is now "unsupported-polygon", preserving atomic rejection checks.

Color layer commit: `5bba75eec372985a4b2604d32756eaa5e74bd2fb`. Sample/docs, actual browser pixels/input and measurements remain pending. Intermediate implementation checkpoints use `[skip ci]`; final candidate will run full CI.

### Sample, documentation and browser checkpoint

Added `tile-geometry` standalone/gallery example and Japanese/English API guides, plus CLI/site registration and links from Tilemap/rendering/architecture/roadmap. The example demonstrates all four tilings, actual polygon fills, routed pointer painting, finite edge neighbors, null edits, pan/zoom controls, Scene recreation, Canvas label and independently tweened Triangle/Hexagon Actors. Image polygons remain explicitly deferred.

Browser validation on local Chromium 153 (isolated temporary `@sparticuz/chromium` binary; no repository dependency change): new geometry tests passed 8/8 across WebGL/Canvas2D and desktop/narrow. Existing Triangle+Hexagon fixture passed desktop both backends. Local pinned Playwright Chromium 156 and runtime Chromium 151 downloads returned a 195-byte Site Unavailable HTML rather than ZIP; the alternative binary was unpacked locally without changing browser assertions. CI uses its pinned browser.

Initial fixture failures: Canvas UI was configured after run (unsupported), and the sample Canvas root background filled the entire viewport. Fixed fixture setup through a Scene factory and bounded the sample label to a noninteractive 320×36 panel. A flat-hex click target was outside the zoomed viewport; changed the test to an in-viewport tile while keeping real pointer delivery and exact coordinate assertions. Additional Hexagon contour/transform/live-property assertions and repeatable CPU/render/picking measurements are being finalized.

Next: save this checkpoint, run benchmark alone, complete checks/unit/regression browser/build/site and full CI, review changes, then merge and verify Pages. No integration has occurred.

### Pre-integration validation checkpoint

- Full local unit suite: **805 passed / 60 files** (includes square Collision/index tests).
- `/Simpludify/` site build and site:check passed: **68 HTML documents, 4,537 references, 64 standalone snippets**.
- Geometry browser tests: 8 passed; expanded Hexagon contour/live transform assertions and true touchscreen input on Narrow are included in the next complete browser run.
- First full `check` found only new Markdown snippet/table and benchmark JSON formatting errors; formatting was corrected without changing assertions. Recheck is in progress.
- Performance harness now covers fixed-view maps 32²/100²/256² and all-visible 16²/32²/64² on both renderers, 12 warmups, 40 timed samples, raw data in `benchmarks/tile-geometry/results.json`. Isolated measurement confirmed exactly 40 cell visits for 40 edits, regardless of total/visible cells; static frames add none. CPU timings include draw submission, not GPU completion. Zero medians can reflect 0.1ms timer quantization, not free work. A paired square-image baseline/current harness is also committed for regression measurement.
- Review added a cached finite-map extent gate: extremely distant finite world points safely return undefined before infinite-coordinate arithmetic. Placement validates both ends of its extent; no new physics changes.
- New production/live acceptance script verifies both guides, actual selected-cell pixels, color/null changes, Camera conversion, narrow touchscreen input and Scene/Game disposal. CI will execute it for both site bases and after Pages deploy.

All source is checkpointed before complete browser/build/site verification. Main integration is still pending.

Boundary validation caught a type-only graphics→game dependency from the new geometry helper. Moved the existing structural TilePoint type into graphics/coordinates and reexported it from game/tilemap, preserving its public name/shape and all runtime Tilemap behavior. The boundary validator was not relaxed. Production geometry acceptance passed locally for both viewport sizes, including exact pink cell pixels and Narrow touch input.

### Full CI candidate

Local final-source `check` passed (strict workspace/Core types, unchanged boundary rules, Biome, architecture validation, license allowlist). Full unit suite again passed **805/805**. Existing default production build/smoke passed at both viewport sizes. Full browser regression and integrated site smoke are running; no failure is currently waived. `/Simpludify/` geometry production acceptance already passed both sizes with exact painted RGB pixels and Narrow touchscreen delivery.

All-visible 4,096-cell results illustrate the limit: WebGL static draw medians about 0.1ms, one-cell-edit draw about 1.4–2.8ms; Canvas2D static about 7.5–9.1ms and edited about 7.7–8.9ms on the measured software environment. One-cell reconciliation remains one cell, but downstream Pixi/draw work is not guaranteed constant-time. Fixed-view picking batches of 1,000 were about 0.1ms square, 0.8–1.0ms triangle, 1.5–1.7ms pointy hex and 2.2ms flat hex in the first fixed-view sweep. These are environment-specific observations, not FPS/GPU/native/mobile promises. Final paired square-regression measurements and exact CI links will follow.

The previous pushed checkpoint is `2d87941761bb14b80429911b4e2d95bdb51fc2d5`. This candidate triggers the existing complete CI plus new production geometry checks; no main integration yet.
