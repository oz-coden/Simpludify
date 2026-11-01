# Experimental npm SDK publishing

> **Current status (2026-11-02):** Both `@simpludify/core@0.1.0` / `@simpludify/web@0.1.0` and `@simpludify/core@0.1.1` / `@simpludify/web@0.1.1` have been published. Version 0.1.1 was published using GitHub Actions Trusted Publishing (OIDC). The initial-bootstrap and unpublished-state steps below document the _historical v0.1.0 preparation process_ and must not be followed as if these packages were still unpublished. For a new release, review the current workflow's version guards and the target version before dispatching.


Targets: `@simpludify/core@0.1.0` and `@simpludify/web@0.1.0`, public npm registry, MIT, ESM only. The npm release is **not yet published**. Source and documentation must not imply registry availability until the clean public-registry installation test succeeds. No v0.1.0 tag or GitHub Release has been created by this preparation work.

## Build and verify without publishing

Use Node >=22.12 and npm for development, Node 24 for CI. From the repository:

```sh
npm ci
npm run check
npm test
npx playwright install --with-deps chromium --only-shell
npm run test:packages
npm run pack:packages
```

`test-results/packages/` contains both actual tarballs, npm pack manifests with SHA512 integrity, and the external-consumer test report/screenshots. `pack:packages` always rebuilds; plain `npm pack ./packages/core` does not rebuild stale output. Do not publish an archive generated before its sources changed.

The external test creates projects in the OS temporary directory. Core is installed alone, executed in Node and typechecked using NodeNext without DOM/Node ambient types. Web alone is installed from its tarball; a temporary loopback registry serves the Core tarball under its real name/version so dependency resolution can be verified while npm remains unpublished. Other dependencies come from the public registry. No source aliases, workspace symlinks, direct Core dependency or repository files are provided to the Web application. Development and production subpath builds exercise automatic CSS, Actor/input, Canvas UI, scene replacement and disposal on desktop/narrow Chromium. Failed projects remain at the recorded temporary path for inspection.

Only `dist`, package metadata, README and MIT license are shipped. JavaScript maps embed original sources; declaration maps are omitted. Web retains Core 0.1.0 and PixiJS 8.22.0 as dependencies, not embedded copies. Repository tools use source aliases in `scripts/workspace-vite.mjs` and root TypeScript paths; external projects use compiled exports and require no aliases. Web imports CSS automatically and also exports `@simpludify/web/style.css`, with a matching declaration. Core has no runtime dependencies.

## Current npm authentication constraints

Official specifications checked 2026-11-01 JST:

