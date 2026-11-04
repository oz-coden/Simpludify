# Input bindings and single-input capture — v0.1.6

## Baseline and scope

- Baseline main: `b3e69dd3f2223431ac480fa1686182cbe7bca974`, the separate completed [v0.1.5 publication record](2026-11-04-v0.1.5-publication.md). Immutable release source/tag is `ed3ccc65d7b4c5689dfc14a96ee0bf8e12ecfad3` / `v0.1.5`; Core/Web are published and clean registry consumers passed before this implementation begins. [Publishing CI 41842910464](https://github.com/oz-coden/Simpludify/actions/runs/41842910464) succeeded.
- Work branch: `feat/input-bindings-v0.1.6`. Source manifests/lock/ENGINE_VERSION/package READMEs are prepared as 0.1.6. Public registry and independent starter pins are not upgraded by the candidate version change.
- Scope: keyboard/mouse bindings, controller-managed gamepad settings, one physical key/mouse/gamepad button capture, runtime configuration, save/restore, sample, paired documentation and distribution/regression verification. No npm publication/tag/Release for 0.1.6.
- Excluded: chords, sequences, double taps/hold pattern recognition, Action priority/exclusion, game modes, a standard settings widget, input DSL or replacement Controller architecture. Existing virtual-button hold behavior is unchanged.

## Existing structure reviewed

Core ActionController already owns validated ActionBinding data and get/rebind/add/remove/reset/conflicts/export/import. KeyboardSource is a typed physical contribution; ActionSource is the logical composition path. Button OR and clamped/normalized axis addition, short taps, frozen frames, reset/gating and Scene lifetime are implemented. Binding conflicts are diagnostic rather than prohibitions. Existing persisted data is version 1 and imports validate all entries before applying any change.

Web BrowserInput respects focus, native editing, UI-consumed keys, IME and autorepeat. GamepadInput samples once per Engine boundary and publishes separate device facts; controller-owned GamepadSource has explicit player/device assignment, source gating, mapping/dead-zone policy and neutral rearming. Its binding specification/validation is pure data although currently in Web. BrowserPointer and Core PointerRouting remain the only pointer ownership/capture boundary. Canvas UI precedes virtual controls, which precede world; captured ownership stays fixed until release/cancel.

Reviewed files include README/API/architecture/Action/gamepad/virtual contracts, interaction/actions/action-bindings/input/input-source/pointer-routing, Web input/pointer/gamepads/gamepad-bindings/Game, existing unit/browser/package fixtures and site validation.

## Planned implementation and compatibility

1. Add portable standard MouseButton data and MouseSource to Core. Extend existing ButtonBinding with mouse buttons and digital axis direction bindings with mouseNegative/mousePositive; retain existing keyboard arrays/presets and all controller configuration methods. Per-controller mouseEnabled is separate from keyboardEnabled. Preserve legacy keyboard-only JSON shape when new fields are absent.
2. Move the existing pure gamepad binding data/checker to Core, retaining Web re-exports and existing explicit GamepadSource bindings. Add optional root-level gamepad data to ActionBinding. Omitting GamepadOptions.bindings opts a source into the controller's common settings; explicitly supplied bindings preserve existing independent-source behavior. Device index/mapping/dead-zone assignment remains explicit on the existing source. Rebinding one managed Action must not release another held Action.
3. Preserve conflicts()'s legacy keyboard result; optional device/all diagnostics cover added settings without rejecting duplicates. Keep version 1 import/export and document the additive optional mouse/gamepad fields: old keyboard configurations remain readable, while older SDKs reject extended fields instead of silently discarding them. Reuse checked binding/edit paths for atomic import and copied/frozen defaults. Keep per-device polling outside the Controller.
4. Feed mouse buttons through the existing BrowserPointer/PointerRouting world-owned gesture and physical source; observe buttons on move as well as down/up, because additional pressed mouse buttons do not emit overlapping Pointer Events downs/ups. Canvas UI and virtual ownership suppress their own mouse gameplay contribution. World pointer events keep their current delivery and ownership. Auxiliary defaults are prevented only for an accepted game binding/capture.
5. Add Game.captureInput() returning an owned InputCapture session with state/result/cancel. CapturedInput identifies keyboard code, mouse button or gamepad index/id/mapping/button and contains a ready-to-use Button ActionBinding. Escape/modifiers are ordinary assignable keys; cancellation is explicit. Capture starts arming from held inputs and ignores the initiating pointer/key; it listens after neutral state and accepts a fresh single input. Analog-axis capture is deferred to avoid drift/threshold complexity; existing manual axes remain available.
6. Web owns raw capture listeners. A small internal InputSystem live-input gate flushes only physical contributions/queued physical transitions and resets device adapters, preserving explicitly supplied program sources. Capture suppresses gameplay keyboard/mouse/gamepad/virtual input, releases existing pointer ownership, and blocks the captured hold until release/neutral before gameplay resumes. It uses GamepadInput's existing sampled snapshot through an internal host observer, never a second navigator poll. Blur/outside/editor focus, hidden document, pause/reset/Replay, Scene/owner/Game disposal cancel safely. One active capture per Game/InputSystem; session cleanup removes ownership callbacks and Game disposal removes listeners.

These are design targets, not claims of implemented behavior. Names may be refined while preserving the stated compatibility and scope.

## Verification plan and risks

- Core/unit: all Action kinds, keyboard/mouse and managed/explicit gamepad settings, OR/multiple Actions, add/remove/reset, copied defaults, malformed/atomic persistence, held rebind and source/lifetime/reset/Replay behavior.
- Browser: real key/pointer/button-mask events, all five standard mouse buttons, Canvas/world/virtual arbitration, simultaneous buttons, capture opener exclusion and modifier/Escape capture, repeats, blur/editing/Scene/pause cancellation, neutral rearming, device composition, both renderers/viewports and final resource counts.
- Consumers: genuine external candidate archives, Core without DOM/Node ambient dependencies, strict public types and runnable rebinding/capture/save examples; normal full CI and both site bases. Registry 0.1.5 verification stays pinned separately.
- Material risks: pointer buttons use a different bit mask order than button indices; captured/opening held state must never leak into resumed gameplay; gamepad synchronization must preserve unchanged Action contributions; parser/serialization extensions must not reinterpret old fields; capture must not introduce Core host imports or another pointer owner.
- Physical devices, pen/vendor behavior, Safari/Firefox, hardware GPU and assistive technologies require separate real-device coverage. Local standard Chromium 156 download is unavailable; supplemental npm Chromium 153 may be used with results labelled, while CI retains its pinned standard browser.

## Checkpoint status

Investigation/design and source version preparation only. Feature implementation, feature tests, final documentation and integration are pending. No new feature test is claimed successful at this checkpoint. Release-only main documentation CI is [41845804834](https://github.com/oz-coden/Simpludify/actions/runs/41845804834); its result will be recorded independently.

Initial candidate `npm run check` passed (643 files; unchanged 16 warnings / 12 informational diagnostics; version 0.1.6 consistent; architecture and 116-dependency license checks passed). This is static baseline evidence, not feature acceptance. The plan/version checkpoint skips duplicate runtime CI; normal full feature CI remains required.

## Core/common settings checkpoint

The baseline plan/version is saved as `a38910ebfb5d91485a251b9bd3608b5cab674008`. Core now has MouseButton/MouseSource, optional mouse and root gamepad ActionBinding data, independent controller mouse gating, the existing version-1 persistence/edit/reset paths and optional device/all conflict diagnostics. Default conflicts() retains its old keyboard-only shape. Pure gamepad data/checking moved to Core with existing Web re-exports; only an explicitly provided invert field participates in incremental edits, preserving a prior inversion when another control is added.

Gamepad sources with omitted bindings follow the controller; explicit bindings remain independent. Changes are synchronized per Action, neutral rearming changed controls without releasing unchanged held Actions. Existing BrowserPointer observes world-owned mouse button masks (including chorded button changes); Canvas/virtual/scroll ownership is excluded. Mouse reset blocks held IDs until fresh input, and auxiliary defaults are scoped to accepted game bindings. PointerRouting retains sole ownership. The Host live-input gate and shared gamepad poll observer are present, but the capture session/DOM integration is not yet implemented.

Targeted existing Action/gamepad/virtual regressions passed 62/62. The expanded subset passes 78/78 across four files, including 16 new common-binding/mouse/gating cases. Two initial fixture assertions used exact floating-point equality and compared a raw preset with a normalized binding; component-wise numeric tolerance and the captured initial normalized default corrected those fixture expectations. No product assertion, retry or global timeout was relaxed. TypeScript passed after the Host mouse integration. Latest static validation passed 646 files with unchanged 16 warnings / 12 informational diagnostics; architecture, version 0.1.6 and 116-dependency license checks passed after fixing import ordering/spacing.

Release-only main `b3e69dd3f2223431ac480fa1686182cbe7bca974` [CI 41845804834](https://github.com/oz-coden/Simpludify/actions/runs/41845804834) completed all 20 validation jobs and Pages successfully, independently of this feature branch.

Pending: actual capture sessions/listeners, new browser/sample/consumer checks, complete regression/distribution verification, paired contracts and final integration. Capture will clear pending transition queues at its boundary while retaining explicit program values; previously frozen frames retain the existing next-input-boundary semantics.

## Capture/sample checkpoint

Common-binding implementation commit: `93fa522be0a760376c672a988f1bbe32267da380`, [CI 41850095568](https://github.com/oz-coden/Simpludify/actions/runs/41850095568). All quality, distribution (Linux/Windows), production, both site-base, six consumer and starter jobs succeeded. Browser shard 1 failed four cases per viewport because exact source-count assertions omitted the newly Game-owned mouse source (15→16, menu 1→2, repeated-play 3→4). The fixtures now count both host physical sources while retaining repeated-transition stability and terminal-zero checks; no runtime input assertion failed in that run.

Portable Core InputCapture now provides arming/listening/completed/cancelled state, selected devices/index, an owner-scoped result Promise and immutable physical facts plus a ready Button binding. Game.captureInput owns browser observation and Scene cancellation, shares the existing gamepad poll, waits for eligible held controls to become neutral, rejects an unfocused/inactive host, suppresses live gameplay and retains explicit program values. Captured holds remain blocked until release. Escape/modifiers are capturable; cancellation is explicit. No gamepad-axis capture was added; manual analog bindings remain available.

New input-bindings example uses existing DOM/Canvas controls, one Character/controller, common bindings, runtime capture/add, save/restore/reset and existing virtual controls. It introduces no settings widget. New browser cases cover five button masks/chording, UI/virtual ownership, keyboard/pad OR, runtime persistence, mouse/keyboard/pad capture, held opening gesture, modifiers/Escape and cancel/blur/pause/Scene/owner/final cleanup across both renderers/viewports. These browser cases are not yet run.

Capture/common targeted unit tests pass 29/29. The initial capture fixture used nonexistent KeyCode.KeyE rather than the existing KeyCode.E name; corrected without changing the finite key table. Type checking caught sample misuse of assign(index) and unsupported absolute CanvasStyle fields; the sample now uses existing assignment and flex layout APIs. Full checks, browser regressions, consumer extensions, bilingual docs and final integration remain pending.


## Browser checkpoint and host interruption

Capture/session/sample checkpoint: `a7ec93df73ece6f49f1f16d2420074e009171532`. The first local desktop browser run passed 4/8: two cases attempted a pointer click on the keyboard-only Canvas accessibility mirror, and two used an unresolved bare module specifier from page.evaluate. Fixtures now click actual Canvas bounds and pass the Core module URL from process.cwd(); no ownership implementation or assertions were weakened. The corrected local run passed 8/8, both WebGL and Canvas2D, using supplemental Chromium 153.

At 2026-11-05 00:10 JST the execution/browser environment became unavailable. This interrupted the next documentation checkpoint; draft documentation/consumer edits had not yet been pushed. No final local full-suite/consumer/site result is claimed. The saved GitHub branch remains the implementation baseline; corrected fixtures and subsequent documentation are being restored directly through repository APIs, with normal CI as the executable verification environment. A local static check before the interruption had passed 655 files with unchanged 16 warnings and 12 infos, architecture, SDK version and 116 dependency licenses; that result applies to the then-local candidate, not later remote edits.

Pending: restore paired documentation and extended package consumers, verify full CI, inspect failures, integrate only after successful validation, and record final main CI. No v0.1.6 publication is authorized or performed.


## Restored documentation checkpoint

Paired English/Japanese Binding guides, CLI/site sample registration and API/Action/gamepad/architecture entry points were restored after the host interruption. They specify device settings, neutral arming, ownership, cancellation, program-source behavior, version-1 compatibility and unverified real hardware. Public code samples are included in site snippet compilation. Extended package consumer restoration and final CI remain pending.


## Consumer restoration checkpoint

External candidate-archive validation now imports the public portable capture API without DOM/Node ambient types and exercises version-1 save/restore, actual keyboard/mouse input, keyboard+pad OR and capture-result rebinding in the installed Web consumer. Existing dev/production/subpath and 1280/390/320 viewport checks remain. Browser capture cleanup now also covers editing focus, explicit input reset and the Replay input lock. These restored checks await CI; the execution environment is still unavailable. Earlier six independent frozen consumer regressions remain unchanged.
