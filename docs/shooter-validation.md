# Triangle / Prism Raid: API review and validation

> Historical validation of the Triangle/shooter revision through `636014f`. Later [typed Action input](action-input.md) replaces the keyboard-oriented game bindings and autopilot described here; the recorded benchmark versions and results remain historical evidence.

## Scope and source

Triangle extends the existing public `Shape` object and Pixi Graphics renderer. [Prism Raid](../examples/prism-raid/README.md) is a complete three-wave vertical shooter built with public Core/Web exports. Engine changes are limited to the Triangle Shape value and its Graphics polygon branch. CollisionWorld, Solid correction, Core lifecycle and package dependencies are unchanged.

Baseline: `bacdf9e4d34431704bafcce05029f0cca2657ada`. Triangle checkpoint: `e138cc78e6e2cad251a2ac59213e7c82fd504692`; headless game: `551d05e8e9de5eaf69424e1d1bf0a9cd1f05895d`; Web/site integration: `1b33d7dede13d4cc0c5698dc5d73985bf8b9c39d`; measurement tools/source: `4297c5172932491c65d4641de881c10f752b397a`. Work is saved on `codex/triangle-shooter` before main integration.

## Triangle contract and renderer compatibility

`new Renderable({ source: { kind: "shape", shape: Shape.Triangle }, width: 32, height: 40, color: 0x65a8ed })` creates an upward-pointing isosceles triangle. Local vertices are `(0,-height/2)`, `(width/2,height/2)` and `(-width/2,height/2)`. The origin is the bounding-box center, matching other shapes; it is not the centroid. Width/height are independent. Transform position, radians rotation, independent/negative scales and live visibility/opacity/depth all use the existing renderer path. Live geometry/color and explicit shape/image sources now follow the [rendering contract](rendering.md).

Triangle uses a closed Graphics polygon; it does not add another renderer, texture path or physics shape. Existing Box/Circle/Character pixel fixtures pass. Triangle-specific pixel/resource cases pass on both WebGL/SwiftShader and forced Canvas2D at desktop/narrow widths. Forced Canvas2D Prism Raid also starts, clears all waves through normal input and releases resources. These are pinned Chromium/Pixi observations, not universal Canvas2D, WebGPU or hardware-GPU guarantees.

The game's player and enemy triangles use circle Trigger approximations. Triangle/convex polygon Colliders remain future candidates; no Solid or CollisionBody behavior was added.

## Game structure and usability

| Source                                            | Responsibility / public contracts used                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [logic.ts](../examples/prism-raid/logic.ts)       | Ordinary round state plus Unit, Pilot, Flight, Clock and Lifetime Components; Transform, Motion, KeyboardController, CollisionWorld, Trigger events, Scene timers and owned cleanup |
| [view.ts](../examples/prism-raid/view.ts)         | Renderable Triangle ships, Box/Circle shots, depth, opacity and deterministic decorative stars                                                                                      |
| [main.ts](../examples/prism-raid/main.ts)         | Game menu/play factories, BrowserInput action binding, owned InputSource, native Button/HoldButton, Label, pause/resume and restart                                                 |
| [autoplay.ts](../examples/prism-raid/autoplay.ts) | Read-only game snapshots, predicted aim and simple avoidance; every action writes normal logical Action input                                                                       |

The shooter rules do not import Web/Pixi/DOM internals. Rendering consumes model state and does not consume its PRNG. The automatic player does not change HP, enemy positions, score, wave progress or collision state. `Raid.snapshot()` copies custom game data; Engine.snapshot() supplies controlled input/PRNG and generic Actor state. Neither is advertised as a complete save/restore API.

Documentation-first use established ownership, update order, geometry approximations, pause, timers and scoped events. Concrete source inspection was needed to establish **which browser keys Game accepts**: custom Component reads do not automatically register action keys. The API/input guides now document the exported BrowserInput adapter. The docs also clarify that a newly added Actor's component updates wait until the next step while its already attached Collider can participate in the later collision pass of the current step. The stale architecture reference to a future falling-block puzzle now names implemented Blockfall/Prism Raid examples.

