# Implementation status

English | [日本語](../roadmap.html)

Simpludify is an experimental, code-first, 2D-focused TypeScript engine. This document separates shipped capabilities, intended future work, and explicit non-goals. Priorities express product direction, not committed release dates or final API names. Concrete APIs, performance budgets, migration behavior, and target support must be validated in dedicated designs and sample games before implementation.

## Product direction and planning rules

- Prioritize code-first game creation: application code defines gameplay and UI; the engine manages input, presentation, lifecycle, and host-specific details. Avoid requiring a visual editor, handwritten HTML, or platform-specific code for standard use cases.
- Keep **Core host-independent** and retain the Core/Web separation. Platform-specific audio, rendering, file I/O, networking, and packaging must have explicit adapters and resource ownership. Avoid unnecessary per-frame cross-process work.
- Extend existing Action, Scene, Actor/Component, Canvas UI, Tilemap, and CollisionWorld contracts instead of introducing parallel frameworks or breaking them without migration plans.
- Prefer stable, small building blocks with sensible defaults and documented escape hatches. Large subsystems must be driven by runnable example games, tests, and measured constraints.
- Ship optional capabilities as independent modules where doing so keeps the default runtime lightweight. Do not make networking, heavyweight physics, or desktop/mobile hosts mandatory dependencies.
- Each milestone needs API documentation, lifecycle/error handling, representative headless/browser acceptance tests, cleanup tests, and realistic limitations. Experimental support is not a verified platform guarantee.

## Forward roadmap

Priority labels reflect importance, not necessarily development order. Work in the same tier can be delivered incrementally; dependencies and actual game requirements decide sequencing.

| Priority          | Area                                            | Planned outcomes                                                                                                                                             | Key design/verification questions                                                                                                     |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| High              | **Audio**                                       | BGM and sound effects, playback control, volume/mute, categories or buses, looping and fades                                                                 | Unlock/autoplay policies, host adapter, scene/actor ownership, simultaneous voices and cleanup                                        |
| High              | **Save and Load**                               | Explicit game-state serialization and restoration, versioned application data and safe failure/migration paths                                               | Keep this distinct from input Replay and generic Engine snapshots; make storage backend optional                                      |
| High              | **Assets**                                      | Shared image/audio/font loading, preloading, manifests or typed references, progress/error reporting and caching                                             | Resource leases, overlapping scenes, cancellation, eviction and safe URLs; build on existing renderer image sharing                   |
| High              | **Scene lifecycle and composition**             | Preserve and resume existing scenes; support overlays/modal scenes and controlled transition policies                                                        | Input focus, pause/update/render policy, async readiness, scene ownership, suspension and failure rollback                            |
| High              | **Canvas UI components**                        | Reusable modal dialogs, confirmation/alert flows, overlays, focus trapping/restoration and composable settings/menu patterns                                 | Canvas/native focus and accessibility, pointer ownership, cancellation, stacking and nested dialogs                                   |
| High              | **Particles and effects**                       | Lightweight particle emitters and common visual effects with explicit lifetime/performance controls                                                          | Efficient batching/pooling, scene cleanup, renderer independence and deterministic-vs-visual timing                                   |
| High              | **Camera system**                               | Camera shake, transitions, bounds/follow improvements, and eventually multi-camera/multi-viewport where supported by use cases                               | Projection/pointer conversion, UI anchoring, resize/DPR and simultaneous views                                                        |
| High / staged     | **Networking**                                  | Optional transport abstraction and session/message facilities first; add synchronization patterns only after concrete multiplayer games validate them        | Server/P2P separation, authority, security, bandwidth, ordering, reconnects and deterministic limitations; no hosted service implied  |
| Medium            | **Advanced state machines**                     | Typed, reusable hierarchical states/transitions, guards, actions, and lifecycle hooks for gameplay and AI                                                    | Integration with Scene/Component lifetime, timed/async transitions and testability; do not impose on simple games                     |
| Medium / research | **Physics extension**                           | Keep existing lightweight Trigger/Solid position correction; evaluate external 2D rigid-body libraries for gravity, forces, joints, friction and restitution | Optional adapter rather than mandatory rewrite; coordinate/scale conversion, ownership, collision events, fast-body CCD and licensing |
| Deferred          | **Input configuration UI and complex bindings** | Eventually offer reusable rebind screens, key chords, sequences and advanced capture                                                                         | Defer until existing binding/capture semantics, conflict policy, and UI interaction are mature; avoid premature parallel abstractions |
| Deferred          | **Desktop and mobile targets**                  | Electron and Tauri adapters/packaging; investigate Android/iOS alongside host expansion                                                                      | Secure sandboxing, offline bundles, signed builds, device/input/IME testing, startup/memory and distribution rules                    |
| Evaluate later    | **Virtualized UI lists**                        | Add virtualization only if large-list workloads justify it                                                                                                   | Focus, scroll state, stable identity and accessibility contracts                                                                      |

