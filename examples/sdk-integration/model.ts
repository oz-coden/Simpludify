import {
  Easing,
  type Scene,
  Tween,
  type TweenPlayback,
} from "@simpludify/core";

export interface World {
  readonly step: number;
  readonly cells: readonly number[];
}
export interface Display {
  readonly x: number;
  readonly opacity: number;
}
const world = (step: number): World =>
  Object.freeze({
    step,
    cells: Object.freeze([Math.min(step, 6), Math.min(step * 2, 6)]),
  });

/** Application-owned integer rules and display-only animation; not an engine service. */
export function createDiscreteDemo(
  scene: Scene,
  paint: (display: readonly Display[]) => void = () => {},
) {
  let current = world(0),
    previous = current;
  const display = { progress: 1 };
  let active: TweenPlayback | undefined;
  const sample = (): readonly Display[] =>
    current.cells.map((cell, i) => ({
      x:
        (previous.cells[i] ?? 0) +
        (cell - (previous.cells[i] ?? 0)) * display.progress,
      opacity: cell === 6 ? 1 - display.progress : 1,
    }));
  const redraw = () => paint(sample());
  const binding = Tween.bind({
    target: display,
    key: "progress",
    read: () => display.progress,
    write: (value) => {
      display.progress = value;
      redraw();
    },
    valid: () => !scene.disposed,
  });
  return {
    get world() {
      return current;
    },
    get progress() {
      return display.progress;
    },
    get playback() {
      return active;
    },
    sample,
    step() {
      active?.finish();
      previous = current;
      current = world(current.step + 1); // Commit immutable integers before any presentation frame.
      display.progress = 0;
      redraw();
      active = scene.presentationTweens.play(
        Tween.to(binding, 1, { duration: 0.35, easing: Easing.InOutCubic }),
        { owner: scene },
      );
    },
    restart() {
      active?.cancel();
      active = undefined;
      current = previous = world(0);
      display.progress = 1;
      redraw();
    },
  };
}