| API area                    | Concrete observation                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Names/defaults              | Scene disposal is terminal; goTo creates a fresh Scene as documented. Trigger is the correct default for nonblocking shots; Body correction is unnecessary. Game's default 800×450 resolution is explicitly replaced with the arena's 360×540.                                                                           |
| Actor/Component composition | Movement reuses Motion/KeyboardController; Flight sets enemy position/pattern in the Input phase, before Motion and contacts. Lifetimes and HP stay game-owned rather than becoming Engine cases.                                                                                                                        |
| Spawn/remove                | `scene.add(actor)` and `actor.dispose()` suffice. A Set owned by the round removes its entry through Actor.onDispose; no separate inactive-entity list or object pool is required.                                                                                                                                       |
| Input                       | Movement maps to Game's existing controller discovery; continuous Space uses an explicit BrowserInput, disposed with its Scene. HoldButton feeds the same keys for touch. This is explicit but adds adapter boilerplate.                                                                                                 |
| Contacts                    | Projectile callbacks dispose the projectile first and check both participants. This prevents double consumption/score in simultaneous contacts. Survivor Exit behavior is tested; destroyed projectiles do not own cleanup in Exit handlers.                                                                             |
| Rendering                   | Triangle uses the same width/height/Transform/depth/opacity interface as other shapes. No Pixi object, geometry buffer or shader leaks into game code.                                                                                                                                                                   |
| UI                          | Small RaidChanged payloads update Label bindings; unchanged text is skipped by the binding. Native controls continue during pause and retain focus/keyboard semantics.                                                                                                                                                   |
| Headless testing            | A Raid attached to Engine.scene needs only the injected Engine.random callback. Tests can advance without waiting, replay inputs and inspect custom snapshots without starting a renderer.                                                                                                                               |
| Diagnostics/maintenance     | Existing dependency, owner, shape-size, Scene and input-source diagnostics remain intact. Game option failures use an ordinary descriptive Error. Typed custom Component tokens need explicit generic annotations, as documented. File boundaries keep rules, presentation and browser ownership independently editable. |

## Findings classified A–D

| Class                      | Finding / disposition                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — game-specific          | Spawn cadence, three enemy patterns, weapon cooldown, waves, score and breach penalties are game rules. They remain in Raid/Components.                                                                                                                                                                                                   |
| A — game-specific          | Same-frame projectile consumption and one-second damage invulnerability are explicit game rules. Guard/consumption tests prevent duplicate damage and score.                                                                                                                                                                              |
| A — game-specific          | Discrete high-speed shots can miss. The shipped speeds are 300/165 units per second with circle radii 6/5 and Web maxDelta=1/30. This bounds normal displacement but does not guarantee every grazing path. Controlled tests reproduce a 1200-unit/s miss at a large step and detect it using 1/120 substeps. No universal CCD was added. |
| B — documentation          | Additional action keys require BrowserInput; custom Component reads alone do not register them. Added a complete public-API example and Japanese guidance.                                                                                                                                                                                |
| B — documentation          | Clarified new-Actor update eligibility versus same-pass Collider participation. Updated implemented sample/shape lists and the outdated future-Blockfall description.                                                                                                                                                                     |
| C — general API candidate  | A Scene-owned action-key registration API could remove one BrowserInput adapter per game. Current alternatives are explicit public BrowserInput and InputSource. A new API would need native-control filtering, focus/blur, ownership and duplicate-source semantics; retained as a candidate rather than another convenience alias.      |
| C — general API candidate  | An optional fixed-step Web driver could decouple render cadence from bounded contact steps. Current alternatives are small controlled Engine steps or a game-specific FrameDriver; implementing a scheduler requires catch-up budgets, pause and input-edge contracts. Not required by the measured game.                                 |
| C — optimization candidate | Dense broad-phase candidates remain costly at artificial 1101-Actor loads. Profile distributions and lifetime churn before considering spatial indexing or pooling. Destroyed Actor/Component reuse would conflict with current terminal ownership and is not an implicit optimization.                                                   |
| D — engine defect          | No new defect was reproduced under the documented valid usage in this implementation. Triangle tests, existing behavior and disposal contracts passed. The observations do not prove the absence of all defects.                                                                                                                          |

