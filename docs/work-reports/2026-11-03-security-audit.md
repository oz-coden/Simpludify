# Security audit and input-validation hardening

## Baseline and scope

- Simpludify main baseline: `1164b77c0bc037f7afc3b29a32b48d6a2d27e476`.
- Branch: `main`.
- Scope: Core runtime/UI/input/replay/collision/tile modules (`packages/core`), Web adapter/DOM/Canvas native editing/shared image loading (`packages/web`), build/site/release scripts (`scripts`), GitHub Actions workflows (`.github/workflows`), starter template (`templates/npm-vite`), documentation site (`site`, `docs`), and examples (`examples`).

## Confirmed findings and fixes

1. **Canvas UI `fontFamily` validation and CSSOM assignment (`packages/core/src/ui/canvas-node.ts`, `packages/web/src/canvas-native.ts`)**:
   - `checkedStyle` previously accepted any non-empty string for `fontFamily`, and `nativeGeometry` interpolated `style.fontFamily` into `el.style.cssText`.
   - `checkedStyle` now rejects whitespace-only `fontFamily` strings and values containing CSS declaration/block/control delimiters or `url(...)`. `nativeGeometry` assigns `el.style.fontFamily` via CSSOM rather than `cssText` string interpolation.
2. **Game theme and token validation (`packages/web/src/game.ts`)**:
   - `Game` previously checked `Themes[options.theme ?? Theme.Dark]` via prototype-chain lookup and applied `options.tokens` entries to `--s-*` properties without validating key ownership or value syntax.
   - `Game` now validates `Object.hasOwn(Themes, themeName)` and validates every `options.tokens` key and value before creating or appending the host DOM element.
3. **Renderer image URL protocol allowlist (`packages/web/src/renderer.ts`)**:
   - `PixiRenderer.acquireImage` now restricts resolved asset URLs to `http:`, `https:`, `data:`, `blob:`, and `file:`, rejecting script or custom protocol schemes with `EngineError("ASSET_LOAD_FAILED", ...)`.
4. **Cross-platform Core dependency boundary validation (`scripts/core-boundary.mjs`)**:
   - `validateCoreDependency` previously split `relative(...)` paths only on `/`, causing backslash-delimited paths on Windows to return a single-element array and bypass internal module and parent-escape checks.
   - Path segments are now split on `/[\\/]+/` with explicit relative/non-absolute validation.
5. **Static preview server, site checker, CLI and release script hardening (`scripts/site-server.mjs`, `scripts/site-check.mjs`, `scripts/cli.mjs`, `scripts/publish-packages.mjs`, `site/assets/site.js`, `.gitattributes`)**:
   - `serveSite` and `site-check.mjs` now validate containment with `relative(root, target)` across POSIX and Windows path separators, reject encoded backslashes/null bytes/leading slashes in `serveSite`, and set `X-Content-Type-Options: nosniff`.
   - `cli.mjs create` rejects target directories inside the repository root to prevent recursive self-copying.
   - `publish-packages.mjs` validates `RELEASE_TAG` against `v${sdkVersion}` during dry-run verification as well as publication.
   - `site/assets/site.js` validates `data-launch` identifiers before constructing sample iframe URLs.
   - `.gitattributes` enforces LF line endings across platforms.
6. **Own-property lookups for bindings and replay metadata (`packages/core/src/interaction/actions.ts`, `packages/core/src/runtime/replay.ts`)**:
   - `ActionController` and `ReplayPlayer` now check `Object.hasOwn` when reading `options.bindings` and `this.data.metadata` so `Object.prototype` keys (`toString`, `valueOf`, etc.) are never confused with configured entries.

## Verification

- `npm run check`: passed (`tsc --noEmit`, `packages/core/tsconfig.json`, Biome, `scripts/validate.mjs`, `scripts/licenses.mjs --check`).
- `npm test`: passed (61 test files, 821 unit tests including new regression tests in `tests/unit/portable-ui.test.ts`, `tests/unit/ui.test.ts`, `tests/unit/actions.test.ts`, `tests/unit/replay.test.ts`, `tests/unit/cli.test.ts`, and `tests/unit/core-boundary.test.ts`).
- `npm run site:build -- --base /Simpludify/` and `npm run site:check`: passed (73 HTML documents, 5099 links/assets, 65 typechecked documentation snippets).
- `npm run pack:packages`: passed (`@simpludify/core` and `@simpludify/web` archives built and packed).
- `npx playwright test tests/browser/game.spec.ts --project=desktop` (with system Chrome via `CHROMIUM_PATH`): passed (7 browser tests including disallowed image URL scheme rejection).

## Limitations

- Passing static checks, unit tests, and browser smoke tests does not constitute a formal proof of complete security. Physical multi-device IME behavior, third-party browser/GPU driver vulnerabilities, and future unimplemented networking features remain outside the verified scope.

## Integration review follow-up

The [integration report](2026-11-03-security-integration.md) records further review against the latest main, corrections to path containment and legitimate input handling, external consumer validation and final merge/deployment evidence. The initial verification above applies to the original Argon commit; follow-up results are recorded separately.
