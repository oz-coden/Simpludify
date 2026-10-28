import {
  Action,
  ActionController,
  Button,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
  Label,
  Motion,
  Panel,
  SpriteAnimation,
  SpriteSheet,
  Transform,
} from "@simpludify/web";
import { startExample } from "../shared/start";

const sheet = SpriteSheet.grid(new URL("./hero.svg", import.meta.url).href, {
  frameWidth: 32,
  frameHeight: 32,
});
const clips = {
  idle: { frames: [0, 1], fps: 3 },
  walk: { frames: [2, 3, 4, 5], fps: 8 },
  wave: { frames: [6, 7, 6, 7], fps: 5, loop: false },
} as const;
export const game = new Game<"field" | "rest">({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
const Actions = defineActions({ Move: Action.axis2D() });
game.scene("field", ({ scene, add, ui }) => {
  const controls = new ActionController(Actions, {
    scene,
    input: game.engine.input,
    bindings: { Move: KeyboardBindings.WASD },
  });
  const player = add(
    Character({
      id: "sprite-player",
      x: 260,
      y: 290,
      size: 72,
      source: sheet.get(0),
      movement: controls.reader(Actions.Move),
    }),
  );
  const animation = player.add(new SpriteAnimation({ sheet, clips }));
  // Game policy chooses the clip; the Component handles every image/frame update.
  scene.onUpdate(() => {
    const direction = player.require(Motion.type).direction;
    animation.play(direction.x || direction.y ? "walk" : "idle");
    const t = player.require(Transform.type);
    t.x = Math.max(40, Math.min(760, t.x));
    t.y = Math.max(210, Math.min(410, t.y));
  });
  const friend = add(
    Character({
      id: "sprite-friend",
      x: 540,
      y: 290,
      size: 72,
      source: sheet.get(0),
      color: 0xffc878,
    }),
  );
  const greeting = friend.add(
    new SpriteAnimation({ sheet, clips, initial: "wave" }),
  );
  ui(
    Panel(
      [
        Label("WASDで移動 / idle ↔ walk。右の仲間も同じ画像を共有。"),
        Button("Wave again", () => greeting.play("wave", { restart: true })),
        Button("Pause / Resume friend", () =>
          greeting.state === "paused" ? greeting.resume() : greeting.pause(),
        ),
        Button("Stop friend", () => greeting.stop()),
        Button("Leave field →", () => game.goTo("rest")),
      ],
      { title: "Sprite garden" },
    ),
  );
});
game.scene("rest", ({ ui }) => {
  ui(
    Panel(
      [
        Label("The field's Actors and sprite resources have been released."),
        Button("← Return to field", () => game.goTo("field")),
      ],
      { title: "A fresh scene" },
    ),
  );
});
await startExample(game, "field");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
