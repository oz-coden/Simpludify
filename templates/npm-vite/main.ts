import {
  Action,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";
import "@simpludify/web/style.css";

const parent = document.querySelector<HTMLElement>("#app");
if (!parent) throw new Error("Missing #app");
const game = new Game<"play">({ parent });
const Actions = defineActions({ Move: Action.axis2D() });
game.scene("play", (context) => {
  const controls = context.actions(Actions, { Move: KeyboardBindings.WASD });
  const player = context.add(
    Character({ movement: controls.reader(Actions.Move) }),
  );
  context.canvasUI(
    CanvasColumn(
      [
        CanvasLabel("Click the world / Tab, then WASD"),
        CanvasButton("Move right", () => {
          player.x += 32;
        }),
        CanvasButton("Pause / Resume", () =>
          game.engine.paused ? game.resume() : game.pause(),
        ),
        CanvasButton("Restart scene", () => game.goTo("play")),
      ],
      { padding: 12, gap: 8 },
    ),
  );
  // Actors and controls belong to this Scene; Canvas buttons also work on touch.
});
const dispose = () => game.dispose();
window.addEventListener("pagehide", dispose, { once: true });
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener("pagehide", dispose);
    dispose();
  });
try {
  await game.run("play");
} catch (error) {
  dispose();
  throw error;
}
