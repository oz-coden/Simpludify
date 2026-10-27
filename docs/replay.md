# Random, Replay and fixed steps

Random is standard Engine functionality. Replay is an opt-in execution driver: ordinary play creates no recorder, input log or per-step random snapshots. These APIs help reproduce a controlled run; they are not a save-game, arbitrary state serializer or universal determinism guarantee.

## Random streams

```ts verify
import { Engine, RandomManager } from "@simpludify/core";
const engine = new Engine(); // automatic seed
console.log(engine.random.seed); // the actual initial uint32 seed
const enemy = engine.random.stream("enemy");
const loot = engine.random.stream("loot");
enemy.next();
loot.next();
engine.random.next(); // explicit default stream
const independent = new RandomManager(12345);
console.log(independent.stream("map").next());
console.log(independent.snapshot());
engine.dispose();
independent.dispose();
```

`new Engine({ seed: 42 })` and `new RandomManager(42)` reproduce the same default sequence. Explicit seeds must be integers in 0..4294967295; negative/fractional values are rejected rather than silently truncated. `next()` returns a number in [0,1). Initial `seed`, current `state` and consumed `calls` are distinct. The manager caches a handle per exact, case-sensitive name; names contain 1–256 UTF-16 code units. `$default` names the default stream. Acquiring a stream does not consume another stream.

Algorithm identifier: **lcg32-fnv1a-utf16le-v1**. The default stream begins at the master seed. Every next state is `(1664525 * state + 1013904223) mod 2^32`, implemented with Math.imul and unsigned coercion; output divides by 2^32. A named seed is FNV-1a-32, starting at 2166136261, processing the master's four little-endian bytes followed by each exact UTF-16 code unit's low byte then high byte. Each byte applies `hash = imul(hash xor byte, 16777619) >>> 0`. There is no locale conversion or Unicode normalization. Creation order and consumption of other streams cannot change a stream's state. Finite 32-bit seeds/hashes can collide; this is a lightweight game PRNG, not cryptographic randomness or mathematical statistical independence.

