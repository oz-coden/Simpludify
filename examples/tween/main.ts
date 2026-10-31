import {
  Action,
  Aspect,
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";
import { startExample } from "../shared/start";
import { buildTweenLab } from "./lab";
export const game = new Game<"lab" | "empty">({ aspect: Aspect.Adaptive });
export let lab: ReturnType<typeof buildTweenLab>;
const A = defineActions({ Move: Action.axis2D() });
game.scene("lab", (context) => {
  game.resume();
  const controls = context.actions(A, { Move: KeyboardBindings.WASD });
  lab = buildTweenLab(context, {
    spriteURL: new URL("../sprites/hero.svg", import.meta.url).href,
    movement: controls.reader(A.Move),
    paused: () => game.paused,
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => game.goTo("lab"),
    leave: () => game.goTo("empty"),
  });
});
game.scene("empty", ({ canvasUI }) => {
  canvasUI(
    CanvasColumn(
      [
        CanvasLabel(
          "Lab Scene disposed: its Actors, UI and tweens are released.",
        ),
        CanvasButton("Return to lab", () => game.goTo("lab")),
      ],
      { padding: 20, gap: 12 },
    ),
  );
});
export const tweenDemo = {
  game,
  get lab() {
    return lab;
  },
};
Object.assign(window, { tweenDemo });
declare global {
  interface Window {
    tweenDemo: typeof tweenDemo;
  }
}
void startExample(game, "lab");
