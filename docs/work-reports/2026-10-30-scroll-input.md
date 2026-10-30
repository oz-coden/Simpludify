# Canvas scrolling and input arbitration

## Status and baseline

Investigation complete; implementation and verification are pending. Source is latest main at task start: `c9f525264caf0db5c0bea165def08eafed6e03ac`. Branch: `feat/canvas-scroll-input-2026-10-30`. Previous report: [Core/Host UI](2026-10-30-core-host-ui.md). Run To Exit and packaging targets are outside scope.

## Concrete findings

- CanvasNode owns offsets/ranges and validates immutable style patches. scrollTo/scrollBy currently invalidate full Flex layout. CanvasUI.layout reruns intrinsic/constrained Flex and projects scroll offsets into frozen boxes. Paint, native mirrors and hit tests read those boxes.
- Core PointerRouting already owns each pointer from down to release, combines pointer/key holds, suppresses invalidated IDs through physical release, releases native capture through an injected callback and scopes subscriptions to Scene/UI.
- HoldButton is an immediate held-state control, not a delayed long-press recognizer. Preserve its existing immediate down semantics; transferring an active pointer to scrolling must release only that pointer's held contribution and deliver cancellation once.
- BrowserPointer normalizes coordinates using Game's host transform, captures before dispatch, normalizes wheel modes, and releases on blur/hidden/cancel. Canvas already has touch-action:none; DOM overlays keep their own behavior. World gestures must never become UI scrolling after down.
- Web CanvasVisual owns Pixi text/background/masks and native button mirrors. No scrollbar painting/hits currently exist. Game already supplies presentation frames while simulation can pause; Core must receive elapsed time explicitly without RAF or browser clocks.

## Planned contracts (not completed)

1. Per-node dragScroll/inertia/scrollbar settings, runtime validation and immediate cancellation on disable/axis changes. Default scrollbars overlay content without changing Flex size.
2. A pointer starts as a normal UI gesture. An axis-aware screen-space threshold can transfer it to the deepest movable scroller in its original ancestor path. Cancel/release the original target once, retain native capture and suppress click. Lock that scroller until release; do not jump parents mid-drag. Wheel chaining remains per-event. One active pointer per scroller; distinct scrollers/pointers remain independent.
3. Core owns timestamp-based bounded velocity estimation and analytic exponential decay. Host explicitly advances only active momentum; pause/blur/disposal/input/programmatic commands stop it. Invalid/large time discontinuities must not launch or resume uncontrolled motion.
4. Core owns overlay track/thumb geometry, hit regions and direct thumb/track semantics. Web paints in subtree paint order and converts native capture/input only. Hidden bars do not disable scrolling; always without overflow shows a disabled full-size thumb.
5. Separate Flex invalidation from scroll projection. Reuse unscrolled layout geometry for offset-only updates; text measurement and intrinsic sizing must not repeat for scrolling. Keep frozen public bounds and shared clip/hit/native coordinates.

## Verification and recovery ledger

- Repository/AGENTS/architecture/API/Host and UI/routing/Game/Web drawing sources inspected.
- npm ci: passed (68 packages). No source tests, browser tests or performance measurements have run for this task yet.
- Baseline and revised scrolling workloads will be recorded on the same machine with no concurrent tests/builds; report p50/p95, sizes, commands and layout counters.
- Pending: drag arbitration, momentum, bars, projection optimization, sample/docs, regression tests, CI and merge/deploy.
- No main integration, PR or final CI exists yet. Do not treat the planned contracts as implemented results.

Each implementation checkpoint must update this ledger and be pushed before long verification. If interrupted, resume from this branch/report and inspect the actual commit/CI state. Final results must include all API/cancellation rules, tested and untested environments, performance data, commit/CI links and integration/deploy receipts.