With no seed, the manager uses the optional cross-host `globalThis.crypto.getRandomValues` capability when available. Modern browsers and supported Node builds provide it; hosts without it, or with a failing capability, fall back to ES Math.random for the initial seed. No DOM/Node import or ambient type enters Core. Automatic seeds are not guaranteed unique. The PRNG after seeding is always the identified deterministic algorithm. See [Web Crypto](https://www.w3.org/TR/webcrypto/) and [Node globals](https://nodejs.org/api/globals.html#crypto).

Engine owns its manager. Scene replacement retains every stream and its consumption; dispose invalidates future next/stream calls, including previously retained handles. Seeds, final scalar state and copied snapshots remain inspectable. Independent managers have their own dispose. A snapshot copies sorted stream states and call counts, but no restore API is provided in this revision.

Migration: `engine.random()` becomes `engine.random.next()`, `new Engine(42)` becomes `new Engine({ seed: 42 })`. Game's seed option remains optional and now defaults to automatic generation. Engine.snapshot().random replaces the old single randomState field.

## Record and replay logical Actions

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Engine,
  parseReplayData,
  ReplayPlayer,
  ReplayRecorder,
} from "@simpludify/core";
const Actions = defineActions({ Move: Action.axis2D(), Fire: Action.button() });
function create(seed: number) {
  const engine = new Engine({ seed });
  const controls = new ActionController(Actions, {
    scene: engine.scene,
    input: engine.input,
  });
  engine.scene.add(Character({ movement: controls.reader(Actions.Move) }));
  return { engine, controls };
}
const live = create(42);
const recorder = new ReplayRecorder(live.engine, {
  controllers: { player: live.controls },
  metadata: {
    gameVersion: "movement-example-1",
    difficulty: "normal",
    buildId: "local",
  },
});
const source = live.controls.createSource();
source.set(Actions.Move, { x: 1, y: 0 });
source.set(Actions.Fire, true);
source.set(Actions.Fire, false); // retained short tap
live.engine.step(1 / 60);
recorder.record("checkpoint", { x: live.engine.scene.actors[0]?.id ?? "none" });
const data = recorder.finish();
const text = JSON.stringify(data);
const decoded = parseReplayData(JSON.parse(text));
const replay = create(decoded.random.seed);
const player = new ReplayPlayer(replay.engine, decoded, {
  controllers: { player: replay.controls },
  expectedMetadata: { gameVersion: "movement-example-1", buildId: "local" },
});
while (player.step()) {
  /* no wall-clock wait */
}
console.log(live.engine.snapshot(), replay.engine.snapshot());
player.dispose();
live.engine.dispose();
replay.engine.dispose();
```

Construct a recorder/player **after deterministic game setup and before the fresh Engine's first step**. A Web Scene factory can create it after constructing game logic. Mid-game recording is rejected: initial seeds alone cannot reconstruct an arbitrary partly played game. Random state immediately before the first recorded boundary is saved for initial-condition checking. Playback requires the same setup/activation random consumption; it does not restore arbitrary state to force a match.

Bind every active ActionController with an explicit stable ID. Two controllers may both define `Fire`; the IDs disambiguate them. IDs and Action names/kinds/normalization must match. Symbols and object identities are not serialized. Within each target controller, imported names resolve to that controller's own typed tokens. Physical keyboard bindings may differ because recorded frames are already logical, composed input.

The frame stores all Button/Axis1D/2D/3D values plus the **ordered Button down/up event list**. It preserves sub-step taps, repeated presses, cross-button order and multiple source composition; held booleans alone are insufficient. Captured frames enter the existing Action boundary before onPressed dispatch. They are not replayed as artificial physical keys or added on top of live source contributions, and normalized vectors are not normalized a second time.

Playback exclusively owns logical frames. Browser keys are not accepted; non-neutral Action/device writes throw REPLAY_INPUT_LOCKED. Neutral cleanup remains harmless. Disable live touch/AI producers in a replay viewer. Player disposal clears contributions and unlocks ordinary input. Direct Engine.step is allowed only with the next recorded delta; player.step() supplies it and returns false at the end. After completion the driver stays attached until disposed, preventing accidental unrecorded stepping.

Every boundary records pausedBefore/pausedAfter. Playback applies between-boundary external pause changes and verifies the game's pause callbacks produce the same after-state. Recorded pause Actions still run while simulation is suspended. Zero-duration boundaries, including paused input pumps, retain their exact sequence; host wall-clock pause duration is not recorded. Invalid/reentrant Engine.step calls do not consume a frame. A failed boundary invalidates the recording/playback instead of presenting a partial execution as healthy.

Initial support is **one Scene per fresh Engine session**. Finish/dispose before Scene replacement; unsupported transitions are rejected before Core commit. Engine disposal releases its driver. Direct disposal of the active Scene remains terminal. New/replaced controller rosters during a run are not supported. Rebuild the same game factory with the recorded seed to replay; no seek, rewind, arbitrary Component restore or mid-game resume is implemented.

## JSON format and auxiliary observations

ReplayData version 1 contains:

| Field                        | Purpose                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| formatVersion, engineVersion | Format compatibility and source-workspace version                                    |
| random                       | Algorithm identifier, actual master seed and initial stream seeds/states/call counts |
| sceneId, controllers         | Initial Scene and explicitly identified Action schemas                               |
| metadata                     | Game-supplied JSON object: game version, stage, difficulty, build ID, etc.           |
| steps                        | Sequential index, dt, pause states, logical values and ordered Button events         |
| events                       | Optional observations with step, phase, global order, type and JSON payload          |

Engine version is a checked source constant matching package.json, not a Git commit detector. The experimental workspace can change without a package-version bump; use gameVersion/buildId metadata and expectedMetadata checks for a particular build. Metadata is never inferred from game code. Playback rejects incompatible format/algorithm/version, seed/schema mismatches, invalid values/dimensions/events and inconsistent initial random consumption. expectedMetadata checks the supplied fields; it does not execute migration code.

`recorder.record(type, payload)` records an observation. During a boundary it has phase `step` and that zero-based index; between boundaries it has phase `between` and the upcoming index. order is monotonic across observations. Events are **never executed as game commands** during playback. Replay does not register arbitrary functions or subscribe to every game event automatically.

Payloads must be JSON data: finite numbers, strings, booleans, null, arrays and plain objects. Undefined, functions, class instances, cycles and excessive depth are rejected. Import validates and copies data; input objects cannot later mutate playback. Recording defaults to maxSteps=100000 (configurable 1..1000000); stop before the budget is exhausted. Parser bounds include 64 controllers, 256 Actions per controller, 10000 transitions per frame, 1000000 steps/events and 4096 initial random streams. Applications should also bound imported file byte size before JSON.parse. This initial format stores each frame explicitly; it favors simple exact edges over compression.

File/network persistence belongs to the application. Core neither opens files nor downloads JSON. The example CLI optionally writes a file:

```sh
npm run replay:demo
npm run replay:demo -- --out mission.json
```

[Prism Raid's helper](../examples/prism-raid/replay.ts) records a normal input-only automatic mission, JSON-round-trips it and compares real round/Engine state after playback. Pass automatic=false to its recordMission helper to capture ordinary no-input loss. The helper supplies its own game version; the engine does not guess it.

## Fixed stepping and browser presentation

```ts verify
import { Game } from "@simpludify/web";
const game = new Game({
  fixedStep: { step: 1 / 120, maxSteps: 8, maxFrameDelta: 0.25 },
});
await game.run();
game.dispose();
```

Variable RAF stepping remains the default, with maxDelta=0.05 seconds. In fixed mode, Web accumulates host time and runs zero or more Engine.step(step) calls, then renders once. maxFrameDelta caps accepted frame time; maxSteps bounds catch-up work. Excess whole simulation steps are dropped, a fractional remainder is retained, and Core FixedStepRunner.advance reports droppedSeconds/alpha. There is no automatic render interpolation. maxDelta applies to variable mode; fixed mode uses its own cap.

FixedStepRunner can be used headlessly with the same step. step is 1e-6..1 seconds, maxSteps 1..1000, maxFrameDelta between step and 60 seconds. Scene changes, Web visibility and Game.pause/resume reset the accumulator. While paused, advance performs Engine.step(0) to service logical pause/resume controls without accumulating paused time. A resume at that boundary can run zero-delta game callbacks, following Engine's existing contract. Short taps before a full tick remain pending. Engine.stepCount counts entered input boundaries (including zero/paused boundaries), not rendered frames; failures after entering a boundary also make an Engine ineligible for a fresh Replay.

For browser playback, configure Game.playReplay inside the initial Scene factory after constructing the same game. It returns the ReplayPlayer and paces recorded deltas from RAF independently of the normal variable/fixed simulation mode. Bounded catch-up slows playback rather than skipping recorded steps. Navigation to a different Scene or Game disposal stops the player; failed staged preparation also releases it. Game.stopReplay explicitly unlocks live input. Viewer pause/seek controls are not implemented; Game.pause remains a game-state operation whose recorded state wins at the next replay boundary.

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  type ReplayData,
} from "@simpludify/web";
export async function viewMovementReplay(data: ReplayData) {
  const game = new Game({ seed: data.random.seed });
  const Actions = defineActions({
    Move: Action.axis2D(),
    Fire: Action.button(),
  });
  game.scene(data.sceneId, ({ scene, add }) => {
    const controls = new ActionController(Actions, {
      scene,
      input: game.engine.input,
    });
    add(Character({ movement: controls.reader(Actions.Move) }));
    game.playReplay(data, {
      scene,
      controllers: { player: controls },
      expectedMetadata: { gameVersion: "movement-example-1" },
    });
  });
  await game.run(data.sceneId);
  return game;
}
```