- [Trusted publishers](https://docs.npmjs.com/trusted-publishers/): npm >=11.5.1, Node >=22.14, supported hosted runners, OIDC permissions and per-package configuration. GitHub public repositories/public packages receive automatic provenance.
- [npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/): the target package must already exist. CLI trust administration requires account 2FA and package write access.
- [Package publishing authentication](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/): creating/publishing packages requires 2FA or an eligible granular token; package settings require 2FA.
- [Access-token constraints](https://docs.npmjs.com/about-access-tokens/): token management/governance requires interactive 2FA; bypass tokens do not authorize those actions. An Organization token permission alone does not grant package publishing rights.

Therefore an unregistered package cannot be bootstrapped by this unconfigured Trusted Publisher. A new account/Organization does not itself prove write access, nor does anonymous E404 prove ownership or permission to claim a name. Account `oz-coden` and Organization `simpludify` must be verified through an authenticated npm session. No npm account credentials or Trusted Publisher configuration were accessible during preparation.

This workflow does not use `NPM_TOKEN`/`NODE_AUTH_TOKEN`, generate or save long-lived tokens, or weaken package/account protections. If the account cannot satisfy npm's initial creation and configuration requirements, keep the tarballs available and the registry status unpublished. Do not publish a placeholder version, use another account, or disable protections to work around the bootstrap restriction. Enabling account 2FA is an optional owner decision, not an automated prerequisite silently applied by this repository.

## Initial bootstrap when the owner can authenticate

This section describes an alternative interactive bootstrap, not an operation already authorized or performed. Obtain final approval explicitly naming both versions before any `npm publish` command. Once a name/version is published, it cannot be reused even after unpublishing.

1. Verify the npm account identity and Organization role from an authenticated npm session. With the npm CLI, `npm login --auth-type=web`, `npm whoami` and `npm org ls simpludify` help identify the account/role. Verify package creation/write permissions; GitHub repository admin rights do not imply npm rights.
2. Select a main commit with successful full CI, record its full SHA, and generate/test the exact tarballs with `npm run test:packages`. Confirm neither target version exists. If a version exists, compare its registry integrity to the tested tarball; never overwrite or silently substitute another artifact.
3. After explicit final approval, publish the tested Core archive interactively using npm's required authentication, then verify its registry version/integrity. Only then publish Web:

   ```sh
   npm publish ./test-results/packages/simpludify-core-0.1.0.tgz --access public --ignore-scripts --registry https://registry.npmjs.org/
   npm view @simpludify/core@0.1.0 version dist.integrity --json
   npm publish ./test-results/packages/simpludify-web-0.1.0.tgz --access public --ignore-scripts --registry https://registry.npmjs.org/
   npm view @simpludify/web@0.1.0 version dist.integrity --json
   ```

4. Run `npm run test:packages:registry`. It installs the actual registry packages into new external projects and repeats type/build/browser/disposal checks. The loopback registry is disabled in this mode.
5. Configure Trusted Publishing for **each package** before later OIDC releases. The first interactive publication and later OIDC publication are distinct operations; bootstrapping 0.1.0 does not produce OIDC provenance retroactively.
6. Record the exact source SHA, tarball integrities, checks and npm URLs in the work report. Create the `v0.1.0` tag at that tested source commit only after publication is verified, and create an Experimental prerelease on GitHub using the same tag. Attach the tested archives and checksums. Do not move an existing tag.
7. Update README, package READMEs and Japanese site guides to say published, then verify Pages. Do not re-publish 0.1.0 to update documentation included in its immutable tarballs; retain an honest record of the preparation-time package README.

## Trusted Publisher configuration

On npm, open each package → Settings → Trusted publishing → GitHub Actions. Apply the same identity to both packages:

| Field                       | Value                                                                         |
| --------------------------- | ----------------------------------------------------------------------------- |
| GitHub organization or user | `oz-coden`                                                                    |
| Repository                  | `Simpludify`                                                                  |
| Workflow filename           | `npm-publish.yml` (filename only)                                             |
| Environment                 | Leave empty; this workflow does not declare an environment                    |
| Allowed actions             | Enable direct `npm publish`; staging-only permission cannot run this workflow |

The current official guide states newly created configurations must complete their first successful OIDC publish within two days or be recreated. Saving configuration is not an authorization test. `npm whoami` does not validate OIDC permission. Configure each publisher near the next approved release; an existing immutable 0.1.0 cannot be republished merely to validate OIDC. Keep the GitHub repository URL in package metadata exact. Setting changes may require the owner's interactive 2FA; do not request credentials in issues/commits/chat.

## Manual OIDC release workflow

`.github/workflows/npm-publish.yml` has **only** `workflow_dispatch`; push, PR and tag creation do not publish. The workflow is intentionally limited to 0.1.0. Before a later version, update both manifests, the Core dependency, checks and the explicit version guards in a reviewed change.

If both packages already exist and valid Trusted Publishers are configured **before** an approved 0.1.0 release, the workflow can publish 0.1.0 via OIDC:

1. Create `v0.1.0` at the main commit used to dispatch the workflow, with a successful main push CI run. Do not change an existing tag. Use a full SHA to avoid ambiguity.
2. After explicit approval naming both packages, open Actions → Publish experimental npm SDK → Run workflow from `main`.
3. Enter tag `v0.1.0` and the exact confirmation `publish @simpludify/core@0.1.0 and @simpludify/web@0.1.0`.
4. Validation checks the approval/tag/main-CI relationship, checks/types/tests, real tarballs, and external browser tests. The tag must equal the dispatched main SHA so provenance identifies the actual source commit. Its immutable source SHA and archives are passed to a separate job. Only that publish job receives `id-token: write`; contents stays read-only. No npm token is configured.
5. The job checks both target versions before publication. Existing identical integrity is safely skipped; existing different content fails. Core is published and verified before Web. Network/auth errors fail rather than treating them as a missing version. Archive checksums are verified before publishing.
6. After publication, clean public-registry installs repeat consumer checks. Artifacts and the job summary record the source tag/SHA, integrity and per-package publication state even on failure.
7. Create a GitHub Experimental prerelease at the same tag after both registry versions and the consumer tests succeed. The workflow does not create or modify tags/Releases automatically.

If Core succeeds and Web fails, inspect `npm-sdk-publication` and registry integrity, then rerun with the same tag and exact archives. If an existing published version differs, stop and investigate; a new version needs a separate reviewed release. Never force-push, move a release tag or unpublish as a retry mechanism. A post-publication test failure is not an unpublished state.

## Current release quality guards

`build:packages` checks each package README's experimental version and install command against its package manifest and rejects stale unpublished-state wording. `test:packages` reinstalls the external Web consumer with `npm ci`. `test:starter` copies the committed npm/Vite template to an independent temporary project, installs public 0.1.1, checks types, builds a Pages subpath, exercises CSS/Scene restart and validates generated production notices. The CI starter job runs on Windows and Linux. The starter intentionally follows the latest published SDK rather than unreleased APIs; update and revalidate its manifest and lockfile after a new release.

Source package versions stay at 0.1.1 during development. Local rebuilt tarballs are validation artifacts and do not replace public registry archives. Before the next release, bump Core/Web and source engine versions together, synchronize package README versions and Web's exact Core dependency, run distribution checks, and explicitly authorize publication. Runtime candidates from the SDK-consumer work are `Game.bindViewport` and interrupted native-IME refocus handling.
