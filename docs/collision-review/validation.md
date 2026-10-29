# Collision review validation and recovery record

> Historical design review. The public Contact union proposal is superseded by the [implementation decision](../collision-implementation.md): Actor Contact stays unchanged; dedicated TileContact events share the same internal World/solver. Recorded measurements and counterexamples remain historical evidence, not current Solver throughput.

Status: review validation complete. This review does not ship formal Tilemap collision. The runtime Contact type, Scene structure, Actor solver and rendering behavior remain unchanged. Production diff is limited to internal shape/position parameter types, enabling probes to reuse real geometry/correction without fake Actor/Collider instances.

## Validation results

| Check                                    | Result                                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Base remote ref/commit                   | `codex/working-tilemap` = `77479d59b58f26aadc4e89f773d90b9b5ba1752b`, verified before work                                                |
| Existing refs at start                   | main `8b6babe9157c0dbb2ceb288afc8a4595ed8535dd`; Sprite `eb61494e5f3275ba1593bb5989cb8f3b9cdce312`                                        |
| Focused Actor/prototype tests            | 84/84 passed (includes 60 existing geometry/response cases and 24 new cases)                                                              |
| Whole unit run                           | Final 391/391 passed, including raw-data integrity                                                                                        |
| Raw-data integrity test                  | Passed: 216 run summaries, 12 raw files, 20 samples/run, equivalent semantic counts, exact p50/p95                                        |
| Strict `npm run check`                   | Passed after formatting docs; existing 12 warnings/11 infos, no errors; 116 dependency licenses unchanged                                 |
| Native TypeScript completion probe       | `node scripts/check-collision-completions.mjs` passed: grass/wall/water in rule and setter; tile-only / Actor-only fields after narrowing |
| Existing Sprite/Tilemap completion probe | Passed unchanged idle/walk names for get/play/set/fill                                                                                    |
| Candidate benchmark                      | 216 runs with no concurrent local tests/builds; source `1d1d0c018a7fea44d1b24dc7e538f55ecf088b66`, clean at start                         |
| Production default build/smoke           | `npm run test:build` passed `/Simpludify/`, 1440×900 and 390×844                                                                          |

The first check while new Markdown was being written failed on three document formatting diagnostics; formatting corrected them and the complete check passed. The initial impossible-gap test geometry let the body escape through a centered wall; the test was corrected to a genuinely narrower-than-body gap. These were fixture/document preparation failures, not established runtime defects. The naive tile seam/deep-embedding probes intentionally reproduce limitations and pass by asserting the known limitation; they do not assert that terrain response is solved.

## Browser environment

Linux, Node v24.22.1, Chromium/Chrome for Testing 156.0.8078.4, Playwright 1.64.1, WebGL SwiftShader and the existing forced Canvas2D fixtures. Desktop 1440×900 and narrow 390×844, retries disabled. The default Playwright CDN download returned truncated archives; the same Chrome version's headless shell was downloaded from Google's Chrome-for-Testing archive and selected with CHROMIUM_PATH. This tooling workaround is not an engine dependency or repository change.

The full existing browser suite passed **166/166**, retries disabled, in 3.2 minutes. It includes Signal Run Actor response and Sprite/Tilemap WebGL/Canvas2D lifecycle fixtures at both viewport sizes. Its Tilemap tests cover current rendering/camera/editing/lifetime only. No browser terrain collision exists yet. The next formal stage's browser/physics acceptance matrix is in implementation-plan.md. The historical narrow Signal Run failure noted in Sprite validation did not reproduce in this run; its historical cause is not claimed fixed.

## Recovery

All commits are created on the GitHub repository and immediately attached to the work branch with a non-force expected-head update. No local-only commits are used as recovery checkpoints. After `b3386ed` (audit/probes/raw data), the transient workspace disappeared; it was cloned again from that remote commit and work continued. No saved result was lost. This is why raw data, code and intermediate docs are committed, rather than relying on this conversation.

Work branch: https://github.com/oz-coden/Simpludify/tree/codex/working-collision-design

