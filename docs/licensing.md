# Licensing and dependencies

Original Simpludify engine sources, example code and included SVG/placeholder designs use the root MIT license. Commercial games, modifications and redistribution are permitted under that license. Original game code and original assets do not acquire a mandatory MIT license by using this engine. Dependencies and independently obtained content keep their own terms.

## Reviewed dependency choices

Versions are exact in the workspace manifests and npm lockfile. The initial review checked npm metadata and installed license files on 2026-10-26:

| Direct dependency | Version | License           | Use                       |
| ----------------- | ------- | ----------------- | ------------------------- |
| PixiJS            | 8.22.0  | MIT               | Web rendering             |
| Vite              | 8.3.5   | MIT               | Development/build tooling |
| Vitest            | 5.0.5   | MIT               | Unit tests                |
| TypeScript        | 7.0.2   | Apache-2.0        | Typechecking              |
| Playwright        | 1.64.1  | Apache-2.0        | Browser tests             |
| Biome             | 2.6.3   | MIT OR Apache-2.0 | Lint and formatting       |
| Node types        | 24.10.0 | MIT               | Tooling types             |

These projects had recent published maintenance activity when selected. Version pinning is reproducibility, not a guarantee against vulnerabilities. Run `npm audit` when changing dependencies. No font, audio, Electron runtime or game-content pack is bundled in the current game runtime.

## Automated notices and inventory

`npm run check` validates all locked package license declarations against a reviewed allowlist and requires license/notice files for installed packages. New unreviewed license identifiers fail the check. Optional binaries for other platforms are represented in the inventory even when not installed on the current host. Their upstream files must be rechecked on a packaging host before redistributing those binaries.

`npm run build -- --target web` creates:

- `dist/LICENSE.txt`: original engine/example MIT notice;
- `dist/THIRD-PARTY-NOTICES.txt`: installed dependency license/notice text, conservatively including build tools;
- `dist/sbom.json`: versioned JSON dependency inventory with version, integrity, license, dev/installed flags.

This initial inventory is a project-specific SBOM schema (`simpludify-dependencies-v1`), not an SPDX/CycloneDX certification or a binary-level compliance audit. Vite/Rolldown's packaged third-party notices are retained as well.

Some optional tool binaries omit a separate license file. The generator includes their owning Biome/Rolldown distribution's notices. `@pixi/colord@2.9.6` omits the upstream license file; the upstream MIT text is preserved in [third-party/colord](../third-party/colord/LICENSE.md), sourced from [the license commit](https://github.com/omgovich/colord/blob/0d16e3b7ab0a4bcb42e6682712cc124af5f7ce9d/LICENSE.md). Reassess this fallback when updating the dependency.

Vite's optional Lightning CSS tooling appears in the lockfile under MPL-2.0. The checker permits MPL only for development dependencies; it is not an approved game-runtime dependency. The current build does not enable Lightning CSS or ship its binary. Redistributing that tool or modifying/bundling its code requires a separate review of its source-availability obligations; see [Mozilla's MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

## Distribution checklist

Keep the engine MIT notice and generated third-party notices with a distributed game. Review any newly added images, fonts, music and code separately, including attribution and redistribution rights. Re-run checks/inventory after dependency changes. Desktop packaging will additionally require review of Electron/Chromium/Node and all shipped native binaries. A compatible source license does not guarantee ownership of arbitrary supplied content or general operational safety.

## Documentation site tooling

The official site adds markdown-it 15.0.3 (MIT) as an exact development dependency. Its seven locked additions, including argparse, entities, linkify-it, mdurl, punycode.js and uc.micro, were reviewed from installed manifests and license files on 2026-10-27. argparse 3.0.4 declares PSF-2.0 and includes the Python Software Foundation license text; the complete file is retained by the notice generator. PSF-2.0 is permitted for development dependencies only. No Markdown parser is shipped as game runtime code. The generated site includes the conservative combined build/runtime inventory and notices, just like single-game output. The site uses system fonts, first-party CSS/JS and existing MIT sample assets; no remote font, analytics or CDN runtime is added.