### High-priority workstreams

#### Audio and asset infrastructure

- Start with a minimal audio API usable without direct Web Audio calls from game code; expose playback handles, master/category volume, mute and a small set of standard controls. Keep browser autoplay and other host limitations explicit.
- Add asset preloading and loading-state/error handling incrementally, integrating already implemented async image leases rather than replacing them blindly. Treat font readiness and audio decoding as separate host concerns.
- Decide which resources are application-wide versus Scene-owned. Verify cancellation, overlapping Scene lifetimes, repeated loads, failures and disposal. Avoid unbounded implicit caching.

#### Persistent game state

- Provide a game-defined, versioned save payload and explicit restore entry point. Do not claim universal Component serialization or arbitrary mid-step state restoration.
- Separate logical state encoding from browser/desktop/mobile persistence providers. Include schema validation, corrupted-data behavior, migrations and atomicity expectations.
- Keep input Replay focused on reproducibility from a compatible initial game; do not market it as Save/Load. Prove save/reload with a game featuring multiple Scenes and changed assets/settings.

#### Retained Scenes, overlays and modal UI

- Define lifecycle states for inactive-but-retained Scenes, including suspended/resumed updates and timers, background rendering and eventual disposal. Preserve the existing destructive navigation path for callers that want it.
- Specify stacking/composition, topmost input ownership, Gamepad/keyboard routing, world pointers, screen-space UI, and scene-local resources. Provide deterministic behavior for focus and for failed asynchronous transitions.
- Build modal/dialog components on the Canvas UI primitives; support confirm/cancel results, keyboard and controller interaction, focus restoration and nested overlays. Prefer one consistent overlay model over an unrelated DOM-only modal system.
- Treat the API names in this roadmap as proposals, not implemented exports; verify sample-game usage before freezing them.

#### Particles, camera and gameplay control

- Start particles with common presets/configurable emitters, per-emitter budgets and lifecycle-scoped cleanup; keep simulation-heavy particle interactions distinct from cheap visual effects.
- Expand camera follow, shake and transitions before introducing simultaneous viewports; test World/Screen conversions and each viewport's UI/input boundary.
- Explore an optional hierarchical state-machine module for actors, enemies, menus and staged encounters. Support explicit transition guards and cleanup, and demonstrate it in an actual enemy/wave sample.

#### Networking as an optional capability

- Stage 1: explicit transport/session interfaces, typed messages and disconnection/error handling; leave application-defined server infrastructure outside the engine.
- Stage 2: test real multiplayer use cases to choose state replication, RPC/events, authority and interpolation strategies rather than assuming one universal synchronization model.
- Stage 3: consider prediction/rollback only with evidence that simulation determinism, replay compatibility and networking constraints permit it. Do not assume existing fixed-step and Replay capabilities guarantee lockstep or rollback safety.
- Document security boundaries, user-controlled identifiers and host requirements. Core must remain usable completely offline.

### Platform and physics expansion

- **Physics:** retain current lightweight Collider/CollisionWorld for simple games. Evaluate a separately installable external rigid-body implementation only when a game needs rich forces/joints/CCD. Avoid silently mixing two solvers or giving contradictory contact ownership; define interoperability and migration before selecting a library.
- **Electron/Tauri:** investigate both rather than committing exclusively to Electron. Keep bundled Web game code portable, use minimal native bridges, deny unnecessary permissions, enforce safe content policies, and verify clean process shutdown. Benchmark bundle size, runtime memory and startup under comparable conditions.
- **Mobile:** investigate Android and iOS with the corresponding host/packaging work, including touch, soft keyboards/IME, lifecycle suspension, orientation, performance and store constraints. A working Web build alone does not certify native mobile support.
- New renderer/host implementations should reuse Core definitions. Platform-specific modules may be released independently from the core engine.

### Deferred, optional and out of scope

- **Visual GUI editor:** not an active roadmap item. Reconsider only after substantial future major/minor evolution and demonstrated demand (potentially ten or more such releases away); this is not a scheduled version promise. Code-first authoring remains the default.
- **Built-in 3D:** not planned. The engine remains 2D-focused; independent community modules may experiment with 3D without making it a core commitment.
- **Advanced key configuration:** key chords, sequences, standard rebind UI and richer capture are intentionally postponed while binding semantics mature. Existing v0.1.6 physical bindings, single-input capture and JSON configuration remain supported.
- **Virtualization:** keep as a performance-driven design candidate, not an automatic UI dependency.
- **Full CSS/DOM parity, mandatory generic ECS rewrite, custom GPU renderer, cross-language SDK, and universal multiplayer stack:** not required for the current product direction.

