# Unified input, gamepads and bilingual SDK documentation — v0.1.4

## Baseline and checkpoint

- Baseline main: `42302ff3210f8806db63bfe9ad72f376d6e8713d`.
- Branch: `feat/unified-input-v0.1.4`.
- Security PR #14 is already included (merge `1c28c8f913a25db85d1c50604a847bce2db5a303`). Existing regression tests and immutable published 0.1.3 artifacts are retained.
- Target: prepare Core/Web 0.1.4, integrate only after validation, and require separate final approval before npm publication. No publication or release workflow has been invoked.

## Existing design and planned extension

ActionController already composes independent ActionSources, exposes stable ActionReaders, retains button transitions between simulation boundaries and participates in Replay. KeyboardSource is an Engine-wide physical device contribution. Keyboard bindings currently fan out to every active controller that uses a matching key. Canvas touch/program input already uses ActionSources; no replacement input hierarchy is needed.

The implementation reuses these contracts:

- Add enabled state to existing ActionSource/KeyboardSource. Disable clears its contribution; enable restores no stale values. Clear/dispose retains ordinary logical release edges; global resets remain silent.
- Add per-controller keyboardEnabled, allowing keyboard exclusion without affecting other controllers or replacing Actors. Re-enable requires release of already-held keys before adopting new presses. Shared keyboard bindings deliberately fan out.
- Add a small DOM-free InputAdapter sampling/reset port to the existing InputSystem. Hosts sample before all Action frames are frozen; playback excludes live sampling. Pause/resume, Scene replacement and global clear reset adapters alongside logical state.
- Add a Web GamepadInput adapter available through Game.gamepads. Explicit bindings create ordinary controller-owned ActionSources. Multiple pads/controllers and deliberate same-device fan-out are permitted; the game chooses assignments. Dispose detaches, disable clears, reassignment clears the old contribution and reconnect/focus/reset requires neutral before rearming.
- Poll navigator.getGamepads at the input boundary; connection events invalidate/reset but never substitute event payloads for a usable polled snapshot. Sparse indices, missing APIs, permission errors and nonstandard mapping remain safe/neutral.
- Use physical standard positions for bindings. Preserve raw browser facts separately from inferred display layout. Unknown layouts use position/number names; labels can be overridden. Nonstandard devices require explicit raw-index mapping. IDs/indices are not persistent identities.
- Preserve additive/clamped axes, OR buttons, vector normalization, Scene ownership, pause callbacks and Replay frames. No networking, AI decisions, automatic takeover or player registry is introduced.

## Validation and documentation plan

Unit fixtures will cover source gating, keyboard isolation, poll ordering, multiple pads, disconnect/reconnect, analog/dead-zone behavior, binding validation and Replay resets. Browser fixtures will supply a controllable Gamepad API and exercise real focus, Canvas/touch/keyboard input, Scene transitions and both renderers. An official two-player sample will use the same reader-driven Actors throughout input-source changes.

Current user-facing Japanese and English coverage will be inventoried and paired. Existing guide URLs remain; current contracts are separated from historical/internal reports. Maintained examples are typechecked. Windows/Linux tarball consumers and the frozen Run To Exit candidate matrix will verify the prepared SDK without changing the consumer's permanent registry pins.

No test results are claimed at this initial checkpoint. Physical gamepads, manufacturer-layout accuracy, OS IME and non-Chromium browsers require separate verification. Gamepad standard reference: https://www.w3.org/TR/gamepad/ .

## Implementation checkpoint 1

Core source gating, per-controller keyboard exclusion, InputAdapter sampling/reset and the Web GamepadInput/GamepadSource API are implemented. The Web Game exposes gamepads and scopes polling to visible/focused game surfaces, excluding native editors. Device facts/layout labels and positional binding presets are separate modules. Sources validate bindings before allocating resources, reject cross-Engine controllers and release registrations immediately on disposal.

Local TypeScript passed. The first full static check failed on existing Markdown table formatting in the security integration report/index; these formatting-only issues were corrected, and the complete static check is being repeated. Focused input regression: 4 files / 68 tests passed, including 11 new gamepad/source fixtures and the unchanged existing unified-input/Action/Replay suites. A new lifetime fixture initially constructed Scene without its required ID; the fixture was corrected before the successful run. No existing test was removed or disabled. Browser, complete unit/package/site/consumer matrices and documentation work are pending.

## Implementation checkpoint 2

The first checkpoint is available on GitHub at `28a26a94a0da6f7459af9c22a0563fc5b9943508`. Full local static validation passed after the existing report-table formatting correction. All 838 unit tests passed before adding the two latest observer/provider fixtures; the expanded gamepad suite passes 13/13, and TypeScript passes with the new sample/browser fixtures.

