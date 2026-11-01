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
