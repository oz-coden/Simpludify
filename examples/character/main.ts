import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";
import { startExample } from "../shared/start";

const game = new Game({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(Actions.Move) }));
await startExample(game);
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
