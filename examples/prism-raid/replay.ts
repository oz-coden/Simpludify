import {
  Engine,
  parseReplayData,
  ReplayPlayer,
  ReplayRecorder,
} from "@simpludify/core";
import { autopilot } from "./autoplay";
import { Raid, RaidFinished } from "./logic";
export const replayGameVersion = "prism-raid-replay-2";
/** Runs the ordinary game and input-only pilot; no drawing or wall-clock wait. */
export function recordMission(
  options: { seed?: number; automatic?: boolean } = {},
) {
  const engine = new Engine(
    options.seed === undefined ? {} : { seed: options.seed },
  );
  const random = engine.random.stream("enemy");
  const round = new Raid(engine.scene, engine.input, () => random.next());
  const recorder = new ReplayRecorder(engine, {
    controllers: { raid: round.controls },
    metadata: {
      gameVersion: replayGameVersion,
      automatic: options.automatic ?? true,
    },
    maxSteps: 120 * 76 + 1,
  });
  engine.scene.events.on(
    RaidFinished,
    (status) =>
      recorder.record("missionFinished", { status, score: round.score }),
    engine.scene,
  );
  try {
    for (let step = 0; step < 120 * 76 && round.status === "playing"; step++) {
      if ((options.automatic ?? true) && step % 6 === 0) autopilot(round);
      engine.step(1 / 120);
    }
    if (round.status === "playing")
      throw Error(
        "Mission did not reach a terminal state within its step budget",
      );
    return {
      data: recorder.finish(),
      snapshot: round.snapshot(),
      engine: engine.snapshot(),
    };
  } finally {
    recorder.dispose();
    engine.dispose();
  }
}
export function playMission(value: unknown) {
  const data = parseReplayData(value),
    engine = new Engine({ seed: data.random.seed }),
    random = engine.random.stream("enemy");
  const round = new Raid(engine.scene, engine.input, () => random.next());
  const player = new ReplayPlayer(engine, data, {
    controllers: { raid: round.controls },
    expectedMetadata: { gameVersion: replayGameVersion },
  });
  try {
    while (player.step()) {}
    return { snapshot: round.snapshot(), engine: engine.snapshot() };
  } finally {
    player.dispose();
    engine.dispose();
  }
}
