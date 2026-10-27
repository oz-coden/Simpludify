import { Character, Game, Movement } from "@simpludify/web";
import { startExample } from "../shared/start";

const game = new Game({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
game.add(Character({ movement: Movement.WASD }));
await startExample(game);
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
