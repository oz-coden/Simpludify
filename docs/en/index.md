# English documentation

Simpludify is an experimental code-first TypeScript 2D engine with a DOM-free simulation Core and a Web host for Pixi rendering, browser input, asynchronous Scene preparation and DOM/Canvas UI. Core/Web **0.1.6 are published on npm**, adding [physical bindings and single-input capture](specs/input-bindings.md). Next development milestone is v0.1.7. Use matching versions and a lockfile for independent applications.

Published v0.1.6 includes physical key/mouse/gamepad bindings and single-input capture. Published v0.1.5 includes [virtual sticks and pointer controls](specs/virtual-input.md).

## Start here

- [First game](./getting-started.md) and [independent npm SDK setup](./npm.md)
- [Core concepts](./concepts.md), [Scenes and UI](./scenes-ui.md), [layout and viewport](./layout.md)
- [Actions and input boundaries](specs/action-input.md), [gamepads](specs/gamepads.md) and [two-player input lab](../../examples/unified-input/README.md)
- [Collision guide](./collision.md), [build and hosting](./hosting.md), [platform limits](./limitations.md)
- [API contracts](api.md), [Canvas UI](specs/canvas-ui.md), [value controls](specs/canvas-controls.md), [native editing](specs/text-input-design.md) and [scrolling](specs/scrolling.md)
- [Grid](specs/grid.md), [movement](specs/movement.md), [rendering](specs/rendering.md), [sprites](specs/sprites.md), [Tilemap](specs/tilemap.md), [tile geometry](specs/tile-geometry.md), [Tween](specs/tween.md) and [Replay](specs/replay.md)
- [SDK integration patterns](specs/sdk-consumer-patterns.md), [architecture](architecture.md), [licensing](licensing.md)
- [Interactive gallery (Japanese instructions; sample controls use English labels)](../ja/examples.md)

## Language coverage

The maintained onboarding, current API and major user guides have Japanese and English routes. The header switches to the corresponding guide where a pair exists; unpaired sample instructions and engineering records link to the other language's index. Both language indexes stay available in navigation. Existing URLs are retained.

Detailed English contracts are rendered directly from repository docs. Design proposals, historical implementation/validation reports and performance measurements are separate engineering records, not promises of current API behavior. Not every historical report or sample instruction is translated. The gallery instructions and game UI are not fully localized.

## Source examples

```sh
git clone https://github.com/oz-coden/Simpludify.git
cd Simpludify
npm ci
npm run dev -- --example unified-input
```

Use Node.js 22.12+ (CI: Node 24). Focus the game area with click/Tab. The input lab supports keyboard, touch and program operation without physical pads. The automated target is Chromium with WebGL/Canvas2D fixtures; physical pads, OS IME, mobile hardware and Safari/Firefox remain unverified.

Trigger/Solid contacts, bounded inverse-mass position correction and sprite animation are implemented. Collision is discrete, without force/impulse rigid-body dynamics or continuous collision detection. Audio, networking and native desktop packaging remain unimplemented. APIs may change before stabilization. See [platform limits](./limitations.md) and the [implemented roadmap](roadmap.md).