Use the branch ref API or GitHub commit history for the latest SHA; a file cannot embed its own final commit hash without changing that hash. The final response verifies remote head and all protected refs after the last commit. The commit containing this final validation file is itself the last checkpoint; use the branch ref to recover it.

## Site and build scope

`npm run site:build -- --base /Simpludify/` and `npm run site:check` passed: 48 HTML documents, 2444 local links/assets, 48 standalone documentation snippets typechecked. The review is delivered as GitHub documents, linked from repository README and the existing Tilemap design page; it is not published as new supported API documentation or a terrain-collision demo. No site build/config/hosting change was made. Root-base site/browser smoke was not repeated for this design-only change. Default game production smoke passed at both desktop/narrow sizes. The completed browser run is regression evidence, not a browser performance measurement.

## Changes and checkpoints

The only engine source edits are internal parameter types in collision-geometry.ts and collision-response.ts (five added interface lines and four parameter substitutions); no function body, public barrel, package manifest or lockfile changes. No runtime dependency was introduced. Everything else is design material, isolated probes, type examples, benchmark harness/data and validation tests.

| Commit                                   | Saved result                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| c493100cafbb70a205535f18386d4f9731986ec0 | Initial current-system audit and identified risks, explicitly in progress                                |
| 1d1d0c018a7fea44d1b24dc7e538f55ecf088b66 | 24 new contract/probe cases, type-only API, shared-shape/position parameter types, benchmark harness     |
| b3386ed2f2c55740b543350785f87a4837aa3806 | 216 measurements/raw samples, response counterexamples and limits; recovery checkpoint                   |
| 9e8c8c59a0237123bbb3b056fb0b43c2f6136e45 | Tile policies, unified target/source migration, lifecycle/events, optimizer comparison, next-stage gates |
| 35723f72eee9b9f5fbd5147dc620692c119c4d01 | Native TypeScript completions, raw-data integrity and recovery/validation record                         |
| Final validation commit (this file)      | Final regression results, review completion, full file inventory, benchmark output formatting            |

All are saved on codex/working-collision-design only. Main/Sprite/Tilemap must not be advanced by this task. This branch contains their ancestor implementations: review changes against the Tilemap base first, rather than treating the full main comparison as collision work.

### Changed file inventory relative to Tilemap base

- `README.md`
- `benchmarks/collision-design/results.json`
- `benchmarks/collision-design/samples/100-scattered-32-1.json`
- `benchmarks/collision-design/samples/100-uniform-32-1.json`
- `benchmarks/collision-design/samples/256-scattered-256-1.json`
- `benchmarks/collision-design/samples/256-scattered-32-1.json`
- `benchmarks/collision-design/samples/256-scattered-32-16.json`
- `benchmarks/collision-design/samples/256-uniform-256-1.json`
- `benchmarks/collision-design/samples/256-uniform-32-1.json`
- `benchmarks/collision-design/samples/256-uniform-32-16.json`
- `benchmarks/collision-design/samples/32-scattered-1-8.json`
- `benchmarks/collision-design/samples/32-scattered-32-1.json`
- `benchmarks/collision-design/samples/32-uniform-1-8.json`
- `benchmarks/collision-design/samples/32-uniform-32-1.json`
- `docs/collision-review/README.md`
- `docs/collision-review/implementation-plan.md`
- `docs/collision-review/performance.md`
- `docs/collision-review/tilemap-contract.md`
- `docs/collision-review/validation.md`
- `docs/tilemap-design.md`
- `packages/core/src/collision-geometry.ts`
- `packages/core/src/collision-response.ts`
- `scripts/benchmark-collision-design.mjs`
- `scripts/check-collision-completions.mjs`
- `tests/prototypes/cell-policy.ts`
- `tests/prototypes/collision-api.ts`
- `tests/prototypes/tile-candidates.ts`
- `tests/prototypes/tile-response.ts`
- `tests/types/collision-proposal.ts`
- `tests/unit/cell-policy.test.ts`
- `tests/unit/collision-benchmark-data.test.ts`
- `tests/unit/collision-review.test.ts`
- `tests/unit/tile-candidates.test.ts`
- `tests/unit/tile-response-probe.test.ts`
