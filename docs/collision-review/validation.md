# Collision review validation and recovery record

Status: final regression in progress. This review does not ship formal Tilemap collision. The runtime Contact type, Scene structure, Actor solver and rendering behavior remain unchanged. Production diff is limited to internal shape/position parameter types, enabling probes to reuse real geometry/correction without fake Actor/Collider instances.

## Evidence recorded so far

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

The existing full suite is running; do not infer final success from the table above. Its Tilemap tests cover current rendering/camera/editing/lifetime only. No browser terrain collision exists yet. The next formal stage's browser/physics acceptance matrix is in implementation-plan.md.

## Recovery

All commits are created on the GitHub repository and immediately attached to the work branch with a non-force expected-head update. No local-only commits are used as recovery checkpoints. After `b3386ed` (audit/probes/raw data), the transient workspace disappeared; it was cloned again from that remote commit and work continued. No saved result was lost. This is why raw data, code and intermediate docs are committed, rather than relying on this conversation.

Work branch: https://github.com/oz-coden/Simpludify/tree/codex/working-collision-design

Use the branch ref API or GitHub commit history for the latest SHA; a file cannot embed its own final commit hash without changing that hash. A final report will verify remote head and all protected refs after the last commit.
