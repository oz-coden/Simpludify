# Sprite garden

```sh
npm run dev -- --example sprites
npm run build -- --target web --example sprites --base /Simpludify/
```

Focus the game and move with WASD. The green player switches between idle/walk clips; the violet friend shares the same sheet but owns independent one-shot playback. Buttons restart/pause/resume/stop the friend or leave/return to the field. Movement requires a keyboard; playback/navigation buttons also work with touch.

`main.ts` uses Character + SpriteSheet + SpriteAnimation, an ordinary ActionController and a short Scene callback to select movement clips. No game code obtains Textures or advances frames. The eight 32×32 cells in `hero.svg` are original geometric artwork provided under the repository MIT license. `new URL(..., import.meta.url)` keeps the asset correct under root/subpath builds.

[Sprite contracts](../../docs/sprites.md) explain frame coordinates, deferred image-bound validation, source ownership, sharing and cleanup. Browser checks live in `tests/browser/sprites.spec.ts`.
