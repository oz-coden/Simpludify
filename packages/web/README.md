# @simpludify/web

Experimental v0.1.3 browser SDK for Simpludify, a code-first TypeScript 2D engine. APIs may change between 0.x releases. Includes Game, PixiJS rendering, browser input and Canvas/DOM UI adapters; re-exports the host-independent Core API. Core and PixiJS are installed as runtime dependencies, not bundled into this package.

Registry installation (check availability with `npm view @simpludify/web@0.1.3 version`):

```sh
npm install @simpludify/web@0.1.3
npm install --save-dev vite typescript
```

```ts
import { Game, Character } from "@simpludify/web";
const game = new Game();
game.add(Character());
await game.run();
// Call game.dispose() when removing the game.
```

Use a browser bundler such as Vite, with an HTML module entry and a parent with an explicit height. The entry automatically imports scoped CSS. It can also be imported explicitly with `import "@simpludify/web/style.css"`. Do not configure CSS as side-effect-free. No repository CLI, example assets or global stylesheet reset is included.

ESM only, ES2022. Tooling requires Node >=22.12; Chromium/WebGL is the automated rendering target. This browser package is not a Node/SSR entry; use `@simpludify/core` for headless execution. Source maps embed original sources. [Complete Vite setup](https://github.oz-coden.com/Simpludify/guides/npm.html) · [Repository/API](https://github.com/oz-coden/Simpludify). MIT.
