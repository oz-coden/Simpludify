# Security audit integration and regression validation

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
