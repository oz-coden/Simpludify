import assert from "node:assert/strict";
import { cpSync, existsSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { installCandidateProject, runConsumerNpm } from "./sdk-candidate.mjs";
import { sdkVersion } from "./sdk-version.mjs";

const [checkout, destination] = process.argv.slice(2);
assert(
  checkout && destination,
  "Pass the Run To Exit checkout and an isolated destination",
);
const project = resolve(destination);
const workspace = resolve(import.meta.dirname, "..");
const relativePath = relative(workspace, project);
assert(
  relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath),
  "Consumer must be outside the SDK workspace",
);
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
