# Contributor instructions

Simpludify is an experimental code-first TypeScript 2D engine. Read `README.md`, `docs/architecture.md` and `docs/api.md` before changing lifecycle or public APIs. `SPEC.md` describes broader goals; `docs/roadmap.md` records implemented scope.

## Boundaries

- `packages/core` has no imports outside itself and compiles without DOM/Node ambient types. Keep browser/Pixi/Electron APIs out of it.
- `packages/web` owns renderer, browser input, DOM overlay and asynchronous scene transitions. It must not acquire Electron/Node runtime dependencies.
- Prefer readable typed mode objects with corresponding union types. Document units, defaults, ownership, readiness and errors when behavior changes.
- Keep Core lifecycle synchronous; Web owns asynchronous preparation, cancellation and presentation commit.
- Actor/Component additions start updating next step; removals/disables suppress later execution immediately. Preserve captured roster/component iteration safety.
- Collider policy/geometry and CollisionBody correction weight are separate. Motion owns movement intent; position correction runs before contact delivery. Keep the default Trigger policy explicit in migrations.
- Dependencies are explicit structural requirements, not an implicit scheduler. Maintain Input → Update → post-update contacts → timers → Scene callback order.
- Engine must not know Character behavior. Prefer Actor/Component composition over another entity hierarchy.
- Scope event subscriptions, timers, textures and pending loads to owners; test disposal during unfinished preparation.
- Keep World/Screen/physical coordinates and logical resolution/Viewport/Camera separate. DPR belongs only to presentation.
- Experimental APIs may be replaced with coherent documented APIs; do not keep duplicate implementations for compatibility.
- Never require an editor, interactive wizard, AI service or per-frame IPC.

## Commands and fixtures

Run `npm ci`, `npm run check`, `npm test`, `npm run build -- --target web`. For browser changes install Chromium with `npx playwright install --with-deps chromium`, then run `npm run test:browser` and `npm run test:build`. `CHROMIUM_PATH` selects a compatible existing Chromium binary. `npm run bench` and `npm run bench:browser` measure local performance; they do not assert superiority over other engines. `npm run bench:response` measures Trigger/Solid workloads; browser mode requires a production Signal Run build and supports an explicit bounded real-time soak. Do not run other local tests/builds during recorded benchmarks.

Unit fixtures cover movement/input/determinism, generic Actors/Components/dependencies, Scene lifecycle, scoped events/timers, coordinate spaces, trigger contacts, independent input sources, pause/game rounds and CLI diagnostics. The composition example logic is also a headless fixture. Browser fixtures cover real Pixi output, images, focus, viewport bounds, scene UI, failed readiness and disposal. Maintain those behavioral contracts when refactoring. Examples are executable documentation; keep their imports and APIs synchronized with the docs.

## Review checklist

- Verify no core ambient-host dependency or unreviewed runtime dependency was introduced.
- Exercise startup failures, scene failures, repeated transitions, pending async work and idempotent disposal.
- Check native button focus and input release on blur; avoid global keyboard capture.
- Use browser layout capabilities, scoped CSS and textContent for UI text.
- Validate licenses/notices after dependency changes; update the lockfile and document reviewed exceptions.
- Explain actual tested support and deferred features precisely. Do not claim packaging, benchmarks or browser compatibility from unrun paths.
- Public docs, code comments and commit messages must make sense without private planning conversations. Match existing language/style and avoid unnecessary unrelated edits.

The project and internal packages are private workspaces for now. Do not publish npm packages or create releases as part of routine implementation work.

## Official documentation site

`site/config.mjs` maps Japanese Markdown and existing English docs to static routes. Keep public API contracts in sync with source; SPEC proposals must not be described as implemented. `npm run site:build -- --base /Simpludify/`, `npm run site:check` and `npm run test:site` validate the integrated site without changing game CLI dist. Also test base `/` after build/config changes. Page content is trusted repository Markdown; do not accept arbitrary runtime HTML. Preserve first-party iframe disposal/focus behavior and include all notices. Pages must be enabled by an administrator before deploy; workflows must not enable visibility or configure DNS automatically.
