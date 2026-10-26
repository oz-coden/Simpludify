import {
  Button,
  CameraFollow,
  containsScreenPoint,
  Game,
  HoldButton,
  Label,
  Layout,
  Panel,
  Placement,
} from "@simpludify/web";
import {
  Round,
  RoundChanged,
  RoundFinished,
  type RoundSnapshot,
  RoundStatus,
} from "./logic";

type SceneId = "menu" | "play" | "result";
const game = new Game<SceneId>({
  parent: document.querySelector<HTMLElement>("#app") ?? document.body,
});
let current: Round | undefined, result: RoundSnapshot | undefined;
game.scene("menu", ({ ui, onActivate }) => {
  onActivate(() => game.resume());
  ui(
    Panel(
      [
        Label(
          "Collect six amber signals in 30 seconds. Avoid red hazards, slide along blue walls and keep your three HP.",
        ),
        Label(
          "WASD / arrows, click a destination, or use the touch buttons. Pause freezes simulation time.",
          { muted: true },
        ),
        Button("Start run", () => game.goTo("play")),
      ],
      { title: "Signal Run", placement: Placement.Center },
    ),
  );
});
game.scene("play", ({ scene, ui, signal, onActivate, onDispose }) => {
  const round = new Round(scene);
  const follow = new CameraFollow(game.camera, {
    bounds: { x: 0, y: 0, width: 800, height: 450 },
  });
  scene.onUpdate((seconds) => follow.update(round.player, seconds));
  current = round;
  result = undefined;
  onDispose(() => {
    if (current === round) current = undefined;
  });
  onActivate(() => {
    game.resume();
    game.camera.x = 0;
    game.camera.y = 0;
    game.camera.zoom = 1;
  });
  const hp = Label("HP 3/3"),
    score = Label("Signals 0/6"),
    time = Label("Time 30s"),
    status = Label("Collect amber. Avoid red.", { muted: true });
  scene.events.on(
    RoundChanged,
    (state) => {
      hp.setText("HP " + state.hp + "/" + state.maximumHP);
      score.setText("Signals " + state.score + "/" + state.goal);
      time.setText("Time " + state.secondsRemaining + "s");
    },
    scene,
  );
  scene.events.on(
    RoundFinished,
    (state) => {
      result = state;
      void game.goTo("result").catch((error) => {
        if (!game.engine.disposed) console.error(error);
      });
    },
    scene,
  );
  const pause = Button("Pause", () => {
    if (game.paused) {
      game.resume();
      pause.setText("Pause");
      status.setText("Collect amber. Avoid red.");
    } else {
      game.pause();
      pause.setText("Resume");
      status.setText("Paused");
    }
  });
  ui(
    Panel(
      [
        Panel([hp, score, time], { layout: Layout.Row }),
        status,
        Panel(
          [
            pause,
            Button("Restart", () => game.goTo("play")),
            Button("Menu", () => game.goTo("menu")),
            Button("Zoom", () => {
              game.camera.zoom = game.camera.zoom === 1 ? 1.25 : 1;
              follow.update(round.player, 0);
            }),
          ],
          { layout: Layout.Row },
        ),
      ],
      { title: "Signal Run" },
    ),
  );
  const source = game.engine.input.createSource(scene);
  ui(
    Panel(
      [
        HoldButton("Left", (held) => source.set("KeyA", held)),
        HoldButton("Up", (held) => source.set("KeyW", held)),
        HoldButton("Down", (held) => source.set("KeyS", held)),
        HoldButton("Right", (held) => source.set("KeyD", held)),
      ],
      {
        title: "Touch / hold",
        layout: Layout.Row,
        placement: Placement.Bottom,
      },
    ),
  );
  game.element.addEventListener(
    "pointerup",
    (event) => {
      if (
        game.paused ||
        (event.target instanceof HTMLElement &&
          event.target.closest(".s-panel"))
      )
        return;
      const point = game.pointerToWorld(event);
      if (containsScreenPoint(game.view, game.worldToScreen(point)))
        round.setTarget(point);
    },
    { signal },
  );
});
game.scene("result", ({ ui, onActivate }) => {
  onActivate(() => game.resume());
  const state = result;
  ui(
    Panel(
      [
        Label(
          state?.status === RoundStatus.Won
            ? "All six signals recovered."
            : state?.status === RoundStatus.Timeout
              ? "Time ran out."
              : "Your HP reached zero.",
        ),
        Label("Signals " + (state?.score ?? 0) + "/" + (state?.goal ?? 6)),
        Button("Play again", () => game.goTo("play")),
        Button("Main menu", () => game.goTo("menu")),
      ],
      {
        title: state?.status === RoundStatus.Won ? "Run complete" : "Run ended",
        placement: Placement.Center,
      },
    ),
  );
});
await game.run("menu");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
const inspection = {
  game,
  get round() {
    return current;
  },
  get result() {
    return result;
  },
};
declare global {
  interface Window {
    signalRun: typeof inspection;
  }
}
window.signalRun = inspection;
