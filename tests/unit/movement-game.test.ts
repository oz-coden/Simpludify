import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { recordMission } from "../../examples/prism-raid/replay";

const baseline = JSON.parse(
  readFileSync(
    new URL("../fixtures/movement-game-states.json", import.meta.url),
    "utf8",
  ),
) as {
  sourceCommit: string;
  scenarios: {
    options: { seed: number; automatic?: boolean };
    steps: number;
    status: string;
    score: number;
    gameStateSha256: string;
  }[];
};
for (const scenario of baseline.scenarios)
  it(`preserves complete pre-refactor Prism Raid ${scenario.status} state from ${baseline.sourceCommit.slice(0, 7)}`, () => {
    const run = recordMission(scenario.options);
    expect(run.data.steps.length).toBe(scenario.steps);
    expect(run.snapshot.status).toBe(scenario.status);
    expect(run.snapshot.score).toBe(scenario.score);
    expect(
      createHash("sha256").update(JSON.stringify(run.snapshot)).digest("hex"),
    ).toBe(scenario.gameStateSha256);
  });
