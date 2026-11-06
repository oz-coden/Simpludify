# Work reports

- [Documentation site syntax highlighting and bilingual navigation separation — 2026-11-06](2026-11-06-site-improvements.md): Complete: Shiki syntax highlighting across TS/JS/JSON/HTML/CSS/Bash/PS1/YAML with dual theme support and copy buttons; language-segregated navigation with fallback section for English engineering records, fallback banners, en/examples.html, and language continuity; 102 HTML docs, 6,423 links, 97 typechecked snippets, 898 unit tests, and Playwright Chromium test:site (87 pages, desktop/narrow viewports, light/dark themes) verified.

- [Documentation reorganization, consolidation and direct docs site build — 2026-11-06](2026-11-06-docs-reorganization.md): Complete: removed CODEX-START.md, aligned v0.1.6 published / v0.1.7 upcoming references, categorized docs into ja/en mirrors under docs/ with specs/benchmarks/archive, removed redundant site/ directory, moved site assets to scripts/site-assets, consolidated content favoring the most detailed version, verified site build (base /Simpludify/ and /), 101 pages, 9,488 links, 97 typechecked snippets, 891 unit tests.

- [v0.1.6 publication and registry verification](2026-11-05-v0.1.6-publication.md): release preparation; exact main push CI, approved tag, OIDC publication and registry acceptance pending.

- [Input bindings v0.1.6 final review and integration](2026-11-05-input-bindings-final-review-v0.1.6.md): Complete: main 3914f15; 891 unit / 448 browser / 66 eventual consumer E2E successes (one existing retry); main CI 20 validations and Pages passed; no npm publication.

- [Input bindings and single-input capture — v0.1.6](2026-11-04-input-bindings-v0.1.6.md): Complete: implementation, final review and main integration; see the final review record for main CI, retry evidence and unverified hardware; no npm publication.

- [v0.1.5 publication and registry verification](2026-11-04-v0.1.5-publication.md): Complete: Core/Web 0.1.5 published from ed3ccc6 through OIDC; immutable tag/Release, exact registry archives, clean consumers and four production virtual-input cases passed.

Implementation checkpoints and final verification records live here so repository history is sufficient to resume interrupted work. Each report distinguishes completed checks from plans and records the source revision, branch, changes, verification, limitations and integration status. Keep older reports; add a uniquely named file per task.

| Date (JST) | Task                                                                          | Status                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-03 | [Security audit integration](2026-11-03-security-integration.md)              | Complete: PR #14 merged 1c28c8f; 827 unit / 392 browser / 66 consumer E2E; Windows/Linux packages, main CI and Pages passed; no npm publication |
| 2026-11-03 | [Security audit and input-validation hardening](2026-11-03-security-audit.md) | Complete: input/style/theme/URL/path-boundary hardening, 821 unit tests, site build/check and browser game spec verified                        |
| 2026-11-01 | [Experimental npm SDK](2026-11-01-npm-packaging.md)                           | Complete SDK: main b7951e9, 805 unit / 346 browser and external tarball acceptance; Pages passed; npm bootstrap/authentication pending          |
| 2026-11-01 | [Tile geometry and polygon rendering](2026-11-01-tilemap-geometry.md)         | Complete: main 87a0337; 805 unit / 346 browser; main CI, Pages and published geometry acceptance passed                                         |
| 2026-11-01 | [Tilemap collision and rectangle search](2026-11-01-tilemap-collision.md)     | Complete: main 3b13557; 779 unit / 338 browser; final CI, Pages and published desktop/narrow acceptance passed                                  |
| 2026-11-01 | [Tween and animation foundation](2026-11-01-tween-animation.md)               | Complete: main 043c1d8; 767 unit / 334 browser; CI, Pages and published desktop/narrow browser checks passed                                    |
| 2026-10-31 | [Hover, keyboard and focus](2026-10-31-ui-focus-input.md)                     | Complete: direct main 1d9901d; 701 unit / 314 browser, final main CI/Pages and live gameplay/forms/docs verified                                |
| 2026-10-31 | [Select and native text editing](2026-10-31-native-input.md)                  | Complete: PR #4 merged 884475b; main 696 unit / 294 browser, Pages and live sample/docs verified                                                |
| 2026-10-31 | [Standard Canvas input controls](2026-10-31-canvas-controls.md)               | Complete: PR #3 merged ff39721; main 658 unit / 266 browser tests, Pages and live settings/docs verified                                        |
| 2026-10-30 | [Canvas scroll input](2026-10-30-scroll-input.md)                             | Complete: merged 221b053; main CI/Pages passed; live sample and docs matched main dd2eb0e                                                       |
| 2026-10-30 | [Core modules and host-independent Canvas UI](2026-10-30-core-host-ui.md)     | Complete: merged ba1345e; main CI 570 unit / 238 browser tests and Pages deployment passed                                                      |

Before long-running verification or integration, commit implementation and update the corresponding report, then push the branch. Final reports must include check counts, CI links, commits and integration SHA; never mark an unexecuted check successful.

- [2026-11-02 npm SDK documentation review](2026-11-02-sdk-docs-review.md)

- [2026-11-02 SDK consumer integration](2026-11-02-sdk-consumer-integration.md)

- [2026-11-02 v0.1.2 release preparation](2026-11-02-v0.1.2-release.md)

- [2026-11-02 v0.1.2 publication and registry adoption](2026-11-02-v0.1.2-publication.md)
- [Canvas screen consumer integration](2026-11-02-canvas-consumer-ui.md)

- [2026-11-03 v0.1.3 publication and Canvas adoption](2026-11-03-v0.1.3-publication.md)

- [Unified input, gamepads and bilingual documentation — v0.1.4](2026-11-03-unified-input-v0.1.4.md): PR #15 merged as aa7e5ba; 842 unit / 404 browser tests, Windows/Linux packages, six candidate consumers, main CI and Pages acceptance passed. npm publication is recorded in the separate v0.1.4 release report.

- [v0.1.4 publication and public-registry verification](2026-11-03-v0.1.4-publication.md): Core/Web published through OIDC from 84a5f1b; exact registry archives, clean consumers, TypeScript, production build, program input and gamepad API checks passed.

- [Virtual sticks and generic pointer input — v0.1.5](2026-11-04-virtual-input-v0.1.5.md): Complete: main ffde512 runtime, 861 unit / 424 browser tests, external archives, paired guides, final CI/Pages and four published virtual-input cases passed; no npm publication.
