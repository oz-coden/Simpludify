import { spawnSync } from "node:child_process";
import { build } from "vite";
import "./licenses.mjs";

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--base"))
  throw new Error("Usage: npm run build -- [--base /my-game/]");
const checked = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  { stdio: "inherit" },
);
if (checked.error || checked.status !== 0)
  throw checked.error ?? new Error("Typecheck failed");
await build({ base: args[1] ?? "./" });
