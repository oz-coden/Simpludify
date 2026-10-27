# English documentation

Simpludify is an experimental code-first TypeScript 2D engine. It provides a DOM-free simulation Core and a Web host for Pixi rendering, browser input, asynchronous scene preparation, and DOM UI. There is no published npm SDK yet; clone the source workspace to start.

## Language coverage

The primary site currently provides Japanese onboarding, concepts, practical guides and sample instructions. This English section directly renders the existing detailed API, architecture, roadmap, performance and licensing documents from the repository. It is not a complete translation of every Japanese page.

- [API contracts and defaults](../docs/api.md)
- [Architecture, lifecycle and ownership](../docs/architecture.md)
- [Implemented scope and roadmap](../docs/roadmap.md)
- [Performance methodology and limitations](../docs/performance.md)
- [Licensing and dependency review](../docs/licensing.md)
- [Interactive sample gallery (Japanese instructions)](ja/examples.md)

## Quick start

```sh
git clone https://github.com/oz-coden/Simpludify.git
cd Simpludify
npm ci
npm run dev -- --example character
```

Use Node.js 22.12+; CI uses Node 24. Open the printed localhost URL, focus the game area and use WASD. WebGL is the primary verified rendering path. The pinned Pixi can select a fallback; a no-WebGL Character Canvas2D startup is covered, not full fallback compatibility. Chromium is the automated browser target. The sample gallery launches each game in a separate iframe; Signal Run also supports touch controls. Character and Beacon Field require a keyboard for movement.

## Scope

Trigger/Solid contacts and bounded inverse-mass position correction are implemented. This is not a force/impulse rigid-body engine or continuous collision detection. Audio, sprite animation, networking, Windows packaging and a full falling-block puzzle are not implemented. API semantics may change before stabilization.
