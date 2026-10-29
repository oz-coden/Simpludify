# Canvas trail

```sh
npm run dev -- --example canvas-ui
```

Start opens a SpriteAnimation character in a SpriteSheet Tilemap. WASD and four Canvas hold buttons share the same typed Move Action. Stone stops the dynamic circle through CollisionWorld; water is a Trigger. Slide along the wall, edit the wall at (14,7), pause/resume with P/Escape or the Canvas button, select a world tile by clicking empty UI space, then Menu/Start to destroy and recreate the Scene. The Camera follows the corrected Actor; HUD and touch controls remain in screen coordinates. Resize to see Flex node wrapping, a min/max-constrained title panel and automatic Japanese/English text wrapping. Buttons use minimum height with automatic content height; each computed rectangle also drives pointer and keyboard-mirror bounds. Tab/Enter/Space operate mirrored native buttons and draw the focus ring on Canvas.

The existing DOM UI example remains independent. Canvas widgets render through Pixi, including Canvas2D fallback. This example does not implement a custom collision/movement/input router. `context.actions` supplies the staged Scene/input, `controls.createSource(node)` scopes each touch contribution, and `context.canvasUI(root)` scopes the entire UI tree. Async navigation buttons receive an owner AbortSignal; Scene disposal cancels gestures and subscriptions.

Original terrain/character SVG assets are reused from Tile trail/Sprite garden. No external artwork or layout runtime is added.
