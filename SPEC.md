# Code-First 2D Game Engine — Specification (Draft v0.1)

Status: Initial implementation specification
Date: 2026-10-26

> This document specifies a general-purpose, code-first 2D game development framework. All names and API examples are provisional until validated through a working vertical slice.

## 1. Product goals

Enable developers, including AI coding agents, to create, test, package, and distribute 2D games without a visual editor. Optimize for the effort required to complete a game, not the number of features in the engine.

### Guiding principles

1. **Code is the source of truth.** Scenes, entities, UI, input, assets, styles, and build configuration are authorable in code. No mandatory GUI editor or interactive configuration wizard.
2. **Simple tasks should be trivial.** Displaying and moving a character should need only a few lines of user code. Defaults are documented, overrideable, and predictable.
3. **Good presentation by default.** Adaptive layout, sensible typography, spacing, controls, and themes work without manual pixel tuning.
4. **Explicit when necessary.** All automatic decisions are overrideable. Absolute positioning is supported, but responsive behavior is not guaranteed for explicitly fixed placements.
5. **Portable game logic.** The core does not depend on DOM, PixiJS, Electron, Node.js, or a specific OS. Platform and renderer integration happens through adapters.
6. **AI-friendly through ordinary tooling.** Stable, typed APIs; noninteractive CLI; structured diagnostics; reproducible headless scenarios. AI integration is optional, and games never require AI to run.
7. **Performance by default.** Avoid needless updates, layout recalculation, allocation, and main-thread blocking. Measure against equivalent workloads in existing engines.
8. **Permissive distribution.** MIT for original engine code; permit commercial use, modifications, and redistribution. Respect and automate notices for third-party dependencies and assets.

## 2. Scope and non-goals

### MVP must include

- TypeScript SDK, type-safe enum-like constant APIs and IDE autocomplete.
- A minimal scene/lifecycle API and simple entities, including a movable character with defaults.
- Keyboard input with sensible key-repeat behavior, configurable mappings, delta-time movement, and diagonal normalization.
- A PixiJS renderer adapter with simple sprite and shape rendering, default placeholders, and clean disposal.
- Declarative DOM UI elements (text, button, panel) and responsive layout using Flexbox/Grid, theme tokens, intrinsic sizing, and optional aspect-ratio policies.
- Web build from static assets; Windows portable packaged output with bundled runtime via Electron.
- Noninteractive CLI: create, dev, check, test, build; machine-readable `--json` diagnostics.
- Headless core execution and tests without a browser; browser-based UI smoke tests and a Windows package smoke test in CI where a compatible runner is available.
- A playable example using only a few lines for character setup, plus a sample demonstrating UI and scene switching.
- API documentation and a quickstart that a first-time user can follow unaided.

### Deferred

- C# SDK and cross-language runtime; alternative native runtime; full physics; animation editor; tilemap editor; network multiplayer; complex shaders; advanced accessibility system; automatic AI game creation service; visual editor; mobile native packaging; generic ECS framework unless justified by real requirements.

## 3. Proposed monorepo layout

```text
packages/
  core/              # platform-agnostic game state, lifecycle, input contracts, time
  api/               # public TypeScript SDK and high-level presets
  renderer-pixi/     # PixiJS implementation, isolated behind renderer contracts
  ui-dom/            # DOM UI, theme tokens, responsive layout
  platform-web/      # web bootstrap and browser services
  platform-electron/ # safe Electron runtime, desktop packaging
  cli/               # create/dev/check/test/build/doctor
examples/
  character/         # few-line interactive character example
  ui-scenes/         # adaptive UI and scene navigation
  headless/          # scripted simulation and assertions
 docs/
  architecture.md
  api.md
  performance.md
  licensing.md
```

Packages can be consolidated if separation introduces needless indirection. Dependency direction must remain explicit:
- core → no other package, no browser/desktop APIs;
- api → core and contracts, not Electron;
- renderer-pixi → core/contracts + PixiJS;
- ui-dom → core/contracts + browser DOM;
- platform packages → adapters + app bootstrap;
- cli → build tools/platform packages; not imported by games at runtime.

Avoid speculative abstractions. Each public abstraction must have a working use case and tests.

## 4. Game and scene API

Aspirational usage, not an existing implementation:

