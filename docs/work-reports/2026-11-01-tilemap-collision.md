# Tilemap collision: rectangle search and dynamic terrain

## Baseline and design checkpoint

- Started 2026-11-01 JST from main `d17cdf9b6ef7e33e61576c4ed24cbfcc837c38eb`.
- Branch: `feat/tilemap-collision-2026-11-01`.
- Existing: copied finite Grid/Tilemap data; world/tile conversion; independent draw depth/visibility; culled incremental shared-texture rendering; ID policies and sparse overrides (including invisible Solid cells); dynamic image/policy edits; shared Actor/terrain CollisionWorld solver; Circle/OBB response with internal-face suppression; per-cell Enter/Stay/Exit; owner-scoped disposal; playable Tile trail; Core/Host separation; SpriteAnimation and Tween.
- Missing in this scope: rectangle aggregation/indexing and bounded local rebuilding; convenient world-space cell rectangle; reproducible comparison with the existing direct search.
- Keep all existing APIs and cell contact identity/order. No per-cell Actors/Colliders and no separate physics loop.
- Add an optional CollisionWorld rectangle search mode. Deterministic row-run rectangles extend vertically only for identical horizontal extents and complete policies. Bound rectangles to 16x16 chunks. Lazy chunk construction avoids a full-map startup scan. Single-cell invalidation drops only its chunk; ID policy edits invalidate cached chunks containing that image ID; bulk changes invalidate cached chunks. Placement movement needs no rebuild (rectangles use tile coordinates).
- Rectangles aggregate collision candidate shapes, not public contact identity. The same exact cell narrow phase and topology-aware response remain authoritative. This deliberately preserves existing trajectories, contact normals/depth and per-cell events. It does not claim one response test per rectangle or fewer public contacts. Dense contacts still require cell work; measure the overhead as well as favorable sparse footprints before selecting defaults.
- Preserve direct search as the default until measurements justify changing it. The sample will explicitly opt into rectangle search.
- Edits remain synchronous data writes, sampled by the next CollisionWorld pass. Contact callbacks cannot trigger rescans mid-delivery. New Solid under an Actor uses the existing next-pass finite-budget correction; fully embedded starts can remain unresolved. CCD remains out of scope.
- Add `tileBounds(x,y)` using existing Grid validation and world units; retain half-open point conversion.

## CI baseline

