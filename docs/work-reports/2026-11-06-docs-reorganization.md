# Documentation reorganization, cleanup and v0.1.6 alignment — 2026-11-06

## Baseline and objectives

- Baseline branch: `flash/docs/reorganization` at `26c1e8599f8ac3e32edfc1b557ea9f4a7d1e7aa1`.
- Task: Reorganize and clarify Simpludify's documentation structure.
  1. Remove obsolete kickoff artifact `CODEX-START.md`.
  2. Update stale version references across `README.md`, `site/` and `docs/` reflecting that Core/Web v0.1.6 are published on npm, and the next development milestone is v0.1.7.
  3. Analyze and propose directory categorization for `docs/` (features/specs, benchmarks, archive).
  4. Identify English documentation on the official site that lacks Japanese translations for future localization work.
  5. Ensure site build integrity and link verification pass cleanly.

## Changes made in this checkpoint

1. **Obsolete file removal**:
   - Deleted `CODEX-START.md` (initial task prompt, unreferenced by site or code).
2. **Version alignment to published v0.1.6 & upcoming v0.1.7**:
   - `README.md`: Updated header and SDK sections to state that v0.1.6 is published on npm with physical bindings / single-input capture, and v0.1.7 is the next milestone.
   - `site/ja/index.md`, `site/en.md`: Aligned published version notices and links.
   - `site/ja/limitations.md`, `site/en/limitations.md`: Updated from stale 0.1.4 scope to 0.1.6 published scope (virtual input, physical bindings, single-input capture).
   - `site/ja/npm.md`, `site/en/npm.md`: Updated npm install version strings and tgz paths to 0.1.6.
   - `docs/api.md`, `docs/architecture.md`, `docs/action-input.md`, `docs/input-bindings.md`, `site/ja/input-bindings.md`, `docs/npm-publishing.md`: Clarified that physical bindings and capture are published in v0.1.6.
   - `examples/input-bindings/README.md`, `examples/virtual-input/README.md`: Aligned version notices.

## Verification results

- `npm run site:build`: Passed (86 client modules + 809 tilemap + 810 canvas-ui modules built, licenses verified for 116 dependencies).
- `npm run site:check`: Passed (`Site references verified: 97 HTML documents, 8688 links/assets, base /Simpludify/`, `Standalone documentation examples typechecked: 88`).
- `npx @biomejs/biome format --write`: Formatted modified Markdown documents cleanly.
- `npm run check`: Passed (657 files checked, 0 errors, architecture and required-file checks passed, SDK version 0.1.6 consistent).
- `npm test`: 64/66 test files passed (888/891 tests passed; the 3 failures are environment-dependent: local port connection restriction in sandbox for `cli.test.ts`, and Windows non-elevated symlink EPERM in `path-boundary.test.ts`).

## Remaining work and recommendations

1. Reorganize `docs/` into categorized subdirectories (`docs/specs/`, `docs/benchmarks/`, `docs/archive/`) after user alignment.
2. Review the 15 English-only site pages for potential Japanese localization.