```ts
import { Game, Character, Movement } from "@engine/api";

const game = new Game();
game.add(Character({ movement: Movement.WASD }));
game.run();
```

This example must work with a built-in placeholder visual and default position. Explicit image asset:

```ts
game.add(Character({ sprite: "./assets/player.png", movement: Movement.WASD }));
```

Design stable lifecycle semantics: create/setup → ready/assets resolved → update → render → dispose. Define cleanup for scene transitions, subscriptions, loaded resources, and input bindings. Provide scene IDs, typed navigation, and clear errors for invalid transitions. Be explicit about async asset loading and `run()` readiness (Promise or start handle).

Do **not** sacrifice semantics to meet line counts: keep minimal usage brief while exposing customization.

## 5. Coordinates, scaling, and layout

### Game world

- World coordinates use logical world units, not physical pixels; movement speed uses world units per second.
- A configurable camera maps world coordinates to the viewport; device-pixel-ratio handling belongs to renderer.
- Support fixed logical world extent or adaptive world extent with a documented aspect policy.
- Absolute world coordinates are natural and supported; responsiveness claims apply to the presentation system, not arbitrary game mechanics.

### UI

- Declarative component layout, default auto sizing, flex/grid distribution, intrinsic text measurement, safe-area support where practical.
- Relative constraints and semantic tokens take priority over fixed pixel values: `Fill`, `Auto`, proportional units, min/max constraints, `AspectRatio`, alignment, spacing presets.
- Screen aspect policies: **Fit** (preserve logical ratio with letter/pillarboxing), **Fill** (preserve ratio and crop), **Adaptive** (reflow available UI; world policy separately specified). Do not implement distortion by default.
- Aspect ratio is width/height, including values such as `16 / 9` or `4 / 3`. Do not require explicit viewport width and height for normal usage.
- Font loading supports packaged local fonts. Changing fonts, text, locale, or viewport invalidates only affected layout nodes. System fallbacks must be documented.
- Provide accessible focus/keyboard interaction and basic contrast/size defaults for DOM controls.
- Fixed positioning and sizes are allowed via an explicit API; the engine does not promise to prevent clipping or collision for hard-coded geometry.
- Separate UI overlay from the canvas, with defined pointer-event routing, z-order, resizing, and coordinate transforms.

### Themes

Offer a small set of attractive built-in themes, semantic color roles, typography scales, spacing scales, and explicit overrides. No mandatory design file or GUI theme editor.

## 6. Typed API conventions

- No undocumented magic-string modes. Export named constant objects + corresponding union types (or actual enum when beneficial).
- Favor serializable, self-describing values for configuration; stable schema for diagnostics.
- Use discriminated unions when they enable exhaustive checking.
- Defaults, units, ownership, error behavior, and lifecycle are documented for each public API.
- Avoid committing to a cross-language schema/ABI prematurely; keep contracts implementation-independent where feasible. C# is a future SDK requiring its own runtime strategy.

## 7. Simulation, input and testing

- Core supports step-based deterministic execution with controlled clock and seeded randomness _for engine-managed sources_.
- Accept synthetic input events; export state snapshots and structured diagnostics.
- Determinism is scoped: external time, host APIs, arbitrary user randomness, asynchronous resource loading and GPU rendering are not implicitly deterministic.
- Render tests may use Playwright screenshots and inspect DOM/canvas bounds. Visual regressions require maintained reference images or explicit assertions.
- `check` runs typecheck, lint, package/asset validation; `test` runs unit/integration; `doctor --json` provides actionable diagnostics.
- All commands support CI use with documented exit codes, no mandatory prompt, and usable text output by default.

## 8. Runtime and distribution

- Web target emits static files working under a configurable base path, usable on GitHub Pages.
- Windows target packages a local-game Electron renderer and a bundled Chromium/Node runtime, with an `electron-builder` portable distribution option.
- Distinguish single-file portable distribution from runtime extraction at launch. No claim that portable guarantees zero temporary files.
- Main game loop runs in the renderer without per-frame Electron IPC.
- Electron security baseline: `nodeIntegration: false`, `contextIsolation: true`, sandbox enabled, restrictive CSP, local bundled code, narrow validated preload API, deny unnecessary permissions/navigation, no arbitrary external content execution.
- External network access is not required for offline games. A game can opt in to network functionality explicitly.
- Asset-excluded runtime and engine package target: below 1 GB. Keep compressed package size and installed/extracted size as separate metrics.
- Other desktop platforms and native backends are future targets, not MVP commitments.

