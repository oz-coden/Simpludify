# Implementation status

Simpludify has an experimental Web runtime and a generic composition-based Core. The long-term specification contains additional targets; they are not all implemented.

## Included

- Generic numeric Tween, Scene simulation/display clocks, lifetime/channel ownership, sequence/parallel, Actor draw and Canvas/Slider adapters; [contracts and limitations](tween.md).

- [Portable scroll input](scrolling.md): touch/mouse content arbitration, per-node momentum, overlay scrollbar controls, nested/multipointer ownership, keyboard commands and cached projection; [measurements](scroll-performance.md).

- Host-independent Core Canvas UI tree/Flex/text policy/pointer routing, dynamic ordering, clipped scrolling and logical focus; Web supplies Pixi/metrics/native focus adapters. [Module and Host boundaries](host-boundary.md), [Canvas API](canvas-ui.md) and [portable screen](../examples/canvas-ui/portable-screen.ts).

- Finite Tilemap placements from copied Grid/rows, typed SpriteSheet IDs, camera culling and incremental edits; [API](tilemap.md), [measurements](tilemap-performance.md), and [optional terrain collision](tilemap-collision.md).

- SpriteSheet grid/named/rectangle frames, shared cropped image textures and Actor-owned SpriteAnimation with simulation-time playback; [contracts and sample](sprites.md).

- Independent fixed-size dense Grid with strict coordinates, shared/factory initialization and full/rectangle traversal; [contracts and data-only example](grid.md).
- DOM-free Engine stepping, frozen frame input, managed seeded randomness and generic snapshots.
- Synchronous Scene states, exclusive ownership, lifecycle hooks and aggregate cleanup.
- Dynamic Actors/Components with deterministic membership and update rules, dependency diagnostics and enable flags.
- Transform, Renderable (live validated dimensions/color and explicit Box/Circle/Character/Triangle/image sources), live validated Motion speed/direction, optional scaled ActionMovement and the Character composition preset. Input/Update commands precede Integrate and LateUpdate.
- Optional typed local/external events with owner-scoped subscriptions and simulation timers.
- Single Camera/Viewport, logical resolution, pure World/Screen transforms, pointer/DPR handling and optional bounded CameraFollow.
- Pixi shape/image rendering, dynamic component reconciliation, pending-image cancellation and resource diagnostics.
- Queued/coalesced asynchronous Web scene readiness with before-commit recovery and prompt disposal cancellation.
- DOM labels/buttons/panels, two themes, responsive Flexbox/Grid and independent world aspect policies.
- Scene-owned circle/oriented-box Trigger/Solid contacts, filtering, deterministic events/queries, and bounded inverse-mass position correction through CollisionBody.
- Typed KeyCode and Scene-owned Button/Axis1D/Axis2D/Axis3D Actions with logical device sources, ordered short-press events, runtime bindings/conflicts/JSON configuration; independent input sources, pause/resume, live depth/opacity/visibility, aspect-preserving images and keyboard/touch hold controls.
- Character, UI/scenes, headless, Beacon field the complete Signal Run collection/survival game, and Blockfall falling-block puzzle with deterministic grid logic, hold/ghost and keyboard/touch controls; Prism Raid adds Triangle ships, Trigger combat and input-only automatic play.
- Noninteractive source scaffold/dev/check/test/build/doctor, JSON diagnostics, unit/browser/production-subpath tests, baseline scripts and automatic licensing notices.

- Japanese-first static documentation, English technical reference, isolated playable ten-sample gallery, integrated root/project-base builds and Pages workflow. See site-validation for deployment evidence.

## Pending and limits

Windows/Electron packaging and Windows executable smoke tests are pending. There is no portable executable guarantee or cross-language SDK. Public npm publication, compiled SDK packages and automated vendored-engine upgrades are deferred.

No impulse/angular rigid-body simulation or continuous collision detection, multiple cameras/viewports, infinite maps, audio, save-game format, networking, generic ECS, asset manifest/font manager or visual editor is implemented. Actors/components are destroyed on removal; reusable pooling and scene reactivation are not implicit features. Dynamic images load asynchronously and can fail independently of logical Actors.

Generic control-right management was reviewed and is not being introduced. Grid does not acquire control handles for stored values, and no control-right API is being added to existing Components. NDArray and sparse/infinite/chunked grids are outside the fixed 2D Grid scope.

