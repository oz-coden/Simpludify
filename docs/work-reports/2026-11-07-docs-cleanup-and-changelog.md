# Documentation cleanup, initial specification archive, and CHANGELOG establishment — 2026-11-07

Implementation and verification report for organizing Simpludify documentation, archiving early specifications, creating the user-facing `CHANGELOG.md`, generalizing version references, and updating publishing procedures.

## Task baseline and branch

- Baseline commit: `db0d592` on `origin/main`.
- Working branch: `flash/docs/cleanup`.
- Engine API & runtime: No changes were made to `@simpludify/core` or `@simpludify/web` runtime behavior, exports, or public APIs.

---

## Completed improvements

### 1. Initial specification archive

- **Moved `SPEC.md`**: Relocated `SPEC.md` to `docs/archive/initial-spec.md`.
- **Added historical archive notice**: Added a clear note at the top of `docs/archive/initial-spec.md` indicating that it is an early design draft from October 2026 (illustrating early concepts such as a multi-package `packages/renderer-pixi` and `packages/ui-dom` structure before it was consolidated into `packages/core` and `packages/web`), and directed readers to current authoritative specifications:
  - Architecture: `docs/en/architecture.md` / `docs/ja/architecture.md`
  - API: `docs/en/api.md` / `docs/ja/api.md`
  - Roadmap: `docs/en/roadmap.md` / `docs/ja/roadmap.md`
  - Host boundary: `docs/en/host-boundary.md` / `docs/ja/host-boundary.md`
- **Updated cross-references**:
  - `AGENTS.md`: Updated initial spec reference.
  - `scripts/cli.mjs`: Removed non-existent `"SPEC.md"` and `"site"` from the file list copied by `npm run create`.
  - `README.md`: Updated link to `docs/archive/initial-spec.md`.

### 2. User-facing `CHANGELOG.md` creation

