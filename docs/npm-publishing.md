# Experimental npm SDK publishing

## Release status

Core/Web v0.1.2 were accepted through [Trusted Publishing run 41408637470](https://github.com/oz-coden/Simpludify/actions/runs/41408637470), from source `8122a6dc347d661da24c3df7610d4218a431c314` and tag `v0.1.2`. Both registry versions and their validated SHA512 integrities were confirmed. npm processing exceeded the original one-minute visibility budget, so the same publish job was resumed using identical archives; Core was verified before Web publication. See [publication and registry adoption](work-reports/2026-11-02-v0.1.2-publication.md) for final clean-install and CI results. Older v0.1.0/v0.1.1 remain immutable historical releases.

## Prepare and verify

Use Node >=22.12 for development and Node 24 in CI. The publish job requires npm >=11.5.1 and Node >=22.14. From a clean work branch:

```sh
npm ci
npm run version:sdk -- 0.1.3
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:browser
npm run test:packages
npm run test:starter
npm run pack:packages
node scripts/publish-packages.mjs
```

The last command only checks archives and registry availability; it does not publish. `version:sdk` updates the root/Core/Web versions, exact Web→Core dependency, workspace lock metadata, `ENGINE_VERSION`, and package README versions together. `sdk-version.mjs` rejects disagreement in builds, quality checks, package consumers and publication. There are no release-version literals in the validation or publication scripts/workflow. Review release notes and registry status separately; a source bump is not proof of publication.

`test:packages` creates genuine external temporary projects with no workspace aliases or symlinks. Core alone runs in Node and typechecks in NodeNext without DOM ambient types. Web alone resolves the exact Core tarball transitively using a loopback scoped registry. Both development and production subpath builds check CSS, public declarations, images, controls, scene replacement, `bindViewport` and idempotent resource cleanup at desktop, 390px and 320px. `--registry` installs the matching source version from public npm and runs the same fixture, including the new API. Network/authentication failures fail validation. Failed temporary projects remain available for inspection.

CI runs package generation and these external consumers on **Windows and Linux**, as well as the independent npm/Vite starter on both systems. The starter uses the published v0.1.2 registry lockfile. Do not fabricate registry integrity for an unpublished version.

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

1. Merge only a successful full-CI PR. Record the full main commit SHA and wait for that exact main push CI to pass. Freeze the candidate commit for release; subsequent main changes require revalidation and renewed selection.
2. Generate and inspect the exact candidate archives. Record package names/versions, SHA512 integrity, exports, license, declarations, CSS and source SHA in the report. Check neither target version already exists. An existing version with different integrity must stop the release.
3. Obtain explicit final approval naming `@simpludify/core@0.1.3` and `@simpludify/web@0.1.3`, the selected SHA and release tag. npm versions are immutable and cannot be reused after unpublishing.
4. Create `v0.1.3` at that full SHA without moving any existing tag. The manual **Create approved SDK tag** workflow validates version, exact main SHA, confirmation (`create TAG at SHA`) and successful main push CI, and refuses to move an existing tag. Open Actions → Publish experimental npm SDK → Run workflow from `main`. Enter tag `v0.1.3` and exact confirmation `publish @simpludify/core@0.1.3 and @simpludify/web@0.1.3`.
5. Validation derives the version from manifests and verifies confirmation, tag, dispatched SHA, main ancestry and successful main push CI. It reruns checks/unit tests and external tarball consumers, records pack manifests and SHA256 checksums, then passes those exact archives to the publish job.
6. The publish job verifies checksums, archive metadata against source manifests, package versions/integrities, tag/SHA and OIDC capability before any publication. Both target versions are checked before the first publish. **Core publishes first and its registry integrity is verified before Web publishes.** Already-published identical archives may be skipped; differing archives fail. `latest` is the intended dist-tag. After npm accepts a publish, the script allows up to six minutes for processing/visibility before reporting failure; this wait never republishes or skips registry integrity checks.
7. `test:packages:registry` makes clean public-registry installations and repeats the full consumer fixture including `bindViewport`. Inspect `npm-sdk-validation`, `npm-sdk-publication` and the job summary. Record source SHA/tag, integrities, provenance and registry URLs. Do not mark a failed post-publication test as an unpublished state.
8. After registry validation succeeds, update the independent starter and Run To Exit to exact v0.1.3, regenerate their lockfiles from npm, run checks/browser tests, merge successful PRs and verify Pages. Update public release status in the docs. Create a GitHub Experimental prerelease using the same tag if desired.

If Core succeeds and Web fails, inspect registry metadata and saved archives before retrying the same tag. Never move a release tag, force-push main, unpublish, or silently substitute rebuilt content as a retry mechanism. A different archive requires a separately reviewed version.