Viewport tests cover the supplied examples on Chromium, not arbitrary user layouts or every browser. WebGL context recovery, controlled hardware testing, native/GPU retained-memory instrumentation and multi-hour real-time soak coverage remain open. The Solid response measurements add a bounded five-minute real-time production run and separate simulation/draw CPU proxies. Production Signal Run measurements, forced-GC heap/DOM samples and accelerated simulation/disposal workloads are reproducible with bench:practical. Existing measurements are local observations, not superiority claims.

## Next milestones

1. Extend the measured disposal cycles into a real-time soak with dynamic images, native/GPU memory tracking and controlled hardware; profile the known continuous resize/font workload.
2. Add further game capabilities only when a concrete example requires them (such as audio), keeping collision response/fast-object detection explicit and preserving ownership/update order.
3. Build a secure Windows host in a separate platform-electron package. Reuse the Web renderer loop without per-frame IPC, loading bundled local output only. Disable nodeIntegration, enable contextIsolation and sandbox, apply a restrictive CSP and deny unexpected navigation/windows/permissions. Add a narrow preload API only for an actual feature.
4. Review Electron/electron-builder/Chromium/Node licenses and support before enabling build --target windows. In Windows CI launch the built portable artifact, verify a rendered frame, movement/navigation, offline behavior, process cleanup and temporary/extracted files. Report compressed and installed/extracted sizes separately before documenting verified OS/portable support.

Before comparative performance claims, implement equivalent Godot/Phaser workloads on controlled hardware and preserve all versions and raw results.

## Controlled execution

Implemented: standalone RandomManager, cached named streams, actual automatic seeds, opt-in JSON Action Replay from a fresh Engine/one Scene, auxiliary observations, and optional bounded fixed stepping. Deferred: seek/rewind, arbitrary state restoration, cross-Scene replay, compression, render interpolation and network determinism. See [contracts and validation](replay.md).

[Live rendering](rendering.md) preserves Component identity and separates pending image requests from owned display resources. Renderer-local image sharing now coalesces pending loads and holds independently cancellable consumer leases across Visuals and overlapping Scenes. URL sources remain the public reference; TextureRef/Material, idle retention, preloading remain deferred.


## Optional Tilemap collision

The finite Tilemap now supports copied ID policies, sparse cell overrides and dedicated TileContactEnter/Stay/Exit through the existing CollisionWorld. Actor Contact stays unchanged. Local candidate queries, equal-policy exposed-feature response and one shared iteration budget are implemented. See [API and limits](tilemap-collision.md). CCD, rigid-body response, streaming, slopes and general deep-embedding recovery remain outside scope.

## Canvas UI and Pointer input

Implemented: Scene-owned Web Canvas nodes, Pixi screen presentation, dirty Flex with min/max freeze/reallocation and width-aware grapheme-safe text wrapping, fixed-owner multi-pointer routing, existing ActionSource integration, native keyboard button mirrors, and Canvas trail integration. Existing DOM UI and Core Action contracts remain. See [API and scope](canvas-ui.md), [validation](canvas-ui-implementation.md) and [measurements](canvas-ui-performance.md). Full CSS layout, text editing/document semantics, gamepad adapters, OS/device accessibility verification and hardware GPU profiling remain separate work.

## Deferred Scene API proposals

Consider a clearer `changeScene` name for factory-based navigation, directly constructed dynamic Scenes for generated levels, and suspend/resume or concurrent Scenes for modal menus and overlays that must preserve simulation state. These require explicit ownership/readiness/input contracts and are not part of Canvas UI integration. Large lists may eventually justify UI virtualization after game workloads establish the need; current layout and hit testing still visit visible model nodes.

- Standard Canvas Checkbox and horizontal Slider provide typed values/events, read-only state and shared pointer/keyboard/focus/lifetime behavior; Canvas trail Settings lab uses Core-only definitions. [Control contracts](canvas-controls.md).
- Canvas Select/TextInput/NumberInput provide typed selection, accepted values versus text drafts, generation-checked native Host editing, finite numeric validation and shared focus/lifetime. [Native editing contracts](text-input-design.md) distinguish automated browser/synthetic composition tests from unverified real OS Japanese IME and physical mobile keyboards.
