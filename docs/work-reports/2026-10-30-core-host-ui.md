# Core modules and host-independent Canvas UI

## Final implementation result

**Implementation and review complete; source CI passed; PR #1 merged into main.** The exact tested source is `61dbb7b6d3a94fd773b5d73c9347fb20738d1d12`. Integration SHA: `ba1345e7ba71f8ab6b8a4717a8980b98414d2cc5`. Post-integration CI/deployment are running; their final results will be added only after completion.

The two existing private packages remain. Core now owns Canvas UI state, layout, clipping, scroll/focus and abstract pointer/key routing. Web owns actual Pixi painting, exact font metrics, native semantic mirrors, browser capture/input, resource loading and asynchronous scene transactions. No Electron/Tauri/Android build or new npm package was added. Run To Exit was inspected as reference and remains unchanged.

## Design decisions and implemented behavior

- Core has shallow foundation, scene, graphics, ui, interaction, animation, game and runtime modules. Transform/Renderable data is separate from Motion/ActionMovement. Foundation timers and runtime fixed stepping follow their actual dependencies. Tilemap remains an integrated game facade because placement and optional collision policies are already coupled.
- Scene depends on a narrow identity/input owner, not the Engine implementation. UI depends only on foundation/UI; graphics cannot depend on game behaviors. ES2022-only compilation, relative path escape checks, module direction checks and runtime import-cycle detection run in the existing check command. No value-import cycles were found among the 49 Core sources.
- Existing UI algorithms were moved, preserving Flex constraints, width-aware text wrapping, pointer ownership, cancellation, Action sources and renderer resource lifetimes. Text measurement remains injected by the renderer/Host.
- CanvasScroll supports vertical/horizontal/both scrolling, clipped bounds shared by paint/hit/native mirrors, nested normalized wheel routing, clamped ranges after resize/removal and button-based touch-screen scroll controls. Main-axis overflow is retained. There is no virtualization or inertia.
- Panels support add/remove, identity-preserving move(child, finalIndex) and aggregate clear(). Core owns logical focus, scroll reveal and Enter/Space activation; Web mirrors native semantics. Traversal excludes permanently clipped/pointer-transparent controls while retaining scroll-reachable entries.
- Canvas trail's UI list lab uses the same Core-only screen definition as headless tests: text, selection, add/remove/reverse, scrolling and navigation. It needs no Scene/Actor/Component knowledge in the screen definition and no direct DOM/Pixi calls. The list viewport is bounded so both narrow and desktop screens exercise overflow.
- Work report index/checkpoints and contributor/startup instructions now require pushed implementation/verification/handoff records before long operations and integration. This report contains the material findings and limitations used for final communication.

## Main changed files

| Area                 | Files                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Core modules         | packages/core/src/{foundation,scene,graphics,ui,interaction,animation,game,runtime}, index.ts and components.ts                          |
| Shared UI            | ui/canvas-node.ts, canvas-layout.ts, canvas-text.ts, canvas-ui.ts; interaction/pointer-routing.ts; foundation/cancellation.ts            |
| Web adapters         | packages/web/src/canvas-node.ts, canvas-visual.ts, pointer.ts, game.ts, renderer.ts, index.ts; export-only probe forwarders              |
| Boundary checks      | scripts/core-boundary.mjs and scripts/validate.mjs; internal-path updates in benchmark/prototype tools                                   |
| Compatibility screen | examples/canvas-ui/portable-screen.ts, main.ts and README.md                                                                             |
| Behavioral tests     | portable-ui.test.ts, web-cancellation.test.ts, core-boundary.test.ts and browser/portable-ui.spec.ts; moved-source import updates        |
| Guides and recovery  | docs/host-boundary.md, architecture/API/Canvas/roadmap docs, Japanese guides/site route, AGENTS.md, CODEX-START.md and this report/index |

## Public API and migration

Existing package-level imports remain. Experimental internal file paths changed; import from package roots rather than private source paths. Web CanvasButton callbacks still receive a native AbortSignal. Core CanvasButton callbacks and CanvasNode.signal now use CancellationSignal (aborted, onCancel, throwIfCancelled); browserAbortSignal explicitly bridges an owner into fetch/DOM APIs. CanvasNode.ui is a narrow owner interface; retain the CanvasUI returned by canvasUI(root) for focus/layout/diagnostics. CanvasUI accepts a LifetimeOwner and its legacy scene property identifies that owner; retain a separate Scene reference for Scene-specific fields. Core lifecycle/update phase order, image leases and asynchronous Web readiness contracts remain unchanged.

