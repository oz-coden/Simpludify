# Architecture

Simpludify separates a synchronous, DOM-free simulation from a browser host that owns asynchronous readiness, rendering, input events and DOM UI. The private source workspaces are `@simpludify/core` and `@simpludify/web`. No Electron, AI service or generic ECS scheduler is part of the Core.

## Responsibilities and boundaries

| Concept                       | Responsibility                                                                                | Ownership                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Engine                        | Active Scene, frozen frame input, explicit stepping, seeded randomness, diagnostics/snapshots | One current Scene                                                   |
| Scene                         | Synchronous lifecycle, Actor membership, update callbacks, local events and simulation timers | Actors and registered cleanup                                       |
| Actor                         | Identity, membership, enable state, Component composition                                     | Components and registered cleanup                                   |
| Component                     | One reusable behavior or data capability                                                      | One Actor; its own subscriptions/cleanup                            |
| EventBus                      | Optional typed synchronous notifications                                                      | Explicit bus owner; optional subscription owners                    |
| Camera / coordinate functions | World-to-screen projection and its inverse                                                    | Plain Core data; no renderer/DOM knowledge                          |
| Web Game                      | Scene factories, asynchronous setup/visual preparation, frame/resize/input services           | Engine, renderer, UI, host element                                  |
| PixiRenderer                  | Scene presentation and dynamic Renderable reconciliation                                      | Containers, display objects, image textures and pending image loads |
| DOM UI                        | Native label/button/panel layout, focus, selective text updates                               | One mounted scene overlay                                           |

Core compilation uses ES2022 libraries without DOM or Node ambient types. The boundary validator rejects external Core imports and Electron dependencies in Core/Web. Core's renderer contracts accept Scenes and coordinate transforms rather than character lists or platform objects.

## Scene lifecycle

A Scene begins **Preparing**, covering construction and application setup. Its synchronous states are:

| State     | Meaning                                                   | Legal successor    |
| --------- | --------------------------------------------------------- | ------------------ |
| Preparing | Actors/components/resources may be configured; no updates | Ready, Disposed    |
| Ready     | The caller has declared preparation complete; no updates  | Active, Disposed   |
| Active    | Eligible for Engine steps                                 | Inactive, Disposed |
| Inactive  | Deactivation hook is running; no new resources or reuse   | Disposed           |
| Disposed  | Terminal, owned resources released                        | none               |

`Scene.markReady()` is a synchronous readiness declaration. Core neither loads assets nor awaits browser promises. Web factories must leave markReady/Engine.activate to the host. `Engine.activate` accepts a Preparing scene for headless convenience and declares it ready; browser code calls markReady only after asynchronous preparation succeeds. An Engine's initial default Scene remains Preparing until explicit activation or the first headless step. Initial default activation preserves already injected input; replacing a Scene clears input.

An Engine claims a Scene exclusively. An active same-instance activation is a no-op. Replacing it deactivates and destroys the old instance; inactive/disposed instances are never reactivated or pooled. A Web factory creates a new instance for every completed reload, including a reload of the current ID. Register activation hooks before activation. These are logic hooks; await Web run/goTo before querying mounted UI layout.

Before commit, invalid state/ownership errors leave the current Scene unchanged. At commit, Engine installs the new active Scene, then runs old deactivation, old disposal, and new activation callbacks. All lifecycle cleanup callbacks run even if others fail. Callback failures are aggregated after commit; the new Scene remains active. Synchronous nested Engine activation/stepping is rejected to avoid half-applied transitions. Disposing during a callback is allowed and terminates further updates, including during implicit first-step activation before elapsed time is advanced.

Direct disposal of an active Scene is terminal, not an implicit navigation action. Subsequent Engine steps reject until another Scene is activated. In Web applications navigate through Game; Game must coordinate its presentation and Core together.

## Web scene transaction

