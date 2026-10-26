# Contributor instructions

Simpludify is an experimental code-first TypeScript 2D engine. Read `README.md`, `docs/architecture.md` and `docs/api.md` before changing lifecycle or public APIs. `SPEC.md` describes broader goals; `docs/roadmap.md` records implemented scope.

## Boundaries

- `packages/core` has no imports outside itself and compiles without DOM/Node ambient types. Keep browser/Pixi/Electron APIs out of it.
- `packages/web` owns renderer, browser input, DOM overlay and asynchronous scene transitions. It must not acquire Electron/Node runtime dependencies.
- Prefer readable typed mode objects with corresponding union types. Document units, defaults, ownership, readiness and errors when behavior changes.
- Keep the entity roster sealed after Web readiness until a tested dynamic entity lifecycle is introduced.
- Never require an editor, interactive wizard, AI service or per-frame IPC.

## Commands and fixtures

Run `npm ci`, `npm run check`, `npm test`, `npm run build -- --target web`. For browser changes install Chromium with `npx playwright install --with-deps chromium`, then run `npm run test:browser`. `CHROMIUM_PATH` selects a compatible existing Chromium binary. `npm run bench` and `npm run bench:browser` measure local performance; they do not assert superiority over other engines.

Unit fixtures cover movement/input/determinism/aspect mapping, scene cleanup and CLI diagnostics. Browser fixtures cover real Pixi output, images, focus, viewport bounds, scene UI, failed readiness and disposal. Maintain those behavioral contracts when refactoring. Examples are executable documentation; keep their imports and APIs synchronized with the docs.

## Review checklist

- Verify no core ambient-host dependency or unreviewed runtime dependency was introduced.
- Exercise startup failures, scene failures, repeated transitions, pending async work and idempotent disposal.
- Check native button focus and input release on blur; avoid global keyboard capture.
- Use browser layout capabilities, scoped CSS and textContent for UI text.
- Validate licenses/notices after dependency changes; update the lockfile and document reviewed exceptions.
- Explain actual tested support and deferred features precisely. Do not claim packaging, benchmarks or browser compatibility from unrun paths.
- Public docs, code comments and commit messages must make sense without private planning conversations. Match existing language/style and avoid unnecessary unrelated edits.

The project and internal packages are private workspaces for now. Do not publish npm packages or create releases as part of routine implementation work.
