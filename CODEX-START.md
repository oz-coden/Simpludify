# Codex implementation kickoff

Implement the first vertical slice of the code-first TypeScript 2D game engine described in `SPEC.md`. This is a greenfield implementation. Use a provisional project/package name if none has been selected; avoid publishing packages or creating external repositories under an invented permanent name.

## Task

1. Read `SPEC.md` completely. Identify any technical contradictions before coding. Choose the minimum sustainable architecture; document decisions in `docs/architecture.md`.
2. Initialize a TypeScript workspace with strict typechecking, package manager lockfile, scripts, Vitest tests, eslint (or equivalent), and CI-ready noninteractive commands. Keep runtime core independent of DOM, Node, Electron, and PixiJS.
3. Implement a working **web vertical slice**: `Game`, `Character`, and explicit typed Action input (`ActionController`, Axis2D reader, KeyboardBindings.WASD); frame-rate-independent movement; diagonal normalization; default visible character; a minimal PixiJS renderer adapter. The simple usage sample must work without manually authored sprites or a visual editor.
4. Implement a minimal DOM UI overlay for a label and clickable button, scene switching, and a simple adaptive layout/aspect policy. Use existing browser layout capabilities rather than writing an unnecessary custom layout engine.
5. Provide demonstrative examples and unit tests for core/inputs/scene lifecycle; a browser smoke test at two viewport dimensions; explicit cleanup/disposal tests.
6. Add initial CLI commands or scripts for noninteractive `dev`, `check`, `test`, and `build --target web`; meaningful exit codes. Prefer a thin working tool over a speculative full CLI framework.
7. Create `README.md` quickstart, `docs/api.md`, `docs/architecture.md`, `AGENTS.md`, `LICENSE` (MIT), and `docs/licensing.md`. All public text must be understandable by readers without access to the planning conversation.
8. Do not implement Electron desktop packaging in this first task unless the web slice and all tests are already working. Instead, define a narrow adapter interface and document an actionable next milestone. Do not promise a portable `.exe` until verified.

## Constraints

- Implement for usefulness, not artificial abstraction count. No speculative ECS, physics, multiplayer, custom renderer, or C# integration.
- Prefer readable public APIs with typed named modes over magic strings. Export value/type pairs if using `as const`.
- The game loop cannot require Electron IPC. Browser code should not leak into core.
- Every user-facing behavior must have documented defaults and override points.
- Avoid absolute pixel coordinates for UI layout by default; game-world coordinates are separate.
- Include dependencies only after verifying license suitability and maintenance; do not assume original game content inherits MIT.
- Do not change unrelated repositories, create remote repos, publish packages, or make releases without authorization.
- Test actual behavior; do not describe stubs or untested paths as complete.

## Delivery report

Report: (a) implemented functionality and commands; (b) tests actually run and results; (c) architectural decisions; (d) features deferred; (e) blockers; (f) next concrete milestone. Provide a small code example that works against the current implementation rather than merely an aspirational API.
