# Experimental npm SDK v0.1.0 — packaging and publication readiness

## Final status

SDK packaging, external-consumer acceptance, main integration, main CI and GitHub Pages verification are complete. **Neither npm package has been published.** npm identity/write permissions and Trusted Publisher configuration could not be verified, and the initial-package bootstrap requires npm-side authentication. No token, release tag or GitHub Release was created. Actual publication still requires final approval explicitly naming both versions after authentication/setup is available.

- Baseline main: `e4f26cac2822f1a114d61e996e7b5ac161d5fb20` (2026-11-01 JST).
- Development branch: `feat/npm-packaging-2026-11-01`.
- Final implementation commit: `2d2a91839205c880878b6aba39a55367f0d82c8d`.
- Integration: [PR #5](https://github.com/oz-coden/Simpludify/pull/5), merge `b7951e92652adadf389449f6d2cf3b47ed8d13b6`.
- Main acceptance and Pages: [CI 41321774172](https://github.com/oz-coden/Simpludify/actions/runs/41321774172), all jobs successful, verified 2026-11-02 JST.
- This final report/index follow-up changes documentation only. It does not change tested package contents or the deployed guides and uses `[skip ci]` to avoid repeating the completed engine/browser suite.

## Existing structure and distribution design

The original Core/Web workspaces were private, exporting TypeScript source files directly. Web already depended on Core 0.1.0 and PixiJS 8.22.0 and automatically imported scoped CSS. The root CLI built example applications; it did not emit SDK libraries. Existing CI covered types/lint/format/boundaries/licenses, unit tests, browser shards, production games, both site bases and Pages.

Keep source/API and Core/Host boundaries intact. `scripts/build-packages.mjs` emits separate ES2022 ESM libraries with Vite and declarations with the pinned TypeScript CLI. Core remains runtime-dependency-free and compiles against ES2022 without DOM/Node ambient types. Web keeps Core and PixiJS external, with exact normal dependencies, not bundled copies. Web re-exports Core APIs and retains Game, rendering/input/UI exports.

Both 0.1.0 manifests now have typed ESM exports, MIT license/repository metadata, public publish configuration, and `files` restricted to `dist`, license and package README. Root remains private. No workspace-only install/build lifecycle scripts are shipped. Only package-root and CSS/package.json subpaths are public; internal module paths are unsupported.

JavaScript source maps embed original sources and use relative paths; declaration maps are omitted. Static relative declaration specifiers are normalized to resolvable `.js` paths and checked against emitted `.d.ts` files, including directory indexes. CSS is copied by the library build, automatically imported by the Web entry, explicitly exported as `@simpludify/web/style.css`, and accompanied by `style.css.d.ts`. Entry/CSS side-effect metadata preserves CSS through tree shaking. No external image asset is required by the SDK; consumer assets are handled by its bundler.

Root TypeScript paths and the repository-only `scripts/workspace-vite.mjs` adapter keep CLI, tests, site and benchmark tools on editable source files without stale SDK rebuilds. External consumers use compiled exports with no aliases. Existing public APIs and lifecycle implementation were not changed.

## Actual tarballs and external tests

`npm run pack:packages` rebuilds and generates both actual tarballs and npm pack manifests in `test-results/packages/`. Plain package-level `npm pack` does not rebuild stale output.

| Package                  | Archive                     | Packed bytes | Unpacked bytes | Entries |
| ------------------------ | --------------------------- | -----------: | -------------: | ------: |
| `@simpludify/core@0.1.0` | `simpludify-core-0.1.0.tgz` |       233020 |         993885 |      69 |
| `@simpludify/web@0.1.0`  | `simpludify-web-0.1.0.tgz`  |        75320 |         322118 |      25 |

Tarballs contain compiled JavaScript, declarations, embedded-source JS maps, scoped CSS for Web, metadata, README and MIT license. File allowlists reject tests, benchmarks, configs and raw source directories. Archive SHA512 checks match npm pack metadata:

- Core: `sha512-FU9D8IvDoNjt5ZZeUcF6qc/JYjB7lPXYRhUcMxhd/IjMguI6ezMHXXG3WmzfDCixKPXL8bkmz/OKykE93kc+Cg==`
- Web: `sha512-HIJQ2nsrsCHrgKzPf2UdoDCGnJiMiyoCFOYoWtiuYSE8FWKP0nzLoYS8vjPHp180/8iMtRMj0AJZHc7vwkWDZg==`

The [main CI artifact](https://github.com/oz-coden/Simpludify/actions/runs/41321774172/artifacts/13089563209) contains both archives, validation JSON and development/production screenshots. Artifacts have normal GitHub retention; source and commands reproduce them.

`scripts/test-packages.mjs` creates physically separate temporary projects outside the repository. All of the following passed in main CI:

1. Core-only installation from its actual tarball, with no Web/Pixi installation.
2. Node ESM import, Engine/Actor lifecycle, and public NodeNext typechecking with ES2022 and no DOM/Node ambient types.
3. Web-only installation from its actual tarball. A temporary loopback scoped registry serves the real Core tarball to test automatic normal dependency resolution before public publication. Core is not a direct consumer dependency; installed packages are physical files, not workspace symlinks.
4. Web public declarations and explicit CSS export typecheck without workspace paths or `skipLibCheck`.
5. An independent Vite production build under `/external-game/`, including actual scoped CSS and a separately emitted application SVG.
6. Development and production browser execution at 1280×720 and 390×844: two Actors sharing one image, WASD movement, Canvas pointer/keyboard interaction and repeated Scene replacement.
7. Idempotent Game disposal, Scene/UI destruction, removed host DOM, zero actors, presentations, visuals, textures, image references/entries and pending image loads, with no page errors. Imported Core identity is shared with Web.

Production screenshots were downloaded and visually inspected at both widths. These are application/lifecycle diagnostics, not native/GPU retained-memory measurements. Public-registry consumer tests were not run because no package was published; `npm run test:packages:registry` is ready for that stage.

## Regression and publication evidence

| Check                                                                             | Result / evidence                                                                                                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`, root strict types, DOM-free Core, Biome, dependency boundaries/licenses | Passed; existing informational/warning diagnostics remain                                                                                             |
| Unit tests                                                                        | 60 files / 805 tests passed                                                                                                                           |
| Existing browser regression                                                       | 346 tests passed across desktop/narrow shards                                                                                                         |
| Packed external consumers                                                         | All seven acceptance groups above passed                                                                                                              |
| Production samples                                                                | UI/scenes, Signal Run, Canvas UI and Tween builds/smoke tests passed                                                                                  |
| Site `/` and `/Simpludify/`                                                       | Both build/reference/browser/live acceptance jobs passed                                                                                              |
| Project site reference/type checks                                                | 70 HTML documents, 4808 links/assets, 65 standalone documentation snippets                                                                            |
| Main CI and Pages                                                                 | [41321774172](https://github.com/oz-coden/Simpludify/actions/runs/41321774172), successful including published Tween/Tilemap/Tile geometry acceptance |
| Final branch CI                                                                   | [41320835090](https://github.com/oz-coden/Simpludify/actions/runs/41320835090), successful                                                            |
| PR CI                                                                             | [41320839402](https://github.com/oz-coden/Simpludify/actions/runs/41320839402), successful                                                            |

After Pages deployment, an independent HTTP fetch of [the published npm guide](https://github.oz-coden.com/Simpludify/guides/npm.html) verified its title, explicit unpublished notice, `@simpludify/web@0.1.0` and Game/Canvas UI startup example. The web retrieval tool could not access that URL, but direct HTTP verification succeeded. README, package READMEs and Japanese guides consistently describe preparation/unpublished status.

Local Playwright browser installation failed because the official download returned invalid ZIP content; local browser execution is not claimed. Hosted CI installed its pinned Chromium and ran the full acceptance above. A local read-only registry preflight timed out and correctly failed closed without mutation. The publication script also rejects non-OIDC execution before registry/publish calls.

## npm names, authentication and initial-publication limit

Anonymous `npm view` for both target names/versions returned E404 on 2026-11-01 JST: no publicly readable target version was found. This does **not** prove name availability, account identity, Organization ownership or write permission. `npm whoami` returned `ENEEDAUTH`; `npm org ls simpludify --json` returned `{}`, which does not verify an authenticated role. npm settings browsing hit a persistent Cloudflare human-verification page. Therefore account `oz-coden`, Organization `simpludify`, package creation/write permissions and Trusted Publisher settings remain unverified.

Official specifications checked:

- [Trusted publishers](https://docs.npmjs.com/trusted-publishers/): npm >=11.5.1, Node >=22.14, supported hosted runners, per-package configuration, `id-token: write` and automatic provenance for public GitHub/public package publishing.
- [npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/): target package must already exist; CLI trust administration requires account 2FA and write access.
- [Publishing authentication](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/): initial creation/publishing requires eligible authentication; package settings require 2FA.
- [Access tokens](https://docs.npmjs.com/about-access-tokens/): token/governance management requires interactive 2FA; bypass tokens do not authorize those governance actions.

An unregistered package cannot be created by this unconfigured OIDC identity. Account 2FA is not silently imposed by the repository; if the owner cannot satisfy npm's bootstrap requirements, the packages remain unpublished and the tarballs remain usable. No long-lived token was generated/saved, no protection was weakened, and no placeholder version or different account was used.

## Trusted Publishing workflow and required owner actions

See [the complete release runbook](../specs/npm-publishing.md) and [standalone SDK/Vite guide](../../site/ja/npm.md).

`.github/workflows/npm-publish.yml` runs only through manual dispatch from main with an exact confirmation naming both versions. It checks a v0.1.0 tag matching the dispatched source SHA and a successful main push CI. A read-only validation job rebuilds/checks/tests actual archives; a separate OIDC job publishes those exact archives Core first, verifying visibility/integrity before Web. Existing identical versions are skipped; mismatched existing versions, network errors and authentication failures stop the run. Checksums, publication state and post-publication clean-install results are archived. Tags/Releases are not created automatically. The actual OIDC publish path remains unexecuted and its npm authorization/provenance is not claimed verified.

For each existing npm package, configure Settings → Trusted publishing → GitHub Actions:

| Field                | Value                        |
| -------------------- | ---------------------------- |
| Organization or user | `oz-coden`                   |
| Repository           | `Simpludify`                 |
| Workflow filename    | `npm-publish.yml`            |
| Environment          | Empty                        |
| Allowed actions      | Direct `npm publish` enabled |

The current npm guide says a new publisher configuration must complete its first successful OIDC publish within two days or be recreated. Saving settings and `npm whoami` do not validate OIDC permissions.

Remaining actions:

1. Authenticate the intended npm account and verify Organization/package creation/write permissions. Complete npm-required initial creation authentication outside GitHub; do not put credentials or one-time/recovery codes in commits, logs or issues.
2. Obtain explicit final approval for `@simpludify/core@0.1.0` and `@simpludify/web@0.1.0` and the tested archive integrity values before any actual publication.
3. If npm permits the owner's authenticated interactive bootstrap, publish the exact tested Core archive, verify it, then publish Web as documented. Otherwise keep both unpublished; do not bypass account/package protections.
4. Configure Trusted Publishers per package for later OIDC releases. Bootstrap and OIDC publication are distinct; publishing an immutable 0.1.0 again cannot validate a new publisher or add provenance retroactively.
5. Run `npm run test:packages:registry`, record registry integrity/consumer results, create an Experimental GitHub Release and `v0.1.0` tag at the verified source commit without moving existing tags, and update public status only after registry verification.

## Problems resolved and checkpoints

- TypeScript 7 does not expose the legacy compiler API used by the initial draft; declaration normalization now validates emitted static specifiers directly. External NodeNext/Bundler checks pass.
- Packed strict consumers exposed TS2882 for CSS; shipped a CSS declaration and typed export.
- Initial production/site CI dropped automatic CSS when the Web barrel was treated as pure; marking source/compiled entries and CSS side-effectful fixed it. Existing source development and production regressions now pass.
- Strengthened the image fixture to use two actual shared-image Actors and added SVG accessibility metadata. Final image/cleanup acceptance passes.
- Initial failed/intermediate CI is historical evidence, not acceptance: 41319627407 and 41320035646 preceded the final fixes. Final accepted runs are listed above.
- Durable checkpoints: investigation `43f7a8f`, Core `3e3d379`, Web/external consumer `4e90801`, workflow/docs `0d0d3f1`, CSS correction `01d49b3`, strengthened acceptance `628b00c`, final release permission review `2d2a918`, main integration `b7951e9`.

## Resume without this conversation

Start from current main, read this report and `docs/npm-publishing.md`, and inspect registry state before mutation. Rebuild with `npm ci` and `npm run pack:packages`; run `npm run check`, `npm test` and `npm run test:packages` on a host with the pinned Chromium. Retrieve accepted CI archives when publishing an already-reviewed build, and compare their integrity to this report. Never silently replace a published name/version, move a release tag or force-push history. No engine reimplementation is required; only npm authentication/bootstrap/publisher setup, explicit publication approval and public-registry acceptance remain.
