# Virtual sticks and generic pointer input — v0.1.5

## Baseline and scope

- Baseline main: `02ac22b487912e1403163c92dc35384f9cc44aed`; [CI 41629951815](https://github.com/oz-coden/Simpludify/actions/runs/41629951815) passed all 20 validation jobs plus Pages deployment. Registry Core/Web remain published 0.1.4.
- Work branch: `feat/virtual-input-v0.1.5`.
- Scope: fixed/floating/follow sticks, optional-direction virtual buttons, explicit activation regions, existing ActionSource composition, a two-stick sample, Japanese/English contracts and regression/distribution validation. No npm publication or release/tag creation.
- Initial inspection covered contributor instructions, README, architecture/API, Core PointerRouting/ScenePointer/ActionController/InputSystem, Canvas UI/value controls, Web BrowserPointer/Game/PixiRenderer and the site/SDK validation workflow. `npm ci` succeeded on Node 24.

## Design checkpoint

The existing PointerRouting remains the sole pointer-ID ownership boundary. Canvas UI picks first; a Scene-scoped virtual-input provider supplies virtual buttons before sticks; unmatched gestures retain world routing. Captured ownership never changes when activation regions are crossed. Occupied controls suppress additional pointers rather than falling through to another receiver. Existing scroller/control arbitration remains local to Canvas UI.

Core owns portable activation geometry, gesture state, dead zones, radial normalization, elapsed hold time and ordinary controller-owned ActionSources. Web supplies the current host CSS-pixel viewport, browser Pointer Capture and Pixi presentation. Virtual controls do not create gameplay Controllers, Actors, device detection or game-specific abilities. Visibility and input enablement are independent.

Built-in viewport-relative/screen-space rectangles and circles receive exact overlap checks within each same-priority control group. Custom predicates declare conservative screen-space bounds; intersecting bounds are rejected as ambiguous even if predicates might be disjoint. Canvas UI and virtual-button overrides of broad stick areas are intentional priority rules. Geometry changes are validated before commit and cancel active gestures so resized layouts cannot retain stale axes.

Input reset, pause/replay transitions, blur, pointer cancellation, controller/Scene disposal and explicit disable release the affected source and cancel the captured gesture. Long holds use an explicitly advanced presentation clock; release confirmation contains the final optional direction while the source itself becomes neutral.

Implementation and all feature-specific checks are pending at this checkpoint. Physical hardware, vendor/driver behavior, physical mobile browsers/IME and non-Chromium support must not be inferred from synthetic pointers or emulated viewports.

## Implementation checkpoint 1

Core VirtualInput/VirtualStick/VirtualButton, activation geometry and the existing PointerRouting target port are implemented. The Web Game lazily owns one provider per Scene; Pixi paints the controls beneath Canvas UI with no extra event adapter. Pointer Capture, virtual-only focus interruption, model visibility/enablement, relative viewport updates and cleanup reuse existing lifetime/input boundaries. Source manifests/lock/ENGINE_VERSION are prepared as 0.1.5; public registry/starter pins remain unchanged.

The new unit suite passes 18 tests; targeted Action/pointer regressions pass 42 tests across three files. Initial fixtures incorrectly omitted the Canvas layout measurement callback and used KeyCode.KeyD rather than KeyCode.D; correcting those fixture calls produced the pass. TypeScript passed after implementation/sample corrections. An existing architecture validation pass is recorded when complete below. Four browser behaviors for both WebGL/Canvas2D and both standard viewports are added but not yet executed. Standard Playwright Chromium download failed with truncated ZIP data; a supplemental npm-distributed Chromium is being prepared.

The sample includes separate movement/aim sticks, a central 12% gap, a directionless hold button and directional release button, ordinary Canvas UI precedence, all stick modes, explicit visibility/enablement, program handoff, pause and Scene restart. Browser acceptance, comprehensive units, packaging, bilingual documentation and full CI remain pending.

Core boundary validation initially rejected the interaction module importing the runtime graphics coordinate factory. The portable control now constructs its validated screen-point data locally and imports only coordinate types; architecture and required-file validation pass without relaxing the dependency policy.

## Documentation and browser acceptance checkpoint

Implementation checkpoint `372c2f62d4ca4b20d53f9a6bc1ad0ee51e9a1ce7` is saved remotely. Full local static validation passed. Full units passed 860/860 before the additional Replay fixture; the expanded virtual/pointer/gamepad subset passes 48 tests / 3 files, including 19 virtual-input cases. The Replay fixture initially used different random default seeds; assigning its explicit fixture seed made the recorded-input check pass.

Supplemental Chromium 153 passed all 16 new browser cases: four behaviors × WebGL/Canvas2D × desktop/narrow. They exercised actual CDP finger crossing, third-pointer button coexistence, all mouse modes, hidden-but-enabled input, disable/rearm, Actor-preserving program handoff, Canvas precedence, center gap, real capture release, blur, outside focus, resize and Scene disposal. Initial browser failures were fixture issues: CDP partial touchEnd lists the fingers being released rather than the survivors; lostpointercapture is delivered when the browser processes the next pointer event. The corrected tests preserve the same assertions/deadlines and assert surviving stick identity. No product test, retry or global timeout was relaxed. The old checkpoint CI is not final-head evidence.

Japanese/English virtual-input contracts and a paired site route are added; the playable sample is registered. Current README/API/architecture/Action documentation distinguishes 0.1.5 candidates from registry 0.1.4. Project-base site build/check passed 94 HTML documents, 8,304 references and 82 standalone TypeScript examples. Root-base/browser site verification is pending.

Distribution fixtures now import and execute the virtual API from real external Core/Web tarballs, including strict NodeNext Core execution and Web lifetime cleanup. A new browser case checks actual virtual-control pixels, hiding independently of input, and repeated independent provider/presentation disposal. These latest cases, complete package checks and final-head CI remain pending at this checkpoint.

## Distribution and lifecycle review checkpoint

Checkpoint `add053021cbe013fb2eab40489b325854472f836` preserves the paired docs and corrected pointer fixtures. The complete unit suite now passes 861/861. External package verification passes all archive/export/integrity, NodeNext Core, exact transitive Web, strict declarations, Vite subpath and development/production browser groups using the candidate tarballs. Both site bases pass static checks and all 82 snippets; the latest project-base build has 94 HTML documents and 8,305 references.

The added actual-pixel/visibility/independent-provider lifecycle cases pass 4/4 across both renderers/viewports. A follow-up focused run of those and capture/focus/resize/Scene cases passes 8/8 after the final provider cleanup changes. Provider presentations are owned by the provider lifetime, avoiding retained Scene cleanup closures across explicit provider recreation. Virtual buttons paint above sticks regardless of creation order, consistent with input arbitration. No runtime dependency was added.

The sample now exposes the same live diagnostics/HMR cleanup pattern as existing official labs. Gallery smoke explicitly switches its mode and visibility and verifies iframe stop/restart resource cleanup. A built/published-site acceptance script exercises actual CDP crossing, third-pointer release, neutral cancellation, Actor-preserving program handoff and Scene/final cleanup in four renderer/viewport combinations; it is included in both site-base jobs and post-Pages acceptance. Execution of this latest built-site script and final-head CI are pending. No npm release/tag/publication workflow has run.
