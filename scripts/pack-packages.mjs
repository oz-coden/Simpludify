import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const output = resolve("test-results/packages");
mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ["scripts/build-packages.mjs"], {
  stdio: "inherit",
});
for (const name of ["core", "web"]) {
  const data = execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    [
      "pack",
      `./packages/${name}`,
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      output,
    ],
    { encoding: "utf8" },
  );
  writeFileSync(`${output}/${name}-pack.json`, data);
  console.log(
    `${JSON.parse(data)[0].filename}: ${JSON.parse(data)[0].integrity}`,
  );
}
