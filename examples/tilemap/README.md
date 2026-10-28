# Tile trail

```sh
npm run dev -- --example tilemap
npm run build -- --target web --example tilemap --base /Simpludify/
```

Focus the field and move with WASD. CameraFollow tracks the animated explorer through a 64×48 ground map. Two independently positioned maps add trees and flowers at different zIndex values around the ordinary player Actor. Paint under player changes exactly one ground cell; the label demonstrates worldToTile/tileToWorld. Leave/return creates fresh placements and releases the previous Scene's image leases. Navigation/editing buttons work with touch; movement requires a keyboard.

Terrain is visual only: water and trees do not block movement. No Tilemap collision API is enabled. The terrain SVG is original artwork under the repository MIT license; the hero reuses the original Sprite garden sheet. Both assets use import.meta.url for root/subpath-safe URLs.

Game code creates three Tilemap facades and calls place(scene). The renderer owns visible-cell Sprites and image sharing. [API](../../docs/tilemap.md), [design/collision proposal](../../docs/tilemap-design.md), and [measurements](../../docs/tilemap-performance.md) describe boundaries and limits.