Source: [successful main CI 41229432146](https://github.com/oz-coden/Simpludify/actions/runs/41229432146). Total elapsed 666s, including deployment/live acceptance. Quality 57s; production 173s; site bases 240/242s; browser jobs 201/228/310/544s. Browser test portions: narrow 160/197s, desktop 283/508s. Chromium install 14–19s, npm install 3–5s, site build 3s, site smoke 209/211s. Production Tween smoke alone 104s; published Tween acceptance 65s.

One foreground worker per shard protects focus/input contracts; browser contexts and renderer disposal are covered by existing fixtures. Current CI already caches npm, shards desktop/narrow independently, cancels obsolete branch runs, and reuses the validated project site artifact for deployment. No measured evidence yet supports a workflow rewrite. Local focused tests precede full CI; no timeout increases planned.

## Verification and remaining work

Investigation/design complete. Implementation, focused tests, benchmarks, full regression, main integration and published acceptance are pending. No unexecuted checks are marked successful.

## Implementation checkpoint: shared terrain and rectangle geometry

Existing collision policy/override/dynamic APIs were retained. Added internal `TileCollisionIndex` and `CollisionWorld({tileSearch:"rectangles"})`; direct `"cells"` remains default. Rectangles merge complete equal policies horizontally/vertically inside lazy 16x16 chunks. Region policy filters and exact Circle/OBB-vs-region tests reject aggregate candidate shapes before expanding surviving cells in row-major order. Cell manifolds, internal-face suppression, response ordering and contact identities are unchanged.

Invalidation handles single cells, ID defaults, bulk changes and equal-policy image edits (which change future ID membership). Translation reuses local geometry. Map/World disposal releases subscriptions/cache; all changes are observed at the next ordinary collision pass. Added `Tilemap.tileBounds`.

Focused checks: baseline 96 tests passed. Implementation focused suite 87 tests passed, including randomized region coverage/full policies, one-chunk rebuilding, equal-policy image/default edits, exact differential trajectories/events with four Actors, runtime changes from contact handlers, pause/resume, disposal, discrete teleport behavior, new-wall next-pass correction, and existing Actor-wall trajectory comparisons through rectangle/chunk seams. Root and DOM-free Core TypeScript checks passed. Test authoring caught an incorrect Body option name (`type` instead of `motion`); corrected before this checkpoint.

Changed: `packages/core/src/game/{collision,tilemap,tile-collision-geometry,tile-collision-index}.ts`, `tests/helpers/tile-wall-scenario.ts`, `tests/unit/tile-collision-index.test.ts`.

Environment: npm install succeeded. Local Chromium installation returned truncated/non-ZIP downloads on all retries; no local browser pass is claimed. Repository pushes use the connected GitHub Git-data API because shell git has read-only access. All remote updates use expected-head checks and fast-forward only.

## Dynamic update, coordinate, layer and sample checkpoint

Added/validated the lazy chunk invalidation alongside the rectangle implementation, without introducing another update queue or physics loop. Existing rendering remains independent (zIndex/visibility vs physics response/layer/mask). Tile trail now explicitly uses rectangle search, displays cached cells/regions/chunks and adds a fixed door at (14,7), retaining existing WASD, wall editing, Trigger, camera, SpriteAnimation and Scene transitions. Added WebGL/Canvas2D pixel/physics/cleanup tests for rectangle mode, plus door/real-input sample checks in both viewport projects. Browser tests are authored and typechecked, not yet executed. Added CPU benchmark script; collection follows this committed checkpoint. English API/contracts and Japanese guide describe only implemented APIs and explicitly distinguish candidate rectangles from cell responses/events.

Quality-check finding: main's final Tween report contained an unformatted JSON block introduced after its last CI. Applied the formatter's three-line-array-to-one-line-only change, preserving that report's content. Also formatted the new index row and static-Body fixture. No existing assertions were weakened.

## CPU measurement checkpoint

Collected 12 baseline and 24 current cases using `scripts/benchmark-tile-index.mjs`: 32² / 128² / 512² cells, small-wall / wide-sparse / filtered-dense / dense-trigger. Baseline Core d17cdf9; current runtime 9132f79. Raw arrays/conditions/environment are in `benchmarks/tile-index/{baseline,current}.json`; full table and reproduction commands are in `docs/tilemap-performance.md#rectangle-collision-search`. No tests/builds ran concurrently.

512² filtered-dense p50: baseline 0.1238ms, current direct 0.1613ms, rectangles 0.0138ms; cached 4,352 collidable cells → 17 candidate rectangles. 512² small-wall: baseline 0.1114ms, current direct 0.1359ms, rectangles 0.2515ms. Tiny footprints do not justify index overhead; direct remains default. Short series/JIT/environment variation precludes a universal speedup/regression claim. Narrow phases/contact response still expand intersecting cells. Every indexed single-cell edit rebuilt at most one chunk. CPU heap deltas are retained with explicit noise/fixture-retention limitations; browser drawing measurements are separate.

Added production/public Tile trail acceptance script for both viewport sizes: actual keyboard wall stop/sliding/camera, real door buttons and closed/open canvas pixels, passage through opened door, Scene recreation, contacts/cache/image/input/host cleanup and published docs. Site-base jobs execute it before main integration; deploy executes the same script against the published site. Existing Tween acceptance remains unchanged. No timeout increases or cache/shard rewrites were made.

## Integration-candidate checkpoint

Local focused index suite: 12 tests passed, including 150 randomized Circle and 150 rotated/scaled OBB poses with chunk-edge/tolerance cases, compared exactly against direct search. `npm run check` passes with only the repository's existing warnings/infos. Reviewed Core/Host separation, full-policy boundaries, no duplicate physics loop, cell/event ordering, lazy updates and disposal. A test-authoring issue in the door fixture was corrected to assert a round trip from its actual preexisting state (the earlier wall-edit test already opens that cell). Final full unit/build/site checks and branch CI are starting from this checkpoint. Browser and production acceptance remain pending until actual CI results are available.
