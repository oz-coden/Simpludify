# Core modules and Host contracts

Simpludify is a code-first, lightweight, AI-native 2D content engine. Typed APIs, explicit lifecycle/ownership and diagnostic tooling support human and AI-assisted development without requiring an AI service. Games are its primary use, alongside interactive animation, mini-games, simulations and small 2D tools. Standard UI/content definitions do not need HTML, CSS or Pixi calls. The private `@simpludify/core` and `@simpludify/web` source workspaces remain the only packages; module folders are internal, not new install/import targets.

## Internal responsibility map

| Core folder | Responsibility                                                                                     | Dependencies                               |
| ----------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| foundation  | Diagnostics, lifetime/cancellation, events, timers, random, dense Grid                             | Foundation only                            |
| scene       | Scene, Actor, Component, execution phases                                                          | Foundation; type-only InputSystem identity |
| graphics    | Transform/Renderable data, coordinates/Camera, SpriteSheet                                         | Foundation, Scene components               |
| ui          | Canvas tree/state, Flex, text wrapping policy, clipping, scroll/focus state                        | Foundation, UI only                        |
| interaction | Actions, keyboard contributions, pointer event records/routing, holds and key activation           | Foundation, Scene, UI; coordinate types    |
| animation   | SpriteAnimation playback component                                                                 | Foundation, Scene, Graphics                |
| game        | Motion/ActionMovement, Character, Collider/CollisionBody/CollisionWorld, integrated Tilemap facade | Foundation, Scene, Graphics, Interaction   |
| runtime     | Engine, fixed stepping, replay, renderer/frame ports                                               | Foundation, Scene, Graphics, Interaction   |

`src/index.ts` preserves package-level exports. `components.ts` is an export aggregator for the previous API; internal sources import concrete graphics or movement files. Tilemap stays in game because it already combines placement and optional collision data. Foundation timers remain independent of Scene, while fixed stepping depends on Engine and belongs to runtime. Scene claims Engine identity through a narrow `{input}` contract rather than importing Engine.

`npm run check` compiles Core with **ES2022 only and no DOM/Node ambient types**, rejects external imports and relative path escapes, and validates module directions. Scene/Actor/Component refer to each other through types; Actions refer to Scene lifecycle and Scene refers to input ownership types. These are explicit type relationships, not a runtime scheduling cycle. The folders are not a promise that every module can already become a standalone npm package.

## Core, Renderer, Host and target

| Layer               | Owns                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Core                | Logical state, synchronous lifecycle, composition, draw descriptions, UI layout/input meaning, resource ownership/cancellation  |
| Renderer            | Platform draw objects, exact font metrics, image decoding/textures, masks, display reconciliation                               |
| Host                | OS/browser input capture, screen/viewport changes, timing, asynchronous preparation/commit, focus/accessibility/IME integration |
| Distribution target | Build/packaging/signing/install/update conventions                                                                              |

Web Game is a Host using PixiRenderer and browser adapters. Electron and Tauri Desktop/Mobile can eventually reuse that Web renderer/Host inside their WebView with target-specific bootstrap/packaging. They are **not implemented or verified targets**. Android support is not implied by the Core refactor. A future non-Web Host can use the same Core definitions with another renderer and input adapter.

Core lifecycle remains synchronous. Asynchronous image loading, font availability, user setup, cancellation and presentation commit remain Host transactions. Existing renderer image leases, pending-versus-committed sources and final-owner texture release have not moved into Core.

## UI flow

