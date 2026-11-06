# First game and getting started

This guide explains how to check out the repository source workspace and get started with the existing examples. To build an independent game project without vendoring or copying engine sources, see the [npm SDK / Vite guide](npm.md). The published registry SDK is v0.1.6 and the next development milestone is v0.1.7. Unified input, gamepads, virtual input, and input bindings are available via npm.

## Requirements

- Node.js 22.12+ and npm (CI uses Node 24).
- Modern browser supporting WebGL, ResizeObserver, and ES2022.
- Automated testing targets Chromium. Compatibility with physical mobile devices, Safari, Firefox, and OS IME is not certified.

```sh
git clone https://github.com/oz-coden/Simpludify.git
cd Simpludify
npm ci
npm run dev -- --example character
```

Open the printed `http://127.0.0.1:4173` URL, click or Tab into the game surface, and use WASD to move.

## First code

Here is the core logic from `examples/character/main.ts`:

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";

const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
```

`examples/character/index.html` sets the page height and entry point:

```html
<style>
  html, body, #app { margin: 0; width: 100%; height: 100dvh; }
</style>
<main id="app"></main>
<script type="module" src="./main.ts"></script>
```

`Character` is a composition preset with Transform, Renderable, and Motion. It adds ActionMovement only when `movement` is provided. See [Movement composition](./specs/movement.md) for live scale changes and custom movement policies. A placeholder is drawn even without image assets. The default position is world coordinates (400, 225), speed is 180 units/second, and size is 32. `Game` has a default logical view resolution of 800×450.

The Web entry includes scoped CSS automatically. Without `parent`, Game appends its own host element to `document.body`. It does not autofocus. Give the html/body/parent element a nonzero height; standard CSS handles the outer page layout. Call `game.dispose()` when tearing down or replacing the game.

## Create a separate game directory

```sh
npm run create -- ../my-game
cd ../my-game
npm ci
npm run dev
```

This command refuses to overwrite an existing directory. It creates a vendored source workspace copying engine source, tooling, and documentation; engine updates must be incorporated explicitly. For UI and scene management, inspect `examples/ui-scenes/main.ts`. For collision and game rounds, see `examples/signal-run`.

## Verification and production build

```sh
npm run check
npm test
npm run build -- --target web --example character --base /my-game/
```

Single-game build output is emitted to `dist/`. Deploy all files, including `LICENSE.txt`, `THIRD-PARTY-NOTICES.txt`, and `sbom.json`, to your static HTTP(S) host. Serve over HTTP(S), not `file://`. Use `--base /` for domain-root deployments.

The official site and integrated sample gallery are built with a separate command:

```sh
npm run site:build -- --base /Simpludify/
npm run site:serve
```

See [Builds and hosting](hosting.md) for complete details.

## Troubleshooting

- **Black screen or startup error:** Check WebGL support and browser hardware acceleration settings. Examples display a diagnostic banner on initialization failure.
- **Keys not responding:** Focus the game area. On standard Buttons, Enter/Space activate UI while unconsumed keys like WASD control gameplay. Native text, number, and Select editors own all keys; Tab away from the editor to resume gameplay movement.
- **Missing images:** Place assets in the sample's `public/` directory or import them with Vite, taking base paths into account.
- **Detailed diagnostics:** Run `npm run doctor -- --json` to inspect environment and toolchain health.
