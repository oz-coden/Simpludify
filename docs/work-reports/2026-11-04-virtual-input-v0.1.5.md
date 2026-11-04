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
