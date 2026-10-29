# Canvas UI measurements

These are historical measurements before min/max and automatic text wrapping. See [finalization](canvas-ui-finalization.md) for the current library decision, performance, teardown profile and CI evidence.

Final measured runtime: `94065a6f5ccaa66d488df08c2e61e6d4f60b9307`. Node v24.22.1, linux, AMD EPYC 9V74 80-Core Processor; Chromium 156.0.8078.4, SwiftShader WebGL and forced Canvas2D. Browser type is asserted (1/4), not inferred from pixels alone. Runs were sequential, with no concurrent local tests/builds.

Raw reports: [model](../benchmarks/canvas-ui/model.json), [browser](../benchmarks/canvas-ui/browser.json), [earlier esnext bundles](../benchmarks/canvas-ui/bundles.json), [CLI-default bundle totals](../benchmarks/canvas-ui/bundles-cli-summary.json). Time units below are milliseconds. Node timings are not browser FPS; synthetic dispatch timings are not physical-device input latency.

## Model/layout/router

Synthetic fixed text metrics, a wrapped row, 10 warmups and 100 recorded dirty-layout/gesture samples. A gesture is down + five moves + up, with one additional Click delivery. Idle values divide batches of 1000 calls and include assertion overhead. Disposal is one observation per size.

| Buttons (+1 root) | Dirty layout p50 | One text edit + layout p50 | Idle call p50 | Gesture p50 | Hit visits / gesture | Dispose |
| ----------------- | ---------------- | -------------------------- | ------------- | ----------- | -------------------- | ------- |
| 10                | 0.0206           | 0.0060                     | 0.0000108     | 0.0154      | 88                   | 0.984   |
| 100               | 0.0535           | 0.0301                     | 0.0000297     | 0.0514      | 808                  | 0.964   |
| 1000              | 0.2748           | 0.2246                     | 0.0000033     | 0.4777      | 8008                 | 8.722   |
| 5000              | 1.4484           | 1.4077                     | 0.0000277     | 2.5616      | 40008                | 45.761  |

Unchanged calls produced zero extra layouts. Paint-only style changes also skip Flex (unit regression). Eight hit queries visit 8×(N+1) nodes: there is no spatial-index or sublinear-hit-test claim. Every disposal asserts zero model nodes/subscriptions, captured/suppressed pointers and event listeners. Dirty layout can reposition siblings/percentage children, so the root is recomputed; visual signatures avoid recreating unchanged text styles/geometry.

| Nesting depth | Layout p50 | Arrange visits / layout | Intrinsic helper visits / layout | Constrained helper visits / layout |
| ------------- | ---------- | ----------------------- | -------------------------------- | ---------------------------------- |
| 16            | 0.0383     | 16                      | 256                              | 240                                |
| 32            | 0.0712     | 32                      | 1024                             | 992                                |
| 64            | 0.2544     | 64                      | 4096                             | 4032                               |

Arranged-node count is not all computation. Deep nesting adds constrained measurement work; 64 levels is the supported limit. The 100×100-button model Scene-cycle forced-GC heap record includes Vite/SSR and measurement allocations, and does not establish leak freedom.

## Browser synchronization and input

Viewport 1000×700, DPR1. Twenty recorded samples; five initial draw warmups and ten pointer warmups. Synchronization includes model layout, real font measurement, Pixi object/Graphics commands and native mirror updates, but excludes app.render. Draw submission is synchronous CPU/driver time, not GPU completion. All 30 synthetic gestures assert 240 deliveries and 240 UI hit tests. Functional mouse/CDP-touch/keyboard tests are separate.

| Renderer | Buttons (+3 model nodes) | Edit/layout/sync p50 | Resize/sync p50 | Idle update p50 | Gesture p50 | Draw submission p50 |
| -------- | ------------------------ | -------------------- | --------------- | --------------- | ----------- | ------------------- |
| WebGL    | 10                       | 0.200                | 0.150           | 0.000000        | 0.200       | 0.500               |
| WebGL    | 100                      | 0.300                | 0.600           | 0.000000        | 0.300       | 0.950               |
| WebGL    | 1000                     | 2.800                | 10.825          | 0.000000        | 2.900       | 13.950              |
| Canvas2D | 10                       | 0.200                | 0.150           | 0.000000        | 0.200       | 0.400               |
| Canvas2D | 100                      | 0.200                | 0.500           | 0.000000        | 0.300       | 0.700               |
| Canvas2D | 1000                     | 1.400                | 6.250           | 0.000000        | 1.700       | 8.450               |

Idle updates produce zero extra layouts and zero extra visual synchronizations. Offscreen but model-visible nodes still participate in layout/traversal and retain display objects; this version does not virtualize large UI trees.

| Renderer | Buttons | Initial run (one observation) | Full Game.dispose (one observation) |
| -------- | ------- | ----------------------------- | ----------------------------------- |
| WebGL    | 10      | 62.300                        | 689.200                             |
| WebGL    | 100     | 58.300                        | 1347.900                            |
| WebGL    | 1000    | 289.500                       | 2537.000                            |
| Canvas2D | 10      | 18.600                        | 2.100                               |
| Canvas2D | 100     | 39.400                        | 5.000                               |
| Canvas2D | 1000    | 249.000                       | 38.600                              |

Full Game disposal includes Pixi renderer/context/global-resource cleanup. The large WebGL teardown times are a measured limitation in this software-rendering environment; their internal cause was not separately profiled. They must not be presented as per-Scene UI removal time.

