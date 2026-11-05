# English documentation

Simpludify is an experimental code-first TypeScript 2D engine with a DOM-free simulation Core and a Web host for Pixi rendering, browser input, asynchronous Scene preparation and DOM/Canvas UI. Core/Web **0.1.5 are published on npm**, including source gating and gamepads. Use matching versions and a lockfile for independent applications.

Source v0.1.6 adds [physical bindings and single-input capture](../docs/input-bindings.md), including common device settings, runtime edits and persistence. These additions are not yet published on npm.

Published v0.1.5 includes [virtual sticks and pointer controls](../docs/virtual-input.md).

## Start here

- [First game](en/getting-started.md) and [independent npm SDK setup](en/npm.md)
- [Core concepts](en/concepts.md), [Scenes and UI](en/scenes-ui.md), [layout and viewport](en/layout.md)
- [Actions and input boundaries](../docs/action-input.md), [gamepads](../docs/gamepads.md) and [two-player input lab](../examples/unified-input/README.md)
- [Collision guide](en/collision.md), [build and hosting](en/hosting.md), [platform limits](en/limitations.md)
- [API contracts](../docs/api.md), [Canvas UI](../docs/canvas-ui.md), [value controls](../docs/canvas-controls.md), [native editing](../docs/text-input-design.md) and [scrolling](../docs/scrolling.md)
- [Grid](../docs/grid.md), [movement](../docs/movement.md), [rendering](../docs/rendering.md), [sprites](../docs/sprites.md), [Tilemap](../docs/tilemap.md), [tile geometry](../docs/tile-geometry.md), [Tween](../docs/tween.md) and [Replay](../docs/replay.md)
- [SDK integration patterns](../docs/sdk-consumer-patterns.md), [architecture](../docs/architecture.md), [licensing](../docs/licensing.md)
- [Interactive gallery (Japanese instructions; sample controls use English labels)](ja/examples.md)

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

Trigger/Solid contacts, bounded inverse-mass position correction and sprite animation are implemented. Collision is discrete, without force/impulse rigid-body dynamics or continuous collision detection. Audio, networking and native desktop packaging remain unimplemented. APIs may change before stabilization. See [platform limits](en/limitations.md) and the [implemented roadmap](../docs/roadmap.md).
