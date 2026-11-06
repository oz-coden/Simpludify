# English documentation

Simpludify is an experimental code-first TypeScript 2D engine with a DOM-free simulation Core and a Web host for Pixi rendering, browser input, asynchronous Scene preparation and DOM/Canvas UI. Core/Web **0.1.6 are published on npm**, adding [physical bindings and single-input capture](../docs/specs/input-bindings.md). Next development milestone is v0.1.7. Use matching versions and a lockfile for independent applications.

Published v0.1.6 includes physical key/mouse/gamepad bindings and single-input capture. Published v0.1.5 includes [virtual sticks and pointer controls](../docs/specs/virtual-input.md).

## Start here

- [First game](en/getting-started.md) and [independent npm SDK setup](en/npm.md)
- [Core concepts](en/concepts.md), [Scenes and UI](en/scenes-ui.md), [layout and viewport](en/layout.md)
- [Actions and input boundaries](../docs/specs/action-input.md), [gamepads](../docs/specs/gamepads.md) and [two-player input lab](../examples/unified-input/README.md)
- [Collision guide](en/collision.md), [build and hosting](en/hosting.md), [platform limits](en/limitations.md)
- [API contracts](../docs/api.md), [Canvas UI](../docs/specs/canvas-ui.md), [value controls](../docs/specs/canvas-controls.md), [native editing](../docs/specs/text-input-design.md) and [scrolling](../docs/specs/scrolling.md)
- [Grid](../docs/specs/grid.md), [movement](../docs/specs/movement.md), [rendering](../docs/specs/rendering.md), [sprites](../docs/specs/sprites.md), [Tilemap](../docs/specs/tilemap.md), [tile geometry](../docs/specs/tile-geometry.md), [Tween](../docs/specs/tween.md) and [Replay](../docs/specs/replay.md)
- [SDK integration patterns](../docs/specs/sdk-consumer-patterns.md), [architecture](../docs/architecture.md), [licensing](../docs/licensing.md)
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