## Determinism limits

Reproduction requires matching game code/configuration, seed and setup consumption, Action schemas, step sequence and deterministic external conditions. Fixed steps alone cannot control Date.now/performance.now, Math.random in game code, network messages, asynchronous completion order, host text input, audio or GPU output. External conditions that affect rules must become explicitly scheduled game input before they can be replayed; auxiliary observations cannot substitute for them. Snapshots inspect state and do not serialize/restore arbitrary Components. Physical-device diagnostics in Engine.snapshot().input are not replayed; compare logical frames and game-owned state. Replay does not compute a universal per-step state checksum; applications/tests compare their relevant game snapshots. Cross-browser bitwise equality is not promised.

## Validation and measured costs

The maintained fixtures compare real Blockfall board/score/terminal state and Prism Raid round/Engine snapshots after JSON round trips. Blockfall reproduces a controlled loss twice; Prism Raid reproduces both an input-only automatic victory and a no-input loss. Random golden fixtures pin UTF-16 seed derivation independently of the implementation. Core cases cover all Action dimensions, composite short taps, multiple presses and controller IDs, pause boundaries, invalid imports, exclusivity, budgets, disposal and a disabled-recording traversal spy. Browser fixtures use real keys, the Web fixed loop, Pixi presentation, JSON mission playback, navigation and failed preparation cleanup at desktop/narrow sizes. This is Chromium coverage, not a claim of native mobile or every browser/device compatibility.