## 9. Performance and quality

Prioritize **frame pacing and interaction latency** over startup time. Startup delay and distribution footprint are secondary within user-defined limits.

Benchmark at least these workloads on controlled hardware and software versions:
1. Idle/empty scene;
2. 1,000 moving sprites;
3. 1,000 UI nodes and selective state updates;
4. Continuous resizing with font changes;
5. Scene creation/disposal cycles;
6. Long-running idle and active session with memory tracking.

Measure p50/p95/p99 frame duration, dropped/slow frames, memory stability, CPU/GPU load where available, startup time, and distribution size. Define comparator games in Godot/Phaser or another relevant engine **before** making any performance superiority claim. A single machine/renderer test is not proof of general superiority. No hard FPS guarantee for arbitrary scenes or hardware.

## 10. Licensing and dependency policy

- Original engine sources: MIT license with copyright notice.
- Third-party libraries: prefer permissive licenses with minimal downstream obligations; evaluate exact transitive dependencies, fonts, native binaries, and redistributable runtimes before packaging.
- Preserve upstream notices where required; generate packaged notices automatically and include an SBOM/license audit workflow.
- Games built with the engine do **not** inherit a mandatory MIT license for the game's original code or original assets. Distribution still must honor bundled third-party licenses.
- Optional sponsorship via GitHub Sponsors, no royalties or paid license gates.

## 11. Agent-oriented development

- `AGENTS.md` should explain architecture boundaries, conventions, commands, review checklist, and test fixtures to coding agents.
- No hidden GUI actions; every build and test step callable from CLI.
- Structured errors include stable machine-readable codes and relevant paths/scene/component IDs.
- Examples and docs are treated as executable contract tests where practical.
- Avoid runtime dependency on model providers, cloud AI APIs, telemetry, or auth.

## 12. Acceptance criteria for first vertical slice

All must pass:

1. A newly generated project starts with one documented command and no mandatory wizard.
2. An example with `Game`, `Character`, and `Movement` shows a movable placeholder character using WASD; movement is frame-time independent and diagonal speed normalized.
3. A scene switch and UI button work, defined entirely in TypeScript; the screen adapts to two significantly different viewport sizes without obvious clipping in the tested examples.
4. Core unit tests run in Node with no DOM/Electron dependency.
5. Web app launches and passes a Playwright smoke test.
6. Windows portable executable can be built and launched on a supported Windows CI runner or is explicitly flagged as pending if only a different OS is available.
7. Build and diagnostic commands can run noninteractively and return correct status; at least diagnostic failures have JSON output.
8. No engine package depends on Electron except the Electron platform/packaging package.
9. Initial benchmark baseline recorded; no unsubstantiated claims about outperforming other engines.
10. MIT license, dependency notices, README, architecture docs, and examples are provided.

## 13. Release sequencing

**Phase 0 — Workspace and boundaries:** monorepo, TypeScript config, lint/test/build, dependency graph assertions, license/CI, docs.

**Phase 1 — Executable Web slice:** core, high-level character API, input, Pixi adapter, demo, delta-time tests.

**Phase 2 — UI/scene system:** responsive DOM UI, themes, scene switching, aspect policies, screenshot tests.

**Phase 3 — Headless and CLI:** deterministic core stepping, typed input injection, JSON diagnostics, create/dev/check/test/build.

**Phase 4 — Desktop packaging:** secure Electron adapter, portable Windows build, packaging smoke tests, notices.

**Phase 5 — Quality gates:** benchmark baselines, performance improvements, document and verify API contracts.

Work may be divided into small PRs. Do not use placeholders for acceptance criteria; document blockers and unimplemented features precisely.

## 14. Open design decisions (do not silently lock in)

- Final project and npm package name.
- Whether character collision, sprite animation, and camera follow belong in MVP or first extension.
- Whether desktop portable output should be default or opt-in.
- Supported minimum versions of Node, Windows, and browsers, determined after CI verification.
- Exact semantics of scene creation and async asset readiness.
- Future C# runtime strategy and native platform implementation.
