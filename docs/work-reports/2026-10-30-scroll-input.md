# Canvas scrolling and input arbitration

## Current status — 2026-10-30 18:10 JST

**Implementation is saved, but final verification is not complete. Main has not been merged and these changes have not been deployed to GitHub Pages.**

- Development branch: `feat/canvas-scroll-input-2026-10-30`; tested source: [b79e6f093acafe5288bebd558a994e4a3d5b018a](https://github.com/oz-coden/Simpludify/commit/b79e6f093acafe5288bebd558a994e4a3d5b018a). Main remains the starting revision `c9f525264caf0db5c0bea165def08eafed6e03ac`.
- Implemented: touch/mouse content dragging, axis-aware threshold and pointer ownership transfer, Button/HoldButton cancellation, independent pointers and locked nested-scroll ownership, per-node inertia and runtime settings, overlay scrollbar modes/thumb/track interaction, Core geometry and Web rendering, offset-only layout projection, and expanded portable sample/API documentation. Core has no new DOM/Pixi dependency.
- Exact-source [CI 41022256709](https://github.com/oz-coden/Simpludify/actions/runs/41022256709) finished with **failure**. Quality passed: **622 unit tests / 47 files**, including boundary checks. Production build/smoke and both root/project site-base jobs passed.
- Browser total: **248 passed / 2 failed out of 250**. Desktop shard 1: 67 passed; desktop shard 2: 56 passed, 2 failed; narrow shard 1: 67 passed; narrow shard 2: 58 passed. Both failures are desktop timeouts: existing Prism Raid Replay test (`replay.spec.ts:123`) and new WebGL Host-frame momentum/pause/disposal test (`scroll-input.spec.ts:209`). No root cause has yet been established. The new momentum test passed for Canvas2D desktop and both narrow renderer variants; that does not resolve the failing desktop WebGL result.
- Mouse/thumb/pixel and CDP multi-touch ownership tests passed in all four renderer/viewport combinations. CDP touch is emulation; physical Android/iOS devices are **not verified**. Local browser installation was unavailable, so real browser execution above is Actions-only.
- Latest retained Core benchmark: 5000-row median **3.523ms → 0.513ms**, approximately **6.9x** faster; offset updates perform zero Flex layouts/text measurements. Same-machine conditions and all raw runs are retained below and in `benchmarks/canvas-scroll/`. This excludes Pixi/GPU and end-to-end input latency; no virtualization claim.
- Next priority: inspect the two timeout traces, distinguish product defects from timing/environment issues, fix concrete causes, rerun relevant and full verification, then complete review and merge/deploy only if required checks pass. Failure artifacts: [desktop shard 2](https://github.com/oz-coden/Simpludify/actions/runs/41022256709/artifacts/12962531992).
- This is an interim verification record, not a completion report. The chronological checkpoints below retain earlier plans/results; their “pending” statements describe those earlier points in time.

## Initial status and baseline (historical)

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

## Drag/input checkpoint

- Added per-node validated dragScroll/inertia/scrollbar/dragThreshold settings. Scroll containers block their own empty space by default; explicit pointerEvents overrides remain available. Screen threshold defaults to 8 Host units and is converted through UI scale; DPR is presentation only.
- Drag arbitration uses the original hit's ancestor path. Once scrolling wins, original HoldButton contribution releases and PointerCancel fires once while native capture remains held. The scroller becomes the owner until physical release/cancel; it does not jump to a parent at its edge. At the next gesture the deepest movable ancestor can win. Occupied scrollers reject competing pointer claims; different scrollers work independently.
- External scroll commands (including no-ops), drag disable, direction change, ancestor disable/hide/removal and Scene/UI disposal cancel active ownership. World gestures are never stolen after down. Existing HoldButton remains an immediate held-state control; there is no delayed long-press recognizer.
- Separated offset projection from Flex/text invalidation. Frozen base layout boxes are retained in a WeakMap; scrolling updates projected bounds without remeasurement, preserving public frozen snapshots and shared paint/hit/focus geometry.
- Core momentum math/state foundation is present but Host advance and momentum regressions are not yet complete; do not treat inertia as fully validated at this checkpoint. Scrollbar painting/interaction remains pending.
- npm run check: passed. Existing pointer suite: 14/14; existing layout/portable suites: 35/35; new drag/input suite: 17/17.
- Baseline performance: Node v24.22.1, Linux, AMD EPYC 9V74, 9 logical CPUs; single local workload, 10 warmup +100 measured offset+flush operations. 100/1000/5000 rows p50: 0.150/0.727/3.523 ms; p95: 0.296/1.391/5.963 ms. Every size ran 100 full layouts and count*100 text measurements. Raw data: benchmarks/canvas-scroll/before.json. Core-only; excludes Pixi/GPU. Heap deltas after GC are noisy, not allocation/peak-memory measurements.
- Baseline measured via node --expose-gc /tmp/scroll-benchmark.mjs /tmp/scroll-before.json before engine edits; scripts/benchmark-scroll.mjs preserves that workload with normal Vite import and clean-checkpoint validation.
- Initial source checkpoint: https://github.com/oz-coden/Simpludify/commit/e2f37ebfae2c09b0ec20ca87907fddf1895e0f8d . Browser download again failed in this environment; real browser verification will use Actions unless a local browser becomes available.

## Momentum checkpoint

- Core estimates velocity from monotonic Host seconds using a 45ms exponential filter, clamps samples to 3000 UI units/s, ignores missing/backwards/nonfinite/over-150ms histories and refuses stale release velocity after 80ms.
- Per-node inertia defaults on; exponential decay is 8/s, cutoff 10 units/s, cap 3000. Integration clips at the exact cutoff time so 30/60/120Hz produce the same terminal distance. Each axis clamps independently at its scroll bounds.
- CanvasUI.advance(seconds) updates only its active Set. It rejects invalid/negative elapsed values without moving state and stops momentum for discontinuities over 250ms. No timers/RAF/browser clocks were added to Core. Web Game supplies presentation elapsed time and stops motion on pause/hidden; existing blur/release/reset/disposal paths also stop it.
- New down/wheel/programmatic scroll commands interrupt motion. Runtime inertia/axis/drag policy changes, hide/disable/removal and owner disposal stop affected state; unrelated scrollers retain their settings.
- npm run check passed. New scroll/input suite: 30/30. The preceding checkpoint's full unit suite passed 587/587 in 46 files. Scrollbars and new real browser/touch regressions remain pending.
- Drag/projection checkpoint: https://github.com/oz-coden/Simpludify/commit/73a551d02cfd75709a236c6d1d8dc8462f195409 .

## Scrollbar checkpoint

- Added Core overlay geometry and ordered hit selection for vertical/horizontal/both scrollbars. auto shows overflow only, always shows a disabled full-track thumb without overflow, hidden hides only the bars. Bars do not reserve Flex space. Thumb minimum is 24 UI units; cross-axis hit width is at least 24 Host units, clipped by the same ancestor bounds.
- Primary mouse/touch thumbs map directly to clamped positions using the current track and original fractional grab point. Track presses page 90% of the viewport. Thumb/track gestures own their scroller, suppress content clicks and never launch momentum. Content drag disable does not disable bar control. Competing claims cannot steal capture; bar disappearance, direction/visibility/enable changes and disposal cancel safely.
- Core paint/hit traversal includes post-subtree overlays, so parent bars cover their content but later sibling UI covers earlier bars. Web draws only the Core geometry. Keyboard Arrow/Page/Home/End commands work through focused controls even when bars are hidden.
- Web retains private bar Graphics and releases their contexts with the presentation. Pure scroll translation no longer rebuilds background/text styling; mask geometry and scrollbar paint are cached separately from positions. No per-frame text measurement is added by the Core projection path.
- New scrollbar suite 16/16 and scroll/input/momentum 30/30 passed; check passed. Full suite result follows in final verification. Sample, browser/touch tests, performance comparison and docs remain pending.
- Momentum checkpoint: https://github.com/oz-coden/Simpludify/commit/2d2db05ec1a234d90238d5bfb9aab1610b73315d .

## Performance/sample/final-verification checkpoint

- Full unit suite: 47 files / 618 passed / 0 failed. Check passed, including ES2022-only Core, import/module/cycle boundaries and license checks. Malformed pointer coordinates and UI scale changes now cancel unsafe ownership/momentum; old-target cancellation exceptions still leave all holds released and the new owner cancellable.
- Same-machine revised Core benchmark at df46850: 100/1000/5000 rows p50 0.010/0.094/0.451 ms; p95 0.013/0.182/0.838 ms. Offset-only updates ran zero full layouts and zero text measure callbacks, versus 100 layouts and 10k/100k/500k callbacks before. Raw before/after data and reusable benchmark command are committed. 5000-row median improved about 7.8x in this workload. No GPU/renderer timing or peak-memory improvement is claimed; retained heap is noisy and projection still visits all rows.
- Core-only portable screen now includes inertia/drag/bar switches, independent secondary inertia, always-visible bars, nested both-axis cards and an immediate HoldButton. Original list/add/remove/reorder behaviors remain. Its existing 10 headless cases passed after extension.
- Browser fixtures cover actual mouse input, CDP multi-touch, ownership transfer/cancel/blur, visible scrollbar pixels, thumb dragging, hidden modes, stable Flex counts, Host-frame momentum and pause/disposal. Controlled presentation frames are used for stable clock assertions; CDP touch is emulation, not physical Android/iOS validation. These new browser tests have not yet run.
- docs/scrolling.md defines public APIs/defaults, mutation timing, exact cancellation/nesting rules and Host requirements. docs/scroll-performance.md bounds the measurements. Existing API/Canvas/Host/roadmap/Japanese guides and sample documentation now reference the implemented behavior.
- Next: collect CI/browser/production/site results, fix concrete failures, review ownership/resources and update the final report before merge. Local Chromium download failed, so real browser execution will be reported as Actions-only. Main remains c9f5252; no merge/deploy for this task yet.
- Scrollbar implementation checkpoint: https://github.com/oz-coden/Simpludify/commit/df46850936aa8bc461462c4dcd70c693e827c001 .

## First full browser results and touch fixture follow-up

- Source 7672415 passed quality (618 units), production smoke, both site bases, and narrow shard 1. Narrow shard 2 failed two newly added CDP touch checks: Hold state was read immediately after touchMove and was still true. Mouse/thumb pixel and Host-frame momentum tests passed in both renderers. Main is not merged.
- Replayed the exact main-list + secondary-Hold two-pointer sequence through the full portable screen headlessly: passed. The browser test now polls the post-dispatch state rather than assuming CDP command acknowledgement means DOM move delivery is complete. Failure attachments include pointer event history, ranges, settings and ownership for diagnosis; the next CI must confirm whether this resolves the native-delivery timing issue.
- Local project-base build/check passed: 60 HTML documents, 3711 references, 55 standalone typed examples. Latest focused input suite: 33/33. Local Chromium remains unavailable.
- Initial investigation-only CI 41017127390 had an existing Tile trail WebGL test timeout before any engine edits. Subsequent momentum and scrollbar checkpoint CIs 41018406305 and 41019334591 passed completely. No unrelated test was removed or its timeout increased.
- Repeated final-source Core workload at 7672415: p50 0.0103/0.0828/0.5127 ms; p95 0.0341/0.2684/0.9916 ms for 100/1000/5000 rows; still zero Flex layouts/measurement calls. This is about 6.9x median at 5000 rows relative to baseline, rather than cherry-picking the earlier 7.8x run. Raw final-source data will be retained alongside both earlier runs.

## Pending-input and native-touch review

- Native CDP state polling resolved the initial delivery-timing failure: narrow shard 2 at 1c10cf4 passed all 58 tests, including both renderer variants of mouse/thumb pixels, two-finger Hold transfer/cancel/blur and Host-frame momentum. Other quality/production/site and narrow shard 1 checks also passed. Desktop results are still being collected; no premature merge.
- Review added cancellation for pending descendant presses when their ancestor receives wheel/program commands, including a no-op scrollTo. Reentrant held-state callbacks cannot deliver a late PointerDown after cancelling the gesture. New regressions pass; focused input suite is 35/35.
- Final-source performance guide now uses the later 7672415 measurement (5000-row median 0.513ms, p95 0.992ms, about 6.9x median improvement). Both earlier raw runs remain available. Later input-arbitration changes do not touch the measured projection path.
- Current local production/site project/root checks passed; final source browser suite enumeration and full unit counts are updated in the final receipt. Initial native timing failure is retained above instead of being rewritten as success.

## Final source checkpoint

- Local final unit suite: **622 passed / 0 failed, 47 files**. Check passed with the unchanged baseline 12 warnings / 11 informational diagnostics. Browser enumeration: **250 tests / 16 files** across desktop/narrow.
- Disabled scroll containers now retain dim bar geometry while refusing bar input; hidden/disposed trees do not paint bars. This completes the separation of display policy and input availability. Added the corresponding regression. No further features are planned; collect this exact source's full CI before integration.
- Pending-input cancellation fix: https://github.com/oz-coden/Simpludify/commit/40e210492e0c1a6225b35ef68cd3c2a6a03775c5 . Native touch fixture correction: https://github.com/oz-coden/Simpludify/commit/1c10cf45cac669efb4960fad46f3a3c77e3803ad .

## Resumed investigation — 2026-10-30 18:23 JST

- Reconfirmed remote branch at `2535a31d3512886b0971b21f4521a9ce94727ace`, main at `c9f525264caf0db5c0bea165def08eafed6e03ac`, and no open PR. Continue the existing branch without reconstructing completed scrolling features. `npm ci` passed (68 packages).
- Downloaded and decoded the [failed desktop artifact](https://github.com/oz-coden/Simpludify/actions/runs/41022256709/artifacts/12962531992), including Playwright browser JSON, nested traces and screencast images. Both failures reached the final synchronous `Game.dispose()` evaluate call. Replay's disposal call has no completion event before timeout; scroll disposal eventually returned all expected zero/disposed counters after **35007ms**. All preceding momentum, pause and runtime inertia assertions completed. This narrows the issue to teardown, rather than an unmet scrolling-state wait.
- Replay trace includes ANGLE outsideRenderPass queueSerial warnings. Pinned Pixi's GL context teardown calls `gl.useProgram(null)` and `WEBGL_lose_context.loseContext()`. These are inspection findings, not proof that either native call caused the delay. Next: instrument/reproduce teardown before selecting a fix, compare the main baseline where feasible, then run targeted repeated and full browser checks.
- No source fix or successful revalidation has yet been claimed. Main remains unmerged; Pages unchanged.

### Teardown probe checkpoint

A temporary diagnostic workflow repeats the affected desktop tests three times on the work revision and the existing Replay test three times on main with only the diagnostic test overlay. Synchronous wrappers log entry/exit of renderer system destruction and native GL release calls; no timeouts, assertions, rendering paths or disposal semantics are changed. The diagnostic files will be removed after collecting evidence. Local Chromium installation failed again with a truncated/non-ZIP download, so browser reproduction uses Actions. This checkpoint records instrumentation, not a fix.

### Native call isolated; CI-mode comparison

- [Diagnostic run 41033222006](https://github.com/oz-coden/Simpludify/actions/runs/41033222006), source [959cd27](https://github.com/oz-coden/Simpludify/commit/959cd27238d8fb48be2b5d5e55a39ad863faa953): main Replay **2 passed / 1 timeout**, work affected cases **9 passed** (Replay/WebGL scroll/Canvas2D scroll, three repetitions each). Baseline failure trace reaches Pixi `_GlContextSystem.destroy`, then `gl.useProgram(null)` returns in 0.1ms and **`WEBGL_lose_context.loseContext()` does not return before timeout**. Earlier systems finish in milliseconds. Work WebGL scroll cases took 26.4–26.7s, compared with 0.60–0.63s for Canvas2D; passing is not evidence of an acceptable stable margin. Main artifact: https://github.com/oz-coden/Simpludify/actions/runs/41033222006/artifacts/12965869636 .
- Candidate CI-only correction: use Chromium's documented **WebGL-only SwiftShader mode** (`swiftshader-webgl`), rather than forcing its entire OpenGL ES driver/compositing path through SwiftShader. WebGL content still uses ANGLE/SwiftShader; no Canvas2D substitution, renderer changes, relaxed assertions or timeout changes. Official mode definitions: https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md . This is a hypothesis under controlled comparison, not yet a validated fix. Four diagnostic jobs compare both modes on both revisions, three repetitions each, with explicit WebGL version and native release timings.
- Local `npm test`: 622/622. `npm run check`: passed after formatting diagnostic YAML/report index; unchanged 12 warnings/11 infos. Canvas UI production compilation passed; local smoke cannot launch Chromium. Project site check passed (60 HTML/3711 references/55 snippets). An immediate sequential root check initially reported a stale project asset URL; standalone project and root rebuild/check both passed subsequently. Root cause of that local transient is not established; both CI site jobs remain required independently.