1. `Game.run` initializes the renderer and resolves one startup Promise after initial assets, Core activation, UI attachment and first render. Repeated calls share it. Navigation requires awaiting startup.
2. `goTo(id)` serializes requests. Identical outstanding IDs share a Promise; they do not enqueue another reload. After completion the same ID creates a fresh instance. A failed request does not poison the queue.
3. A staged Scene and its AbortSignal belong to the transaction. User setup may be asynchronous. The old active Scene continues updating while it waits.
4. Pixi prepares the staged Scene and resolves its initial visual resources. DOM UI is built detached. Preparation failure disposes the candidate, aborts its signal and leaves the old active Scene/presentation intact.
5. Core commits the synchronous activation. Web then installs the matching presentation and overlay. Old visual/UI cleanup is idempotent and also tied to the old Scene's disposal. Lifecycle-hook errors are reported while retaining the committed new Scene.
6. Game disposal rejects active/queued navigation promptly, even if user setup never resolves. It aborts scene signals, disposes the staged/current Scene, cancels the one frame chain, removes input/resize listeners and owned DOM, and disposes the renderer. Late prepared resources are immediately disposed. Arbitrary user promises cannot be forcibly stopped; use the provided signal and register cleanup before awaiting.

Actors created by activation hooks are runtime additions; use whenReady to await their images after activation. Renderer/render failures after commit are runtime failures, not rollback guarantees. Update exceptions abort the remaining step without rolling back already mutated state. Core clears its reentrancy guard so a headless caller can handle the failure. Background update/render exceptions reach the diagnostic observer and stop/dispose the Web Game. User code should handle rejections from run/goTo/whenReady.

## Actor and Component ownership

An Actor is Detached, Attached to exactly one Scene, or terminally Disposed. Explicit IDs must be unique within a Scene; omitted IDs are allocated deterministically by that Scene (`actor-1`, ...). Removing an Actor destroys it; transfer/pooling is not implicit. Explicit IDs can be reused after removal; generated IDs are monotonic within the Scene.

Components attach to exactly one Actor and cannot be reused after destruction. Actor.add requires dependencies to have been added first. Requirements are structural presence constraints, not a general scheduler or automatic factory. Missing/duplicate requirements, dependency cycles, instance sharing and removal of a required dependency are diagnosed. Structural add/remove calls from onAttach are rejected so failed attachment can roll back without orphan dependents; onAttach can read dependencies and register resources. The Actor destroys components in reverse attachment order, which also disposes dependents before dependencies under the dependency-first addition rule. Dependencies remain readable during dependent cleanup/onDestroy; each Component is removed from lookup after its destruction. The Actor is already disposed and rejects structural mutation or new resources.

Transform and Renderable are passive data. Motion owns movement and caches its required Transform. ActionMovement copies an explicitly injected Axis2D ActionReader into Motion.direction during the Input phase. Character is a composition preset with these components; Engine does not import or update Character. Custom Components can be entirely nonvisual.

An Actor's enabled flag gates all its updates and visibility. A Component's enabled flag gates its own update; Renderable.enabled additionally gates its visual. Disabling a passive Transform does not disable dependent behavior. ActionMovement clears its direction when disabled/removed. Structural dependencies remain available even when disabled.

## Update consistency

Each Engine step performs:

1. Validate delta and complete initial activation if needed. Capture Actor/Component/timer eligibility and every active logical Action frame from the collected device/logical contributions.
2. Deliver logical onPressed controls, including while paused. New Actors/Components/timers wait for the next step; writes affect the next input boundary.
3. Run Input-phase components for all captured Actors, in Scene insertion order and Component insertion order.
4. Run Update-phase components in the same ordering. Motion and custom Components use this phase by default.
5. Run registered post-update hooks, including the optional Scene-owned CollisionWorld.
6. Advance active scene simulation timers, then Scene update callbacks.
7. Return to the host, which reconciles changed render structure and draws current state.

Membership/component changes are immediately visible to lookup APIs. New Actors and new Components start updating on the **next** step. Removing/disabling Actors or Components prevents subsequent execution immediately; old snapshots are checked for disposal/membership. An Actor disabled at step start remains ineligible until the next step even if enabled mid-step. Changes cannot invalidate iteration or cause double updates. There is no configurable system graph or archetype storage.

Action values are recomputed when contributions or bindings change, then captured once per step. ActionMovement writes into Motion's existing vector without allocating a direction per Actor per frame. There is no second raw-key frame or key-to-movement path. Actor rosters and Component execution plans are rebuilt only when structurally changed. Passive Actors are omitted from the Component dispatch roster; they still participate in rendering and optional contact detection. Frame contexts are reused; do not retain a context for future frames. Snapshot exports intentionally allocate copies for inspection.

Pause suspends subsequent simulation phases (including contacts/timers), while logical Action capture/onPressed controls, Web presentation and DOM controls continue. A resume in an input callback permits simulation using that step's delta; pause from a Component takes effect on the following step. A state change clears input and Web resets its timestamp. Scene navigation remains available; scenes explicitly resume when appropriate.

