# Interactive examples gallery

Explore runnable examples directly in the browser before reading code. Games load on demand when you launch them. Only one example runs at a time; launching another sample or clicking Stop cleanly disposes the previous Game instance.

WebGL rendering is verified in Chromium desktop and narrow viewports. Software GPU fallbacks and Canvas2D compatibility are verified for select fixtures, but are not guaranteed for all environments. On narrow mobile screens, scroll down to the player frame or click "Open in new tab". Signal Run, Blockfall, Prism Raid, and Canvas trail support full touch controls. Unified input lab supports keyboard, touch, and programmatic input for each player.

<!--gallery-->

## Suggested learning progression

1. **Character:** Minimal setup with Game, Character, and typed Action input.
2. **UI / Scenes:** Typed Scene IDs, DOM UI buttons, and asynchronous transitions.
3. **Beacon Field:** Custom Components, typed events, timers, pointer conversion, dynamic spawn/removal.
4. **Signal Run:** Trigger pickup/damage, Solid wall collisions, HP and timer, pause, retry, camera follow.
5. **Blockfall:** Integer grid puzzle, seeded 7-bag, rotation, line clears, hold/ghost, touch controls, headless replay test.
6. **Prism Raid:** Triangle ships, movement, rapid fire, multiple enemies, Trigger combat, autopilot demonstration.
7. **Sprite garden:** SpriteSheet, idle/walk animations, shared textures, Scene round-trips.
8. **Tile trail:** Grid and SpriteSheet terrain layers, WASD camera follow, Solid wall obstacles, water Triggers.
9. **Canvas trail:** Canvas UI, Flex layout, multi-pointer routing, touch buttons, sprite animation, terrain collision.

## Focus and teardown

The game runs inside an isolated iframe. Keyboard input operates only while the game frame is focused. Tab into controls and Shift+Tab back out. Stopping the game restores focus to the launch button. Hiding the tab releases held keys and gestures.

When switching examples, `Game.dispose()` runs before removing the iframe. Reopening from browser bfcache reloads fresh state.

## Tested scope

Examples exercise the published `@simpludify/web` and `@simpludify/core` APIs. Automated fixtures run on Chromium at desktop and 390px widths. See [Platform limits](limitations.md).

## Tile geometry lab

Switch between square, triangle, and two hex orientations to test tap picking, color painting, edge-neighbor highlights, and Camera controls. See [Tile geometry contracts](specs/tile-geometry.md).

## Unified input lab

Control two players on the same screen while switching between keyboard, gamepads, touch buttons, and programmatic input without replacing Actors. See [Gamepads and input sources](specs/gamepads.md).
