# Simpludify

A code-first TypeScript 2D game engine. Create a visible character, responsive UI, and scene navigation using ordinary code and browser tooling.

**Status: experimental Web engine with a composition-based Core.** The API can change before a stable release. Windows/Electron packaging is pending. No npm package or release is published.

## Quick start

Use Node.js **22.12 or later** and npm. Node 24 is used by the initial CI configuration. The Web renderer requires a modern browser with WebGL, ResizeObserver, and ES2022 support; Chromium is the automated browser test target. Other browsers have not yet been verified.

```sh
git clone https://github.com/oz-coden/Simpludify.git
cd Simpludify
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**. Click an empty part of the game area, then use **W A S D** to move. The button changes scenes; Tab and Enter also operate the controls. Narrow screens reflow the UI. Touch movement controls are not implemented.

To run the minimal character example:

```sh
npm run dev -- --example character
```

`examples/character/main.ts` contains the working SDK entry point:

```ts
import { Game, Character, Movement } from "@simpludify/web";

const game = new Game();
game.add(Character({ movement: Movement.WASD }));
await game.run();
```

The browser entry imports the default stylesheet automatically. With no parent specified, the game is appended to `document.body`. Give the page and parent a height for a full-screen game; the supplied example HTML already does this. Click or Tab into the game to grant keyboard focus. The rounded placeholder character needs no image asset or visual editor. Call `game.dispose()` when removing the game from a page.

## Actors, Components and the sample game

Game objects are generic Actors composed from reusable Components. Transform, Renderable, Motion and KeyboardController implement the Character preset. Typed events and simulation timers can be scoped to Scenes, Actors or Components. Camera, Viewport, logical resolution and physical pixels are separate concepts.

```sh
npm run dev -- --example composition
```

**Beacon field** demonstrates custom Components, WASD collection, typed events, runtime spawning/removal, simulation timers, pointer-to-world conversion and zoom. The same collection logic also runs in a headless test. See [API and migration notes](docs/api.md) for low-level extension APIs and changes to the experimental storage/renderer contracts.

## Create a separate game workspace

The thin scaffold command copies the engine sources, toolchain lockfile, examples, and documentation into a new directory:

```sh
npm run create -- ../my-game
cd ../my-game
npm ci
npm run dev
```

Edit `examples/ui-scenes/main.ts` for UI and navigation, or `examples/character/main.ts` for a minimal game. Creation refuses to overwrite an existing directory. This is a vendored source workspace, not an installed public npm SDK; engine updates must currently be incorporated explicitly. Both internal packages are private.

## Commands

| Command                                             | Purpose                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                       | Start the UI/scenes example on localhost:4173                                                                  |
| `npm run check`                                     | Strict typechecking, DOM-free core check, lint/format, boundary/file validation, dependency license validation |
| `npm test`                                          | Node-only unit and CLI contract tests                                                                          |
| `npm run test:build`                                | Build and smoke-test production output under `/Simpludify/` at two viewport sizes                              |
| `npm run test:browser`                              | Playwright integration tests at two viewport sizes                                                             |
| `npm run build -- --target web`                     | Static Web output in `dist/`, including dependency notices and inventory                                       |
| `npm run build -- --target web --example character` | Build the minimal example                                                                                      |
| `npm run doctor -- --json`                          | Machine-readable tooling diagnostics                                                                           |
| `npm run bench`                                     | Headless idle and 1,000-character baseline as JSON                                                             |
| `npm run bench:browser`                             | Browser workload measurements as JSON                                                                          |
| `npm run licenses -- --out dist`                    | Regenerate dependency notices/inventory                                                                        |
| `npm run format`                                    | Apply Biome formatting and safe lint fixes                                                                     |

Before running browser tests for the first time:

```sh
npx playwright install --with-deps chromium
npm run test:browser
```

On a machine with an existing compatible Chromium binary, `CHROMIUM_PATH` can select it. CI installs the Playwright-pinned version. A finite CLI command supports `--json`, for example `node scripts/cli.mjs check --json` or `node scripts/cli.mjs test --json`. Exit codes: **0** success, **1** validation/build/runtime command failure, **2** invalid arguments or unsupported target. The persistent development server uses text logging.

## Static hosting

```sh
npm run build -- --target web --base /Simpludify/
```

Upload **all files in `dist/`**, including `LICENSE.txt`, `THIRD-PARTY-NOTICES.txt` and `sbom.json`, to the static host. The default base is `./`; use an explicit base for GitHub Pages project paths. Put images and local fonts in the selected example's `public/` directory, or import assets through Vite. For subpath-safe public assets use `import.meta.env.BASE_URL + 'player.svg'`. No cloud service or AI provider is required at runtime. Hosting is not enabled automatically.

## Documentation

- [API and defaults](docs/api.md)
- [Architecture and lifecycle decisions](docs/architecture.md)
- [Performance methodology and recorded limitations](docs/performance.md)
- [Implementation status and next milestone](docs/roadmap.md)
- [Licensing and dependency policy](docs/licensing.md)
- [Original design specification](SPEC.md)
- [Contributor and coding-agent instructions](AGENTS.md)

## License

Original engine code and included example assets are [MIT licensed](LICENSE). Games' original code and assets do not have to use MIT. Bundled dependencies retain their own licenses; see [licensing](docs/licensing.md).