InputSystem owns keyboard-device contributions and the Engine input boundary. KeyboardSource represents device state only; it has no direction, raw game frame or implicit scripted writer. ActionController resolves bindings and combines those keys with its logical ActionSources; only it owns logical held values, pending Button edges and captured Action frames. Device and logical source handles share one internal ownership/release implementation. No movement Component reads physical keys. ActionReader explicitly injects a read-only, kind-typed Scene dependency into Components, and ActionMovement rejects cross-Scene references. Multiple readers do not consume an Action's edges. Browser input accepts only active Action bindings and preserves text/native UI input. Source disposal releases that contribution only; a global clear flushes every contribution and pending edge. See [the unified input contract](action-input.md).

`Engine.step` is uncapped and deterministic for fixed controlled inputs, steps, seed, and user code. Web uses variable RAF delta with a default 0.05-second cap, drops excess stalled time, clears keys when hidden and resets the timestamp on resume. External time/randomness, asynchronous asset ordering and GPU output are not deterministic guarantees.

## Contacts and position correction

Collider owns geometry, layer/mask filtering and an explicit Trigger/Solid response policy. CollisionBody separately owns static/dynamic correction weight and mass; it does not own velocity integration. Motion integrates intent into Transform, and the optional Scene-owned CollisionWorld corrects positions afterward. Body-less Solids are fixed. Existing Collider defaults remain Trigger.

The existing circle/oriented-box narrow phase now returns minimum translation normals and penetration depth. It lives in collision-geometry; collision-response contains weighted translation only. CollisionWorld retains ownership, broad-phase sweep, deterministic pair tracking and notification. All eligible geometry is validated before the first correction; per-pair geometry is refreshed during bounded sequential correction. Repeated scans discover overlaps caused by earlier corrections. The final scan captures Trigger contacts at corrected positions, while Solid contacts retain encounters from response iterations. Only then are contact events delivered, before timers/Scene.onUpdate. Query snapshots permit ordinary game logic without subscriptions.

