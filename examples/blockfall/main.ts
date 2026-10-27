import {
  BrowserInput,
  Button,
  Game,
  HoldButton,
  Layout,
  mountUI,
  Panel,
} from "@simpludify/web";
import { startExample } from "../shared/start";
import {
  type Command,
  createPuzzle,
  type Puzzle,
  type PuzzleController,
} from "./logic";
import { BoardView, preview } from "./view";
import "./style.css";

function element(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing sample element: ${id}`);
  return found;
}
const game = new Game<"play">({
  parent: element("board"),
  resolution: { width: 240, height: 480 },
  seed: 2026,
});
game.element.setAttribute(
  "aria-label",
  "Blockfall board. Focus to use arrow keys, Space, C, P and Escape.",
);
let current: Puzzle | undefined,
  currentController: PuzzleController | undefined;
game.scene("play", ({ scene, onUpdate, onActivate, onDispose, signal }) => {
  const { puzzle, controller } = createPuzzle(scene, () =>
    game.engine.random(),
  );
  const view = new BoardView(scene);
  current = puzzle;
  currentController = controller;
  const source = game.engine.input.createSource(scene);
  const keyboard = new BrowserInput(game.element, game.engine.input, (code) =>
    ["ArrowLeft", "ArrowRight", "ArrowDown"].includes(code),
  );
  onDispose(() => keyboard.dispose());
  onDispose(() => {
    if (current === puzzle) {
      current = undefined;
      currentController = undefined;
    }
  });
  const command = (value: Command) => {
    if (!game.paused) controller.queue(value);
  };
  const pause = Button("Pause", () => togglePause());
  const updateStatus = () => {
    element("status").textContent = game.paused
      ? "Paused"
      : puzzle.over
        ? "Game over — Restart to play again"
        : "Stack. Clear. Repeat.";
    pause.setText(game.paused ? "Resume" : "Pause");
  };
  function togglePause(): void {
    if (game.paused) game.resume();
    else game.pause();
    source.clear();
    controller.clearInput();
    updateStatus();
  }
  const controls = mountUI(
    [
      Panel(
        [
          HoldButton("Move left", (held) =>
            source.set("ArrowLeft", held && !game.paused),
          ),
          HoldButton("Soft drop", (held) =>
            source.set("ArrowDown", held && !game.paused),
          ),
          HoldButton("Move right", (held) =>
            source.set("ArrowRight", held && !game.paused),
          ),
        ],
        { layout: Layout.Row },
      ),
      Panel(
        [
          Button("Rotate left", () => command("ccw")),
          Button("Rotate right", () => command("cw")),
          Button("Hard drop", () => command("drop")),
          Button("Hold", () => command("hold")),
        ],
        { layout: Layout.Row },
      ),
      Panel([pause, Button("Restart", () => game.goTo("play"))], {
        layout: Layout.Row,
      }),
    ],
    (error) => {
      throw error;
    },
  );
  element("controls").style.cssText = game.element.style.cssText;
  onDispose(() => controls.dispose());
  onActivate(() => {
    game.resume();
    element("controls").append(controls.element);
    updateStatus();
  });
  // Discrete commands are queued on keydown so taps shorter than a frame
  // survive until the next public Component update. Held motion uses BrowserInput.
  const actions: Record<string, Command> = {
    ArrowUp: "cw",
    KeyX: "cw",
    KeyZ: "ccw",
    Space: "drop",
    KeyC: "hold",
    ShiftLeft: "hold",
    ShiftRight: "hold",
  };
  game.element.addEventListener(
    "keydown",
    (event) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("button, input, textarea, select")
      )
        return;
      if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        if (!event.repeat) togglePause();
      } else {
        const action = actions[event.code];
        if (action) {
          event.preventDefault();
          if (!event.repeat) command(action);
        }
      }
    },
    { signal },
  );
  let previousNext = "",
    previousHold = "";
  const refreshHUD = () => {
    element("score").textContent = String(puzzle.score);
    element("lines").textContent = String(puzzle.lines);
    element("level").textContent = String(puzzle.level);
    const next = puzzle.next.join("");
    if (next !== previousNext) {
      previousNext = next;
      preview(element("next"), puzzle.next[0] ?? null);
      element("queue").textContent = puzzle.next.slice(1).join(" ");
    }
    const hold = puzzle.held ?? "empty";
    if (hold !== previousHold) {
      previousHold = hold;
      preview(element("hold"), puzzle.held);
    }
    updateStatus();
  };
  refreshHUD();
  view.sync(puzzle);
  // A scene-owned simulation timer refreshes DOM text; it is released on restart.
  scene.every(0.1, refreshHUD, scene);
  onUpdate(() => {
    view.sync(puzzle);
    if (puzzle.over) updateStatus();
  });
});
await startExample(game, "play");
if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
const inspection = {
  game,
  get puzzle() {
    return current;
  },
  get controller() {
    return currentController;
  },
};
declare global {
  interface Window {
    blockfall: typeof inspection;
  }
}
window.blockfall = inspection;
