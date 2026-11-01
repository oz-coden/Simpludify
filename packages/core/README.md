# @simpludify/core

Experimental v0.1.0 of Simpludify, a code-first TypeScript 2D engine. APIs may change between 0.x releases. This package contains host-independent Scene/Actor/Component, collision, geometry, tilemaps, tween/animation, input and Canvas UI models. It has no browser or Node runtime dependencies.

The v0.1.0 distribution is being prepared; registry availability is not yet confirmed. Once published:

```sh
npm install @simpludify/core@0.1.0
```

```js
import { Engine, Actor, Transform } from "@simpludify/core";
const engine = new Engine();
const actor = new Actor();
actor.add(new Transform({ x: 10, y: 20 }));
engine.scene.add(actor);
engine.step(1 / 60);
engine.dispose();
```

ESM only, ES2022, Node >=22.12 for headless usage. No CommonJS or renderer is included. For browser presentation install `@simpludify/web`, which depends on this package. JavaScript source maps embed the original sources; declarations are included. [Repository and API](https://github.com/oz-coden/Simpludify) · [Documentation](https://github.oz-coden.com/Simpludify/). MIT.