The Host guide documents renderer versus Host versus distribution target, actual portability boundaries, escape-hatch ownership and a concrete alternative Host implementation checklist. Standard API definitions are portable models; identical fonts/GPU output, OS accessibility or unimplemented targets are not guarantees.

## Verification results

| Command / environment                                                                         | Result                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm ci                                                                                        | Passed locally and in CI; no dependency changes                                                                                                                             |
| npm run check                                                                                 | Passed: repository and ES2022-only Core types, formatting, dependencies/cycles, required files and license notices; 12 pre-existing warnings / 11 informational diagnostics |
| npm test                                                                                      | **570 passed, 0 failed, 45 files**                                                                                                                                          |
| test:browser, desktop shard 1/2                                                               | **61 passed, 0 failed**                                                                                                                                                     |
| test:browser, desktop shard 2/2                                                               | **58 passed, 0 failed**                                                                                                                                                     |
| test:browser, narrow shard 1/2                                                                | **61 passed, 0 failed**                                                                                                                                                     |
| test:browser, narrow shard 2/2                                                                | **58 passed, 0 failed**                                                                                                                                                     |
| Browser total (Chromium, Actions)                                                             | **238 passed, 0 failed, 15 files**, including portable UI in WebGL and Canvas2D at both widths                                                                              |
| npm run build -- --target web                                                                 | Passed locally                                                                                                                                                              |
| npm run build -- --target web --example canvas-ui --base /Simpludify/                         | Passed locally and CI                                                                                                                                                       |
| npm run test:build; npm run test:build:game; node scripts/smoke-build.mjs --example canvas-ui | Passed in Actions; UI/scenes, Signal Run and Canvas trail production smoke paths                                                                                            |
| site:build -- --base /Simpludify/; site:check; test:site                                      | Passed; 58 HTML documents, 3470 references, 54 standalone typed snippets; real gallery/samples validated in Actions                                                         |
| site:build -- --base /; site:check; test:site                                                 | Passed with the same static counts and real site smoke                                                                                                                      |
| npm run bench; bench:practical; bench:response                                                | Passed in CI quality job; not a new comparative performance claim                                                                                                           |
| Local real browser execution                                                                  | **Not run**: Chromium download returned truncated/non-ZIP data. Real browser evidence above is from Actions                                                                 |
| Electron/Tauri/Android, other browser engines and physical mobile/IME/AT                      | **Not implemented or not verified**                                                                                                                                         |

