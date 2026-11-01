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
