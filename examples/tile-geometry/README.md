# Tile geometry lab

A small color-layer comparison of square, alternating triangle, axial pointy hex and axial flat hex tilings. Run `npm run dev -- --example tile-geometry` or open it in the official sample gallery.

1. Choose Geometry. Click/tap a cell to paint it and show its coordinates/center; gold cells share an edge.
2. Paint selected toggles its color. Hide / show selected switches its value to/from null; hidden cells remain selectable.
3. Pan buttons or WASD move the Camera; Zoom changes its magnification. Reset view returns to the initial projection.
4. Recreate scene disposes placements, UI and presentation Tweens, then creates fresh data.

Triangle and Hexagon Actors rotate independently through existing presentation Tweens. A Canvas label shares the normal UI routing. Controls outside the game reflow on narrow screens; no drag gesture is needed to access Camera controls.

`GeometryTilemap` copies Grid data and handles geometry, culling, picking and changed-cell drawing. The sample keeps only selection/highlight state and colors. These layers do not create physics. Image tiles clipped into polygons, arbitrary polygon colliders and pathfinding are outside this sample. See [full contracts](../../docs/en/specs/tile-geometry.md).
