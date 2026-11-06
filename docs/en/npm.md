# Start an independent npm SDK project

Simpludify Experimental v0.1.6 is an ESM SDK split into `@simpludify/core` and `@simpludify/web`. The next development milestone is v0.1.7. During the 0.x phase, APIs may evolve between releases. Direct imports of internal source paths are not public APIs.

**Registry status: `@simpludify/core@0.1.6` and `@simpludify/web@0.1.6` are published on the npm registry.** Follow the steps below to install and set up an independent game project.

## 1. Requirements and packages

- Node.js 22.12+ and npm (CI uses Node 24).
- Modern browser supporting ES2022 and ResizeObserver. Automated testing covers Chromium/WebGL.
- A modern browser bundler supporting ESM and CSS imports, such as Vite.

| Package            | Description                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@simpludify/core` | Scene, Actor, Component, Grid, Geometry, Tilemap, Collision, Tween, Animation, Events, Timers, Camera, and Canvas UI models. No DOM/Pixi dependency; runs in Node.js. |
| `@simpludify/web`  | Game, PixiJS renderer, browser input, Canvas UI and DOM UI presentation. Re-exports Core APIs. Automatically installs Core and PixiJS as dependencies.                |

For browser games, installing `@simpludify/web` is sufficient. It does not bundle CommonJS, Node/SSR Web runners, Electron/Tauri packaging tools, visual editors, or sample assets.

## 2. Set up an independent Vite project

A complete runnable template is available in the [independent npm/Vite starter](../../templates/npm-vite/README.md). To set up a project manually from scratch:

```sh
mkdir my-game
cd my-game
npm init -y
npm pkg set type=module
npm pkg set scripts.dev=vite scripts.build="tsc --noEmit && vite build" scripts.preview="vite preview"
npm install @simpludify/web
npm install --save-dev vite typescript
```

> **Note on version pinning**: During the 0.x experimental phase, you can optionally pin an exact release with `npm install --save-exact @simpludify/web`.

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My Simpludify game</title>
    <style>html, body, #app { margin: 0; width: 100%; height: 100%; }</style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/main.ts"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["main.ts"]
}
```

Create `main.ts`:

```ts verify
import {
  Action,
  ActionController,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";

const game = new Game({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
const actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(actions.Move) }));
game.canvasUI(
  CanvasColumn(
    [
      CanvasLabel("My first game"),
      CanvasButton("Pause", () => game.pause()),
      CanvasButton("Resume", () => game.resume()),
    ],
    { padding: 16, gap: 12 },
  ),
);
await game.run();

// Call game.dispose() when unmounting the game from the page.
```

Start the local development server:

```sh
npm run dev
```

Open the printed URL, click or Tab into the game surface, and use WASD to move. Canvas UI buttons respond to both pointer and keyboard interaction. Commit the generated `package-lock.json` to Git and use `npm ci` in CI workflows.

## 3. CSS, assets and lifecycle

The root `@simpludify/web` entry imports scoped default CSS automatically. Explicit import is also available:

```ts
import "@simpludify/web/style.css";
```

Provide game assets using Vite imports or `new URL("./player.png", import.meta.url).href`. Do not reference internal SDK paths or engine source files.

A Scene manages its own Actors, input, events, UI, and asset resources. Use Game Scene APIs for transitions, and call `game.dispose()` when tearing down the game or within component unmount hooks in frameworks like React.

## 4. Production build and static hosting

```sh
npm run build
npm run preview
```

To build for a subpath, run `npx vite build --base /my-game/` after typechecking. Deploy the entire `dist/` directory to any static HTTP(S) host. Maintain third-party license notices in distributed applications. The SDK is distributed under the MIT license, and dependencies like PixiJS carry their respective licenses.

The [independent template](../../templates/npm-vite/README.md) automates `THIRD-PARTY-NOTICES.txt` generation for production dependencies.

## 5. Local archive validation

Engine maintainers can generate `.tgz` packages via `npm run pack:packages` and install them locally:

```sh
npm install /path/to/simpludify-core-0.1.6.tgz
npm install /path/to/simpludify-web-0.1.6.tgz
```

When installing locally before publication, install Core first so Web's registry dependency resolves properly.

## 6. Compatibility and limits

- Distributed as standard ESM and TypeScript declarations. Direct imports into `dist/` or CommonJS `require()` are not supported.
- JavaScript source maps include embedded sources.
- Use matching versions of Core and Web (v0.1.6). Web re-exports Core, allowing all imports to originate from `@simpludify/web`.
- Core compiles and verifies without DOM or Node ambient types. Web requires browser DOM types and runtime APIs.
- See [Platform limits](limitations.md), [API reference](api.md), and [Core/Host boundary](host-boundary.md) for full contracts.