1. Content creates Canvas nodes using Core factories. A `CanvasUI(owner, root)` claims the tree; owner can be a Scene or a plain Lifetime. It does not allocate graphics or browser objects.
2. Content mutations invalidate the owner. The Host calls `ui.layout(screenWidth, screenHeight, measureText)` with dimensions in Host screen units; Core divides by UI scale. Measurement receives a node and optional content width. The Host must return finite nonnegative, font-correct dimensions and use the same wrap/font rules when painting.
3. Flex resolves sizes. Scroll ranges/clamped offsets transform descendant bounds. `ui.walk` provides identical node order and intersection clips for rendering and semantic controls. Camera and DPR never change UI coordinates.
4. The Host paints the Core boxes, supplies screen/world pointer snapshots to `PointerRouting`, and calls `routing.setScene(scenePointer, ui)` on commit. Core fixes gesture ownership, delivers typed events, combines holds and performs Enter/Space activation. The Host owns native pointer capture/release and cancels on blur/hidden/disposal.
5. Core owns `ui.focus`, `focusedNode`, `focusNext` and ancestor reveal. Web mirrors logical focus changes to native controls; Tab uses live depth-first declaration order, reveals offscreen scroll entries and leaves the tree at its boundaries. Native sibling reordering must not detach the active editor. Pointer ownership and native/logical focus do not inherently suppress gameplay: consume UI activation/navigation commands, allow unrelated accepted bindings on engine buttons, isolate native editors/selects/composition, clear on editor entry and always deliver keyup release. See [priority rules](canvas-ui.md#keyboard-and-accessibility-scope). Native accessibility activation can directly call `node.activate()`.
6. Owner disposal releases the logical tree, event listeners, holds and cancellation signals. Host subscriptions release Pixi objects, font caches, native mirrors and DOM listeners. Detaching a presentation must not leave its routing subscribed.

The [portable screen](../examples/canvas-ui/portable-screen.ts) imports Core only. It demonstrates selection, list mutation, ordering, scroll controls and text updates without Scene/Actor/Component concepts. Canvas trail's **UI list lab** mounts it with Web Game. Headless and browser tests reuse this same definition; another Host should run it before claiming UI compatibility.

## Adding a Host

1. Implement the [RendererPort](api.md) and frame/input services required by the application. Keep OS resource handles outside Core. Honor prepare/commit/dispose ordering and the ownership/readiness contracts in [architecture](architecture.md) and [rendering](rendering.md).
2. For Canvas UI, supply exact measurement, ordered painting and nested rectangular masks using `CanvasUI.layout/walk`. Reuse `wrapCanvasText` and the same actual line/font measurements when painting. Recompute on viewport/scale and explicit font invalidation.
3. Feed host-local screen coordinates and the current world transform into `ScenePointer`/`PointerRouting`; preserve IDs through cancellation and physical release. `scroll` accepts screen units; normalize platform wheel/gesture units before calling it. Wire native capture release to its constructor callback. Scope all connections to owners.
4. Bridge logical focus and semantic activation to the platform. Feed key down/up into routing, release held keys on blur, and use Core focus traversal for scroll reveal. Provide a platform-specific text/IME helper when implementing an editable control; no such control is supplied by this change.
5. Run Core unit tests and the portable UI fixture; add real renderer/font/input/resize/disposal tests on the target. A layout test alone is not proof of pixels, screen reader or IME behavior.

Web currently checks an optional Canvas presentation capability on its renderer; a custom renderer without it still rejects `RENDERER_CAPABILITY`. Moving the model does not silently grant every custom RendererPort UI support.

## Compatibility and escape hatches

- Existing `@simpludify/core` and `@simpludify/web` package imports remain; no new npm dependencies or packages were added. Internal file paths changed and are not stable public entrypoints. Web probe forwarders contain exports only.
- Core `CanvasButton` callbacks and `CanvasNode.signal` use `CancellationSignal`: `aborted`, `onCancel(callback)` (returns unsubscribe), and `throwIfCancelled()`. The Web factory preserves callbacks receiving a native AbortSignal. Use `browserAbortSignal(node.signal)` when explicitly passing an owner's cancellation to fetch/DOM; the resulting native signal is aborted on owner disposal. Portable definitions should use Core imports.
- `CanvasNode.ui` is a narrow ownership/invalidation interface. Retain the actual CanvasUI returned by `game.canvasUI` / scene `canvasUI` for focus, layout or diagnostics. `CanvasUI.scene` identifies its LifetimeOwner; code that assumes Scene-specific fields should retain its original Scene reference.
- Scrolling defaults now enable content drag, inertia and automatic overlay bars. `CanvasScroll` owns its empty space (`pointerEvents: "auto"`). Use `dragScroll: false`, `inertia: false`, `scrollbar: "hidden"` or an explicit pointer policy where the previous passive behavior is required. Wheel selection respects the topmost hit's ancestor path; covered scroll panels no longer receive input through overlays.
- Custom `CanvasNodeOwner` implementations must implement `scrollChanged(node)` for projection invalidation and `motionChanged(node, active)` for animation membership. Standard `CanvasUI` already provides these. Custom Hosts must implement the advance/lifecycle and post-subtree bar drawing contracts below before claiming the new scroll behavior.
- Browser element/style access, DOM UI, Pixi/native API extensions remain allowed. Those paths opt into platform-specific behavior; callers own their portability and cleanup. No HTML/CSS compatibility framework or automatic translation of arbitrary DOM code is promised.
- Layout/interaction contracts are portable. Identical font rasterization, GPU output, device behavior and asynchronous ordering across platforms are not guaranteed. Actual shipped support remains the tested Web path.

## Remaining scope

Dedicated select/number/text input components, IME bridges, virtualized lists, automatic font readiness and viewport-to-panel binding remain future work. Touch/mouse dragging, inertia and overlay scrollbars now use the existing Core/Host boundary; see [scroll contracts](scrolling.md). Basic selection and numeric stepping can be composed from buttons/labels; these are not native form controls. Scroll range uses laid-out immediate child boxes; keep deeper overflow in a content panel with a suitable intrinsic/explicit size. Scroll changes project cached layout; structural/size changes still reflow the dirty root. There is no virtualization performance guarantee.

Hosts supporting scrolling must provide PointerInfo.time in monotonic seconds, retain capture through target-to-scroller transfer, call CanvasUI.advance with presentation elapsed time and stop/release on pause/blur/hidden/disposal. Core computes bars and input semantics; draw overlays using the post-subtree walk callback with the same clips. Web keeps its existing canvas touch-action policy. [Scrolling](scrolling.md) defines the precise contracts.

## Standard value controls

CanvasInputNode adds values/read-only/change/commit/cancel to standard value controls; it does not replace the Canvas tree or Button/HoldButton base. CanvasControlPort carries immutable logical draw snapshots and synchronous key/pointer commands. PointerRouting arbitrates continuous editing against existing scrollers and releases state on revision/availability/lifecycle changes. Custom Hosts should route supported control keys before ancestor scrolling and reuse `canvasSliderGeometry` / `canvasControlText` with the documented checkbox label inset. Web owns Pixi paint and native checkbox/slider ARIA focus mirrors. [Control contracts](canvas-controls.md) specify immediate value/cancellation semantics; [native editing contracts](text-input-design.md) define Select/TextInput/NumberInput drafts, native ports, accepted values and Host migration. Custom Hosts must implement these native ports and generation/lifetime guards before exposing the new controls; text/key reconstruction or a second independent Canvas caret is not a replacement for native editing.
