# Canvas UI implementation and validation

## Status and source ancestry

Implementation, tests, sample, performance data and developer documentation are saved on `codex/working-canvas-ui`. The requested `codex/working-collision` remote matched `89491c638e070c575fcee89cb08635fbaac67f01` at start. That source already contains the Sprite, Tilemap, Collision design and formal Collision work. Main was `8b6babe9157c0dbb2ceb288afc8a4595ed8535dd`; it is an ancestor of this work. The four preceding development branches are preserved unchanged.

At this documentation checkpoint, local engine/browser/production/project-base site checks pass. GitHub Actions is independently validating the engine and both site bases. **Main integration is pending those results**; do not interpret implementation completion as a successful main push. [CI runs](https://github.com/oz-coden/Simpludify/actions?query=branch%3Acodex%2Fworking-canvas-ui) and the final integration receipt record the final decision.

The temporary execution environment disconnected after the project-base site smoke. All runtime work was already pushed. GitHub's non-deploying CI now runs the project and root site bases separately, without depending on that environment. Existing Pages configuration is unchanged; no release/package publication, DNS or Pages enablement is part of this work.

## Design decisions

- Keep Core DOM-free and retain its existing ActionController, ActionSource, input-frame capture, ordered Button edges, source composition, pause/reset and Scene ownership contracts. No Core runtime change is required.
- Add Web `context.actions(definitions, bindings?)` to supply the staged Scene and Game input safely. `game.actions` covers the current/default Scene; the explicit Core constructor remains appropriate for headless code. No global current-Scene singleton is introduced.
- Preserve DOM Panel/Label/Button/HoldButton. Canvas-prefixed factories explicitly select Pixi presentation. Use DOM for forms, selectable text, scrolling and richer accessibility.
- A Canvas tree is one Scene-owned Web presentation above the world, rather than one Actor/Component per widget. Existing Lifetime and async Scene transactions govern staging, activation, failure and disposal.
- Choose a documented dependency-free Flex subset. Row/Column, uniform gap/padding, finite/percentage sizes, grow/shrink, align/justify, wrap and clipping cover the tested HUDs. Yoga3.2.1 has broader mature layout behavior; the isolated comparison measured bytes and one canonical row, not comparative speed or full CSS equivalence. No runtime dependency or lockfile change is added.
- UI layout units are host CSS dimensions divided by independent UI scale. World Camera, Fit bars, zoom and physical DPR remain separate.
- One Game-owned capture-phase DOM pointer adapter routes to Canvas node buses or a Scene-owned world bus. UI Pixi containers disable federated interaction, avoiding duplicate delivery and window-bubbling initialization assumptions. Down fixes ownership until up/cancel; multiple pointer IDs remain independent.
- Native pointer-transparent semantic buttons provide Tab/Enter/Space, names and focus state, synchronized with Canvas paint order/bounds. This is not a complete Canvas document accessibility tree.

See [supported API/contracts](canvas-ui.md), [Japanese guide](../site/ja/canvas-ui.md), [Action input](action-input.md) and [Canvas trail](../examples/canvas-ui/README.md) for executable examples. The formal guide includes Action movement, title screen, Flex HUD, Button clicks, HoldButton sources, world selection and Scene disposal in one verified sample.

## Correctness findings resolved

1. Capture-phase window blur observes descendant blur too. Only actual window blur releases all gestures; moving ordinary focus must preserve unrelated holds.
2. Pointer-operated Canvas controls focus the Game surface so WASD and touch sources compose. Tab explicitly enters native controls, whose Enter/Space do not leak to gameplay.
3. A disabled/removed/old-Scene gesture stays suppressed until physical release or fresh down. It cannot transfer into a new world or newly enabled button. A canceled keyboard press cannot activate after re-enable.
4. Release flushes pending layout before click eligibility, so moving a button cannot activate its stale rectangle. Native overlay priority, nested clipping, visibility and disabled ancestry match hit testing and painting.
5. WebGL stencil Graphics must remain renderable for Pixi's mask collection. The real clipped-pixel regression caught a Canvas2D/WebGL difference; expected pixels were preserved.
6. Wrapped descendants remeasure auto cross size after grow/shrink allocation. Equal/paint-only changes skip Flex; unchanged frames skip layout and visual synchronization. Diagnostics separate arrange visits from intrinsic/constrained measurement work.
7. Pixi8.22 `Graphics.destroy({children:true})` does not destroy an owned GraphicsContext. Private UI contexts and Text styles are explicitly destroyed.
8. Pinned CanvasGraphicsPipe and UID-keyed text bookkeeping retain destroyed/null entries. An isolated helper removes only exact destroyed UI-owned Graphics and unused UI text keys after normal rendering/destruction. It never purges live/shared images or global caches. DPR transitions track replaced keys too.
9. Disposal clears callbacks, owner-linked ActionSources and obsolete default UI handles. Failed/pending Scene preparations leave the old presentation valid. Canvas trail pause/Camera reset occurs on activation, preserving the old Scene during staging.
10. Async Button work receives an AbortSignal and busy state; rejected work reaches the Game observer. Hold callbacks remain synchronous, with returned Promises diagnosed and consumed.

The raw failed/intermediate resource experiments remain separately named in [benchmarks/canvas-ui](../benchmarks/canvas-ui/). They are investigation evidence, not successful performance claims.

## Validation ledger

Local source environment: Node24.22.1, Linux AMD EPYC9V74, pinned Chromium156.0.8078.4, Pixi8.22.0, Vite8.3.5 and TypeScript7.0.2. The complete runtime was finalized at `94065a6f5ccaa66d488df08c2e61e6d4f60b9307`; later changes are documentation, measurement/validation harnesses and CI.

| Gate                          | Observed result                                                                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit regression               | 539/539 in 40 files, including 30 new layout/router cases; all prior Actor/Action/Sprite/Tilemap/Collision tests retained                                      |
| Strict types and architecture | Pass; Core compiles without DOM/Node ambient types; no new Core imports                                                                                        |
| Lint/licenses                 | Pass; existing 12 warnings/11 infos, 116 locked dependencies; benchmark JSON values preserved through formatting                                               |
| Actual IDE completion probes  | Pass for UI Action/style/align/pointer and existing Sprite/Collision contracts                                                                                 |
| Chromium regression           | 230/230, retries 0, 5.4 minutes; 52 new Canvas cases plus 178 existing cases                                                                                   |
| Renderer/viewports            | Asserted WebGL type1 and forced Canvas2D type4; 1440×900 and 390×844                                                                                           |
| Real input/pixels             | Mouse capture outside host, CDP simultaneous touches, keyboard Tab/Enter/Space, colored/clipped/focus pixels, native overlay priority, WASD/source composition |
| Resize/DPR/scale              | Resize, UI scale1.5 with actual click, DPR2 and dynamic DPR1→3→2; Camera/world transforms remain independent                                                   |
| Lifecycle                     | Scene round trips, failed/pending setup, cancellation, disposal, async errors, stale gestures, dynamically ordered controls; no unexpected page/console errors |
| Production standalone         | Default UI/scenes and Canvas trail build/smoke under /Simpludify/, both viewport sizes                                                                         |
| Project-base site locally     | Build/check/smoke pass: 57 HTML, 3321 links/assets, 52 independently typechecked TS snippets, all nine examples                                                |
| Project-base site gameplay    | Canvas title/start, actual button pixels, WASD wall stop at x434, pause/resume, Menu/Start rebuild and forced Canvas2D pass                                    |
| Root-base site                | Pending independent CI job added in 34ef201                                                                                                                    |
| Remote all-engine CI          | Pending; includes strict checks, unit/browser, both standalone production smokes and existing Core benchmarks                                                  |
| Main integration              | Pending final CI, history/ref lease and source review                                                                                                          |

The new 230 count is measured here, not borrowed from a past prototype. Software Chromium/SwiftShader and synthetic benchmarks do not establish physical mobile, all-browser, native/GPU-byte or long-soak conformance.

## Remote CI findings

Both production site-base jobs passed at `34ef201`. The subsequent documentation checkpoint is being revalidated. The remote unit run completed the existing Blockfall 100,000-step ownership soak in 5576.82ms (847 rounds, 8588 locks) but exceeded Vitest's default 5000ms timeout. This test checks repeated-round ownership and semantics, not a machine-independent performance budget. Only that soak now has an explicit 30000ms bound; all 100,000 steps and assertions are retained. The first final-document pass also caught table-formatting differences; those are corrected without changing test/measurement values. Failed runs remain visible and are not counted as passing regressions.

## Performance and limits

[Performance report](canvas-ui-performance.md) contains scope, raw links and reproduction commands. Model 1000-button dirty layout p50 is 0.275ms; 5000 is 1.448ms. Browser 1000-button edit/layout/Pixi/native synchronization p50 is 2.8ms WebGL and 1.4ms Canvas2D. Unchanged frames add zero layouts and zero visual synchronizations. Hit testing is linear: eight queries visit 8×(N+1) nodes; dirty Flex recomputes the root, and nested measurement can cost more than arranged-node counts suggest.

Thirty 100-button UI→empty round trips return all live UI Graphics/Text/Texture objects and text metadata to baseline. Short forced-GC heap observations changed about +0.164MiB WebGL/+0.213MiB Canvas2D; they are not proof of leak freedom. Whole Game.dispose in software WebGL took up to 2537ms in one observation, distinct from per-Scene UI removal (about 4.4–4.8ms p50). Its internal renderer teardown cost remains unprofiled.

The matched CLI-default build adds 18329 gzip JS bytes (17.90KiB) and 45 gzip CSS bytes, summed across all emitted chunks, not initial transfer. The CLI summary preserves observed totals; the disconnected environment prevented copying its full /tmp asset manifest. The earlier complete esnext manifest remains labeled separately.

This ledger describes the original implementation checkpoint. [Finalization](canvas-ui-finalization.md) adds min/max, automatic text wrapping, new measurements and current integration gates. Supported remaining limits: maximum layout depth64; no full CSS Flex conformance, basis/margins/order/Grid/absolute positioning. No UI virtualization, stationary-pointer hover synthesis, wheel/pressure/tilt, implicit Actor hit selection, full joystick, complete screen-reader/IME model or automatic custom-font cache invalidation. Load fonts before constructing the tree. Upgrade Pixi only after rerunning exact ownership/resource regressions.

## Reproduction and integration gates

Run the following on the recorded source with pinned dependencies. Browser commands require the pinned Playwright Chromium or compatible `CHROMIUM_PATH`; execute measurements without concurrent local tests/builds.

```sh
npm ci
npm run check
npm test
node scripts/check-ui-completions.mjs
npm run test:browser
npm run test:build
npm run test:build:game
npm run build -- --target web --example canvas-ui --base /Simpludify/
node scripts/smoke-build.mjs --example canvas-ui
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
npm run site:build -- --base /
npm run site:check
npm run test:site
```

CI's `site-bases` matrix supplies both site build bases explicitly and does not deploy. Before main integration, re-read current main/work refs, verify main is an ancestor, inspect all inherited Sprite/Tilemap/Collision and UI changes, and verify the final runtime gates. A normal non-force fast-forward with an expected-head lease is preferred. Preserve all existing development branches. If checks, permissions or protection block integration, leave main unchanged and report the exact remaining gate.

## Changed-file inventory

The following 56 files differ from collision base `89491c6` including this documentation/CI checkpoint. Core runtime and dependency manifests/lockfile are unchanged.

- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [README.md](../README.md)
- [benchmarks/canvas-ui/browser-graphics-fix.json](../benchmarks/canvas-ui/browser-graphics-fix.json)
- [benchmarks/canvas-ui/browser-initial-unvalidated.json](../benchmarks/canvas-ui/browser-initial-unvalidated.json)
- [benchmarks/canvas-ui/browser-owned-context-fix.json](../benchmarks/canvas-ui/browser-owned-context-fix.json)
- [benchmarks/canvas-ui/browser-text-fix.json](../benchmarks/canvas-ui/browser-text-fix.json)
- [benchmarks/canvas-ui/browser.json](../benchmarks/canvas-ui/browser.json)
- [benchmarks/canvas-ui/bundles-cli-summary.json](../benchmarks/canvas-ui/bundles-cli-summary.json)
- [benchmarks/canvas-ui/bundles.json](../benchmarks/canvas-ui/bundles.json)
- [benchmarks/canvas-ui/model.json](../benchmarks/canvas-ui/model.json)
- [docs/action-input.md](../docs/action-input.md)
- [docs/api.md](../docs/api.md)
- [docs/architecture.md](../docs/architecture.md)
- [docs/canvas-ui-implementation.md](../docs/canvas-ui-implementation.md)
- [docs/canvas-ui-performance.md](../docs/canvas-ui-performance.md)
- [docs/canvas-ui.md](../docs/canvas-ui.md)
- [docs/input-unification.md](../docs/input-unification.md)
- [docs/roadmap.md](../docs/roadmap.md)
- [examples/canvas-ui/README.md](../examples/canvas-ui/README.md)
- [examples/canvas-ui/index.html](../examples/canvas-ui/index.html)
- [examples/canvas-ui/main.ts](../examples/canvas-ui/main.ts)
- [packages/web/src/canvas-layout.ts](../packages/web/src/canvas-layout.ts)
- [packages/web/src/canvas-node.ts](../packages/web/src/canvas-node.ts)
- [packages/web/src/canvas-ui.ts](../packages/web/src/canvas-ui.ts)
- [packages/web/src/canvas-visual.ts](../packages/web/src/canvas-visual.ts)
- [packages/web/src/game.ts](../packages/web/src/game.ts)
- [packages/web/src/index.ts](../packages/web/src/index.ts)
- [packages/web/src/input.ts](../packages/web/src/input.ts)
- [packages/web/src/pixi-ui-cleanup.ts](../packages/web/src/pixi-ui-cleanup.ts)
- [packages/web/src/pointer-routing.ts](../packages/web/src/pointer-routing.ts)
- [packages/web/src/pointer.ts](../packages/web/src/pointer.ts)
- [packages/web/src/renderer.ts](../packages/web/src/renderer.ts)
- [packages/web/src/style.css](../packages/web/src/style.css)
- [scripts/benchmark-canvas-ui-browser.mjs](../scripts/benchmark-canvas-ui-browser.mjs)
- [scripts/benchmark-canvas-ui.mjs](../scripts/benchmark-canvas-ui.mjs)
- [scripts/check-ui-completions.mjs](../scripts/check-ui-completions.mjs)
- [scripts/cli.mjs](../scripts/cli.mjs)
- [scripts/measure-ui-bundles.mjs](../scripts/measure-ui-bundles.mjs)
- [scripts/site-canvas-test.mjs](../scripts/site-canvas-test.mjs)
- [scripts/site-smoke.mjs](../scripts/site-smoke.mjs)
- [scripts/smoke-build.mjs](../scripts/smoke-build.mjs)
- [site/config.mjs](../site/config.mjs)
- [site/ja/api.md](../site/ja/api.md)
- [site/ja/canvas-ui.md](../site/ja/canvas-ui.md)
- [site/ja/examples.md](../site/ja/examples.md)
- [site/ja/index.md](../site/ja/index.md)
- [site/ja/limitations.md](../site/ja/limitations.md)
- [site/ja/scenes-ui.md](../site/ja/scenes-ui.md)
- [tests/browser/canvas-ui-benchmark.ts](../tests/browser/canvas-ui-benchmark.ts)
- [tests/browser/canvas-ui-fixture.ts](../tests/browser/canvas-ui-fixture.ts)
- [tests/browser/canvas-ui.spec.ts](../tests/browser/canvas-ui.spec.ts)
- [tests/helpers/canvas-resources.ts](../tests/helpers/canvas-resources.ts)
- [tests/types/canvas-ui.ts](../tests/types/canvas-ui.ts)
- [tests/unit/blockfall.test.ts](../tests/unit/blockfall.test.ts)
- [tests/unit/canvas-layout.test.ts](../tests/unit/canvas-layout.test.ts)
- [tests/unit/pointer-routing.test.ts](../tests/unit/pointer-routing.test.ts)

## Saved commits

The following implementation/checkpoint commits precede this final documentation checkpoint. Each was pushed immediately after creation. The [complete comparison](https://github.com/oz-coden/Simpludify/compare/89491c638e070c575fcee89cb08635fbaac67f01...codex/working-canvas-ui) includes subsequent validation receipts and their exact SHAs.

- [7db2ddc](https://github.com/oz-coden/Simpludify/commit/7db2ddc3b69a44d70f65294d469925a2021a6e88) refactor(web): add Scene-scoped Action creation without replacing input contracts
- [8ae4b5f](https://github.com/oz-coden/Simpludify/commit/8ae4b5f49f72097edf909986e1f5b8273ebd78b1) feat(web): checkpoint Scene-owned Canvas nodes and bounded dirty Flex layout
- [3fbb4bb](https://github.com/oz-coden/Simpludify/commit/3fbb4bbbb04873c649b1cd76c56f6752a39c37f0) feat(web): integrate Canvas presentation and fixed-owner pointer routing (browser validation pending)
- [2903c2c](https://github.com/oz-coden/Simpludify/commit/2903c2c32b04ff39e50be749d1842b838328e5cd) feat(examples): checkpoint integrated Canvas trail and browser interaction fixtures (validation in progress)
- [07ead1e](https://github.com/oz-coden/Simpludify/commit/07ead1e6b57ef64ea52d8e629d0a300cee07621e) fix(web): preserve keyboard and gesture ownership across focus changes and avoid redundant UI draws
- [a437f49](https://github.com/oz-coden/Simpludify/commit/a437f49bbf818b4db010a8733392840fb300d32c) test(web): document Canvas contracts and save expanded clipping lifecycle and measurement workloads
- [0e9da59](https://github.com/oz-coden/Simpludify/commit/0e9da595fdbac843c113965bb9fc8bf1aa978fd5) perf: record isolated Canvas model layout routing and disposal measurements
- [13988ef](https://github.com/oz-coden/Simpludify/commit/13988efa5da775ba6137f18b8448c439aca52d1c) perf: preserve unvalidated browser run and flag retained heap and pointer harness findings
- [e6f3cd0](https://github.com/oz-coden/Simpludify/commit/e6f3cd0f3d02d02ae11dc518e0dc558f9ffefca1) fix(web): destroy privately owned Pixi UI contexts and verify live resources through Scene cycles
- [f5e2eca](https://github.com/oz-coden/Simpludify/commit/f5e2eca235e0007651faf3424f580246e0e696e3) fix(web): release pinned Canvas graphics retention and synchronize layout pointer and focus state
- [fe5603b](https://github.com/oz-coden/Simpludify/commit/fe5603b01d4fedcbc4e642539f71519154eeee30) fix(web): bound owned UI text metadata across content and DPR changes
- [94065a6](https://github.com/oz-coden/Simpludify/commit/94065a6f5ccaa66d488df08c2e61e6d4f60b9307) fix(web): suppress canceled keyboard clicks and release obsolete UI ownership handles
- [ab7825f](https://github.com/oz-coden/Simpludify/commit/ab7825fe86802ae236d255dcc3866c0d6edaa60e) perf: publish validated Canvas layout pointer memory and bundle measurements
- [57b3b70](https://github.com/oz-coden/Simpludify/commit/57b3b7067f1661d0e62bf88fc98e59be3f637a51) docs: normalize Canvas reports and record passing engine and type validation
- [4c94604](https://github.com/oz-coden/Simpludify/commit/4c9460470674e6ed18dc9fcbd688e2f0a054510d) test(web): record full browser regression and production Canvas smoke validation
- [34ef201](https://github.com/oz-coden/Simpludify/commit/34ef2015345d9f135f1eb3ecd4f65728b8bf7e76) ci: validate both production site bases and preserve successful project-base verification
