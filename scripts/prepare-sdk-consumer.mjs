import assert from "node:assert/strict";
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { installCandidateProject, runConsumerNpm } from "./sdk-candidate.mjs";
import { sdkVersion } from "./sdk-version.mjs";

const [checkout] = process.argv.slice(2);
assert(checkout, "Pass the path to the pinned Run To Exit checkout");
const project = resolve("test-results/run-to-exit");
assert(
  !existsSync(project),
  `Remove the previous consumer fixture: ${project}`,
);
const excluded = new Set([
  ".git",
  "node_modules",
  "dist",
  "test-results",
  "playwright-report",
]);
cpSync(resolve(checkout), project, {
  recursive: true,
  filter: (path) => !excluded.has(basename(path)),
});
await installCandidateProject(project);
await runConsumerNpm(project, ["run", "check"]);
await runConsumerNpm(project, ["test"]);
await runConsumerNpm(project, ["run", "build"]);
writeFileSync(join(project, "candidate-version.txt"), `${sdkVersion}\n`);
