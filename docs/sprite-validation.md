# Sprite implementation and validation

Validated on 2026-10-29 JST. Work began from main `8b6babe9157c0dbb2ceb288afc8a4595ed8535dd`; all changes are on `codex/working-sprites`. Main was neither pushed nor merged. Runtime/sample source through `7c823da6beadab0503c606d84d271b5a0bcfea80` was exercised; the final commit adds this report. The final branch head is the authoritative complete delivery.

## Implementation

- Core: immutable SpriteSheet metadata, row-major grids, named aliases, named/numeric arbitrary rectangles, safe integer validation and decoded-image boundary resolution. `get()` produces an immutable image source usable directly by Renderable.
- Core: SpriteAnimation Component with copied SpriteClip definitions, typed clip/frame names, fps/frameSeconds alternatives, default looping playback, play/restart/pause/resume/stop, observable state/cursor/time and synchronous one-shot completion.
- Animation uses LateUpdate simulation seconds. Large deltas use bounded arithmetic, including overflow-safe remainder addition; actor/component gating and Game pause retain Core scheduling semantics. No renderer ticker or host timer drives playback.
- Renderable's existing source gains an optional frame. Existing image/shape calls remain valid. Validated frame descriptions participate in source equality and revision no-ops. Animation only changes source; tint, sizing, Transform, opacity, visibility and depth remain independent.
- Web: one existing image entry/base Texture/TextureSource per resolved URL; cached crop Textures by rectangle. Same-frame Actors and equivalent grid/rect crops share a view. Frame changes use the committed lease without reloading/acquiring. Final base-image use destroys crop views before the owned source. Existing request generations, cancellation and retained-display readiness remain in use.
- Invalid decoded frames reject readiness, retain the previous display and recover when corrected, including before first commit and while retaining a different image. Failed staged frame preparation preserves the active Scene and releases candidate leases.
- Sprite garden: original eight-cell MIT SVG, WASD idle/walk selection, independent tinted friend, playback buttons, and Scene round trips. CLI and site gallery include the sample; Japanese and English guides document ownership/defaults/errors.

See [Sprite contracts](sprites.md) for runnable examples and precise defaults. No new runtime or development dependency was added; package scripts only add an optional completion check.

## Results

Environment: Linux, Node 24.22.1, npm 11.9.0, pinned TypeScript 7.0.2 and PixiJS 8.22.0; Chrome for Testing 156.0.8078.4 (Playwright Chromium 1248), WebGL/SwiftShader plus forced Canvas2D. Browser viewport sizes are 1440×900 and 390×844.

| Verification                                               | Result                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci --offline`                                         | Passed using the available dependency cache; lockfile unchanged.                                                                                                                                                                                         |
| `npm run check`                                            | Passed strict TypeScript, DOM-free Core, Biome, architecture/file checks and license review for 116 locked dependencies. Twelve warnings remain in unchanged existing files; no lint errors.                                                             |
| `npm test`                                                 | 360 tests passed in 26 files. Includes grid/rect/name/bounds, shared crop/source lifetime, playback operations, fractional and huge deltas, disposal/callback behavior, and independence.                                                                |
| `npm run check:sprite-completions`                         | Passed against the pinned TypeScript completion API using an in-memory file: both sheet.get and animation.play offer exactly idle/walk. No editor or source-file mutation required.                                                                      |
| `npm run test:browser`                                     | 146 tests passed with retries disabled, including all 20 sprite cases (five behaviors × two backends × two viewports).                                                                                                                                   |
| Additional staged-invalid-frame coverage                   | Four backend/viewport cases passed after extending the existing invalid-frame fixture. Old green pixels and one active lease survive a failed candidate Scene.                                                                                           |
| `npm run build -- --target web`                            | Passed for the default sample.                                                                                                                                                                                                                           |
| `npm run test:build`                                       | Production default sample passed under /Simpludify/ at both sizes.                                                                                                                                                                                       |
| Sprite production build + `node scripts/smoke-sprites.mjs` | Passed at both sizes: screenshot pixels identify the artwork and prove WASD moves the green sprite; playback buttons, three leave/return cycles and final disposal pass without console/page/HTTP errors. Desktop and narrow screenshots were inspected. |
| Site build/check/test with base /Simpludify/               | Passed 35 pages, seven sample entries, 42 HTML documents, 1971 links/assets and 44 independently typechecked documentation snippets; theme, startup fallback, gallery restart/stop and cleanup passed at both sizes.                                     |
| Site build/check/test with base /                          | Passed the same pages/examples, reference/snippet checks, themes, controls and cleanup at both sizes.                                                                                                                                                    |

The first full browser run produced 145 passes and one existing narrow Signal Run input failure (menu observed while polling movement). Its isolated rerun and a subsequent unchanged full run both passed; the root cause was not established. That existing test was not weakened or edited. The sprite-specific fixtures consistently passed their rendering/resource checks. Two sample-harness defects (bare module import and duplicate module URL) and the production pixel reader were corrected during validation; the latter now reads compositor screenshots because ordinary WebGL framebuffer reads can be cleared after presentation.

Expected failure fixtures deliberately report image/frame diagnostics to their observer. The ordinary sprite sample and production checks observed no unhandled error/console failure. These tests cover resource identities, destruction flags, reference counts and repeated transitions, not native decoder/GPU heap profiling or proof of leak freedom.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run check:sprite-completions
npm run test:browser
npm run test:build
npm run build -- --target web --example sprites --base /Simpludify/
node scripts/smoke-sprites.mjs
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
npm run site:build -- --base /
npm run site:check
npm run test:site
```

