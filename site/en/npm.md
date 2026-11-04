# Start an independent npm SDK project

Core/Web 0.1.5 are published on npm, including unified input and gamepads. Existing versions/tags are immutable. Use exact versions and a lockfile. Internal source paths are not public package exports.

## Published SDK

```sh
npm create vite@latest my-game -- --template vanilla-ts
cd my-game
npm install
npm install --save-exact @simpludify/web@0.1.5
```

Use Node.js 22.12+ (CI: Node 24). Web installs its exact Core dependency and Pixi. The root Web import brings scoped CSS automatically; @simpludify/web/style.css is also an explicit stylesheet export. Core alone is suitable for headless simulation and has no DOM/Pixi dependency.

Replace the application entry with a minimal game and provide page/parent height:

```ts verify
import {
  Action,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";
const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = game.actions(Actions, { Move: KeyboardBindings.WASD });
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
```

Set html/body height:100dvh and margin:0. Focus the game with click/Tab; it does not autofocus. Use npm run dev, and Vite's npm run build -- --base /my-game/ for a subpath. Serve dist over HTTP(S). Asset URLs should use new URL("./asset.png", import.meta.url).href; do not hardcode repository paths or CDN source imports.

## Local archive validation

Build from a verified source checkout:

```sh
npm ci
npm run pack:packages
```

Install both generated archives in a disposable copy of the application:

```sh
npm install --save-exact /absolute/simpludify-core-0.1.5.tgz /absolute/simpludify-web-0.1.5.tgz
```

Run its types, units, production build and browser tests. Candidate file: dependencies belong only in that disposable copy. Production applications should use matching published registry versions and verify a clean installation before committing a dependency upgrade.

The independent [npm/Vite starter](https://github.com/oz-coden/Simpludify/tree/main/templates/npm-vite) pins published 0.1.3 and includes a lockfile, Page base configuration, cleanup and license notice generation. Its dependency upgrade is a separate change; this release does not alter its committed lockfile.

## Ownership, licenses and scope

Create Scene-owned controls/resources inside factories, await run/goTo readiness and dispose Game on application/HMR teardown. Use bindViewport for a Canvas layout-owned world region; native editing/IME remains host-owned. [SDK integration patterns](../../docs/sdk-consumer-patterns.md) explain focus, projection, clocks and notices.

Distribute the SDK MIT license and locked dependencies' notices with your application. The starter demonstrates THIRD-PARTY-NOTICES generation; engine package notices do not automatically cover every application dependency. Source maps contain embedded source. Review your own assets/fonts licenses.

Windows/Linux CI verifies ESM/declarations, NodeNext Core-only import, exact transitive Web installation, Vite development/production and 320/390px behavior. It does not create a native Windows/Linux executable. [Platform limits](limitations.md) and the [release procedure](../../docs/npm-publishing.md) separate current support from future targets.
