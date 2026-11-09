# Experimental npm SDK publishing

## Release status

Core/Web v0.1.6 are published on npm, adding physical bindings and single-input capture. Next development milestone is v0.1.7. See [publication and registry verification](../work-reports/2026-11-05-v0.1.6-publication.md). Earlier releases (including v0.1.5 through [Trusted Publishing run 41842910464](https://github.com/oz-coden/Simpludify/actions/runs/41842910464)) remain immutable.

## v0.1.6 scope

The release adds physical bindings for keyboard, mouse and gamepad, single-input capture, runtime reconfiguration, and JSON persistence to the existing unified input/gamepad system.

## Prepare and verify

Use Node >=22.12 for development and Node 24 in CI. The publish job requires npm >=11.5.1 and Node >=22.14. From a clean work branch:

```sh
npm ci
npm run version:sdk -- <version> # e.g. 0.1.7
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run pack:packages
npm run test:packages -- --packed
npm run test:starter -- --packed
node scripts/publish-packages.mjs
```

The last command only checks archives and registry availability; it does not publish. `version:sdk` updates the root/Core/Web versions, exact Web→Core dependency, workspace lock metadata, `ENGINE_VERSION`, and package README versions together. `sdk-version.mjs` rejects disagreement in builds, quality checks, package consumers and publication. There are no release-version literals in the validation or publication scripts/workflow. Review release notes and registry status separately; a source bump is not proof of publication.

`test:packages` creates genuine external temporary projects with no workspace aliases or symlinks. Core alone runs in Node and typechecks in NodeNext without DOM ambient types. Web alone resolves the exact Core tarball transitively using a loopback scoped registry. Both development and production subpath builds check CSS, public declarations, images, controls, scene replacement, `bindViewport` and idempotent resource cleanup at desktop, 390px and 320px. `--registry` installs the matching source version from public npm and runs the same fixture, including the new API. Network/authentication failures fail validation. Failed temporary projects remain available for inspection.

Regular CI builds the candidate pair once. Windows and Linux validate the packages and a copy of the Vite starter using those archives. The starter's committed lockfile continues to pin an actual published release. CI replaces both SDK entries in its temporary copy before running `npm ci`. Run To Exit uses the same archives with a pinned application revision. Its typecheck, units and production build run once, and Playwright tests that build at three viewport sizes with WebGL and Canvas2D.

For independent public-registry acceptance, run **Verify published npm SDK** with the exact version on a matching source ref. The release workflow invokes this check after both packages are published. Locally, use `npm run test:packages:registry` and `npm run test:starter:registry` from the matching source. Each uses its own initially empty npm cache. When the starter's committed pin differs from the target, the registry test updates only the temporary copy's lockfile.

`pack:packages` always rebuilds. Only compiled `dist`, metadata, README and MIT license ship. JavaScript maps embed source, declaration maps are omitted, and Web keeps Core and PixiJS as runtime dependencies rather than embedded copies. Web imports scoped CSS automatically and also exports `@simpludify/web/style.css` with declarations. Core has no runtime dependencies. `test-results/packages/` records pack manifests, SHA512 integrities, validation reports and screenshots.

## Trusted Publisher identity

The existing workflow is `.github/workflows/npm-publish.yml` and uses only `workflow_dispatch`; pushes, PR merges and tag creation do not publish. It grants `id-token: write` only to the publishing job. There are no long-lived npm credentials.

For **both** packages, npm Settings → Trusted publishing must match:

| Field             | Value                             |
| ----------------- | --------------------------------- |
| GitHub user       | `oz-coden`                        |
| Repository        | `Simpludify`                      |
| Workflow filename | `npm-publish.yml`                 |
| Environment       | Empty; the workflow declares none |
| Allowed actions   | Direct `npm publish` enabled      |

The [official Trusted Publishing guide](https://docs.npmjs.com/trusted-publishers/) was checked on 2026-11-02. It requires supported hosted runners, Node >=22.14 and npm >=11.5.1. Package settings need authenticated owner access; repository admin permission alone cannot confirm the current npm publisher settings. A successful previous OIDC release confirms historical operation, not current configuration. Do not change account security or collect credentials as part of a release.

## Final approval and manual release

1. Integrate only changes with successful full CI (a PR or an authorized direct main update). Record the full main commit SHA and wait for that exact main push CI to pass. Freeze the candidate commit for release; subsequent main changes require revalidation and renewed selection.
2. Generate and inspect the exact candidate archives. Record package names/versions, SHA512 integrity, exports, license, declarations, CSS and source SHA in the report. Check neither target version already exists. An existing version with different integrity must stop the release.
3. Obtain explicit final approval naming `@simpludify/core@<version>` and `@simpludify/web@<version>` (e.g. `0.1.7`), the selected SHA and release tag (`v<version>`). npm versions are immutable and cannot be reused after unpublishing.
4. Create `v<version>` at that full SHA without moving any existing tag. The manual **Create approved SDK tag** workflow validates version, exact main SHA, confirmation (`create TAG at SHA`) and successful main push CI, and refuses to move an existing tag. Open Actions → Publish experimental npm SDK → Run workflow from `main`. Enter tag `v<version>` and exact confirmation `publish @simpludify/core@<version> and @simpludify/web@<version>`.
5. Validation derives the version from manifests and verifies confirmation, tag, dispatched SHA, main ancestry and successful main push CI. It reruns checks/unit tests and external tarball consumers, records pack manifests and SHA256 checksums, then passes those exact archives to the publish job.
6. The publish job verifies checksums, archive metadata against source manifests, package versions/integrities, tag/SHA and OIDC capability before any publication. Both target versions are checked before the first publish. **Core publishes first and its registry integrity is verified before Web publishes.** Already-published identical archives may be skipped; differing archives fail. `latest` is the intended dist-tag. After npm accepts a publish, the script allows up to six minutes for processing/visibility before reporting failure; this wait never republishes or skips registry integrity checks.
7. The registry acceptance job repeats the package and starter fixtures with clean public-registry installations. Inspect `npm-sdk-validation`, `npm-sdk-publication`, `npm-sdk-registry-acceptance` and the job summary. Record source SHA/tag, integrities, provenance and registry URLs. Do not mark a failed post-publication test as an unpublished state.
8. After registry validation succeeds, update public release status and create or verify the GitHub Release for the same immutable tag. Treat independent consumer upgrades as separate changes: regenerate lockfiles from npm and require their own checks/browser tests and deployment verification.

If Core succeeds and Web fails, inspect registry metadata and saved archives before retrying the same tag. Never move a release tag, force-push main, unpublish, or silently substitute rebuilt content as a retry mechanism. A different archive requires a separately reviewed version.
