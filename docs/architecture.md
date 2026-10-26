# Architecture

## Scope and resolved design tensions

The first implementation is a working Web slice. The design specification includes Windows packaging in its broader MVP, while the kickoff explicitly prioritizes a tested Web slice and permits Windows to remain pending. Electron is therefore not a dependency of this workspace. Portable executables are not implemented or verified.

The initial specification used a provisional SDK package name and suggested seven packages. The project is named Simpludify; the internal packages `@simpludify/core` and `@simpludify/web` are private source workspaces. Their names do not assert npm availability. Two packages keep the real platform boundary without introducing one package per small module.

The short `new Game()` sample and an environment-independent core are reconciled by a browser SDK facade. `Game` lives in the Web package; `Engine` runs the same simulation directly in Node without importing browser services. The synchronous core scene lifecycle is separate from asynchronous browser resource readiness.

Adaptive presentation does not make hard-coded world positions responsive. Fit/Fill map a fixed logical world; Adaptive uses viewport CSS pixels as world units. DOM UI always reflows independently. The renderer clamps device pixel ratio to 2 by default; canvas CSS size and world units remain separate.

## Dependency boundaries

| Module                         | Responsibility                                                                                                                 | Dependencies               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| `packages/core`                | Characters, key state, normalized movement, scenes, deterministic stepping, seeded PRNG, diagnostics, renderer/frame contracts | None                       |
| `packages/web/src/game.ts`     | Browser-facing SDK, asynchronous scene transactions, frame loop, ownership                                                     | Core and Web adapters      |
| `packages/web/src/renderer.ts` | PixiJS, placeholder/image creation, viewport mapping, GPU resource disposal                                                    | Core, PixiJS, DOM          |
| `packages/web/src/input.ts`    | Focus-scoped keyboard events and release on blur/visibility                                                                    | Core, DOM                  |
| `packages/web/src/ui.ts`       | Declarative label/button/panel descriptors and DOM mounting                                                                    | DOM                        |
| `scripts`                      | Scaffolding, Vite orchestration, validation, dependency inventory, benchmarks                                                  | Node and development tools |

The core compiles using only `lib: ["ES2022"]` and no ambient host types. The check script also rejects nonrelative core imports and Electron package dependencies. These checks complement code review; they are not a full static security analysis.

## Simulation and time

`Engine.step(seconds)` is explicit and uncapped. It moves entities, increments elapsed simulation time, then invokes active scene update callbacks in registration order. Diagonal input is normalized; opposing directions cancel. `Engine.random()` is a seeded 32-bit LCG. Identical steps, inputs, seed, and callback code produce identical managed state in the same JavaScript numeric environment. Arbitrary user time/randomness, loading order and GPU output are outside this guarantee.

The Web facade owns exactly one requestAnimationFrame chain. Its first frame advances zero seconds. Subsequent steps are variable delta, clamped to 0.05 seconds by default. The clamp intentionally drops excess elapsed time after a stall. Hidden pages clear keyboard state and reset the frame timestamp; resuming does not catch up hidden time. Headless deterministic tests supply steps directly. No per-frame IPC is involved.

## Readiness and scene transactions

1. Construct `Game`, configure default entities/UI, or register named scene factories.
2. `run(id?)` initializes the renderer, runs scene setup, waits for image resources, attaches scene UI, sizes and draws the initial frame, then schedules updates. Its Promise rejects on startup failure. Repeated calls return the same Promise; the first initial scene wins.
3. `goTo(id)` queues transitions in call order. A fresh Scene and fresh UI descriptors belong to each invocation. The current scene continues updating while the next scene's async setup/resources are prepared.
4. On success, the new scene becomes active, old input is cleared, old scene cleanup runs, old visuals/UI are disposed, and new visuals/UI are mounted. Movement key state does not cross scene boundaries. Setup or preparation failures dispose staged resources and leave the current scene active. There is no transition animation.
5. Scene cleanup callbacks run in reverse registration order. All callbacks run even when one throws. Old scene cleanup errors are reported after the new scene activates; they do not roll back the transition. An adapter render/commit failure is a runtime failure rather than a rollback guarantee.
6. `Game.dispose()` cancels its frame, aborts input listeners, disconnects resize observation, disposes staged/current scenes, releases visuals and textures, removes UI subscriptions and canvas, and removes its owned host. It is idempotent. If an async factory returns later, it cannot activate or leak prepared resources. User async work should use its own AbortController registered with `onDispose`; arbitrary user Promises cannot be forcibly cancelled.

The entity roster is sealed at readiness; dynamic spawning/removal is deferred. Positions remain mutable and are read by the renderer every frame. Retaining a character object does not transfer scene ownership. Do not activate scenes on `game.engine` manually: the facade coordinates rendering and UI; headless code can use `Engine.activate` directly.

## Resource and event ownership

Each prepared Pixi scene owns its Container, Graphics/Sprites, and image textures. Images bypass Pixi's shared texture cache. Scene changes do not unload another game's assets. Pending image loads abort during renderer disposal. No renderer ticker is started; rendering uses the facade frame loop.

A game's focusable host owns keyboard input. Physical `KeyboardEvent.code` values are stored as a Set, making repeat keydowns idempotent. Native buttons/inputs/editable fields keep their keyboard behavior. Keyup, window blur, hidden documents and focus leaving the game clear appropriate state. Game input never captures every key globally.

Canvas is below the DOM overlay. The overlay's empty space uses `pointer-events: none`; visible panels/buttons opt in to pointer events. UI uses CSS Flexbox/Grid, intrinsic sizes, safe-area insets and native scrolling. Label changes update only the subscribed DOM text node; the browser performs text/font/layout invalidation. No custom layout engine or per-frame UI tree diff is used.

## Extension seams

`RendererPort` (`init`, `prepare`, `resize`, `dispose`) and `PreparedScene` (`render`, `dispose`) use no DOM types. `FrameDriver` (`request`, `cancel`) can be injected for host-controlled timing. The Web SDK still needs a DOM; an Electron renderer can reuse it without introducing Node APIs into game logic. See the concrete desktop milestone in [roadmap](roadmap.md).
