# Security audit integration and regression validation

Final status: [PR #14](https://github.com/oz-coden/Simpludify/pull/14) merged as `1c28c8f913a25db85d1c50604a847bce2db5a303`; [main CI and Pages](https://github.com/oz-coden/Simpludify/actions/runs/41580443697) succeeded. See the final acceptance section below; earlier entries are historical checkpoints.

## Source and integration checkpoint

- PR: [#14](https://github.com/oz-coden/Simpludify/pull/14), `argon/security-audit`.
- Argon source: `326acecda14abdfd0627ce35a7ed1d0454ee4ce2`, based on v0.1.3 source `1164b77c0bc037f7afc3b29a32b48d6a2d27e476`.
- Main incorporated: `9954521a266b5b8a2211a5394feaee2e948c80ef`; clean merge, no conflicts. Publication records, starter dependency pins and existing Canvas UI implementation are preserved.
- Initial PR CI [41575304666](https://github.com/oz-coden/Simpludify/actions/runs/41575304666) succeeded before the follow-up review. This is not evidence for the additional changes below.
- No version bump, npm publication or modification of the v0.1.3 tag is included.

## Review findings and corrections

Argon's own-property checks for themes/bindings/replay, single-property CSSOM assignment, image scheme allowlist, release tag checks and documentation sample identifier validation address their respective unsafe lookup or interpolation paths. Additional review found:

1. Prefix-based `..` checks confused ordinary child names with parent traversal. The CLI could accept a destination such as `<repository>/..audit-child` and recursively copy the repository into itself. A shared tooling helper now compares complete native path segments. CLI destinations resolve existing physical ancestors before containment checks so a symlink/junction alias cannot bypass the guard.
2. Preview containment was lexical only. The server now checks the resolved file's real path before reading, preventing symlink escapes while allowing internal symlinks and ordinary `..notes.txt` files. The link checker uses the same segment comparison.
3. Own optional bindings with `undefined` lost the previous empty-binding default. The default is restored after the own-property check; inherited entries remain ignored.
4. Rejecting every CSS backslash or delimiter also rejected legitimate quoted/escaped family names. Font validation now excludes quoted strings and CSS escapes from syntax checks, while rejecting unquoted declaration/block syntax, URLs and literal line/NUL controls. CSSOM remains the native editing sink. Color token restrictions remain separate. The old test treating `sans-serif\20` as an attack was corrected to assert acceptance; actual injection cases remain tested.
5. The original Windows test could fail for unrelated reasons under POSIX path semantics. New tests explicitly exercise POSIX, Windows drive and UNC rules, plus actual filesystem symlink/junction behavior on Windows/Linux CI. Prototype-named Core modules produce the intended boundary diagnostic.

No Core DOM/Node dependency, public API addition, Canvas lifecycle change or unrelated gameplay change is introduced.

## Verification checkpoint

- Local `npm ci`: completed.
- Local `npm run check`: passed (existing non-blocking Biome warnings remain).
- Focused unit suites: 6 files, 52 tests passed, including action defaults, font validation, URL schemes, CLI/preview containment and cross-platform path semantics.
- Full unit/browser/site/package and consumer CI is pending at this checkpoint. No pending check is counted as a pass.

## External consumer procedure

CI builds local Core/Web tarballs from this checkout and applies them only in disposable copies of Run To Exit at `e3c6f50ad837e2d2c598a1a1d01c47077b33d00c`. Its helper runs type checking, all world unit tests, production build and E2E for desktop, 320px and 390px under WebGL and Canvas2D. Each matrix job retains candidate results, package integrity metadata and browser reports. The source consumer's package.json/lockfile must remain unchanged at published 0.1.3.

## Pending integration evidence

PR head CI, merge commit, main CI and deployed documentation verification will be recorded after completion. Physical-device IME, assistive technology and non-Chromium browsers are outside the automated scope.

## Intermediate execution evidence

- Checkpoint source: `ae17f1bfe54ab742be51095a2fa780332189cf05` (includes main as a merge parent).
- [Push CI 41577580277](https://github.com/oz-coden/Simpludify/actions/runs/41577580277) and [PR CI 41577585763](https://github.com/oz-coden/Simpludify/actions/runs/41577585763) both passed quality: 62 files / 827 unit tests, unchanged timeout limits. Windows/Linux filesystem boundary jobs succeeded. Remaining jobs were still running when this entry was written.
- Local full unit runs (default workers, then two workers) each timed out in the pre-existing Prism Raid 100,000-step churn test. Running that unchanged suite alone passed all 20 tests in 4.20 seconds. These local failures are retained as failures; isolated CI provides the complete-suite result.
- Both documentation bases passed local builds, 73-page / 5099-reference link checks and 65 standalone snippet checks.
- The standard local Playwright browser download returned truncated ZIP archives. A temporary Chromium 153 installation outside the repository was used for a focused CSSOM test only; standard Playwright Chromium in CI remains authoritative for the full browser matrix.
- The new CSSOM browser test initially expected an inline `position` value that belongs to the stylesheet. Its assertion was corrected to verify absence of injected positioning plus the actual geometry/custom color properties. The corrected test passed locally (1/1); no production behavior was changed for that assertion.
- Candidate Canvas2D tests passed all 11 cases for desktop/320/390, and WebGL 320 passed all 11, with all 35 world tests in each disposable consumer. The 320px Canvas2D screenshot was inspected: controls/text stayed within the viewport and the log panel retained its focus outline. Remaining consumer projects are pending.


## Color token bypass found during final review

A real-browser probe reproduced an external image request from `tokens.background = 'image-set("https://example.invalid/token-probe.png" 1x)'`. The original `url(...)` denylist did not cover CSS image functions, and the stylesheet used the `background` shorthand. Color tokens now require `CSS.supports("color", value)` in the Web host. Token-based backgrounds use `background-color`, preventing an image-valued `var(...)` fallback from becoming a resource load. Valid hex/alpha, modern RGB/HSL, color-mix, currentColor, transparent, escaped color identifiers and CSS variables remain supported. A real-browser regression checks both direct rejection and variable-fallback isolation with intercepted network requests. Full CI must be repeated for this production change.

The preceding `db3a7c5c020dcba0246e790f7e593e281bc574ab` candidate passed all 66 consumer tests in push CI, but is superseded by this color-token correction and is not the final merge candidate.

Local verification of the color correction: `npm run check` passed; the focused real-browser font/color tests passed 2/2, including no intercepted image request for a CSS variable fallback.

## Final acceptance and integration

The final security source is `5ec075ccdc6ee650b29a21a8f269bb4bf29dddb0`. The v0.1.3 source-to-main comparison contained only documentation and starter registry pins in examples/templates; Core/Web runtime files had no intervening main changes. The main merge was clean and preserved those updates.

| Verification                                                  | Result                                                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, Biome, architecture/export/version/license checks | Passed; existing non-blocking Biome warnings remain                                                                                                              |
| Core/Web and example unit tests                               | 62 files / 827 tests passed                                                                                                                                      |
| Engine browser E2E                                            | 392 passed across desktop/390px, WebGL and Canvas2D; includes composition, focus, scrolling, layout and paint/cache coverage                                     |
| Production examples                                           | UI Scenes, Signal Run, Canvas UI and Tween build/browser smoke passed                                                                                            |
| Documentation                                                 | Both / and /Simpludify/ builds, 73 pages / 5099 references and 65 typechecked snippets; site/browser and live fixture checks passed                              |
| Windows/Linux distribution                                    | npm tarball contents/integrities, Core-only Node/NodeNext, transitive Web install, public declarations and external development/production Vite consumers passed |
| Published npm starter                                         | Windows/Linux starter checks passed                                                                                                                              |
| External Run To Exit candidate                                | 35 world tests, type check and production build in each isolated copy; all 66 E2E passed (11 cases × 6 renderer/viewport projects)                               |

The consumer matrix covers native numeric/text editing and validation (including Japanese input values), command reordering/removal, all 50 commands and bounded history, scroll/focus, keyboard/touch projection, original-stage clearance, Scene disposal and real-pixel paint after GPU cache reuse. Automated composition behavior is covered in the engine matrix; physical-device IME is not claimed.

Desktop, 320px and 390px consumer screenshots and the Windows packed SDK 320px production screenshot were inspected. Text/controls remained within the viewport; the desktop map and narrow tab layout painted normally. Focus outlines were retained. These observations supplement behavioral tests rather than substitute for them.

Additional local checks passed: seven malformed documentation sample IDs were rejected while a known sample launched/stopped normally; CLI creation into an external `..valid-project` directory copied the expected project files. Repository Markdown/config is trusted build input, not arbitrary runtime HTML.

### Evidence and deployment

- Final PR CI: [41579224132](https://github.com/oz-coden/Simpludify/actions/runs/41579224132), success.
- PR #14 merge commit: `1c28c8f913a25db85d1c50604a847bce2db5a303`.
- Main CI: [41580443697](https://github.com/oz-coden/Simpludify/actions/runs/41580443697), success, including Pages deployment and published SDK integration, Tween, tilemap and tile-geometry checks.
- Documentation: https://github.oz-coden.com/Simpludify/ .
- The final accepted candidate supersedes the earlier interrupted/failed checkpoints above. The incorrect initial CSSOM test expectation and local Prism Raid timing failures remain recorded; no tests were disabled or deadlines increased by this change.

### Candidate integrity and immutable releases

| Candidate archive | SHA512 integrity                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Core              | `sha512-z3oIlf/v7i1cf7LPWnpzMQ9+G1x9pp4IC3bQfzTA5P1SXjWAuwK92KzNC+Ydj4VrFjHQXJ2CtDfGU9bZ9bss1A==` |
| Web               | `sha512-+O9U2At17YoJ9LDhoq+sTst4WFgo4LR1DO86wKSK69azNjRAAGFYRL2e1rmK56an3rLQzAFTnNftkINyr0m2ww==` |

Run To Exit remains at `e3c6f50ad837e2d2c598a1a1d01c47077b33d00c` with registry Core/Web 0.1.3. Its source package.json SHA256 is `a2e397bfe46b14f76903acf64ed47c636938f2e1ca1c5aab13552f3002060499`; package-lock.json is `9928b08d7ae7a93a19b85b1df833b01a8eea86f4e8e8125ee102d21e85b22094`. The working tree and dependency files were unchanged after candidate testing.

The v0.1.3 tag still identifies `1164b77c0bc037f7afc3b29a32b48d6a2d27e476`. Registry integrities match the original publication report (Core `sha512-3hcLff20KzUA2r7UjkMi47EG7C5gh6SAyUl5SM3CY0hme7lSC21Zpy2ts7rbnEIy14H4yz1MLaO+GzDpX4PG8Q==`, Web `sha512-8dtesMt/wmQKMCQPMuTaGyx7bcoeZ4Q2H2rMTH4PyeY2ZEoU1sbalPAWStsm5rB0C34z4ujHxbZ80zZ7OVS56g==`). The candidate archives are unpublished verification artifacts, not replacements for these immutable versions. No release workflow was dispatched.

### Limits and remaining scope

- The fixes are integrated in source and the documentation build. Published 0.1.3 packages and the deployed Run To Exit registry dependencies remain unchanged; distributing the fixes through npm requires a separately authorized future release.
- Chromium automation includes software WebGL/Canvas2D, synthetic composition and emulated touch. Actual OS IME, physical mobile devices, screen readers and other browsers remain unverified.
- Windows/Linux results concern npm SDK packaging and external consumers. Native Electron/Tauri/Android application packaging remains unimplemented and was not represented as tested.
- Automated checks are not a complete security proof. The local preview and copy tools operate on trusted developer-owned filesystem trees.

This documentation-only closeout was recorded after the merged main's complete CI/deployment succeeded. Its `[skip ci]` commit updates only the work reports/index; production, test, workflow, package and site source files remain identical to the validated merge. The deployment above contains the integrated security fixes and updated API guides.