Reproduce without wall-clock waiting:

```sh
npm test -- tests/unit/random.test.ts tests/unit/replay.test.ts tests/unit/game-replay.test.ts tests/unit/fixed-step.test.ts
npm run replay:demo
npm run bench:shooter -- --out /tmp/shooter-off.json
npm run bench:shooter -- --record --out /tmp/shooter-record.json
npm run bench:replay-memory -- --out /tmp/replay-memory.json
```

Run recorded benchmarks alone, without other local tests/builds. [Raw reports](../benchmarks/random-replay/) retain source commit, environment and parameters. Measurements used Node 24.22.1, Linux and an AMD EPYC 9V74 shared host. Each shooter invocation warmed five rounds, then ran 60 seeds (42–101), dt=1/120, with ordinary Action autopilot decisions every six steps. Every invocation completed 172796 boundaries / 1439.97 simulated seconds, 60 wins, 1440 kills, and asserted round/world disposal. Peak 41 counts game Units, not every Scene Actor.

| Source/mode                                          | Three wall times (seconds) | Median |
| ---------------------------------------------------- | -------------------------- | ------ |
| Before this work, clean 76fd916                      | 3.42 / 3.91 / 4.69         | 3.91   |
| New system, recording OFF, clean 1f18214             | 3.66 / 3.63 / 4.97         | 3.66   |
| Recording ON before completion-copy removal, 1f18214 | 4.50 / 5.16 / 5.65         | 5.16   |
| Recording ON with buffer transfer, clean 0b89def     | 4.10 / 4.42 / 4.26         | 4.26   |

ON includes completion and JSON serialization; OFF creates no recorder/Replay frames. The completion optimization does not add work to OFF. Shared-host drift is visible; these samples show no large OFF regression, not a general speedup. Final ON is approximately 16% above the OFF median for this workload. The 60 exported recordings total 29716069 UTF-8 JSON bytes (about 172 bytes/boundary); each round is released independently. A single uninterrupted recording retains all its frames, so long sessions require an explicit budget; no automatic compression or streaming persistence is provided.

A separate forced-GC experiment used 100000 boundaries, three Actions and no Actors/rendering. It includes SSR/tooling heap and is not the shooter's memory profile:

| Recording stage                              | Before copy removal (bc2eceb) | Buffer transfer (0b89def) |
| -------------------------------------------- | ----------------------------- | ------------------------- |
| Heap increase while holding frames           | 27.43 MB                      | 27.43 MB                  |
| Heap increase after finish                   | 51.26 MB                      | 27.35 MB                  |
| Heap increase with JSON string also retained | 68.86 MB                      | 44.94 MB                  |
| Finish time                                  | 171.88 ms                     | 0.09 ms                   |
| JSON bytes                                   | 17594936                      | 17594936                  |

finish now transfers already immutable frames/events and validates headers/payloads once; untrusted Replay imports are still fully validated/copied. The exported object/arrays are frozen and detached from the recorder. After releasing data/string and disposing Engine, sampled heap returned close to its initial level and remaining input sources were zero. Forced-GC stage samples are neither true peak memory nor proof of leak freedom. OFF's 100000-boundary heap increase at the held stage was about 0.07 MB and produced zero Replay bytes. The final microbenchmark measured one million cached stream acquisitions in 10.28 ms and 10000 new named streams in 5.04 ms; prefer retaining frequently used handles for clarity, not because these measurements require a pooling system. No GPU/native memory or multi-hour browser stability conclusion follows from these Core observations.
