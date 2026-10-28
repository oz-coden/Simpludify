# Unified input: migration and validation

## Source of truth

Before unification, InputState held an aggregate physical-key set and immutable InputReader frames. KeyboardController converted that frame using KeyMap/Movement while ActionController independently captured logical values and Button transitions. Game scanned Actors for KeyboardController keys in addition to accepting Action bindings. Character and older games still required the physical path.

Now the only gameplay path is:

1. Game's BrowserInput validates physical codes and writes one KeyboardSource. Touch/AI write typed logical ActionSources.
2. InputSystem owns device contributions and registers ActionController boundary participants. It has no implicit scripted writer, physical frame cache, direction calculator or aggregate key-count state.
3. ActionController alone resolves bindings, composes logical values and retains ordered Button transitions. Its immutable frame is captured for every active controller before any input callback runs.
4. Game Components explicitly read their controller or a kind-typed ActionReader. ActionMovement copies an Axis2D reader into Motion. No Action name is prescribed by the engine.

The remaining device-key sets and logical Action values are different facts, not alternative gameplay state stores. Keyboard aliases are ORed across devices, then combined with logical sources according to the existing Button/Axis contracts. Both source handle types share OwnedInputSource for lifetime, clear/dispose and late-neutral-write behavior. Actual Button/Axis composition remains solely in ActionController.

## Removed and retained APIs

| API                                                       | Result                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| InputState, InputReader, InputSource                      | Removed; no raw gameplay state or implicit scripted writer                             |
| KeyMap, KeyMaps, Movement                                 | Removed; KeyboardBindings contains only frozen Axis2D physical binding data            |
| KeyboardController                                        | Replaced by ActionMovement with explicitly injected Axis2D ActionReader                |
| UpdateContext.input                                       | Removed; inject only the Action dependency a Component needs                           |
| Character movement/keys                                   | movement is an optional ActionReader<"axis2d">; keys option removed                    |
| ActionController / ActionSource / defineActions / KeyCode | Retained with existing typed bindings, edge, source and config contracts               |
| InputSystem / KeyboardSource                              | Engine/device routing boundary; typed keyboard adapter and physical-binding tests only |
| BrowserInput                                              | One Game-owned keyboard adapter, accepts active Action bindings only                   |

KeyboardSource is still public so a non-DOM keyboard adapter and physical-binding regression can exercise exactly the same device boundary as Web. It is write-only; it cannot move a Character or supply a raw UpdateContext reader. Ordinary game developers do not need it. Its small maintenance surface is KeyCode validation and the shared source lifetime, not a legacy keyboard game controller. Custom device axes use ActionSource rather than invented key strings. Game already owns BrowserInput; attaching a second one is unnecessary.

## Samples

All six gallery entries retain their existing presentation and game rules. Character, UI/Scenes and Beacon Field explicitly create an ActionController and inject its reader. Signal Run now uses one custom SignalMovement Component for both Move Actions and pointer destinations, replacing the earlier two-writer ActionMovement/PointControl composition. Touch/automation still write logical vectors. See [movement composition](movement.md). Blockfall retains ordered command Buttons and game-owned repeat timing. Prism Raid removes its redundant Steering Component in favor of ActionMovement; continuous/short-tap fire and its logical-input autopilot remain game rules. Headless and maintained benchmark entry points were migrated too.

## Remaining review topics

The existing lifecycle regressions still cover disposal during initial activation, dependent Component teardown and phase-independent timers. Repeating timers retain fractional time, drop missed repetitions and invoke at most once per step. This revision does not redesign them.

Renderable investigation at the input-unification revision identified immutable visual values and replacement blocked by dependent Components. [Live rendering](rendering.md) now addresses this with validated setters, source revisions, image generations, cancellation and readiness. Shared images and animation remain deferred.

