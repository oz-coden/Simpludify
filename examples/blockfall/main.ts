import {
  Button,
  Game,
  HoldButton,
  Layout,
  mountUI,
  Panel,
} from "@simpludify/web";
import { startExample } from "../shared/start";
import {
  createPuzzle,
  type Puzzle,
  PuzzleActions,
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
game.scene("play", ({ scene, onUpdate, onActivate, onDispose }) => {
  const { puzzle, controller } = createPuzzle(scene, game.engine.input, () =>
    game.engine.random(),
  );
  const view = new BoardView(scene);
  current = puzzle;
  currentController = controller;
  const controls = controller.controls;
  const source = controls.createSource(scene);
  onDispose(() => {
    if (current === puzzle) {
      current = undefined;
      currentController = undefined;
    }
  });
  const pulse = (
    action: (typeof PuzzleActions)[keyof typeof PuzzleActions],
  ) => {
    if (action !== PuzzleActions.Pause && game.paused) return;
    source.set(action, true);
    source.set(action, false);
  };
  const pause = Button("Pause", () => pulse(PuzzleActions.Pause));
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
    controller.resetRepeat();
    updateStatus();
  }
  controls.onPressed(PuzzleActions.Pause, togglePause);
  const buttons = mountUI(
    [
      Panel(
        [
          HoldButton("Move left", (held) =>
            source.set(PuzzleActions.Left, held && !game.paused),
          ),
          HoldButton("Soft drop", (held) =>
            source.set(PuzzleActions.SoftDrop, held && !game.paused),
          ),
          HoldButton("Move right", (held) =>
            source.set(PuzzleActions.Right, held && !game.paused),
          ),
        ],
        { layout: Layout.Row },
      ),
      Panel(
        [
          Button("Rotate left", () => pulse(PuzzleActions.RotateCCW)),
          Button("Rotate right", () => pulse(PuzzleActions.RotateCW)),
          Button("Hard drop", () => pulse(PuzzleActions.Drop)),
          Button("Hold", () => pulse(PuzzleActions.Hold)),
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
  onDispose(() => buttons.dispose());
  onActivate(() => {
    game.resume();
    element("controls").append(buttons.element);
    updateStatus();
  });
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
