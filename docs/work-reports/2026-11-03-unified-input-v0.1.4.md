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