- Created root `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning principles.
- Covered the complete release history:
  - `[Unreleased]`: Build-time Shiki syntax highlighting, bilingual navigation isolation, docs restructuring, SPEC archive, version generalization, and CHANGELOG creation.
  - `[0.1.6] - 2026-11-05`: Physical bindings (`KeyboardBindings`, `MouseBindings`, `GamepadBindings`), single-input capture API (`captureNextInput`), binding serialization v1 schema, and `input-bindings` lab.
  - `[0.1.5] - 2026-11-04`: Virtual sticks (fixed/floating/follow), directional swipe virtual buttons, multi-touch routing, and `virtual-input` lab.
  - `[0.1.4] - 2026-11-03`: Unified action input architecture, Gamepad API integration, local multiplayer source gating, security hardening, and `unified-input` lab.
  - `[0.1.3] - 2026-11-03`: Accessible Canvas UI (readable text mirrors, heading levels, status/alert live regions), numeric keyboard hints, and GPU pooling.
  - `[0.1.2] - 2026-11-02`: First official npm publication via GitHub Actions Trusted Publishing (OIDC), `bindViewport` HUD/world split, and independent Vite starter.
  - `[0.1.1] - 2026-11-02`: Windows npm packaging support and workspace version synchronization.
  - `[0.1.0] - 2026-11-02`: Initial modular packaging for `@simpludify/core` and `@simpludify/web`, CLI tooling, and static documentation site generation.
- Focused on user-facing capabilities, API additions, fixes, and compatibility impacts rather than internal CI metrics.

### 3. Root `README.md` reorganization

- Removed lengthy per-release logs (`v0.1.4`, `v0.1.5`, `v0.1.6`) from `README.md` and linked them to `CHANGELOG.md`.
- Kept a concise summary of the latest release (v0.1.6) and upcoming milestone (v0.1.7).
- Replaced fixed-version install commands with standard `npm install @simpludify/web` while documenting optional `--save-exact` version pinning.
- Fixed stale/broken relative links:
  - `docs/api.md` → `docs/en/api.md` & `docs/ja/api.md`
  - `docs/licensing.md` → `docs/en/licensing.md` & `docs/ja/licensing.md`
  - `SPEC.md` → `docs/archive/initial-spec.md`
- Verified all 72 markdown links in `README.md` with an automated link verification script (0 broken links).

### 4. Version notation generalization

- General installation instructions across `README.md`, `docs/en/npm.md`, and `docs/ja/npm.md` now recommend `npm install @simpludify/web` without hardcoded patch versions.
- Release workflow examples in `docs/en/npm-publishing.md` and `docs/ja/npm-publishing.md` now use placeholders:
  - `npm run version:sdk -- <version>` (with examples like `0.1.7`).
  - GitHub Actions manual trigger confirmation: `publish @simpludify/core@<version> and @simpludify/web@<version>`.
- Historical facts, previous release reports, CHANGELOG versions, package manifests, and `scripts/sdk-version.mjs` checks were preserved intact.

### 5. `docs/work-reports/` organization

- In `docs/work-reports/README.md`:
  - Corrected v0.1.6 publication status from "pending" to "Complete: Core/Web 0.1.6 published via GitHub Actions Trusted Publishing (OIDC) from a137594; signed provenance in Sigstore; clean public-registry consumer tests passed."
  - Added a clear role separation notice between `CHANGELOG.md` (user-facing release notes) and `docs/work-reports/` (developer technical journals and verification logs).
  - Organized existing 26 reports into a structured release publication table and reverse-chronological technical report index.

### 6. Site configuration maintainability review

- Analyzed `scripts/site-config.mjs`:
  - `pages` defines `[route, source, title, section]`.
  - `languagePairs` explicitly maps `[jaRoute, enRoute]`.
  - Adding/removing a document requires: (1) adding/removing the entry in `pages`, and (2) updating `languagePairs` if translated.
  - `scripts/site-check.mjs` automatically validates uniqueness of routes/sources, bidirectionality of language pairs, absence of broken links/anchors, and presence of fallback banners.
  - **Assessment**: The current structure is clean, declarative, explicit, and easy to maintain without runtime overhead or brittle magic heuristics. No heavy redesign is required.

---

## Changed files

- `SPEC.md` → `docs/archive/initial-spec.md`: Relocated and prepended historical archive notice.
- `CHANGELOG.md`: Newly created comprehensive release changelog.
- `README.md`: Streamlined release history, generalized install commands, and fixed broken relative links.
- `AGENTS.md`: Updated initial spec reference.
- `scripts/cli.mjs`: Removed stale `"SPEC.md"` and `"site"` from `npm run create` file copy list.
- `docs/en/npm.md` / `docs/ja/npm.md`: Generalized installation commands and explained optional exact pinning.
- `docs/en/npm-publishing.md` / `docs/ja/npm-publishing.md`: Generalized release commands and confirmation strings with `<version>` placeholders.
- `docs/work-reports/README.md`: Corrected v0.1.6 status and reorganized report index.
- `docs/work-reports/2026-11-07-docs-cleanup-and-changelog.md`: This work report.

---

## Verification results

1. **`npm run check`**:
   - Biome formatting and linting: Clean (0 errors).
   - TypeScript compilation (`tsc --noEmit`): Clean (0 errors).
   - Architecture and required-file validation: Passed.
   - SDK version 0.1.6 consistency: Passed.
   - License check: 161 locked dependencies verified (all MIT).

2. **`npm test`**:
   - 66 test files passed, 891 unit tests passed.

3. **`npm run site:build -- --base /Simpludify/` & `npm run site:check`**:
   - 102 HTML documents generated.
   - 6,423 internal links and assets verified with 0 errors.
   - 97 standalone TypeScript snippets typechecked with 0 errors.
   - Shiki highlighting, bilingual navigation, fallback banners, and language continuity verified.

4. **`npm run site:build -- --base /` & `npm run site:check`**:
   - Root base `/` build and verification passed with identical results.

5. **`npm run test:site` (Playwright in Chromium)**:
   - 87 documentation pages evaluated across desktop (`1440x900`) and mobile (`390x844`) viewports.
   - Light and dark themes toggled with zero horizontal overflow.
   - All 15 interactive gallery samples cleanly initialized and disposed without errors.

6. **Relative link verification in `README.md`**:
   - 72 relative links tested; all target files exist on disk.