## Functional validation

- Strict TypeScript, DOM-free Core, boundaries, lint/format and dependency notices pass. No runtime dependency was added.
- 171 unit tests pass, including 18 shooter cases. They exercise motion/diagonal normalization/bounds, held fire, projectile ownership/expiry, enemy HP/defeat, simultaneous contacts, invulnerability, body contact, breaches, survivor Exit after an actual consumed projectile, pause, Scene replacement, seeded trace replay, terminal win/loss and stress.
- The automatic player wins all 24 enemy kills for seeds 1, 42 and 2026 through InputState alone. A separate identical input trace reproduces both game and Engine snapshots. Normal no-input play reaches loss. A 100,000-step repeated-round test and a 100-enemy/1000-shot fixture pass.
- Existing 52 browser cases, four Triangle cases and ten initial shooter cases pass at 1440×900 and 390×844 (66 total). Two additional shooter Canvas2D cases also pass; together the current suite has 68 cases. Keyboard/focus/blur, simultaneous two-finger movement/fire, pause, restart, menu, normal-input terminal states, twelve consecutive Scene replacements and zero owned resources after disposal are covered.
- The production-subpath integrated site test passes for 22 documentation pages and all six samples, including the original five. It checks themes, links/assets, visible keyboard/touch progress, game outcomes, iframe restart/stop, focus return and explicit Engine/source disposal. The complete suite also passes with base `/`, including reference/anchor checks and nine standalone code examples compiled against the current public APIs. The published suite also passed independently, as recorded below.

## Measured performance and memory (2026-10-27)

Raw reports: [Core](../benchmarks/prism-raid/core.json), [browser](../benchmarks/prism-raid/browser.json). Node 24.22.1 on Linux, AMD EPYC 9V74; Chrome 156.0.8078.4 with SwiftShader, 1000×800 viewport, DPR 1. Source commit is embedded in each report. No other local tests/builds ran during recording.

Core profiles use 160 timed 1/240-second steps. The separated 301-Actor profile warms 20 steps and maintains separation; the overlapping 1101-Actor profile measures contact/removal churn and ends with fewer colliders. These are different distributions, not a linear scaling claim.

| Core workload                           | p50 / step    | p95 / step | Notes                                                                                                               |
| --------------------------------------- | ------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Player only                             | 0.006ms       | 0.024ms    | One Collider                                                                                                        |
| 60 enemies + 240 shots                  | 0.392ms       | 0.628ms    | 301 units; separated X regions; max 8055 candidates, no narrow tests                                                |
| 100 enemies + 1000 shots                | 1.755ms       | 3.172ms    | Contact/removal pressure; max 66018 candidates, 120 narrow tests; 511 final colliders                               |
| 10000 shot Actors created and destroyed | 90.55ms total | —          | About 9.05µs each, including components/subscription/disposal; player and clock remain before final Engine disposal |

Sixty input-only complete rounds produced 1440 kills and 172796 steps (1439.97 simulated seconds) in 3.09 wall seconds. All 60 won. The model peak was 41 units; 18774 player shots/enemies were created, excluding enemy shots. Forced-GC Node heap was 18.884→18.956MB, including Vite/SSR/tooling. Scene/CollisionWorld unit counts returned to zero after each round. These observations did not justify introducing an object pool.

The isolated renderer profile warms 30 submissions, then times 120 render calls with 100/500 rotated Box or Triangle visuals. At 100 visuals both shapes have p95 about 0.1ms; at 500, Box is about 0.2ms and Triangle about 0.1ms. Browser clock granularity is about 0.1ms: median zeros mean below that resolution, not zero work. This measures CPU submission through a local Vite harness, not GPU execution or a general advantage of one shape.

