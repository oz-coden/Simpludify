import { Engine, Scene } from "@simpludify/core";
import { describe, expect, it } from "vitest";
import {
  cells,
  createPuzzle,
  type Kind,
  kinds,
  type Piece,
  type Puzzle,
} from "../../examples/blockfall/logic";

function fixture(seed = 42) {
  const engine = new Engine(seed);
  const { puzzle, controller } = createPuzzle(engine.scene, () =>
    engine.random(),
  );
  return { engine, puzzle, controller };
}
function piece(kind: Kind, x = 3, y = 4, rotation = 0): Piece {
  return { kind, x, y, rotation };
}
function fillRows(puzzle: Puzzle, count: number) {
  for (const row of puzzle.board) row.fill(null);
  for (let y = 20 - count; y < 20; y++)
    puzzle.board[y] = Array.from({ length: 10 }, (_, x) =>
      x === 3 ? null : "J",
    );
  puzzle.active = piece("I", 1, 15, 1);
}

describe("Blockfall integer-grid rules", () => {
  for (const kind of kinds)
    it(`spawns and rotates four cells of ${kind}`, () => {
      const { engine, puzzle } = fixture();
      puzzle.active = piece(kind);
      const initial = cells(puzzle.active);
      expect(new Set(initial.map(({ x, y }) => `${x}:${y}`)).size).toBe(4);
      for (let turn = 0; turn < 4; turn++) expect(puzzle.rotate(1)).toBe(true);
      expect(cells(puzzle.active)).toEqual(initial);
      expect(puzzle.rotate(-1)).toBe(true);
      expect(puzzle.rotate(1)).toBe(true);
      expect(cells(puzzle.active)).toEqual(initial);
      engine.dispose();
    });
  it("uses seeded seven-piece bags without repetition within a bag", () => {
    const { engine, puzzle } = fixture();
    const sequence: Kind[] = [];
    for (let index = 0; index < 21; index++) {
      sequence.push(puzzle.active.kind);
      puzzle.hardDrop();
      for (const row of puzzle.board) row.fill(null);
    }
    for (let offset = 0; offset < 21; offset += 7)
      expect([...sequence.slice(offset, offset + 7)].sort()).toEqual(
        [...kinds].sort(),
      );
    expect(puzzle.next).toHaveLength(5);
    engine.dispose();
  });
  it("rejects walls, floor and occupied cells and applies the documented wall kick", () => {
    const { engine, puzzle } = fixture();
    puzzle.active = piece("O", 0, 18);
    expect(puzzle.move(-1)).toBe(false);
    expect(puzzle.move(0, 1)).toBe(false);
    puzzle.board[18]![2] = "J";
    expect(puzzle.move(1)).toBe(false);
    expect(puzzle.active).toEqual(piece("O", 0, 18));
    puzzle.active = piece("T", -1, 4, 1);
    expect(puzzle.fits(puzzle.active)).toBe(true);
    expect(puzzle.rotate(1)).toBe(true);
    expect(puzzle.active.x).toBe(0);
    engine.dispose();
  });
  it("rejects rotation when every kick is obstructed", () => {
    const { engine, puzzle } = fixture();
    puzzle.active = piece("T", 3, 8);
    for (const row of puzzle.board) row.fill("J");
    for (const { x, y } of cells(puzzle.active)) puzzle.board[y]![x] = null;
    const before = { ...puzzle.active };
    expect(puzzle.rotate(1)).toBe(false);
    expect(puzzle.active).toEqual(before);
    engine.dispose();
  });
  for (const [count, score] of [
    [1, 100],
    [2, 300],
    [3, 500],
    [4, 800],
  ] as const)
    it(`clears ${count} lines and awards the corresponding score`, () => {
      const { engine, puzzle } = fixture();
      fillRows(puzzle, count);
      const distance = puzzle.ghost().y - puzzle.active.y;
      puzzle.hardDrop();
      expect(puzzle.lines).toBe(count);
      expect(puzzle.score).toBe(score + distance * 2);
      expect(puzzle.locked).toBe(1);
      expect(puzzle.board).toHaveLength(20);
      expect(puzzle.board.every((row) => row.length === 10)).toBe(true);
      engine.dispose();
    });
  it("increments level each ten lines and uses the pre-clear level for scoring", () => {
    const { engine, puzzle } = fixture();
    puzzle.lines = 9;
    fillRows(puzzle, 1);
    puzzle.hardDrop();
    expect(puzzle.level).toBe(2);
    const previous = puzzle.score;
    fillRows(puzzle, 1);
    const distance = puzzle.ghost().y - puzzle.active.y;
    puzzle.hardDrop();
    expect(puzzle.score - previous).toBe(200 + distance * 2);
    engine.dispose();
  });
  it("awards soft/hard drop distance and shows the exact landing position", () => {
    const { engine, puzzle } = fixture();
    puzzle.active = piece("O", 4, 0);
    puzzle.tick(0.07, true);
    expect(puzzle.active.y).toBe(2);
    expect(puzzle.score).toBe(2);
    expect(puzzle.ghost().y).toBe(18);
    puzzle.hardDrop();
    expect(puzzle.score).toBe(34);
    expect(puzzle.board[19]?.[4]).toBe("O");
    engine.dispose();
  });
  it("waits for lock delay, bounds resets, and unlocks hold after fixation", () => {
    const { engine, puzzle } = fixture();
    const initial = puzzle.active.kind;
    puzzle.hold();
    expect(puzzle.held).toBe(initial);
    const next = { ...puzzle.active };
    puzzle.hold();
    expect(puzzle.active).toEqual(next);
    puzzle.active = piece("O", 4, 18);
    puzzle.tick(0.44);
    expect(puzzle.locked).toBe(0);
    for (let index = 0; index < 15; index++) {
      puzzle.move(index % 2 ? -1 : 1);
      puzzle.tick(0.1);
    }
    puzzle.move(-1);
    puzzle.tick(0.36);
    expect(puzzle.locked).toBe(1);
    expect(puzzle.holdUsed).toBe(false);
    puzzle.hold();
    expect(puzzle.active.kind).toBe(initial);
    engine.dispose();
  });
  it("ends on blocked spawn or fixation above the visible board", () => {
    const first = fixture();
    first.puzzle.board[0]!.fill("J");
    first.puzzle.hold();
    expect(first.puzzle.over).toBe(true);
    const snapshot = first.puzzle.snapshot();
    first.puzzle.hardDrop();
    first.puzzle.tick(10);
    first.puzzle.rotate(1);
    expect(first.puzzle.snapshot()).toEqual(snapshot);
    first.engine.dispose();
    const second = fixture();
    second.puzzle.active = piece("O", 0, -1);
    second.puzzle.board[1]![0] = "J";
    second.puzzle.hardDrop();
    expect(second.puzzle.over).toBe(true);
    expect(second.puzzle.board[0]![0]).toBe(null);
    second.engine.dispose();
  });
});