Removals/disables suppress later delivery, destroyed recipients receive nothing, and Scene/world disposal clears without synthetic exits. Response is committed before callbacks; callback failures do not roll positions back. A bounded iteration count cannot solve all stacks, narrow gaps or interlocking bodies. This is positional depenetration, not a force/impulse/angular physics simulator; discrete tunneling remains possible. See [API contracts](api.md#trigger-and-solid-contacts) for ordering, pair combinations, mutation and numeric limits.

The X sweep is retained because measured costs do not yet justify a more complex spatial index. Dense overlap and unfavorable axis distributions remain quadratic; diagnostics expose candidates/narrow tests and unresolved movable contacts. Trigger-only worlds do not execute response iterations.

CameraFollow is a host-independent world-space helper with zoom-aware bounds and optional exponential smoothing. Applications call it after response, normally from Scene.onUpdate. It does not add renderer/Scene dependencies or special Engine behavior. Signal Run updates tracking immediately on zoom changes to keep rendered and converted pointer coordinates coherent.

## Events, timers and cleanup

Events are optional typed tokens with identity independent of their debugging name. Delivery is synchronous and registration-ordered. A dispatch snapshots listeners: additions wait until the next dispatch; unsubscriptions/disposal take effect immediately. Different events may nest depth-first. Recursively emitting the same token on the same bus is rejected. Every eligible handler runs despite errors; failures are aggregated and rethrown to the emitter. Promise-returning handlers are diagnosed with EVENT_ASYNC_HANDLER; their rejections are consumed to prevent an unhandled rejection, and delivery continues. Async tasks must be explicitly owned outside the handler.

Scene/Actor/Component local buses are allocated lazily. Local bus disposal removes every listener. A subscription on any external bus can name a Scene/Actor/Component as its owner; manual unsubscription removes the ownership callback too. There is no global Game bus because no current use case requires global routing; applications may explicitly own an EventBus or Lifetime.

Scene.after/every use simulation seconds, never host timers. They run only when their Scene steps. Repeating timers deliver at most once per step, drop missed repetitions and preserve the fractional interval remainder; zero-delay one-shots fire on the next step. Timer eligibility is captured before logical Action callbacks and all Scene update phases. Timers added during components, contacts, timers or Scene callbacks wait until the next step. Actor/Component ownership optionally cancels timers on destruction; enable/disable does not pause timers. Timer handler failures are aggregated after other due callbacks run.

Disposal is idempotent. All registered cleanup runs even after failures. Scene disposal cancels timers and its event bus, destroys Actors/components, then runs Scene cleanup in reverse registration order. Actors run owned cleanup, close their bus and destroy Components in reverse attachment order. Components release their owned subscriptions/bus and invoke onDestroy. A cleanup registration returns a function that unregisters it; that function does not invoke cleanup.

## Coordinates, Camera, Viewport and DPI

WorldPoint is a location in game units. ScreenPoint is a host-local CSS-pixel location. Viewport is an offset rectangle in that host. LogicalResolution is the nominal view extent (800×450 by default), independent of canvas backing pixels. PhysicalPoint is a DPR-scaled screen location; physical pixels are owned by the renderer.

Camera.x/y specify the nominal visible extent's top-left world coordinate; zoom is centered on that extent. Default Camera (0,0,1) reproduces the original view. Fit uses the smaller viewport/logical scale with centered bars; Fill uses the larger scale and clips; Adaptive uses viewport CSS dimensions as logical extent. Zoom multiplies scale without moving the clip rectangle. DOM UI reflows over the whole host and is unaffected by Camera or world aspect.

Pure createViewTransform/worldToScreen/screenToWorld functions provide an invertible mapping. Fit clips to the fitted logical rectangle, while Fill/Adaptive clip to the viewport. Game.pointerToWorld converts client coordinates into host-local screen coordinates before applying the inverse, accounting for the host's bounding rectangle scaling. Outside points are still convertible; containsScreenPoint checks visible bounds when required.

The Web renderer defaults to min(devicePixelRatio, 2), configurable by pixelRatio. It detects ratio changes and resizes backing buffers independently of logical resolution and Camera. A single Camera/Viewport is implemented; projection values and renderer contracts do not rely on process-global camera state.

## Presentation resources

Pixi presentations reconcile only on Scene structural revision changes. Transform values, enable flags, visibility, opacity and depth are read each render. Depth ordering is rebuilt only on relevant changes; equal depths preserve Actor insertion order. Images preserve their aspect by default. Runtime Renderable addition loads an image asynchronously; a placeholder shape is immediate. Pending image visuals remain absent until ready. Game.whenReady waits for current presentation resources and rejects failed images; background failures are also reported without destroying the active Scene. Removing a failed Actor/component permits recovery.

Actor/component destruction cancels pending image work and releases its texture/display object. Images bypass the shared Pixi texture cache. Scene-owned cleanup also disposes staged/active presentations. Diagnostics expose presentation, visual-entry, texture and pending-image counts for resource tests. Painter order at equal depth follows Actor insertion order even when image loading completes out of order. Presentation destruction explicitly releases clipping Graphics contexts. Renderer teardown removes its own canvas/resources without requesting destruction of shared Pixi resources; another live Game remains usable.

DOM UI continues to use native Flexbox/Grid, textContent, focusable buttons and selective label subscriptions. The overlay has pointer-events disabled in empty space; visible controls/panels opt in. No UI layout engine, telemetry or mandatory editor is introduced.

UI construction is transactional: a partial mount releases prior subscriptions and listeners before rethrowing. Unmount aborts button tasks and releases held pointer/keyboard controls. Late asynchronous UI or renderer cleanup failures reach the observer without preventing other teardown. A render failure after presentation commit disposes the Game; before-commit setup failures preserve the previous presentation.

## Official site and future transport

The official site is build tooling, not an engine dependency: existing Vite plus build-time Markdown conversion emits static pages and independently built sample documents. Sample bootstrapping owns pagehide/disposal and startup diagnostics outside Core. Japanese guides introduce current concepts; English API/lifecycle/performance documents remain detailed source contracts.

Code-first means coherent, understandable and maintainable composition, not shortest syntax. High-level defaults and low-level access coexist, and typed events remain optional. Blockfall expresses its grid rules with ordinary game logic rather than mandatory physical Colliders. Prism Raid uses circle Triggers beneath Triangle visuals; enemy patterns, firing, damage and waves remain game-owned Components and state. Circle/box approximations are sufficient where game feel permits; exact contours are not a requirement.

Static hosting is independent from network capability. Standalone samples need no external game service after delivery. Future transport, simulation location and state authority must be separate decisions; P2P, player-hosted and dedicated-server designs are candidates, not implemented APIs. DOM-free simulation must remain reusable without committing to a transport.
