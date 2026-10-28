import { Engine, Renderable, Transform } from "@simpludify/core";
import { expect, it } from "vitest";
import { createPuzzle } from "../../examples/blockfall/logic";
import { BoardView, colors } from "../../examples/blockfall/view";
import { Round } from "../../examples/signal-run/logic";

it("Blockfall changes cell color without replacing its Actor or Renderable", () => {
  const engine = new Engine({ seed: 8 });
  const { puzzle } = createPuzzle(engine.scene, engine.input, () =>
    engine.random.next(),
  );
  const board = new BoardView(engine.scene);
  board.sync(puzzle);
  const cell = engine.scene.actors.find((actor) => {
    const t = actor.get(Transform.type);
    return t?.x === 12 && t.y === 12;
  });
  if (!cell) throw new Error("Missing first board cell");
  const view = cell.require(Renderable.type);
  for (const kind of ["T", "J", null] as const) {
    const row = puzzle.board[0];
    if (!row) throw new Error("Missing board row");
    row[0] = kind;
    board.sync(puzzle);
    expect(cell.disposed).toBe(false);
    expect(cell.require(Renderable.type)).toBe(view);
    expect(view.color).toBe(kind ? colors[kind] : 0x192933);
  }
  engine.dispose();
  expect(view.disposed).toBe(true);
});
it("Signal Run restores damage color and opacity on the same dependent Renderable", () => {
  const engine = new Engine({ seed: 8 });
  const round = new Round(engine.scene, engine.input, { hazards: false });
  const view = round.player.require(Renderable.type),
    color = view.color;
  expect(round.health.hit()).toBe(true);
  engine.step(0);
  expect(view.color).toBe(0xff887e);
  expect(view.opacity).toBe(0.45);
  engine.step(1.1);
  expect(view.color).toBe(color);
  expect(view.opacity).toBe(1);
  expect(round.player.require(Renderable.type)).toBe(view);
  engine.dispose();
});
