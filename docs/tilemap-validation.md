# Tilemap validation and delivery

> Historical Tilemap foundation validation. Current optional collision is documented in the [Tilemap collision API](tilemap-collision.md); the older deferred-collision statements below describe that foundation checkpoint.

Work started from `codex/working-sprites` at eb61494e5f3275ba1593bb5989cb8f3b9cdce312 after verifying the remote. New work is on [codex/working-tilemap](https://github.com/oz-coden/Simpludify/tree/codex/working-tilemap). Each checkpoint commit was immediately persisted by a fast-forward branch update. No force update, main push/merge or Sprite-branch update was performed.

At final verification main remains 8b6babe9157c0dbb2ceb288afc8a4595ed8535dd and the Sprite branch remains the requested eb61494e5f3275ba1593bb5989cb8f3b9cdce312. Main-to-Tilemap differences include the prior Sprite work; Sprite-to-Tilemap is the scoped new work. The final branch head adds the final measurements and this report, so the complete deliverable is recoverable from GitHub independently of the chat.

## Public API and architecture

`new Tilemap({sheet, tiles, tileWidth, tileHeight, x?, y?, zIndex?, visible?, id?, enabled?}).place(scene)` is the placement facade. It provides get/set/fill/inBounds/copyTiles, readonly dimensions/revision, tileToWorld/worldToTile, live position/depth/visibility, enabled, scene/disposed, onDispose and dispose. Names infer from SpriteSheet; null is the only empty cell. [API guide](tilemap.md) contains checked examples, units, errors and coordinate boundaries.

Rows and Grid inputs are validated copies; there is no exposed writable backing Grid. copyTiles supports data reuse after Scene disposal. A placement uses one internal Actor and one passive TilemapLayer, avoiding a new Scene collection while keeping map.get(x,y) distinct from Actor.get(ComponentType). Renderer integration is in a separate tilemap-visual module with existing SharedImages leases/crop Textures. Each map is a draw group ordered alongside ordinary Renderables. No per-cell Actor/Component, implicit simulation update, manual draw registration or texture cleanup is required.

Visible nonempty cells use normal Pixi Sprites, batched by the existing backend. Culling inverts ViewTransform.clip. Stable static frames visit zero cells; visible edits update only changed indices, offscreen edits defer until entry, and range changes scan the visible rectangle. A map's unique used IDs are decoded-bound validated. Data/fill/visibility/resource semantics and cache limits are documented, rather than introducing a chunk/streaming framework without measurements.

[Ownership/rendering alternatives and collision proposal](tilemap-design.md) compare direct Scene ownership, Actor inheritance, internal Component placement, the reviewed @pixi/tilemap artifact, direct collision queries, rectangle merging and chunk rebuilding. Collision images/attributes must be separate, with ID defaults and cell overrides. Future contact identities are placement/cell based rather than optimizer rectangle based. Current Collider Contact hard-codes Actor/Collider targets and needs an explicit discriminated target/event design before tile collision integration. No speculative public collision API or per-cell Collider has been added.

## Verification

Environment: Linux / AMD EPYC 9V74, Node 24.22.1, TypeScript 7.0.2, PixiJS 8.22.0, Chromium 156.0.8078.4 / Playwright 1248. PC 1440×900 and narrow 390×844, WebGL/SwiftShader plus forced Canvas2D.

| Check                                          | Result                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                                         | Passed; no dependency/lockfile change.                                                                                                                                                                                                                                                                                                                    |
| npm run check                                  | Passed strict types, DOM-free Core, lint/format, architecture/file validation and license review for 116 locked dependencies. Twelve pre-existing warnings remain; no lint errors.                                                                                                                                                                        |
| npm test                                       | 366 tests passed in 28 files. Includes copied data, empty/named tiles, strict coordinates/options, mutations/no-ops, ownership/reuse, and lease/subscription cleanup despite Pixi destroy failure.                                                                                                                                                        |
| npm run check:sprite-completions               | Actual pinned TypeScript completion API returns idle/walk for sheet.get, animation.play, map.set and map.fill. The original script was extended rather than duplicated.                                                                                                                                                                                   |
| Full browser regression                        | First run 164/164 passed; after cleanup hardening and expanded sample fallback coverage, final run 166/166 passed, retries disabled.                                                                                                                                                                                                                      |
| Tilemap-specific browser suite                 | 20/20 passed: real crop pixels/layer depth, independent map sizes/origins, copied data, one-cell/offscreen/static counters, camera/resize, Scene handoff/recreation, shared image counts, pending disposal, abandoned late loads and runtime/staged invalid-frame recovery. Actual WASD sample/camera/edit/Scene controls run on both backends and sizes. |
| Default Web build and Tilemap production build | Both passed; Tilemap built under /Simpludify/ with original SVG assets.                                                                                                                                                                                                                                                                                   |
| npm run test:build                             | Default production output passed under /Simpludify/ at both sizes.                                                                                                                                                                                                                                                                                        |
| Site build/check with /Simpludify/ and /       | Both passed: 40 docs pages + eight sample entries, 48 HTML documents, 2444 local references/assets, 48 independently typechecked snippets.                                                                                                                                                                                                                |
| npm run test:site for both bases               | Passed themes, navigation, all sample startup/restart/stop and cleanup at both sizes. Tilemap production case verifies real grass pixels, WASD camera progress, exactly four Actors/three maps/two base images/four leases, a single visited cell after painting, and Scene leave/return.                                                                 |
| Isolated measurements                          | 72 final runs (three sizes × all/partial × static/dynamic × two backends × three repeats), five warmups and 20 measured draws each; all work/resource assertions passed. See raw data and measured source SHA in tilemap-performance.md.                                                                                                                  |

Ordinary Tile trail operation reports no console/page errors. Expected invalid-frame fixtures route diagnostics to their observer and assert rejection/retained pixels. Prior Sprite work recorded a one-off existing Signal Run narrow-input failure; it did not reproduce in either full run here. Its earlier root cause remains unestablished, so this task does not claim that historical flakiness was fixed. Temporary type/lint/harness errors during implementation were corrected; none is treated as successful validation.

## Measurements and limits

[Tables and raw data](tilemap-performance.md) separate initialization, first preparation/submission, update/draw work, resource/object counts and map disposal. Partial view uses exactly 475 Sprites for 32², 100² and 256² maps; all view uses 1024, 10000 and 65536. Stable static draws visit no cells, while eight visible edits produce eight visits/updates per draw. One base image/TextureSource and one lease are retained per map in these workloads; static uses one displayed crop and dynamic two, with final base references returning to zero.

This does not eliminate Pixi draw cost or establish GPU-completed FPS. Large all-visible Canvas2D maps are slow in this environment. Zero WebGL p50 values mean below the approximate 0.1ms clock resolution, not zero cost. The 20 raw timings are retained; ordinary median and nearest-rank p95 are derived without changing draw times. No mobile/real-hardware GPU/native-memory/long-soak or external-library speed comparison was run. The final measurement series uses the completed runtime; an earlier series remains recoverable in commit 3f1171f, and cross-series variations are not attributed to optimizations.

Other limits: finite dense maps, translation only, one map draw group, range-wide scanning on camera tile-bound changes, no Sprite reuse pool/chunk GPU geometry. Hidden/disabled/empty maps retain the sheet lease; crop/ID validation caches live until placement/base-image release. No full Tilemap collision integration, infinite streaming, editor, autotile, Tiled parser, animated tiles, isometric/hex projection, general ControlGuard or new UI framework.

## Reproduction and integration review

```sh
npm ci
npm run check
npm test
npm run check:sprite-completions
npm run test:browser
npm run build -- --target web --example tilemap --base /Simpludify/
npm run test:build
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
npm run site:build -- --base /
npm run site:check
npm run test:site
# Run alone, without other tests/builds:
node scripts/benchmark-tilemap.mjs benchmarks/tilemap/results.json
```

Set CHROMIUM_PATH for a compatible existing browser, or install Playwright Chromium. Review the facade/one-owner choice, strict copied data and null/boundary rules, deferred decoded-bound validation, draw grouping, cache lifetime and all-visible Canvas2D limits before integrating. Tile collision must remain a separate implementation phase. Merge/rebase planning must account for the Sprite ancestry; this branch does not alter main or hosting settings. Rerun CI checks against any subsequent main/Sprite changes.

## Checkpoints

The following source/test checkpoints were persisted immediately; the final delivery commit adds the final raw series, corrected derived percentiles and this report. The branch history contains the complete list including that final commit.

| Commit    | Change                                                                          |
| --------- | ------------------------------------------------------------------------------- |
| `abe55c2` | feat(core): add copied-grid tilemap facade and placement ownership              |
| `1929b1f` | feat(web): render culled incremental tilemaps with shared sprite resources      |
| `9f83fbe` | feat(examples): add tile trail exploration and benchmark workloads              |
| `3f1171f` | perf: record tilemap work counts and 72 isolated browser measurements           |
| `74f5c9b` | fix(web): complete tilemap teardown after cleanup errors and verify typed names |
| `f5b3d10` | docs: publish tilemap contracts collision proposal and tile trail site guide    |
| `124b3f7` | test(site): verify production tilemap pixels camera editing and shared leases   |

## Changed files relative to Sprite base

- `README.md`
- `benchmarks/tilemap/results.json`
- `docs/api.md`
- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/tilemap-design.md`
- `docs/tilemap-performance.md`
- `docs/tilemap-validation.md`
- `docs/tilemap.md`
- `examples/tilemap/README.md`
- `examples/tilemap/index.html`
- `examples/tilemap/main.ts`
- `examples/tilemap/terrain.svg`
- `packages/core/src/index.ts`
- `packages/core/src/tilemap.ts`
- `packages/web/src/renderer.ts`
- `packages/web/src/tilemap-visual.ts`
- `scripts/benchmark-tilemap.mjs`
- `scripts/check-sprite-completions.mjs`
- `scripts/cli.mjs`
- `scripts/site-smoke.mjs`
- `site/config.mjs`
- `site/ja/api.md`
- `site/ja/examples.md`
- `site/ja/index.md`
- `site/ja/limitations.md`
- `site/ja/tilemap.md`
- `tests/browser/tilemap-fixture.ts`
- `tests/browser/tilemap.spec.ts`
- `tests/types/tilemap.ts`
- `tests/unit/tilemap-visual.test.ts`
- `tests/unit/tilemap.test.ts`