### Milestone selection and acceptance

1. Select a small vertical slice with a concrete game use case, maintain existing APIs by default, and document lifecycle and failure semantics before implementation.
2. Implement Core contracts independently of Host services; expose optional platform adapters where necessary.
3. Validate a complete gameplay scenario, not only isolated API tests. Include browser tests, headless tests where appropriate, disposal/reentry and errors.
4. Record benchmark environment and limitations; add a release checklist for supported browsers/devices/targets.
5. Update this roadmap from evidence. Do not mark a planned capability shipped until both implementation and suitable validation exist.

## Included

- v0.1.6 [physical bindings and single-input capture](./specs/input-bindings.md): common keyboard/mouse/gamepad settings, runtime edits and version-1 persistence, per-device diagnostics, neutral capture and existing input ownership/composition. Core/Web v0.1.6 are published on npm; see the [release record](work-reports/2026-11-05-v0.1.6-publication.md).

- [Virtual sticks and pointer controls](./specs/virtual-input.md): fixed/floating/follow Axis2D sticks, optional-direction Button controls, explicit activation regions, fixed pointer-ID ownership and existing ActionSource composition; independent visibility/enablement and WebGL/Canvas2D presentation. Physical-device and non-Chromium verification remain outside automated coverage.

- Generic numeric Tween, Scene simulation/display clocks, lifetime/channel ownership, sequence/parallel, Actor draw and Canvas/Slider adapters; [contracts and limitations](./specs/tween.md).

- [Portable scroll input](./specs/scrolling.md): touch/mouse content arbitration, per-node momentum, overlay scrollbar controls, nested/multipointer ownership, keyboard commands and cached projection; [measurements](./benchmarks/scroll-performance.md).

- Host-independent Core Canvas UI tree/Flex/text policy/pointer routing, dynamic ordering, clipped scrolling and logical focus; Web supplies Pixi/metrics/native focus adapters. [Module and Host boundaries](host-boundary.md), [Canvas API](./specs/canvas-ui.md) and [portable screen](../examples/canvas-ui/portable-screen.ts).

- Finite Tilemap placements from copied Grid/rows, typed SpriteSheet IDs, camera culling and incremental edits; [API](./specs/tilemap.md), [measurements](./benchmarks/tilemap-performance.md), and [optional terrain collision](./specs/tilemap-collision.md).

- SpriteSheet grid/named/rectangle frames, shared cropped image textures and Actor-owned SpriteAnimation with simulation-time playback; [contracts and sample](./specs/sprites.md).

- Independent fixed-size dense Grid with strict coordinates, shared/factory initialization and full/rectangle traversal; [contracts and data-only example](./specs/grid.md).
- DOM-free Engine stepping, frozen frame input, managed seeded randomness and generic snapshots.
- Synchronous Scene states, exclusive ownership, lifecycle hooks and aggregate cleanup.
- Dynamic Actors/Components with deterministic membership and update rules, dependency diagnostics and enable flags.
- Transform, Renderable (live validated dimensions/color and explicit Box/Circle/Character/Triangle/Hexagon/image sources), live validated Motion speed/direction, optional scaled ActionMovement and the Character composition preset. Input/Update commands precede Integrate and LateUpdate.
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

Windows/Electron packaging and Windows executable smoke tests are pending. There is no portable executable guarantee or cross-language SDK. Compiled ESM/type SDK packages and external tarball validation are implemented; Core/Web v0.1.6 are published on npm. Automated vendored-engine upgrades remain pending. See [npm distribution and publishing](./specs/npm-publishing.md).

No impulse/angular rigid-body simulation or continuous collision detection, multiple cameras/viewports, infinite maps, audio, save-game format, networking, generic ECS, asset manifest/font manager or visual editor is implemented. Actors/components are destroyed on removal; reusable pooling and scene reactivation are not implicit features. Dynamic images load asynchronously and can fail independently of logical Actors.

Generic control-right management was reviewed and is not being introduced. Grid does not acquire control handles for stored values, and no control-right API is being added to existing Components. NDArray and sparse/infinite/chunked grids are outside the fixed 2D Grid scope.

