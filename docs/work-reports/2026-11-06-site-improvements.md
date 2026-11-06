# Documentation site syntax highlighting and bilingual navigation separation — 2026-11-06

Implementation report for Shiki-based syntax highlighting, code copy interactions, and language separation between Japanese and English navigation on the Simpludify documentation site.

## Task baseline and branch

- Baseline commit: `15aa9c2` on `main`.
- Working branch: `flash/docs/site-improvements`.
- Repository rule: `docs/ja/` and `docs/en/` remain the single documentation source of truth. No engine runtime API or behavior was changed.

## Requirements addressed

1. **Syntax highlighting with Shiki:**
   - Integrated `shiki` into the build process (`scripts/site-build.mjs`).
   - Supported languages: TypeScript, JavaScript, JSON, HTML, CSS, Bash/Shell, PowerShell, YAML, Diff, Markdown, and plain text fallback.
   - Dual-theme integration: Connected to the site's light and dark themes using Shiki's CSS variables (`--shiki-light`, `--shiki-dark`) and the site's background token (`--code`).
   - Build-time generation: All code blocks are pre-rendered into static HTML during `site:build`, without client-side runtime libraries or external CDN dependencies.
   - Copy button: Added an accessible, non-obtrusive copy button to each code block in `scripts/site-assets/site.js` and `site.css`, with visual confirmation ("コピー完了" / "Copied") and zero interference with normal text selection.
   - Mobile and horizontal scroll safety: Verified `overflow-x: auto` on code blocks with 0 horizontal page overflow at 390px mobile viewports.

2. **Bilingual navigation separation:**
   - English sidebar now displays **only English pages**, categorized cleanly into `Getting started`, `Guides`, `Examples`, `Project`, and `Engineering records`.
   - Japanese sidebar displays **only Japanese pages** across `はじめに`, `ガイド`, `リファレンス`, `サンプル`, `プロジェクト`, plus an explicit fallback section `技術資料 (英語)` for the 11 technical benchmark and archive records that do not have Japanese translations.
   - Added `en/examples.html` pointing to `docs/en/examples.md` and paired it with `examples.html`.
   - Added `.language-fallback-banner` to unpaired fallback pages (such as the 11 English technical records and 6 Japanese sample walkthroughs) with direct return links to prevent navigation dead ends.
   - Language switch button (`[data-language-link]`) in the header seamlessly swaps between translated pairs, or navigates to the counterpart index/gallery when no direct translation exists.
   - Preserved language continuity: Clicking the brand logo, header nav links ("Get started" / "はじめる", "Examples" / "サンプル"), and sidebar links keeps the reader within their chosen language.

## Changed files

- `package.json` & `package-lock.json`: Added `shiki` to `devDependencies`.
- `scripts/site-config.mjs`: Added `en/examples.html`, categorized English pages into structured sections, and paired `examples.html` with `en/examples.html`.
- `scripts/site-build.mjs`: Preloaded Shiki highlighter with dual themes, added fence rendering rule with copy buttons and language normalization, added `buildSidebar` for language-segregated navigation, added fallback banners, and updated `gallery(lang)`.
- `scripts/site-assets/site.css`: Added styles for `pre.shiki`, token CSS variables for light/dark themes, `.code-block`, `.copy-button`, `.language-fallback-banner`, `.lang-tag`, and `[data-language-link]`.
- `scripts/site-assets/site.js`: Added click delegation for `[data-copy-code]` using `navigator.clipboard`.
- `scripts/site-check.mjs`: Added assertions for Shiki code blocks, theme variables, code block containers, navigation separation, fallback banner presence/message, and language continuity on brand and header links.
- `tests/unit/site-features.test.ts`: Consolidated into `scripts/site-check.mjs` and removed from `tests/unit/` so that `npm test` in the CI `quality` job does not depend on a prior site build.
- `docs/work-reports/README.md`: Updated index with this report.

## Verification results

1. **`npm run licenses`**:
   - Verified allowlist and notices for all 161 locked dependencies (Shiki and its sub-dependencies are all MIT licensed).
2. **`npm run check`**:
   - Biome linting and formatting passed with 0 errors.
   - TypeScript typechecking passed with 0 errors.
   - Architectural boundary checks and package version consistency passed.
3. **`npm run site:build -- --base /Simpludify/` & `npm run site:check`**:
   - Built 102 HTML documents (including `en/examples.html`).
   - Verified 6,423 internal links and assets with 0 broken links and 0 anchor failures.
   - Verified 97 standalone TypeScript snippets with `tsc`.
   - Verified Shiki highlighting, copy buttons, sidebar isolation, language continuity, and fallback banners across all pages.
4. **`npm run site:build -- --base /` & `npm run site:check`**:
   - Root base `/` passed with identical verification.
5. **`npm test`**:
   - 66 test files passed, 891 unit tests passed. Verified passing even with `site-dist/` absent (preventing CI `quality` job failure).
6. **`npm run test:site` (Playwright in Chromium)**:
   - Evaluated all 87 documentation pages across desktop (`1440x900`) and mobile (`390x844`) viewports.
   - Verified light and dark theme toggling on every page with `document.documentElement.scrollWidth <= innerWidth + 1` (zero horizontal overflow).
   - Verified interactive sample lifecycles and disposal across all 15 gallery items.
   - Results: 0 failures.

## Known limitations

- The 11 engineering records (benchmarks and historical validation reports) remain English-only; they are surfaced as labeled fallbacks in the Japanese sidebar.
- 6 sample README walkthroughs remain Japanese-only; they feature fallback banners pointing to the English examples gallery.