## Scene round trips and retained resources

Thirty complete 100-button UI→empty round trips per renderer; CDP GC after each five cycles. Creation/removal include Scene transaction completion and its first render. All samples return to the empty Scene’s live Pixi baseline: WebGL keeps one current world clip; Canvas2D keeps none. UI Text/Texture objects and their null slots are zero. Terminal disposal asserts zero UI presentations/nodes/buttons/text metrics/mirrors and input sources.

| Renderer | UI Scene creation p50 | UI Scene removal p50 | Initial V8 heap MiB | After 30 MiB | Change MiB |
| -------- | --------------------- | -------------------- | ------------------- | ------------ | ---------- |
| WebGL    | 16.850                | 4.750                | 13.450              | 13.614       | +0.164     |
| Canvas2D | 11.050                | 4.400                | 15.013              | 15.226       | +0.213     |

This is a short forced-GC observation, not proof of no leaks. Pixi’s current world-clip null hash slots and bounded text-metric/global pools are distinct from live UI resources. Native canvas backing storage, GPU allocations, hardware rendering, physical mobile devices and multi-hour soaks were not measured.

## Bundle and library selection

The CLI-default refresh at `4c9460470674e6ed18dc9fcbd688e2f0a054510d` used Vite8.3.5's production minifier/default target (runtime sources unchanged from `94065a6`), gzip level9 per emitted file, summed across **all** JS chunks (including optional renderer/fallback chunks). These totals are not initial network transfer, decoded WASM memory or installed package size. Same DOM UI/scenes entry is used before/after; Canvas trail additionally uses Sprite/Tilemap/Collision game code.

| Build                           | JS bytes | JS gzip bytes | CSS bytes | CSS gzip bytes |
| ------------------------------- | -------- | ------------- | --------- | -------------- |
| baseline DOM UI/scenes          | 605047   | 178404        | 2027      | 887            |
| current same DOM UI/scenes      | 664047   | 196733        | 2257      | 932            |
| current integrated Canvas trail | 702963   | 207412        | 2257      | 932            |

Same-entry JS increase: 59000 raw bytes, 18329 gzip bytes (17.90KiB); CSS gzip +45 bytes. No runtime layout dependency or lockfile change. The successful refresh's aggregate totals were observed before the temporary environment disconnected; its complete /tmp asset manifest was unavailable for copying. The summary records that limit explicitly; the earlier complete esnext report is retained separately.

| Micro entry                   | Raw JS | Gzip JS |
| ----------------------------- | ------ | ------- |
| empty micro entry             | 23     | 43      |
| custom layout micro entry     | 22281  | 7516    |
| Yoga 3.2.1 module micro entry | 126723 | 51226   |

The custom layout micro entry includes reachable Core error/module initialization code; it is not an isolated algorithm-only byte count. Yoga3.2.1 is MIT and was fetched/extracted only in /tmp, not bundled in the engine. Its ESM entry includes an asynchronous base64 WebAssembly loader. Both engines produce the same canonical padded row coordinates tested in the harness; this does not establish complete CSS equivalence or comparative speed. Yoga offers a broader, mature layout surface. The selected custom subset meets the current Row/Column/gap/padding/percentage/grow/shrink/align/justify/wrap needs with no extra runtime/ownership boundary. Reconsider it if actual games require min/max, richer intrinsic layout or CSS conformance.

## Reproduce

Start from the recorded clean source, install the pinned workspace dependencies, prepare a detached baseline checkout at `89491c6` and extract `yoga-layout@3.2.1`. The bundle script aliases each checkout’s internal packages explicitly, so a shared node_modules cannot accidentally substitute current sources for the baseline. Run sequentially; save outputs outside the checkout until all clean-source guards have completed.

```sh
CHROMIUM_PATH=/path/to/chromium node scripts/benchmark-canvas-ui-browser.mjs /tmp/ui-browser.json
node --expose-gc scripts/benchmark-canvas-ui.mjs /tmp/ui-model.json
node scripts/measure-ui-bundles.mjs /tmp/simpludify-ui-base /tmp/simpludify-yoga/package /tmp/ui-bundles.json
```

## Preserved investigation evidence

- [Initial unvalidated run](../benchmarks/canvas-ui/browser-initial-unvalidated.json): synthetic pointer client geometry was wrong; do not use those input timings. It exposed owned GraphicsContext retention.
- [Explicit-context correction](../benchmarks/canvas-ui/browser-owned-context-fix.json): pointer assertions pass, but Canvas2D destroyed Graphics remain in a pinned Pixi hash.
- [Graphics-object correction](../benchmarks/canvas-ui/browser-graphics-fix.json): live UI resources return to baseline; UID-keyed text null metadata remains.
- [Text-key correction](../benchmarks/canvas-ui/browser-text-fix.json): text/texture slots return to zero; the final report above adds cancellation/lifetime fixes and Scene timing.

The engine isolates pinned Pixi8.22 cleanup in `packages/web/src/pixi-ui-cleanup.ts`. It removes only destroyed owned Graphics and null keys belonging to replaced/disposed UI Text; it never purges a live/shared image or the global cache. Dependency upgrades must rerun the resource regression suite. Custom fonts must be ready before tree construction; automatic web-font cache invalidation is outside this release. See [supported contracts](canvas-ui.md) and [validation](canvas-ui-implementation.md).