The production game runs normal real-time automatic play for about 120.25 seconds, restarting through the real UI after terminal states. It records five wins and no losses. Actor/visual peaks sampled every 500ms are 36/78. Timings use bounded buffers; periodic forced-GC pauses and the following 500ms are excluded.

| Production real-time measurement    | p50    | p95    | p99    |
| ----------------------------------- | ------ | ------ | ------ |
| Engine.step CPU                     | 0.2ms  | 0.4ms  | 1.0ms  |
| PreparedScene.render submission CPU | 0.2ms  | 0.5ms  | 1.5ms  |
| RAF frame interval                  | 16.7ms | 16.7ms | 16.8ms |

Forced-GC browser heap rises from 8.247MB to 9.180MB during the short run, then falls to 4.879MB after Game.dispose. Timing buffers, browser/JIT/cache behavior and different live game states contribute to the observation; this measurement does not isolate their share or prove leak freedom. DOM counters also vary across the run. After disposal, owned input sources, presentations, visuals, textures, pending images, game hosts and canvases are all zero. Native/GPU memory and heap-retaining paths were not profiled. Longer real-device runs and heap snapshots remain follow-up work.

## Reproduction

```sh
npm ci
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
npm run site:build -- --base /
npm run site:check
npm run test:site
npm run site:build -- --base /Simpludify/
npm run bench:shooter -- --mode core --out test-results/shooter-core.json
npm run bench:shooter -- --mode browser --seconds 120 --out test-results/shooter-browser.json
```

`CHROMIUM_PATH` may select a compatible existing Chromium binary. Run recorded benchmarks alone. The browser mode first compares primitive submissions, then serves `site-dist` and measures the production game; its real-time duration can be set between 10 and 600 seconds.

## Hosting and remaining limits

The existing static generator, isolated iframe host, notices and Pages workflow are reused. Six samples remain independent build roots. No Pages visibility, custom-domain or DNS settings are changed. Main integration used a fresh remote-head check and a non-forced update, preserving the existing history.

Physical mobile devices, Safari/Firefox, WebGPU, arbitrary hardware GPUs, long GPU/native-memory retention and universal no-tunneling behavior remain unverified. No audio, networking, Electron host, new Collider type, ECS replacement or pooling contract was introduced. The reviewed game demonstrates ordinary code composition for a bounded shooter; it is not a claim of universal engine completeness or comparative superiority.

## Published validation

Main implementation commit [`700ba58228b7f4fe983d0b539e8bc8587e37b04c`](https://github.com/oz-coden/Simpludify/commit/700ba58228b7f4fe983d0b539e8bc8587e37b04c) passed [CI](https://github.com/oz-coden/Simpludify/actions/runs/40453060306) and [Documentation and Pages](https://github.com/oz-coden/Simpludify/actions/runs/40453060311), including its deploy job.

After deployment, the full site smoke suite passed independently against **https://github.oz-coden.com/Simpludify/** using Chrome 156.0.8078.4 at 1440×900 and 390×844. It checked all 22 documentation pages and six sample games, both themes, keyboard/synthetic touch, pause/restart, Prism Raid wins/losses through ordinary inputs, iframe disposal and focus return. No failed requests, HTTP errors or uncaught page errors were observed in those crawls. Existing renderer-unavailable startup help and the limited Character Canvas2D fallback also passed. This evidence comes from the actual public host, not an inference from Actions success.

Verified entry points:

- [Official documentation](https://github.oz-coden.com/Simpludify/)
- [Sample gallery](https://github.oz-coden.com/Simpludify/examples.html)
- [Play Prism Raid](https://github.oz-coden.com/Simpludify/play/prism-raid/index.html)
- [Controls and source guide](https://github.oz-coden.com/Simpludify/guides/prism-raid.html)
- [API review and measurements](https://github.oz-coden.com/Simpludify/en/shooter-validation.html)

Additional local 320×568 and 844×390 layout checks observed no horizontal overflow, all game controls at least 44×44 CSS pixels, and zero input sources after disposal. They are synthetic viewport checks, not physical-device coverage.