Set CHROMIUM_PATH when using an existing compatible browser; otherwise install Playwright Chromium first. Do not run independent browser suites simultaneously because input/focus fixtures expect a foreground game. No benchmark was run or speedup claimed for this change.

## Limits and integration review

- Crop views remain cached until the last base-image lease. A finite sheet bounds usage; continually inventing rectangles on a permanently live URL can grow the cache. Diagnostics textures still counts base resources, not crop views/GPU bytes.
- Grid count/image bounds are unknown before decoding; only requested frames are decoded-bound validated. Grid dimensions must divide the image exactly. Rectangles support neither trim/rotation/pivot metadata nor atlas parsers/margins/spacing.
- A playing animation owns Renderable.source at animation updates. Pause/stop/disable/remove before assigning a manual source. Other Renderable properties are independent. Removing only SpriteAnimation keeps the final image source alive on Renderable.
- Uniform timing only; no per-frame duration arrays, frame callbacks, dynamic clip registry, preload handles, GUI, generic state machine/control-right manager, tilemap or renderer redesign.
- Safari/Firefox, mobile devices, hardware GPU throughput, long real-time soaks and retained native/GPU memory were not tested. WebGL context recovery remains outside scope.
- Before merging: review the source-ownership/tint defaults, strict grid/deferred validation choice and crop-cache lifetime; compare against main changes since the starting SHA and run the recorded checks in CI. Hosting is not deployed by this branch.

## Saved commits

Every commit below was immediately persisted by a fast-forward update of the working branch. The report is committed and persisted after these source/test checkpoints.

| Commit    | Change                                                                    |
| --------- | ------------------------------------------------------------------------- |
| `32bae83` | feat(core): define immutable sprite sheets and validated frame regions    |
| `c54208d` | feat(web): render shared sprite frames with retained-image readiness      |
| `9e9c7bf` | feat(core): add typed simulation-driven sprite animation component        |
| `3647e6b` | feat(examples): add sprite garden and real-browser frame lifecycle checks |
| `e4fb9e7` | fix(web): recover corrected frames while retaining a different image      |
| `121cc31` | docs: document sprite contracts and integrate sprite garden in the site   |
| `81be79e` | test: verify sprite name completions and failed staged-frame recovery     |
| `7c823da` | test: verify production sprite pixels movement and scene cleanup          |

## Changed files relative to starting main

- `README.md`
- `SPEC.md`
- `docs/api.md`
- `docs/architecture.md`
- `docs/rendering.md`
- `docs/roadmap.md`
- `docs/sprite-validation.md`
- `docs/sprites.md`
- `examples/sprites/README.md`
- `examples/sprites/hero.svg`
- `examples/sprites/index.html`
- `examples/sprites/main.ts`
- `package.json`
- `packages/core/src/components.ts`
- `packages/core/src/index.ts`
- `packages/core/src/sprite-animation.ts`
- `packages/core/src/sprite-sheet.ts`
- `packages/web/src/renderer.ts`
- `packages/web/src/shared-images.ts`
- `scripts/check-sprite-completions.mjs`
- `scripts/cli.mjs`
- `scripts/smoke-sprites.mjs`
- `site/config.mjs`
- `site/ja/api.md`
- `site/ja/examples.md`
- `site/ja/index.md`
- `site/ja/limitations.md`
- `site/ja/rendering.md`
- `site/ja/sprites.md`
- `tests/browser/sprites-fixture.ts`
- `tests/browser/sprites.spec.ts`
- `tests/types/sprites.ts`
- `tests/unit/renderable.test.ts`
- `tests/unit/shared-images.test.ts`
- `tests/unit/sprite-animation.test.ts`
- `tests/unit/sprite-sheet.test.ts`
