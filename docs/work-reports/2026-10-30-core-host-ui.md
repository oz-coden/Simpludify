# Core modules and host-independent Canvas UI

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

## Current handoff

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