Text remains a Web editing stream. [The native typing recipe](action-input.md#text-and-typing-games) covers input/composition, focus and committed-value deduplication. No new parallel key-based text system or TextInput widget is introduced. OS IME UI and physical mobile software keyboards require further device testing.

## Validation

The runtime/source checkpoint is [`e72e654`](https://github.com/oz-coden/Simpludify/commit/e72e6542934a875c42a9b1c7a5dc6a573ddea363). Its [CI](https://github.com/oz-coden/Simpludify/actions/runs/40506220019) and [Pages validation](https://github.com/oz-coden/Simpludify/actions/runs/40506220035) succeeded, including:

- Strict TypeScript, DOM-free Core, architecture boundaries and license checks.
- 214 unit cases, including initial activation disposal, dependency teardown, timer phase/remainder, same-seed Action replay, source disposal, cross-Scene reader diagnosis and stable continuous-vector identity across unchanged steps.
- 84 Chromium cases at 1440×900 and 390×844, including actual keyboard/CDP touch, rebinding, pause/Scene boundaries, input-only automatic wins, native text editing and synthetic IME commits.
- Standalone UI/Scenes and Signal Run production smoke tests under `/Simpludify/`.
- Integrated documentation and all six game builds, reference checks, 16 independently typechecked examples, theme regression, game outcomes, restart/stop and iframe cleanup under `/Simpludify/`.
- All maintained Core benchmark commands (`bench`, `bench:practical`, `bench:response`).

The integrated site was also rebuilt and browser-tested with base `/`: 24 documentation pages and six sample entry points (30 HTML documents), 1080 references and 16 independently typechecked snippets passed. Desktop/narrow themes, controls, game outcomes, restart/stop and iframe disposal all passed with no browser/network failures.

The final type fixture additionally rejects the removed implicit input writer/frame capture, for 17 `@ts-expect-error` contracts. The typing example attaches its native field on Scene activation so staged preparation cannot take focus from the active Scene.

The two old touch assertions were intentionally migrated from physical-key arrays to logical vectors. Diagonal values use numeric tolerance rather than exact binary equality; game behavior was not changed to accommodate a test. Existing immutable Action frames, ordered commands, config import validation and allowed binding conflicts remain covered.

## Isolated performance comparison

[Raw reports](../benchmarks/unified-input/) contain three interleaved runs per revision, all on Node 24.22.1/Linux/AMD EPYC 9V74. Baseline is clean `12a5666`, unified input is clean `e72e654`. Each invocation ran alone, without other local tests/builds/benchmarks. For each revision run:

```sh
npm ci
node --expose-gc scripts/benchmark-shooter.mjs --out /tmp/shooter-core.json
```

The unchanged workload runs five warmup rounds, then 60 complete rounds for seeds 42–101, dt=1/120 and autopilot decisions every six steps. Each run produced exactly 172796 steps, 1439.97 simulated seconds, 60 wins, zero losses, 1440 kills and 18774 player shots plus enemies. Every disposed round had zero remaining game Units and registered colliders. Peak 41 is a Unit count, not a count of every Actor.

| Measurement                       | Baseline (3 runs)       | Unified (3 runs)        |
| --------------------------------- | ----------------------- | ----------------------- |
| Complete-round wall time          | 3.287 / 3.571 / 3.417 s | 3.204 / 3.264 / 3.462 s |
| Median wall time                  | 3.417 s                 | 3.264 s                 |
| 10000 shot Actor create/dispose   | 97.2–99.1 ms            | 97.5–113.4 ms           |
| GC heap increase across 60 rounds | 0.096–0.123 MB          | 0.098–0.111 MB          |

The measured total workload shows no large regression; the slightly lower median is not a general speedup claim from three samples. Actor-churn timing varies and does not justify pooling or another allocator redesign. Managed heap includes Vite/SSR/tooling and the table is not a proof of leak freedom. No GPU/rendering or physical-mobile performance conclusion follows from a Core benchmark.

The input path removes the second physical-frame copy and no longer recomputes continuous Action vectors every step when no contribution changed. A regression asserts stable vector identity. Snapshot calls still deliberately allocate diagnostic copies; they are inspection APIs, not recommended per-Actor input reads.

Remaining validation limits: actual OS IME candidate UI, physical mobile software keyboards, Safari/Firefox, long real-time memory soaks and cross-platform bitwise determinism. A dedicated TextInput helper, fixed-step/replay support and mutable visual configuration remain separate future tasks.
