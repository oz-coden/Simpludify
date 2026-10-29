# Core modules and host-independent Canvas UI

## Scope and baseline

- Date: 2026-10-30 (JST).
- Source: latest `main` at task start, `152ec2e35789ec512f53ea988d7f0d54d7ff1ead`.
- Work branch: `refactor/core-host-ui-2026-10-30`.
- Goal: preserve the two private Core/Web packages, organize Core responsibilities, move portable Canvas UI logic into Core and keep renderer/browser adapters in Web. Persist progress and verification in GitHub.
- Run To Exit is read-only reference material; no game changes are in scope.

## Phase 1: implementation evidence and decisions

- Core already compiles with ES2022 only, without DOM/Node ambient types. Scene/Actor/Component lifecycles, ownership (Lifetime), events, timers, Action device/logical sources, animation and collision are independent of Pixi. Preserve their synchronous contracts.
- Core source currently has 43 flat TypeScript files. `components.ts` mixes Transform/Renderable data with ActionMovement/Motion. Scene depends on InputSystem through types; Actions binds to Scene lifecycle. Grouping must preserve these explicit contracts rather than inventing a scheduler or new packages.
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