it("drives movement, repeat, rotation and drops through public Engine input", () => {
  const { engine, puzzle } = fixture();
  puzzle.active = piece("T");
  engine.input.set("ArrowLeft", true);
  engine.step(0);
  expect(puzzle.active.x).toBe(2);
  engine.step(0.2);
  expect(puzzle.active.x).toBeLessThan(2);
  engine.input.clear();
  engine.step(0);
  engine.input.set("KeyX", true);
  engine.step(0);
  expect(puzzle.active.rotation).toBe(1);
  engine.step(0);
  expect(puzzle.active.rotation).toBe(1);
  engine.input.set("Space", true);
  engine.step(0);
  expect(puzzle.locked).toBe(1);
  engine.step(0.1);
  expect(puzzle.locked).toBe(1);
  engine.dispose();
});
it("freezes and resumes simulation, then disposes old controllers and input sources on restart", () => {
  const { engine, puzzle, controller } = fixture();
  const source = engine.input.createSource(engine.scene);
  engine.step(0.3);
  engine.pause();
  const before = puzzle.snapshot();
  engine.step(20);
  expect(puzzle.snapshot()).toEqual(before);
  engine.resume();
  engine.step(0.6);
  expect(puzzle.active.y).toBeGreaterThan(before.active.y);
  const old = engine.scene;
  const fresh = new Scene("restart");
  const next = createPuzzle(fresh, () => engine.random());
  engine.activate(fresh);
  expect(old.disposed).toBe(true);
  expect(controller.disposed).toBe(true);
  expect(source.disposed).toBe(true);
  expect(next.puzzle.score).toBe(0);
  expect(next.puzzle.board.flat().every((cell) => cell === null)).toBe(true);
  engine.dispose();
  engine.dispose();
  expect(engine.input.sourceCount).toBe(0);
});
it("replays the same seed and input sequence with identical state at every step", () => {
  const a = fixture(2026),
    b = fixture(2026);
  for (let index = 0; index < 1200; index++) {
    for (const { engine } of [a, b]) {
      engine.input.set("ArrowLeft", index % 70 < 15);
      engine.input.set("ArrowRight", index % 70 > 50);
      engine.input.set("KeyX", index % 41 === 0);
      engine.input.set("Space", index % 53 === 0);
      engine.input.set("KeyC", index % 97 === 0);
      engine.step(1 / 60);
    }
    expect(a.puzzle.snapshot()).toEqual(b.puzzle.snapshot());
    expect(a.engine.snapshot()).toEqual(b.engine.snapshot());
  }
  a.engine.dispose();
  b.engine.dispose();
});
it("simulates 100,000 headless steps with repeated live rounds and bounded scene ownership", () => {
  const { engine, puzzle: initial } = fixture();
  let puzzle = initial;
  let rounds = 0,
    locked = 0;
  const begin = performance.now();
  for (let index = 0; index < 100_000; index++) {
    if (index === 0 || puzzle.over) {
      const scene = new Scene(`round-${++rounds}`);
      puzzle = createPuzzle(scene, () => engine.random()).puzzle;
      engine.activate(scene);
    }
    engine.input.set("ArrowRight", index % 60 < 20);
    engine.input.set("KeyX", index % 17 === 0);
    engine.input.set("Space", index % 11 === 0);
    const before = puzzle.locked;
    engine.step(1 / 60);
    locked += puzzle.locked - before;
    expect(engine.scene.actors).toHaveLength(1);
  }
  expect(locked).toBeGreaterThan(5000);
  expect(rounds).toBeGreaterThan(100);
  console.log(
    JSON.stringify({
      headlessSteps: 100_000,
      simulatedSeconds: 100_000 / 60,
      rounds,
      locked,
      wallMilliseconds: performance.now() - begin,
    }),
  );
  engine.dispose();
});

it("queues sub-frame commands until a simulation step and discards input explicitly", () => {
  const { engine, puzzle, controller } = fixture();
  puzzle.active = piece("T");
  controller.queue("cw");
  controller.queue("left");
  expect(puzzle.active.rotation).toBe(0);
  engine.step(0);
  expect(puzzle.active).toMatchObject({ rotation: 1, x: 2 });
  controller.queue("drop");
  controller.clearInput();
  engine.step(0);
  expect(puzzle.locked).toBe(0);
  engine.dispose();
});
it("does not apply accumulated natural-gravity time as a burst of soft drops", () => {
  const { engine, puzzle } = fixture();
  puzzle.active = piece("O", 4, 0);
  puzzle.tick(0.79);
  puzzle.tick(0.035, true);
  expect(puzzle.active.y).toBe(1);
  expect(puzzle.score).toBe(1);
  engine.dispose();
});