The `unified-input` sample retains the same two Characters while explicit mode buttons switch keyboard/pad/program input. Each directional touch gesture uses an independent ActionSource so simultaneous directions compose rather than overwrite. Player pad assignment cycles through browser-exposed indices without a device-count limit. The display shows raw ID/mapping/counts, a layout hint and a user-overridable button-label layout. Scene-owned device notifications keep connection displays current even while simulation is paused.

Six browser cases (three behaviors × WebGL/Canvas2D, run at desktop and narrow widths) are added. They mock the polling adapter, not physical hardware. They cover actor-preserving handoff, independent pads, focus/editor priority, actual CDP touch, pause/reset, hotplug and Scene cleanup. Browser execution is pending at this checkpoint. The standard local Playwright Chromium download failed with truncated ZIP data; a separate temporary Chromium is being prepared for local checks, while CI retains standard Chromium.

CI checkpoint `7000f8475ec56c8a51b050af6c94656d90257907` / run [41593161493](https://github.com/oz-coden/Simpludify/actions/runs/41593161493): quality, Linux packaging and several browser/consumer jobs passed. Narrow shard 1 had one new Canvas2D test failure because it read a captured Action immediately after keydown without advancing an input boundary; the fixture now explicitly steps before asserting. The other five new narrow gamepad cases passed. This initial CI is not counted as an overall pass. Local browser attempts before the temporary browser finished downloading failed at executable setup and are not product-test passes.


## CI follow-up and documentation checkpoint

Run [41593669111](https://github.com/oz-coden/Simpludify/actions/runs/41593669111), source `fdbb3ace713488320e863e95b67e33f25e389609`, passed the corrected gamepad fixtures, quality and all other jobs except an existing desktop SDK viewport test. Its trace shows the world-click count reached the expected 2, but the page.evaluate response took about 7 seconds while the software renderer was busy, exceeding the host-side expect.poll 5-second deadline. The assertion now waits for the exact condition inside the page and keeps the existing overall 60-second test budget; no production pointer behavior, retry count or global timeout was changed.

The Core adapter reset now attempts every registered reset even if another adapter throws, with a regression test. Empty-adapter headless sampling avoids an unnecessary array allocation.

Core/Web/root/lock/ENGINE_VERSION are aligned to 0.1.4; registry 0.1.3 and consumer/starter pins remain unchanged. CI resolves candidate archive names from sdkVersion instead of a release literal. Current documentation additions include paired gamepad/source contracts, the two-player guide, English onboarding/concepts/Scene/UI/layout/npm/collision/platform/hosting guides, Japanese detailed API/Canvas controls/editing/scrolling/SDK patterns and corrections to stale publication/scope statements. Route pairing/navigation and complete documentation validation are still in progress.

## Resume checkpoint — documentation routes and release boundary

Resumed from `f8759c60d021da00032c44266f279f625a8b127b`, with main still at baseline `42302ff3210f8806db63bfe9ad72f376d6e8713d`. Independently inspected [run 41596829446](https://github.com/oz-coden/Simpludify/actions/runs/41596829446): all 20 validation jobs passed (quality, desktop/narrow browser shards, Windows/Linux packages/tooling/starter, six frozen Run To Exit candidate projects and both site bases); deploy was correctly skipped on the feature branch. No existing PR was open for the branch.

The remaining documentation audit found 17 prepared guides absent from the site manifest, an unlisted playable input lab, no corresponding-language navigation, and outdated English index claims that npm and sprite animation were unavailable. These routes/sample are now registered. Explicit guide pairs drive reciprocal language links and localized header/footer labels; existing public URLs are retained. Unpaired engineering records use a separate navigation section and fall back to the other language index. The static checker validates unique routes/sources and reciprocal guide destinations. Browser site smoke adds bidirectional gamepad-guide navigation and the input lab's gallery startup/mode switch/restart/cleanup. The Japanese input guide now describes the implemented adapter consistently. Current English setup and limits continue to distinguish registry 0.1.3 from source candidate 0.1.4.

No production input API was replaced or reimplemented. Local dependencies installed successfully with Node 24.22.1. Full static/unit/site/package checks on the completed navigation changes are pending at this checkpoint. Tag creation, GitHub release and npm publication have not been invoked; final publication approval remains required. Physical gamepads, vendor legends/driver behavior, Safari/Firefox, physical mobile keyboards and actual OS IME remain unverified.

## Documentation validation follow-up

Checkpoint `87a17933516752c0f4e2d92e580fed182c3269d0` is saved remotely and [PR #15](https://github.com/oz-coden/Simpludify/pull/15) is open. Git CLI push lacked credentials; the connected GitHub API saved the identical tree as a child of the known remote head, then advanced the branch with an expected-head lease. The local checkout was synchronized to that remote commit.

`npm run check` passed. The first site build registered 91 HTML documents and 7,934 links/assets; adding the previously unregistered English concepts snippet exposed a missing ComponentType import. Correcting that import made all 80 standalone documentation snippets pass. Both default-concurrency local unit attempts produced 841 passes and a 5-second accelerated Prism Raid round-test timeout. Running the unchanged suite with `npm test -- --maxWorkers=2` passed all 842 tests / 63 files; no assertion, test or timeout was changed.

Local `playwright install --with-deps` failed because the host cannot switch apt user/groups. Browser-only installation also failed repeatedly with truncated ZIP downloads. These are setup failures, not product/browser passes. CI installs standard pinned Chromium independently. A dedicated built-site unified-input acceptance script now checks all 28 language pairs, independent mocked pads, Actor-preserving program handoff, pause reset, Scene recreation and idempotent disposal at desktop/narrow sizes in WebGL/Canvas2D; it runs at both build bases and after Pages deployment. The sample exposes the same live diagnostics pattern as other official labs; no SDK API is added.

## Root-base and local-browser follow-up

The root-base check caught Vite treating `rel=alternate` guide URLs as imported HTML assets, producing duplicate documents under assets with invalid relative styles. Marking these metadata links with Vite's supported vite-ignore attribute preserves the intended guide URLs. Both `/` and `/Simpludify/` now build and pass static checks: 91 HTML documents, 7,934 links/assets and 80 typechecked code examples. The site theme fixture now locates the theme button by its stable data attribute so the English accessible label can be localized.

`npm run pack:packages` passed. The non-publishing `node scripts/publish-packages.mjs` check passed, confirming both target registry versions absent and archive metadata/integrity correct. Prepared Core integrity: `sha512-FH9JB/ufC1HLFTfiJCgOp3yidiPyBbJJ9KbnZbgAQh7OWHzW/0yWO2luVTvbE1wX0e8A4tu0ucOSrx8RiB3H3A==`; Web: `sha512-k8VLMh3YTGnpghH77OiktsJTqbFBWXCKLhoQrb9U/cGE8N2VJx2si1r9fi6/u2//NjVpB/Of+4MIIBR8QaqWLA==`. These are preparation evidence; the final main source and CI artifacts still need selection before publication.

A temporary npm-distributed Chromium 153.0.8010.0 binary is available without changing repository dependencies. Local site/acceptance checks are in progress on that alternative browser; standard Chromium 156 remains the CI target. The initial new acceptance assertion incorrectly read the captured Action frame immediately after pause; it now advances the required input boundary before checking the neutral frame. This fixture correction changes no engine reset semantics or timeouts.

## Built input lab acceptance checkpoint

The completed local built-site acceptance passed all four cases on temporary Chromium 153: widths 1440/390 × WebGL/Canvas2D. It verified the 28 reciprocal guide pairs over HTTP, two independent mocked pad values, same-Actor program handoff, neutral captured frames after pause, disposal of the replaced Scene's controllers, and final Engine/source/host cleanup. No uncaught page errors or root overflow were observed in these four sample cases. This is supplemental evidence; CI must still verify standard Chromium 156.

Canvas buttons' native keyboard mirrors intentionally sit beneath the pointer-owning canvas. New site fixtures initially attempted DOM pointer clicks on these mirrors and timed out. They now activate the native mirror with Enter, matching the existing Canvas site tests; actual pointer/touch behavior remains covered by the dedicated input/browser suites. Full site smoke on Chromium 153 is still running; no full-site browser pass is claimed yet.

## Responsive navigation correction

The broader supplemental site smoke reached the narrow documentation crawl and caught horizontal overflow in the localized English header. The mobile header now retains language/theme/menu controls, with page links available through the existing sidebar menu; the English menu label is shortened. Desktop navigation remains complete. The production project build, static link/pair checks and all 80 snippets pass with the correction. The incomplete earlier full site run is not counted as a browser pass. Final-head CI remains required before merge.

## Navigation timing and completed local site evidence

Local project-base full site smoke passed on Chromium 153: all 78 documentation pages and 13 playable examples at desktop/narrow viewports, both themes, input lab gallery mode switching, iframe restart/stop cleanup, focus return and no request/page errors. Targeted responsive checks passed at widths 320/390/760/1440. The final root-base build/static/snippet check and four-case input lab acceptance also passed when served with SITE_BASE=/.

At head `5ce776c`, PR CI completed both site bases successfully, but the parallel branch-push project's site check reported a transient `en/gamepads.html` narrow overflow immediately after the new round-trip language navigation. The fixture now explicitly waits for the navigation load (including stylesheets) after each language link before inspecting layout, retaining the same overflow assertion and deadlines. Full final-head CI is required; earlier failed/cancelled attempts are not final success evidence. The two public registry latest tags were independently checked and remain 0.1.3. No v0.1.4 tag exists and no publication was invoked.
