# Collision implementation and validation

Status: **implemented and validated**. Base: collision design review `bd5c4834fa827d8ca62ded82a563772024165d0d`. Work branch: [codex/working-collision](https://github.com/oz-coden/Simpludify/tree/codex/working-collision). Main, Sprite, Tilemap and design-review branches are not write targets. This report, code, tests and measurements are recoverable from GitHub without the original conversation.

## Outcome and public boundary

Actor ContactEnter/Stay/Exit and Contact.self/other/selfActor/otherActor remain unchanged. TileContactEnter/Stay/Exit expose direct map/tileX/tileY data and observed image ID/frozen policy. There is no public contact-target union or required migration for Actor-only games. The previous review union proposal is historical and explicitly superseded.

A public union would impose a branch on an Actor-only handler merely because the engine supports terrain. Dedicated tokens require two subscriptions only when a game actually has two different rules. Actor-only, terrain-only and mixed usage is compiled in `tests/types/collision-usage.ts`; negative options/fields and preserved Actor payloads are compiled in `tests/types/tile-collision.ts`. No significant duplicate game-code framework was needed. Native TypeScript completion checks use the real exported APIs, not the historical proposal declarations.

[Current API and lifecycle](tilemap-collision.md) and [full Solver measurements](collision-performance.md) are the supported feature documents. Historical prototypes under tests/prototypes remain isolated evidence; the formal World does not call the naive seam-producing probe.

## Responsibilities and implementation

| Part                                    | Responsibility                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Collider                                | Shape, immutable Trigger/Solid policy and layer/mask, enable state, typed contact delivery                                 |
| CollisionBody                           | Static/dynamic inverse-mass correction weight, not movement integration or velocity                                        |
| Motion / Transform                      | Movement intent/integration and world position; correction preserves intent                                                |
| Tilemap / tilemap-collision             | Copied image Grid, optional copied/frozen ID rules, sparse cell overrides, revision/notifications and placement gates      |
| CollisionWorld                          | Scene discovery, Actor sweep + local cell candidates, one pair registry, bounded response and ordered observation delivery |
| collision-policy / collision-contact    | Shared validation/filter/pair response and observation/phase helpers                                                       |
| collision-geometry / collision-response | Existing Circle/OBB narrow phase and inverse-mass translation, reused for terrain data                                     |
| tile-collision-geometry                 | Closed local candidate bounds and equal-policy exposed boundary features                                                   |
| tile-contact                            | Dedicated public payload/token boundary, not a second solver or World                                                      |
| Web renderer                            | Existing image readiness/sharing/culling only; no collision ownership or scheduling                                        |

The Actor refactor checkpoint passed all 391 original unit tests and strict types **before** adding terrain response. Each map keeps its existing single internal Actor/passive TilemapLayer. Geometry records are plain data only for observed cells, shared by contacting Actors and evicted with the last contact pair. No per-cell Actor/Collider Component, Scene ownership collection, chunk/rectangle index, dependency or ControlGuard is added.

Actor and terrain pairs share policy/filter evaluation, exact narrow phase, one correction loop/iteration budget, observation state, transition/retirement, error handling and owner checks. Separate broad-phase candidate providers are necessary for Actor bounds versus a grid; they feed the same orchestration. Actor-only diagnostics retain their schema. Terrain scan/recompute/work counters are separate; responseDiagnostics describes the entire shared solver.

Collision-only edits do not advance image revision or recreate Sprites. Local lookup needs no map-wide geometry rebuild. Rules/defaults, overrides and image values are sampled during the collision pass; callback edits apply next pass, while disable/disposal suppresses later invalid Enter/Stay immediately. Matched invalid exits follow the same pair-processing semantics as Actor contacts. Scene/World destruction clears silently.

## Boundary response acceptance

Four neighbor probes suppress internal response faces/vertices only for equal complete normalized policies. Exact manifolds remain at exposed faces and convex corners. An internal feature is replaced only by a real exposed finite face intersection (circle projection / OBB segment/slab test), not arbitrary normal rounding. Different response/layer/mask boundaries remain separate.

The formal World compares continuous-wall trajectories with a single ordinary static Actor wall, using circles and boxes rotated +0.37/-0.64 radians, horizontal/vertical walls, both sides and tangent directions, straight walls and exposed convex corners, and 32×32/48×20 cells. **96 measured scenarios** have maximum difference **1.5631940186722204e-13 world units**, below the unchanged **1e-6** threshold, with no unresolved contacts. Separate unit cases exercise concave corners. The original circle counterexample now ends at **(54,136)**, rather than the naive probe's tangent drift of about +3.43.

General deep embedding is deliberately not claimed solved. Fully internal Solid cells can have no exterior response feature; an explicit unit case reports unresolved rather than promising escape. Impossible gaps, dense crowds, low budgets, extreme numeric scales, discrete tunneling and moved-platform velocity transfer remain limitations.

## Validation results

| Validation                          | Result                                                                                                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                              | Pinned lockfile installed; no manifest/lock/dependency changes                                                                                                                                                               |
| npm test                            | **509/509**, 38 files; includes all 391 pre-existing tests                                                                                                                                                                   |
| npm run check                       | Passed strict TypeScript, DOM-free Core, Biome, boundaries/files and licenses; existing 12 warnings/11 infos, no errors; 116 locked licenses                                                                                 |
| Native completions                  | grass/wall/water in constructor rule and setter; direct TileContact fields and unchanged Actor Contact fields; existing Sprite get/play/map set/fill completions pass                                                        |
| Full browser suite                  | **178/178**, retries disabled, 4.0 minutes                                                                                                                                                                                   |
| Post-layout actual sample tests     | **4/4**, WebGL/Canvas2D × desktop/narrow                                                                                                                                                                                     |
| New terrain browser coverage        | Real stopped pixels, visibility/Camera independence, pending-image collision/removal, zero renderer cell visits for policy-only edits, gaps/regeneration, water Trigger, WASD/sliding, collision toggle and Scene recreation |
| Default production game build/smoke | Passed /Simpludify/, 1440×900 and 390×844                                                                                                                                                                                    |
| Official site build/check           | Both /Simpludify/ and /: **51 HTML documents, all local references/assets, 50 standalone TypeScript examples**                                                                                                               |
| Production site browser smoke       | Both bases, both sizes: themes/layout, eight samples, actual wall stop x=434, live terrain contacts/candidates and zero unresolved, real pixels/one-cell edit, gallery cleanup/restart, startup failure and Canvas fallback  |
| Formal Solver benchmark             | **72 plain + 72 instrumented runs**, **2880 raw recorded passes**, six raw files plus summaries and 96 trajectory results                                                                                                    |
| Measurement integrity               | Every stored sample/percentile/release and matched plain/profiled behavior verified by a unit test                                                                                                                           |

Chromium/Chrome for Testing 156.0.8078.4, Playwright 1.64.1, Linux, WebGL SwiftShader and forced Canvas2D. CHROMIUM_PATH selected the matching headless shell downloaded from Google's testing archive. Physical GPU/mobile/other browsers are not verified. Browser tests report no unhandled page/console errors in the new terrain cases. The historical narrow Signal Run failure did not reproduce; no historical root-cause fix is claimed.

Sample screenshots were inspected. Sample-local CSS is imported by its module so standalone and fixture/gallery paths share the compact control grid. No engine UI/Flex/Pointer API was changed. Rendering/shared-image tests retain their source/crop/lease and asynchronous cancellation contracts.

## Performance and resources

Measured clean runtime source: **12255c346f3ce0da5f4313c7ca2206e1041543a2**, Node v24.22.1 / AMD EPYC 9V74 80-Core Processor / Linux. No other local tests/builds ran during recording. Later commits do not change Core runtime code.

At 256² with 128 radius-10 dynamic Actors, plain step p50 medians were about **0.33–0.35 ms** across the controlled dense/scattered/static/eight-edit workloads. Initial map generation/inventory/copy/validation was about 2.4–3.4 ms; disposal about 0.33–0.38 ms for those 128-Actor cases. These are shared-host Node CPU observations, not FPS or universal speed claims. Map/Actor construction, first-step registration, edits, plain step, separately instrumented capture/query/response/delivery, counts and disposal are retained in [the detailed report](collision-performance.md).

The first recorded static pass reads six candidate cells for one Actor or 1218 for 128 Actors, independently of map dimension. Counts include repeated solver/final scans. Terrain has no relation to the number of displayed Sprites; browser tests still collide with zero rendered map Sprites. All controlled measurement disposals leave zero Scene Actors, reconciled maps, contact pairs, retained cell geometry and input sources. This is logical ownership evidence, not a native/managed memory leak proof or long soak.

Actor/Actor narrow response is masked out in this terrain benchmark, while its real sweep cost remains; mixed contacts/mass behavior is covered by regression tests. Pose resets and instrumentation are explicit limitations. Large bodies/Triggers, many overlapping maps, broad-phase worst cases and long sessions remain profiling targets. No measured need for a new chunk/merge framework was established here.

## Reproduction

```sh
npm ci
npm run check
npm test
node scripts/check-collision-completions.mjs
node scripts/check-sprite-completions.mjs
# Install compatible Chromium or set CHROMIUM_PATH.
npm run test:browser
npm run test:build
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
npm run site:build -- --base /
npm run site:check
npm run test:site
# Commit/push first; do not run other tests/builds during recorded measurement.
node scripts/benchmark-tile-collision.mjs
```

The initial usability sketches were compiled before implementation and switched to real APIs. Early test-fixture mistakes (an undefined argument activating a JS default Body and noncontacting mixed-test starting poses) were corrected before the formal checkpoint; they were not Solver defects. The only post-full-suite UI change imported the same sample CSS through the module, then reran the four affected browser cases. All new runtime source is saved and validated; no unfinished formal feature is hidden by those preparation checks.

## Commits and recovery

Every commit is immediately attached to the dedicated remote branch with a non-force expected-head update. No local-only commit is a recovery checkpoint. Main/Sprite/Tilemap/design refs must remain unchanged. The file cannot embed its own final commit SHA without changing that SHA; use the work branch ref/history or final response for the final SHA.

| Commit                                     | Saved scope                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `0c670d123bc62b6d4f71b95bd8f6599135162b97` | refactor(core): share collision policy and observation while preserving Actor contacts            |
| `4e2fb1123618625a32ebd4c6afffbafbb7b94713` | feat(core): add optional copied tile collision rules and sparse cell overrides                    |
| `dfa2fa43e0e41e3dd6211704d471332291382171` | feat(core): exclude internal tile response features with continuous-wall probes                   |
| `1b6aca3d28deefdf0a4e5c5af7b874cd04e11154` | feat(core): integrate dedicated tile contacts into shared collision World and solver              |
| `cd249a47cb88839e68ce4ee8211d145f9f04e8e4` | feat(examples): add real tile terrain collision editing and browser fixtures (validation pending) |
| `12255c346f3ce0da5f4313c7ca2206e1041543a2` | docs: publish terrain collision contracts and save full Solver measurement harness                |
| `49390966e6ac6799002187a900b2ca64925cf1df` | perf: record full tile collision Solver phases counts cleanup and 96 wall trajectories            |
| `8e81f3137e857043d054576b5041846c797c5da7` | test(site): verify production terrain collision and compact sample controls                       |
| Final validation commit (this file)        | Completed validation, full file inventory and integration notes                                   |

## Changed files and integration notes

Relative to bd5c4834fa827d8ca62ded82a563772024165d0d, 53 files change: eight Core files plus tests/type fixtures, sample/CSS, benchmark harness/raw data and documentation/site validation. Package manifests/lockfiles and existing Signal Run/Prism Raid game logic are unchanged. Review the design-base comparison first: the full main comparison also contains all Sprite/Tilemap/review ancestry. No merge, main push, npm release, Pages visibility or DNS change is performed.

The former public union proposal is marked historical in all review documents; current guides use separate events. No Actor contact migration is needed. Before integration, run CI against any newer upstream changes and preserve the shared iteration/event semantics and exposed-feature acceptance matrix. CCD, slopes, friction/bounce/rigid bodies, streaming, general deep-embedding recovery and new UI/control ownership frameworks are outside scope.

Full file inventory:

- `README.md`
- `benchmarks/tile-collision/results.json`
- `benchmarks/tile-collision/samples/100-dense.json`
- `benchmarks/tile-collision/samples/100-scattered.json`
- `benchmarks/tile-collision/samples/256-dense.json`
- `benchmarks/tile-collision/samples/256-scattered.json`
- `benchmarks/tile-collision/samples/32-dense.json`
- `benchmarks/tile-collision/samples/32-scattered.json`
- `docs/api.md`
- `docs/architecture.md`
- `docs/collision-implementation.md`
- `docs/collision-performance.md`
- `docs/collision-review/README.md`
- `docs/collision-review/implementation-plan.md`
- `docs/collision-review/performance.md`
- `docs/collision-review/tilemap-contract.md`
- `docs/collision-review/validation.md`
- `docs/roadmap.md`
- `docs/tilemap-collision.md`
- `docs/tilemap-design.md`
- `docs/tilemap-validation.md`
- `docs/tilemap.md`
- `examples/tilemap/README.md`
- `examples/tilemap/main.ts`
- `examples/tilemap/style.css`
- `packages/core/src/collider.ts`
- `packages/core/src/collision-contact.ts`
- `packages/core/src/collision-policy.ts`
- `packages/core/src/collision.ts`
- `packages/core/src/tile-collision-geometry.ts`
- `packages/core/src/tile-contact.ts`
- `packages/core/src/tilemap-collision.ts`
- `packages/core/src/tilemap.ts`
- `scripts/benchmark-tile-collision.mjs`
- `scripts/check-collision-completions.mjs`
- `scripts/site-smoke.mjs`
- `site/config.mjs`
- `site/ja/api.md`
- `site/ja/collision.md`
- `site/ja/examples.md`
- `site/ja/limitations.md`
- `site/ja/tilemap.md`
- `tests/browser/tile-collision-fixture.ts`
- `tests/browser/tile-collision.spec.ts`
- `tests/helpers/tile-wall-scenario.ts`
- `tests/prototypes/collision-api.ts`
- `tests/types/collision-usage.ts`
- `tests/types/tile-collision.ts`
- `tests/unit/tile-collision-benchmark-data.test.ts`
- `tests/unit/tile-collision-geometry.test.ts`
- `tests/unit/tile-collision.test.ts`
- `tests/unit/tile-wall.test.ts`
- `tests/unit/tilemap-collision-data.test.ts`
