import {
  Engine,
  RandomManager,
  type ReplayData,
  ReplayPlayer,
  ReplayRecorder,
} from "@simpludify/core";
export function replayTypes(data: ReplayData): void {
  const engine = new Engine({ seed: 42 }),
    random = new RandomManager(42);
  // @ts-expect-error seed is readonly
  random.seed = 3;
  // @ts-expect-error stream seed is readonly
  random.stream("enemy").seed = 3;
  // @ts-expect-error the callable random API was removed
  engine.random();
  // @ts-expect-error Engine options are explicit
  new Engine(42);
  const rec = new ReplayRecorder(engine, {
    controllers: {},
    metadata: { gameVersion: "1" },
  });
  // @ts-expect-error functions are not JSON event payloads
  rec.record("event", () => {});
  // @ts-expect-error undefined is not a JSON value
  rec.record("event", undefined);
  // @ts-expect-error Replay steps cannot be mutated
  data.steps.push({});
  const player = new ReplayPlayer(engine, data, { controllers: {} });
  void player;
  rec.dispose();
  engine.dispose();
}
