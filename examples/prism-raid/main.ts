import {
  BrowserInput,
  Button,
  Game,
  HoldButton,
  Label,
  Layout,
  mountUI,
  Panel,
  PixiRenderer,
  Placement,
} from "@simpludify/web";
import { startExample } from "../shared/start";
import { autopilot } from "./autoplay";
import { arena, Raid, RaidChanged, RaidFinished } from "./logic";
import { presentRaid } from "./view";
import "./style.css";

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing game element ${id}`);
  return found;
}
let renderer: PixiRenderer | undefined;
const game = new Game<"menu" | "play">({
  parent: element("stage"),
  resolution: arena,
  seed: 2026,
  maxDelta: 1 / 30,
  tokens: { background: "#0c1520", accent: "#89c7ff" },
  renderer: (host) => (renderer = new PixiRenderer(host, "#0c1520")),
});
let current: Raid | undefined,
  result: ReturnType<Raid["snapshot"]> | undefined,
  demo = false;
for (const id of ["stats", "controls"])
  element(id).style.cssText = game.element.style.cssText;
const observeError = (error: unknown) => console.error(error);
const start = (automatic: boolean) => {
  demo = automatic;
  return game.goTo("play");
};
game.scene("menu", ({ scene, ui, onActivate }) => {
  presentRaid(scene);
  onActivate(() => {
    game.resume();
    element("status").textContent = "Protect the relay.";
  });
  ui(
    Panel(
      [
        Label(
          "Intercept three waves. Shoot coral scouts, amber drifters and violet gunners before they escape.",
        ),
        Label(
          "Five HP. Hold Space or FIRE. WASD / arrows or the touch direction buttons move your ship.",
          { muted: true },
        ),
        Button("Start mission", () => start(false)),
        Button("Watch autopilot", () => start(true)),
      ],
      { title: "Launch bay", placement: Placement.Center },
    ),
  );
});
game.scene("play", ({ scene, signal, onActivate, onDispose, onUpdate }) => {
  const round = new Raid(scene, () => game.engine.random());
  current = round;
  result = undefined;
  presentRaid(scene, round);
  onDispose(() => {
    if (current === round) current = undefined;
  });
  const source = game.engine.input.createSource(scene);
  const shooting = new BrowserInput(
    game.element,
    game.engine.input,
    (code) => code === "Space",
  );
  onDispose(() => shooting.dispose());
  const hp = Label("HP 5 / 5"),
    score = Label("SCORE 0"),
    wave = Label("WAVE 1 / 3");
  const stats = mountUI(
    [Panel([hp, score, wave], { layout: Layout.Row })],
    observeError,
  );
  onDispose(() => stats.dispose());
  const pause = Button("Pause", () => togglePause());
  const updateStatus = () => {
    element("status").textContent = game.paused
      ? "Paused"
      : round.status === "won"
        ? "SECTOR CLEAR — fly again?"
        : round.status === "lost"
          ? "RELAY LOST — try again"
          : demo
            ? "Autopilot demonstration"
            : `Wave ${round.wave}: protect the relay`;
    pause.setText(game.paused ? "Resume" : "Pause");
  };
  function togglePause(): void {
    if (game.paused) game.resume();
    else game.pause();
    source.clear();
    updateStatus();
  }
  const hold = (code: string, held: boolean) =>
    source.set(code, held && !game.paused && round.status === "playing");
  const restart = async () => {
    await game.goTo("play");
    game.element.focus({ preventScroll: true });
  };
  const controls = mountUI(
    [
      Panel(
        [
          HoldButton("← Left", (held) => hold("ArrowLeft", held)),
          HoldButton("↑ Up", (held) => hold("ArrowUp", held)),
          HoldButton("↓ Down", (held) => hold("ArrowDown", held)),
          HoldButton("Right →", (held) => hold("ArrowRight", held)),
          HoldButton("FIRE", (held) => hold("Space", held)),
        ],
        { layout: Layout.Row },
      ),
      Panel(
        [
          pause,
          Button("Restart", restart),
          Button("Menu", () => game.goTo("menu")),
        ],
        { layout: Layout.Row },
      ),
    ],
    observeError,
  );
  onDispose(() => controls.dispose());
  scene.events.on(
    RaidChanged,
    (state) => {
      hp.setText(`HP ${state.hp} / ${round.maximumHP}`);
      score.setText(`SCORE ${state.score}`);
      wave.setText(`WAVE ${state.wave} / 3`);
      updateStatus();
    },
    scene,
  );
  scene.events.on(
    RaidFinished,
    () => {
      result = round.snapshot();
      source.clear();
      game.engine.input.clear();
      updateStatus();
    },
    scene,
  );
  onActivate(() => {
    game.resume();
    element("stats").append(stats.element);
    element("controls").append(controls.element);
    updateStatus();
    game.element.focus({ preventScroll: true });
  });
  game.element.addEventListener(
    "keydown",
    (event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("button,input,textarea,select")
      )
        return;
      if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        if (!event.repeat) togglePause();
      }
    },
    { signal },
  );
  onUpdate(() => {
    if (demo && round.status === "playing") autopilot(round, game.engine.input);
  });
});
await startExample(game, "menu");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
const inspection = {
  game,
  get renderer() {
    return renderer;
  },
  get round() {
    return current;
  },
  get result() {
    return result;
  },
  get demo() {
    return demo;
  },
  autoStep() {
    if (current?.status === "playing") autopilot(current, game.engine.input);
  },
};
declare global {
  interface Window {
    prismRaid: typeof inspection;
  }
}
window.prismRaid = inspection;
