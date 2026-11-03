# First game

The registry SDK is published as Core/Web 0.1.4, including unified input and gamepads. For an independent application start with the [npm guide](npm.md). To edit the engine or run its current examples:

```sh
git clone https://github.com/oz-coden/Simpludify.git
cd Simpludify
npm ci
npm run dev -- --example character
```

Use Node.js 22.12+ and npm (CI uses Node 24). Open the printed localhost URL, click/Tab into the game surface and use WASD. The page and parent need a nonzero height. Chromium is the automated browser target; physical mobile devices, Safari/Firefox and OS IME are not certified by these tests.

```ts verify
import {
  Action,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";
const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = game.actions(Actions, { Move: KeyboardBindings.WASD });
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
```

The Web entry includes scoped CSS automatically. Without parent, Game appends its own host to document.body. It does not autofocus. Set html/body/parent height (for example 100dvh); ordinary CSS handles the outer page. Call game.dispose when removing the embedded game and on HMR teardown.

A Character without movement stays visible but reads no input. Its composition uses Transform, Renderable, Motion and ActionMovement; replace or extend those Components for game-specific behavior. No visual editor or AI service is required.

## Build and verify

```sh
npm run check
npm test
npm run build -- --target web --example character --base /my-game/
```

Serve dist through HTTP(S), not file://. For root hosting use --base /. For production SDK consumers, Vite owns the application build; the engine CLI is a repository/example tool. See [hosting](hosting.md), [platform limits](limitations.md), [concepts](concepts.md), [Actions](../../docs/action-input.md) and [gamepads](../../docs/gamepads.md).