Viewport tests cover the supplied examples on Chromium, not arbitrary user layouts or every browser. WebGL context recovery, controlled hardware testing, native/GPU retained-memory instrumentation and multi-hour real-time soak coverage remain open. The Solid response measurements add a bounded five-minute real-time production run and separate simulation/draw CPU proxies. Production Signal Run measurements, forced-GC heap/DOM samples and accelerated simulation/disposal workloads are reproducible with bench:practical. Existing measurements are local observations, not superiority claims.

## Near-term engineering and quality gates

Product priorities appear in the forward roadmap above. Independent engineering work remains necessary throughout feature delivery:

1. Extend measured disposal cycles into a real-time soak with dynamic images, native/GPU memory tracking and controlled hardware; profile the known continuous resize/font workload.
2. Validate device and browser behavior beyond synthetic Chromium fixtures, including focus/IME, touch, gamepad reconnects, context loss and restoration.
3. Exercise newly introduced modules under Scene replacement, cancellation, asset failure, pause/resume, repeated mount/dispose and external npm consumer builds.
4. Plan secure desktop packaging and Windows executable smoke tests when the platform workstream begins. For Electron, disable Node integration in content, enable isolation/sandbox, restrict navigation and permissions, and minimize preload capabilities. Evaluate Tauri's distinct security model separately.
5. Review packaging licenses, startup time, runtime/installed size, offline operation and process cleanup before claiming any new platform as supported.

Before comparative performance claims, implement equivalent Godot/Phaser workloads on controlled hardware and preserve versions and raw results.

## Controlled execution

Implemented: standalone RandomManager, cached named streams, actual automatic seeds, opt-in JSON Action Replay from a fresh Engine/one Scene, auxiliary observations, and optional bounded fixed stepping. Deferred: seek/rewind, arbitrary state restoration, cross-Scene replay, compression, render interpolation and network determinism. See [contracts and validation](./specs/replay.md).

[Live rendering](./specs/rendering.md) preserves Component identity and separates pending image requests from owned display resources. Renderer-local image sharing now coalesces pending loads and holds independently cancellable consumer leases across Visuals and overlapping Scenes. URL sources remain the public reference; TextureRef/Material, idle retention, preloading remain deferred.


## Optional Tilemap collision

The finite Tilemap now supports copied ID policies, sparse cell overrides and dedicated TileContactEnter/Stay/Exit through the existing CollisionWorld. Actor Contact stays unchanged. Local candidate queries, optional lazy 16×16 chunk rectangle candidate search, equal-policy exposed-feature response and one shared iteration budget are implemented. Cell events retain their identity across chunk rebuilds. `tileBounds` complements the existing tile/world point conversions. See [API and limits](./specs/tilemap-collision.md). CCD, rigid-body response, streaming, slopes and general deep-embedding recovery remain outside scope.

## Canvas UI and Pointer input

Implemented: Scene-owned Web Canvas nodes, Pixi screen presentation, dirty Flex with min/max freeze/reallocation and width-aware grapheme-safe text wrapping, fixed-owner multi-pointer routing, existing ActionSource integration, native keyboard button mirrors, and Canvas trail integration. Existing DOM UI and Core Action contracts remain. See [API and scope](./specs/canvas-ui.md), [validation](./archive/canvas-ui-implementation.md) and [measurements](./benchmarks/canvas-ui-performance.md). Native Canvas editing and label semantics are implemented with their documented limits. v0.1.4 adds the Web gamepad adapter and source gating. Full CSS layout, general document semantics, OS/device accessibility verification and hardware GPU profiling remain separate work.

## Scene API and UI follow-up notes

The retained-Scene and overlay requirements above supersede the earlier generic deferral of suspend/resume. A clearer `changeScene` name and directly constructed dynamic Scenes remain possible API refinements, subject to compatibility and lifecycle review. UI virtualization remains conditional on demonstrated workload needs; current layout and hit testing still visit visible model nodes.

- Standard Canvas Checkbox and horizontal Slider provide typed values/events, read-only state and shared pointer/keyboard/focus/lifetime behavior; Canvas trail Settings lab uses Core-only definitions. [Control contracts](./specs/canvas-controls.md).
- Canvas Select/TextInput/NumberInput provide typed selection, accepted values versus text drafts, generation-checked native Host editing, finite numeric validation and shared focus/lifetime. [Native editing contracts](./specs/text-input-design.md) distinguish automated browser/synthetic composition tests from unverified real OS Japanese IME and physical mobile keyboards.

## Tile geometry

Square/triangle/pointy-hex/flat-hex coordinate geometry, finite color layers, picking, edge neighbors, hex distance/disks, local dynamic updates and Actor Hexagon are implemented. See [contracts and validation limits](./specs/tile-geometry.md). Polygon image UV/masks, polygon Colliders and automatic polygon terrain physics are deferred.
