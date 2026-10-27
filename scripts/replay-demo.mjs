import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

const args = process.argv.slice(2);
const output = args[0] === "--out" && args.length === 2 ? args[1] : undefined;
assert(
  args.length === 0 || output,
  "Usage: npm run replay:demo -- [--out mission.json]",
);
const server = await createServer({
  configFile: false,
  logLevel: "silent",
  server: { middlewareMode: true },
});
try {
  const { recordMission, playMission } = await server.ssrLoadModule(
    "/examples/prism-raid/replay.ts",
  );
  const recording = recordMission({ seed: 2026 }),
    text = JSON.stringify(recording.data),
    playback = playMission(JSON.parse(text));
  assert.deepEqual(playback.snapshot, recording.snapshot);
  assert.deepEqual(playback.engine, recording.engine);
  if (output) writeFileSync(output, `${text}\n`);
  console.log(
    JSON.stringify(
      {
        seed: recording.data.random.seed,
        steps: recording.data.steps.length,
        status: playback.snapshot.status,
        score: playback.snapshot.score,
        jsonBytes: Buffer.byteLength(text),
        matching: true,
        output: output ?? null,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
