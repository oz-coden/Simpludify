import { Character, Game, Movement } from "@simpludify/web";

const game = new Game({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
game.add(Character({ movement: Movement.WASD }));
await game.run();
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