Final source CI: [40935579831 — success](https://github.com/oz-coden/Simpludify/actions/runs/40935579831), source `61dbb7b6d3a94fd773b5d73c9347fb20738d1d12`; 8 validation jobs succeeded, deploy skipped on PR as intended. [PR #1](https://github.com/oz-coden/Simpludify/pull/1) contains the complete change. Earlier failures and fixes are preserved in the checkpoint history below. Report/overview-only metadata may be committed after the tested source without repeating unchanged source tests; main integration must still run its full CI.

## Known limits and next priorities

No major unresolved implementation failure is known at the tested source. Deferred scope is explicit:

1. Dedicated select/number/text controls and a Host text/IME bridge; current example selection is button composition, not a native form control.
2. Touch-drag scrolling, inertia, scrollbars and virtualized/incremental large lists; scroll currently relayouts the dirty root and uses immediate child extents.
3. Automatic font readiness/invalidation and panel-to-world viewport binding helpers. Exact text metrics must match painting; custom RendererPort still needs a Canvas presentation capability.
4. Alternate Host/renderer compatibility tests, then Electron/Tauri packaging and target-specific validation. These targets are architectural preparation only.

Native API/DOM/Pixi escape hatches remain available; callers own portability and cleanup for bypassed abstractions. No cross-platform executable guarantee or physical screen-reader/IME validation is claimed.

## Branch, commits and integration receipt

Baseline: latest main at task start, `152ec2e35789ec512f53ea988d7f0d54d7ff1ead`. Work branch: `refactor/core-host-ui-2026-10-30`. All implementation/checkpoint commits were saved remotely without force push or release/package publication.

| Commit                                                                                            | Purpose                                              |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [c7d4a28](https://github.com/oz-coden/Simpludify/commit/c7d4a28fd9e4948c7b350d2a368a5f3a2eb7b88e) | Investigation and initial report                     |
| [96a75f6](https://github.com/oz-coden/Simpludify/commit/96a75f69d3ce7f5f86112b482d51a7f3eacf0195) | Core modules and graphics/movement separation        |
| [dce3cef](https://github.com/oz-coden/Simpludify/commit/dce3cef75107439baec947fe3341f5af5f75d035) | Shared Core UI/layout/routing extraction             |
| [43bf178](https://github.com/oz-coden/Simpludify/commit/43bf1782b5bed6c97350d01589c226c92a4f1e8c) | Scroll/list/focus and portable screen                |
| [f6bc1ce](https://github.com/oz-coden/Simpludify/commit/f6bc1ce62b70a9330b33ffa1ecc700b8becb64e7) | Site link/input fixture corrections and review       |
| [c04df92](https://github.com/oz-coden/Simpludify/commit/c04df927c7527c18537bbdacbd1b477e71fdf524) | Static clip focus regression                         |
| [61dbb7b](https://github.com/oz-coden/Simpludify/commit/61dbb7b6d3a94fd773b5d73c9347fb20738d1d12) | Narrow/desktop portable fixture; final tested source |

Main integration: **completed** via [PR #1](https://github.com/oz-coden/Simpludify/pull/1). Integration SHA: [ba1345e](https://github.com/oz-coden/Simpludify/commit/ba1345e7ba71f8ab6b8a4717a8980b98414d2cc5). The pre-merge complete report is [ef34877](https://github.com/oz-coden/Simpludify/commit/ef348779bd4e8e819b1ed23164726e657f616db0). Post-integration main CI: [40936947127](https://github.com/oz-coden/Simpludify/actions/runs/40936947127), currently running. Source tests are successful; deployment must not be inferred from that alone. The branch was fast-forwarded to the merge before recording this handoff. Documentation-only receipt commits use [skip ci]; runtime source changes still require full CI.

Next step if interrupted: inspect main CI 40936947127, record its actual job/test/deploy results, then fast-forward main to the final report receipt once verification succeeds. No implementation work remains unless CI exposes a failure.

## Historical checkpoints

The following notes record observations at their checkpoint, including superseded pending states; the final implementation result above is the current source status.

## Scope and baseline

- Date: 2026-10-30 (JST).
- Source: latest `main` at task start, `152ec2e35789ec512f53ea988d7f0d54d7ff1ead`.
- Work branch: `refactor/core-host-ui-2026-10-30`.
- Goal: preserve the two private Core/Web packages, organize Core responsibilities, move portable Canvas UI logic into Core and keep renderer/browser adapters in Web. Persist progress and verification in GitHub.
- Run To Exit is read-only reference material; no game changes are in scope.

## Phase 1: implementation evidence and decisions

- Core already compiles with ES2022 only, without DOM/Node ambient types. Scene/Actor/Component lifecycles, ownership (Lifetime), events, timers, Action device/logical sources, animation and collision are independent of Pixi. Preserve their synchronous contracts.
- Core source currently has 41 flat TypeScript files. `components.ts` mixes Transform/Renderable data with ActionMovement/Motion. Scene depends on InputSystem through types; Actions binds to Scene lifecycle. Grouping must preserve these explicit contracts rather than inventing a scheduler or new packages.
- Web `canvas-node.ts`, `canvas-layout.ts`, `canvas-ui.ts`, `canvas-text.ts` and `pointer-routing.ts` implement mostly portable state, Flex calculation, clipping, text segmentation and event routing. `CanvasNode` currently constructs browser AbortController and exposes AbortSignal; this requires a portable cancellation contract and an explicit browser adapter/migration decision.
- `canvas-visual.ts` owns actual Pixi Graphics/Text, exact font metrics and native button mirrors; `pointer.ts` owns browser capture, blur and DOM coordinates. These stay Web-side. Game owns asynchronous scene preparation/commit, ResizeObserver and renderer lifetime; Core stays synchronous.
- UI ownership currently points CanvasNode directly back to CanvasUI. Use a narrow invalidation/error/ownership contract where possible. Existing routing already has multi-source holds, pointer cancellation, scene subscriptions and cleanup; reuse it.
- Run To Exit `src/main.ts` builds forms, command lists, reorder controls and logs via DOM; `src/board.ts` uses Canvas HUD/selection with public Simpludify exports. `docs/engine-review.md` identifies scrolling, numeric/select forms, reorder and Canvas/world viewport alignment. Prioritize reusable mutation/scrolling/focus foundations; do not add a command VM or game-specific rules.
- Existing CI runs quality/unit/bench checks, four isolated browser shards, production smoke tests and Pages builds for project/root bases. Keep all paths.

## Planned checkpoints (not completed)

1. Organize internal modules and enforce dependency boundaries without changing public package imports.
2. Extract UI model/layout/routing into Core with injected text metrics and portable cancellation. Keep Web adapters and compatibility where reasonable.
3. Add tested dynamic ordering, scrolling/clipping and logical focus; provide a host-independent interactive UI fixture reused by Web/headless tests.
4. Review API/docs and run check, unit, browser, production and Pages validation. Push before lengthy runs.
5. Merge only after successful review/validation, confirm main CI and save final evidence.

## Verification ledger

- Repository inspection: completed; baseline and reference sources read.
- Dependency installation: started; result pending.
- Unit/browser/build checks: not yet executed.
- GitHub Actions: not yet executed for this branch.
- Commits: initial checkpoint is the commit containing this report; later revisions will list stable SHAs.
- Main integration: not performed. Final SHA: unavailable until integration.

## Initial handoff (superseded by later checkpoints)

Implementation has not started. Resume from checkpoint branch, inspect this ledger, install dependencies if needed, then implement the planned extraction. Known limitations: current UI lacks scrolling/reorder API and Core lacks a portable cancellation abstraction; Electron/Tauri/Android are not implemented or verified.

## Phase 2 checkpoint

- Internal sources grouped into foundation, scene, graphics, interaction, animation, game and runtime; package root exports remain stable. Transform/Renderable are now graphics data; Motion/ActionMovement are game behaviors. The components aggregator preserves exports without forcing internal graphics consumers through movement code.
- Tilemap remains an integrated game facade because its existing collision policy support is a real dependency. Simulation timers are foundation utilities; fixed-step Engine execution is runtime. Scene references a narrow identity/input ownership contract instead of importing Engine.
- `npm ci`: passed (68 packages installed).
- Initial `npm run check`: caught stale relative component paths and Markdown formatting; corrected before this checkpoint. Final check result follows below.
- `npm test`: 42 files / 556 tests passed after the component import correction.
- Source checkpoint: [c7d4a28](https://github.com/oz-coden/Simpludify/commit/c7d4a28fd9e4948c7b350d2a368a5f3a2eb7b88e).
- UI extraction, browser validation and integration remain pending.

- Phase 2 final `npm run check`: passed, including ES2022-only Core compilation, boundary and license validation (existing Biome warnings remain).
- Local Chromium installer: failed with truncated/non-ZIP download; browser results are not yet available. GitHub Actions remains the independent browser verification path.

## Phase 3 checkpoint

- Portable CanvasNode ownership/state, Flex layout, text wrapping, CanvasUI hit testing/clipping and ScenePointer/PointerRouting moved into Core. Web source forwarders retain old internal probe paths without duplicating algorithms.
- CanvasUI accepts a LifetimeOwner, so UI construction/layout no longer requires an Engine or Scene. Exact text metrics are still supplied by the Host. Core uses CancellationSignal; Web CanvasButton preserves native AbortSignal callbacks via browserAbortSignal. Direct node.signal consumers migrate to the portable contract or this explicit bridge.
- Web retains Pixi drawing, image/texture leases, native button mirrors, browser pointer capture/keyboard input and asynchronous Game transitions.
- Added module dependency enforcement, including escaping relative import rejection. Graphics cannot import game behaviors; UI depends only on foundation/UI; Scene's input identity reference is type-only.
- `npm test`: 43 files / 558 tests passed after extraction, including existing layout, routing, ownership and cancellation behavior.
- UI scrolling/reorder/logical focus, API guides and final browser/build checks remain pending. Main is unchanged.
- Phase 2 implementation: [96a75f6](https://github.com/oz-coden/Simpludify/commit/96a75f69d3ce7f5f86112b482d51a7f3eacf0195).

## Phase 4 checkpoint

- Added CanvasScroll with vertical/horizontal/both ranges, retained main-axis content, shared clip/hit boxes, nested wheel routing and clamping after list/viewport changes. Added move(child, finalIndex) and aggregate clear(), retaining identity/subscriptions on reorder.
- Added Core logical focus/traversal/ancestor reveal and Core Enter/Space activation. Web retains capture/blur/native semantics and normalizes wheel units. UI list lab uses only Core API definitions and is mounted by Canvas trail; the same screen is a headless fixture.
- Dedicated native select/number/text controls, IME, touch drag/inertia/scrollbars, virtualization and new desktop/mobile targets are deferred.
- `npm run check`: passed at this checkpoint, including ES2022-only Core, module direction/relative escape checks and license notices. The first Phase 3 boundary pass exposed the pointer coordinate type dependency; the validator now explicitly allows that type-only edge.
- `npm test`: 45 files / 568 tests passed. Added headless no-browser-globals UI, scrolling/clipping/scaling/nesting/resize, mutation/disposal, focus, key cancellation and Web AbortSignal bridge tests.
- Browser regressions added for WebGL and Canvas2D, dynamic list/focus/scroll/resize/cleanup; not yet executed locally because Chromium download failed. CI will run both viewport projects.
- New guide: docs/host-boundary.md. Existing Canvas/API/architecture/roadmap/Japanese guides and sample README updated. AGENTS.md and CODEX-START.md now require persistent reports and pushed checkpoints for future tasks.
- Phase 3 implementation: [dce3cef](https://github.com/oz-coden/Simpludify/commit/dce3cef75107439baec947fe3341f5af5f75d035).
- Next: production build, Pages builds/link/snippet checks, review and remote browser CI. Do not merge until these checks succeed.

## Final review checkpoint (before browser completion)

- Review found a wrong relative link in the Japanese Canvas guide. The first Phase 4 CI ([40934063114](https://github.com/oz-coden/Simpludify/actions/runs/40934063114)) failed both site-base jobs on that link. Corrected to the actual repository-relative source path.
- Local `npm run build -- --target web`: passed.
- Local `npm run site:build -- --base /Simpludify/` + `npm run site:check`: passed after link correction; 58 HTML documents, 3470 link/asset references, 54 standalone typed code examples.
- Local `npm run site:build -- --base /` + `npm run site:check`: passed with the same counts.
- Rechecked `npm run check` and `npm test`: passed; 45 files / 568 tests. Check reports 12 pre-existing Biome warnings and 11 informational diagnostics, no errors.
- Runtime import graph reviewed: no value-import cycles among 49 Core TypeScript source files. The boundary validator now also rejects value-import cycles. UI cannot import Scene/Engine or concrete Host code.
- Focus traversal now excludes nodes with non-auto pointer interaction, matching native mirrors. Scroll range calculation avoids argument-spreading large child arrays and avoids duplicate bounds allocation when there is no scroll translation.
- The first Phase 4 CI quality and production jobs passed, including production UI/scenes, Signal Run and Canvas trail smoke tests; browser shards are still being collected. Local Chromium remains unavailable, so local real browser smoke commands were not run.
- Implementation checkpoint: [43bf178](https://github.com/oz-coden/Simpludify/commit/43bf1782b5bed6c97350d01589c226c92a4f1e8c). Main integration remains pending.

- Initial narrow browser shard 1: 59 passed / 2 failed. Both new tests incorrectly tried to pointer-click the intentionally pointer-transparent semantic button mirrors; Canvas correctly intercepted these. Tests now use native keyboard activation for named controls, while real pointer wheel routing still targets Canvas coordinates. This is a fixture correction, not a change to production pointer routing. Narrow shard 2 passed 58/58. Browser suite enumeration: 238 tests / 15 files across desktop and narrow projects.
- Explicit Canvas trail production subpath build (`npm run build -- --target web --example canvas-ui --base /Simpludify/`): passed.

## Focus boundary review checkpoint

- A final review identified a potential Tab trap: an interactive node permanently hidden by a static clip was still a logical traversal candidate. Core now projects possible ancestor scroll reveal before testing clipping, excludes permanently unreachable and pointer-transparent controls, and retains offscreen scroll entries. Added a behavioral regression for this distinction.
- `npm run check`: passed. Focus/portable suite: 9/9; full suite: 45 files / 569 tests passed.
- The preceding source revision [f6bc1ce](https://github.com/oz-coden/Simpludify/commit/f6bc1ce62b70a9330b33ffa1ecc700b8becb64e7) passed quality, production and both site-base jobs in [40934715453](https://github.com/oz-coden/Simpludify/actions/runs/40934715453). Browser results were still pending when the focus correction checkpoint was prepared; final source CI must be checked separately.

## Sample viewport checkpoint

- The portable lab now caps its scroll viewport at 360 UI units so large desktop screens also exercise overflow; without a bound, all 12 entries fit on a tall desktop Host. The complete no-browser-globals screen fixture now runs at both 390x600 and 1440x900.
- `npm test`: 45 files / 570 tests passed. `npm run check`: passed. Core source remains DOM/Node-free; no further feature work is planned before collecting final CI.
- Focus correction source: [c04df92](https://github.com/oz-coden/Simpludify/commit/c04df927c7527c18537bbdacbd1b477e71fdf524).
