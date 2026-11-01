# Experimental npm SDK v0.1.0

## Baseline and progress

- Baseline main: `e4f26cac2822f1a114d61e996e7b5ac161d5fb20`.
- Branch: `feat/npm-packaging-2026-11-01`.
- Target: `@simpludify/core@0.1.0`, `@simpludify/web@0.1.0`.
- Status: investigation/design checkpoint; packages have NOT been published.

## Investigation and design

Both workspaces are private, with exports pointing to TypeScript sources. Web depends on Core 0.1.0 and PixiJS 8.22.0, and imports scoped CSS automatically. Core compiles against ES2022 without DOM/Node ambient types. The root CLI builds games, not SDKs; CI covers quality, browser shards, production games and both site bases before Pages deployment.

Keep existing source/API boundaries. Add separate SDK emission with ESM, declarations and embedded-source JS maps; keep Pixi and Core external to Web. Export scoped CSS and preserve automatic CSS loading. Ship only compiled files, package README and MIT license. Internal source resolution must continue to support immediate source edits without a manual SDK rebuild. Distribution tests must use real tarballs outside the repository, including a small local registry to verify Web-only installation resolves Core transitively before public publication.

## Registry and authentication findings

Anonymous `npm view` on both target versions returned E404 on 2026-11-01 JST. This means no publicly readable target version was found; it does NOT verify namespace ownership, authenticated write access, or name availability for this account. npm account/org permissions and Trusted Publisher settings are unverified; no npm credentials are available to this task.

Official references checked:

- https://docs.npmjs.com/trusted-publishers/ : OIDC requires npm >=11.5.1, Node >=22.14, GitHub-hosted runners, `id-token: write`, and per-package publisher configuration.
- https://docs.npmjs.com/cli/v11/commands/npm-trust/ : package must already exist; CLI trust setup requires interactive 2FA.
- https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/ : package creation/publishing requires strong authentication; do not assume an email login alone authorizes publishing.

Initial publication cannot be assumed to work through an unconfigured OIDC identity. Prepare the SDK fully first; document the bootstrap restriction without creating tokens or weakening protections. Initial publish requires explicit final approval naming both versions. No public release/tag has been created.

## Validation

- `npm ci --no-audit --no-fund`: passed, 68 packages.
- Package builds, packed external tests and regression suite: pending.
- CI/main integration/Pages: pending.

## Resume

Read this report and inspect the branch head. Implement SDK builds and package metadata, then external tarball verification, manual OIDC workflow, guides and full regression checks. Save a remote checkpoint before long checks. Do not publish or mark npm installation as available until public registry verification succeeds.

## Core checkpoint

Core now has public compiled ESM/type exports, MIT metadata, a restricted file list and a standalone library build. `node scripts/build-packages.mjs core` and Node import/step/dispose passed (273.81 kB unminified JS, 69.17 kB gzip, embedded-source map). The pinned TypeScript 7 CLI provides no legacy compiler API; declaration path normalization therefore validates emitted static relative specifiers against actual .d.ts files. Packed external and NodeNext type checks remain pending. Root workspace resolution will be adjusted before full checks.

## Web checkpoint

Web ESM/type/CSS output builds successfully: 93.95 kB unminified JS (22.55 kB gzip) and 3.79 kB CSS. Core/Pixi remain external runtime dependencies. CSS is preserved through a build banner and `sideEffects` metadata. A shared repository-only Vite adapter and TypeScript paths keep source editing/tests/CLI/site/benchmarks independent from distribution output; no consumer alias is required. npm settings browsing encountered a Cloudflare human-verification wall, so authenticated org/publisher permission remains unverified. `npm run check` reached Biome with one newly added report-table formatting error; fix before regression checks. External pack tests still pending.

## External distribution checkpoint

Actual npm tarballs pass file allowlist/integrity/source-map checks. Independent Core-only installation passes Node execution, Engine lifecycle and NodeNext typechecking with ES2022 and no ambient host types. Independent Web-only installation passes automatic Core resolution through a temporary scoped registry serving the actual Core tarball; no direct Core dependency, workspace link or runtime alias is used. Web public declarations pass strict typechecking without skipLibCheck. The initial packed test detected TS2882 for CSS; added `style.css.d.ts` and a typed CSS export. Local browser launch is currently blocked by unavailable Playwright Chromium; the official browser download returned invalid ZIP content. Browser checks are required in CI, not marked passed locally.

The dedicated manual OIDC workflow and publication integrity/retry script are implemented; final review and CI remain pending. No publication attempt was made. Registry permissions are unverified.

## Trusted Publishing and regression checkpoint

- Remote checkpoints: investigation `43f7a8f`, Core `3e3d379`, Web/external tests/workflow `4e90801`.
- Local unit regression: 60 files / 805 tests passed. Root check passed before the new docs/workflow additions; final format/check is running.
- Added normal-CI `packages` job with external development/production browser consumers and archived actual tarballs/results; Pages deployment now also depends on it.
- Manual publishing validates an explicitly approved v0.1.0 tag matching the dispatched main SHA, with a successful main push CI. A separate OIDC-only publish job consumes the validated archives, verifies integrity, checks both registry versions before mutation, publishes/verifies Core before Web, and tests clean public-registry installs. No workflow was dispatched and no OIDC permissions are claimed verified.
- Added Japanese standalone Vite/CSS/lifecycle guide and English release/bootstrap runbook. Source scaffold and npm SDK paths are distinct; all public registry statuses remain unpublished. Root pack command rebuilds and saves npm pack metadata; consumers receive no repository-only lifecycle scripts.
- Local Chromium is unavailable, and the pinned official installer produced invalid ZIP content. Browser results must come from CI. Source regression CI started at https://github.com/oz-coden/Simpludify/actions/runs/41319627407 ; it precedes the final dedicated packaging job and final format fixes, so it is not final acceptance.

## CI-discovered CSS correction

Initial CI 41319627407 exposed dropped automatic CSS in production (unstable DOM controls); quality also reported the two pending doc/workflow format fixes. `sideEffects: ["**/*.css"]` was insufficient when Vite bypassed the Web barrel during tree shaking. Marked the Web source/compiled entry and CSS as side-effectful; rebuilding ui-scenes now emits the scoped `.simpludify` stylesheet. External acceptance now asserts actual CSS rules and a separately emitted application SVG, two shared-image leases, and zero image/renderer resources after disposal. No engine runtime behavior/API was changed. Final CI is pending this correction.

Final local `npm run check`: passed with existing informational/warning diagnostics. Site `/Simpludify/` build/reference check: passed, 70 HTML documents / 4801 links/assets / 64 standalone snippets. These source-site checks preceded the CSS metadata correction; production/browser acceptance is being repeated in CI.
