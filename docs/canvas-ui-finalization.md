# Canvas UI finalization

## Baseline and integration gate

The source branch is `codex/working-canvas-ui`, initially at `5ac970982505b8a5abd3780e95e47fb9e7b126c2`. Remote main is `8b6babe9157c0dbb2ceb288afc8a4595ed8535dd`, an ancestor including the prior resource work. All inherited Sprite, Tilemap, Collision, Action and Canvas commits are retained. No development branch is deleted or force-updated.

[Baseline CI run 40861908787](https://github.com/oz-coden/Simpludify/actions/runs/40861908787) passed all three jobs. The web job log reports 230 browser tests, retries zero, in 12.3 minutes (11:00:32–11:12:50 UTC); installation, checks, unit tests, production smokes and Core benchmarks made the whole run 13m39s. Successful historical runs are not treated as outstanding failures. The Tile trail wall poll retains its 15,000ms timeout.

Implementation gates: constrained Flex allocation; width-aware Unicode text measurement and matching Pixi rendering; real pointer/keyboard/lifetime regression; isolated layout/library/disposal measurements; CI time and coverage comparison; both site bases; final-commit remote CI success. Main remains unchanged until all gates pass. This document records observed results as each gate completes; planned work is not a validation claim.

## Implemented contracts

`CanvasStyle` adds `minWidth`, `maxWidth`, `minHeight`, `maxHeight` using the same number/percentage type as width/height. Constraints include padding and percentages refer to parent content extents (root: host UI extent). Minimum wins a conflict after resolution. Flex clamps preferred sizes before selecting wrap lines, freezes items that reach bounds during grow/shrink and redistributes using original shrink bases. Unsatisfiable minima overflow deliberately; invalid nonfinite/negative values reject. Cross stretch also obeys constraints. Nested containers remeasure auto cross extents after main-axis allocation. Per-layout panel memoization bounds repeated subtree work; all unchanged frames still skip layout entirely.

`textWrap` defaults to true on Label/Button/HoldButton. Text is remeasured at allocated content width and auto height propagates through nested rows/columns. Fixed/max heights retain their constraint and clip overflowing paint. Word/grapheme segmentation uses standard `Intl.Segmenter`; English words, long URLs, Japanese/English mixtures, explicit newlines/blank lines, combining marks, emoji modifiers/flags/ZWJ sequences are covered. Ordinary Japanese brackets/punctuation/small kana receive best-effort line-edge handling. Complete UAX #14/JIS typesetting, hyphenation, bidi layout and impossible punctuation fits are not promised. Soft boundary spaces are omitted; other line content is preserved.

Pixi measurement and rendering use identical explicit line strings, fonts and sizes, without modifying Pixi's global wrapping hooks. Each text node caches at most eight widths; font/content changes replace the cache, disposal clears it. Custom fonts must load before tree construction. Core Action/input contracts are unchanged. Pointer hit testing, native focus mirrors and paint use the same final rectangles. Existing pointer capture, multiple touches, UI/world separation, clips, async cancellation, DPI/scale and Scene ownership remain in the regression suite.

See [English API/examples](canvas-ui.md), [Japanese guide](../site/ja/canvas-ui.md), [responsive Canvas trail](../examples/canvas-ui/README.md). Scene naming, dynamic creation, suspension, concurrent Scenes and UI virtualization remain [roadmap proposals](roadmap.md), not new runtime abstractions.

## Layout selection: custom Flex retained

The isolated [Yoga comparison](../benchmarks/canvas-ui-finalization/yoga-comparison.json) uses Yoga 3.2.1 (MIT) and runtime `a61d36a75bf83041974b83ab33f22a5e21179e80`. Both engines match every box in 10/100/1000/5000-cell wrapped rows, constrained grow redistribution (50/220 units), and a padded mixed-language leaf using the same external text measurement. Yoga's [external measurement contract](https://www.yogalayout.dev/docs/advanced/external-layout-systems) supports intrinsic text but still requires the host's line breaking, font measurement and invalidation.

| Nodes | Custom dirty p50 ms | Yoga dirty p50 ms |
| ----- | ------------------- | ----------------- |
| 10    | 0.0201              | 0.0157            |
| 100   | 0.1948              | 0.0793            |
| 1000  | 0.7060              | 0.8307            |
| 5000  | 2.8159              | 9.3165            |

These are sequential Node CPU measurements, ten warmups/100 samples, synthetic metrics, persistent trees and changed gap every layout. They are not full CSS conformance or browser GPU measurements. Yoga wins some small cases; neither engine is universally faster. Unchanged Canvas frames do not invoke either candidate solver. Custom remains synchronous and has no second persistent native node graph to synchronize/free on every Scene cancellation or subtree removal. The needed min/max and text behavior fits the existing bounded solver; the supported API and ownership regressions remain intact. Yoga's broader CSS semantics and long-term maintenance are benefits, and should be preferred if future requirements expand substantially beyond this subset. Size alone did not determine the decision.

Cold bundled Node module import, one observation: custom model/layout/text helpers 2.33ms; Yoga 17.57ms including its asynchronous WASM initialization. The custom measurement bundle includes model/Scene/UI helpers and is not an algorithm-only comparison. Yoga import increases reported process external memory about 17.36MB; these are whole-process snapshots, not a complete WASM/native allocation inventory. Explicit freeRecursive/config.free is exercised. The report retains heap/RSS snapshots before/after import and disposal; garbage-collected JS wrapper references can remain and RSS is noisy. No native leak-freedom claim follows.

Matched current production-minifier [bundle manifest](../benchmarks/canvas-ui-finalization/bundles.json), gzip level9 summed across all emitted JS chunks:

| Entry                       | Raw JS bytes | Gzip JS bytes |
| --------------------------- | ------------ | ------------- |
| Baseline same DOM UI/scenes | 664047       | 196733        |
| Current same DOM UI/scenes  | 666654       | 197984        |
| Custom layout micro entry   | 23266        | 7933          |
| Yoga module micro entry     | 126723       | 51226         |

Consult the raw manifest for exact final totals if the table is updated with later builds. These include optional renderer/fallback chunks and are not initial transfer/download bytes or installed package size. No runtime dependency or lockfile change was introduced.

## Layout, text, input and memory measurements

[Model report](../benchmarks/canvas-ui-finalization/model.json), [desktop browser report](../benchmarks/canvas-ui-finalization/browser-desktop.json), [390-wide browser report](../benchmarks/canvas-ui-finalization/browser-narrow.json). Node v24.22.1/Linux/AMD EPYC9V74; Chromium156.0.8078.4, SwiftShader WebGL (type1) and forced Canvas2D (type4), DPR1. Workloads ran sequentially without concurrent local tests/builds. Browser synchronization uses twenty samples after warmups; drawing measures synchronous submission, not GPU completion. Initialization/disposal are one observation per size/renderer/viewport. Scene round trips use thirty iterations and GC every five cycles.

| Nodes | Node dirty p50 ms | Browser edit/layout/sync p50 WebGL ms | Canvas2D ms |
| ----- | ----------------- | ------------------------------------- | ----------- |
| 10    | 0.0243            | 0.40                                  | 0.45        |
| 100   | 0.0856            | 0.55                                  | 0.50        |
| 1000  | 0.5275            | 4.10                                  | 2.70        |
| 5000  | 2.8983            | 25.45                                 | 17.25       |

The browser case now includes Japanese/English text edits/wrapping and min/max; it is broader than the historical short single-line case, so its time difference is not a matched rendering regression estimate. At width390, edit/sync p50 for 1000 nodes is 4.3ms WebGL/2.4ms Canvas2D; 5000 is 21.6/15.15ms. All recorded idle phases add zero layouts and zero visual synchronizations. Pointer gesture visits remain 8×(N+1), with every delivery asserted. The engine still traverses nonvirtualized model-visible offscreen nodes.

The initial expanded solver measured 1.33ms at 1000/7.02ms at 5000 in the model. Removing unnecessary fixed-leaf measurement/maps and unbounded constraint allocations reduced those to 0.53/2.90ms. [Pre-optimization evidence](../benchmarks/canvas-ui-finalization/model-before-optimization.json) is preserved. Compared with the historical simpler solver, bounds and width-aware measurement still add CPU work; no universal speedup is claimed. Depth16/32/64 p50 is 0.104/0.183/0.343ms; intrinsic/constrained visit counters are preserved separately from arranged nodes.

After thirty 100-button round trips, all live UI Graphics/Text/Textures return to baseline and terminal UI nodes/presentations/native mirrors/metrics/input sources are zero. Managed heap changes are about +0.158MiB WebGL/+0.246MiB Canvas2D at desktop, similar in the narrow run. Renderer-owned world-clip null slots and browser text/canvas pools remain distinct from live UI resources. These short forced-GC observations do not prove native/GPU leak freedom or hardware/mobile conformance.

## Game disposal profile

Test-only wrappers time public lifecycle methods and WebGL calls; runtime cleanup policy is unchanged. Inclusive nested phases must not be summed. The presentation's second disposal invocation is an idempotent callback path, not a second resource destruction.

| Desktop case  | Full Game.dispose ms | loseContext ms |
| ------------- | -------------------- | -------------- |
| WebGL 10      | 627.5                | 624.5          |
| WebGL 100     | 899.0                | 891.8          |
| WebGL 1000    | 835.0                | 777.2          |
| WebGL 5000    | 291.5                | 46.2           |
| Canvas2D 1000 | 44.3                 | n/a            |

UI presentation cleanup at 1000 is roughly 37ms including a harmless second call; keyboard/pointer cleanup and image lease cleanup are near the timer resolution. Per-Scene 100-button removal p50 is 5.6ms WebGL/4.9ms Canvas2D, because Scene removal keeps the renderer/context. Whole-Game teardown destroys Pixi Renderer, its GL buffers/textures, DOM and finally the context. The major observed stall is the driver's `WEBGL_lose_context.loseContext`, not UI event traversal. Variation with workload, viewport and preceding render commands is large: the historical 2537ms observation and today's lower times are not evidence of a cleanup speedup. No context release was skipped, deferred or replaced with unsafe global/private cache purging. GPU completion time and actual freed GPU bytes are not measured.

## Tile trail and CI investigation

The test retains exact x434 and the existing 15000ms poll. The sample uses variable RAF delta capped at 0.05s, not FixedStep; stalls can discard wall-clock time. Geometry is wall-left448 minus circle-radius14 = 434. New headless tests use actual KeyboardSource → ActionController → ActionMovement → Motion → CollisionWorld at 1/60, 1/120 and 0.05 seconds. All reach 434 and preserve release/sliding. At 1/60, 58 steps from250 at180 units/s produce424 while the Action is still held: this is an ordinary intermediate coordinate, not a collision boundary.

The actual browser test now attaches bounded per-step time/delta/coordinate/device-key/focus/visibility/contact/response observations on success or failure. [CI WebGL trace](../benchmarks/canvas-ui-finalization/ci-wall-webgl.json) reaches434 after about2261ms real time and1.05s of moving simulation; [Canvas2D trace](../benchmarks/canvas-ui-finalization/ci-wall-canvas2d.json) passes424.006 and reaches434 after3218ms/1.0333s. KeyD stays held and response reports zero unresolved contacts. These successful CI traces support delayed progress/time capping as a plausible explanation, but cannot prove the precise cause of old failures that had no trace. No input/physics contract or expectation was changed to mask the old result.

CI retains all browser tests on every push/PR, retries0, worker1 per isolated runner. Desktop/narrow are separate jobs; quality/unit/Core benchmarks and production smokes have separate jobs. Both site bases still build/check/test every sample. Failures upload traces, per-test JSON timing and wall telemetry. npm caching remains; browser contexts remain isolated. Obsolete checkpoint runs cancel. The old separate Pages workflow duplicated type/unit/browser/site work on main; deployment now depends on every CI validation job and reuses the already tested project-base site artifact. Pages enablement/visibility/DNS are unchanged. Splitting the quality job exposed an existing benchmark dependency on a browser-created output directory; quality explicitly creates test-results before writing benchmark reports.

## Verification and integration receipt

Runtime source and measurements are saved before long validation. Local strict checks, architecture/licenses, completion probes and 556 unit tests pass. The four new responsive real-browser cases passed with retries0 before full regression. Complete 234-case browser regression, production smokes, both site bases and final-commit remote CI remain integration gates until their recorded completion. Historical failed/intermediate CI runs are not counted as successes. Final GitHub results and main SHA are reported only after ref verification; the development branch is retained.

Reproduce from the recorded clean source, with the matching Chromium available and Yoga3.2.1 extracted outside the repository:

```sh
node --expose-gc scripts/compare-ui-layouts.mjs /tmp/simpludify-yoga/package /tmp/layout.json
node --expose-gc scripts/benchmark-canvas-ui.mjs /tmp/model.json
CHROMIUM_PATH=/path/to/chromium node scripts/benchmark-canvas-ui-browser.mjs /tmp/desktop.json
UI_BENCH_WIDTH=390 CHROMIUM_PATH=/path/to/chromium node scripts/benchmark-canvas-ui-browser.mjs /tmp/narrow.json
node scripts/measure-ui-bundles.mjs /path/to/baseline /tmp/simpludify-yoga/package /tmp/bundles.json
```
