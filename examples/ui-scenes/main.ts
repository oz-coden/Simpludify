import {
  Action,
  ActionController,
  Button,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
  Label,
  Layout,
  Panel,
  Theme,
} from "@simpludify/web";
import { startExample } from "../shared/start";

type SceneId = "garden" | "studio";
const game = new Game<SceneId>({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
  theme: Theme.Dark,
});
const Actions = defineActions({ Move: Action.axis2D() });
for (const id of ["garden", "studio"] as const) {
  game.scene(id, ({ scene, add, ui }) => {
    const controls = new ActionController(Actions, {
      scene,
      input: game.engine.input,
      bindings: { Move: KeyboardBindings.WASD },
    });
    add(
      Character({
        id: "player",
        movement: controls.reader(Actions.Move),
        color: id === "garden" ? 0x73e3c0 : 0xffc87a,
      }),
    );
    ui(
      Panel(
        [
          Label("CODE FIRST / PLAY IMMEDIATELY", { muted: true }),
          Label(
            id === "garden"
              ? "A little room to explore."
              : "A fresh scene, a fresh start.",
          ),
          Label(
            "Click the game area, then move with W A S D. Tab to reach the controls.",
            { muted: true },
          ),
          Panel(
            [
              Button(
                id === "garden" ? "Visit the studio →" : "← Back to the garden",
                () => game.goTo(id === "garden" ? "studio" : "garden"),
              ),
            ],
            { layout: Layout.Row },
          ),
        ],
        { title: id === "garden" ? "The garden" : "The studio" },
      ),
    );
  });
}
await startExample(game, "garden");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
// The demo intentionally exposes a small inspection hook for smoke tests and learning.
declare global {
  interface Window {
    demo: typeof game;
  }
}
window.demo = game;
