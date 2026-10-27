import {
  Engine,
  type ReplayData,
  ReplayPlayer,
  ReplayRecorder,
} from "@simpludify/core";
import { expect, it } from "vitest";
import { createPuzzle, PuzzleActions } from "../../examples/blockfall/logic";
import { autopilot } from "../../examples/prism-raid/autoplay";
import { Raid } from "../../examples/prism-raid/logic";

function puzzle(seed = 2026) {
  const engine = new Engine({ seed });
  const p = createPuzzle(engine.scene, engine.input, () =>
    engine.random.stream("pieces").next(),
  );
  return { engine, ...p };
}
function raid(seed = 2026) {
  const engine = new Engine({ seed });
  const round = new Raid(engine.scene, engine.input, () =>
    engine.random.stream("enemy").next(),
  );
  return { engine, round };
}
it("recreates a complete Blockfall loss twice from JSON with same-seed grid state", () => {
  const a = puzzle(),
    rec = new ReplayRecorder(a.engine, {
      controllers: { puzzle: a.controller.controls },
      metadata: { gameVersion: "blockfall-replay-1" },
    });
  for (let i = 0; i < 200 && !a.puzzle.over; i++) {
    if (i % 3 === 0) {
      a.controller.input.set(PuzzleActions.RotateCW, true);
      a.controller.input.set(PuzzleActions.RotateCW, false);
    }
    a.controller.input.set(
      i % 2 ? PuzzleActions.Left : PuzzleActions.Right,
      true,
    );
    a.controller.input.set(
      i % 2 ? PuzzleActions.Left : PuzzleActions.Right,
      false,
    );
    a.controller.input.set(PuzzleActions.Drop, true);
    a.controller.input.set(PuzzleActions.Drop, false);
    a.engine.step(1 / 60);
  }
  expect(a.puzzle.over).toBe(true);
  const state = a.puzzle.snapshot(),
    data = JSON.parse(JSON.stringify(rec.finish()));
  for (let repeat = 0; repeat < 2; repeat++) {
    const b = puzzle(data.random.seed),
      player = new ReplayPlayer(b.engine, data, {
        controllers: { puzzle: b.controller.controls },
      });
    while (player.step()) {}
    expect(b.puzzle.snapshot()).toEqual(state);
    expect(b.engine.snapshot()).toEqual(a.engine.snapshot());
    player.dispose();
    b.engine.dispose();
  }
  a.engine.dispose();
});
it("records and replays normal input-only Prism Raid victory with named streams", () => {
  const a = raid(),
    rec = new ReplayRecorder(a.engine, {
      controllers: { raid: a.round.controls },
      metadata: { gameVersion: "prism-replay-1", mode: "autopilot" },
    });
  for (let i = 0; i < 120 * 76 && a.round.status === "playing"; i++) {
    if (i % 6 === 0) autopilot(a.round);
    a.engine.step(1 / 120);
  }
  expect(a.round.status).toBe("won");
  const data = JSON.parse(JSON.stringify(rec.finish())) as ReplayData,
    b = raid(data.random.seed),
    player = new ReplayPlayer(b.engine, data, {
      controllers: { raid: b.round.controls },
    });
  while (player.step()) {}
  expect(b.round.snapshot()).toEqual(a.round.snapshot());
  expect(b.engine.snapshot()).toEqual(a.engine.snapshot());
  expect(b.round.kills).toBe(24);
  player.dispose();
  a.engine.dispose();
  b.engine.dispose();
  expect(b.engine.input.sourceCount).toBe(0);
});
it("repeats a no-input Prism Raid failure and ends cleanly", () => {
  const a = raid(42),
    rec = new ReplayRecorder(a.engine, {
      controllers: { raid: a.round.controls },
    });
  for (let i = 0; i < 120 * 76 && a.round.status === "playing"; i++)
    a.engine.step(1 / 120);
  expect(a.round.status).toBe("lost");
  const data = rec.finish(),
    b = raid(42),
    player = new ReplayPlayer(b.engine, data, {
      controllers: { raid: b.round.controls },
    });
  while (player.step()) {}
  expect(b.round.snapshot()).toEqual(a.round.snapshot());
  player.dispose();
  a.engine.dispose();
  b.engine.dispose();
});
