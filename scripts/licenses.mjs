import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const allowed = new Set([
  "MIT",
  "Apache-2.0",
  "(MIT OR Apache-2.0)",
  "MIT OR Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "CC0-1.0",
  "Python-2.0",
]);
const packages = [];
for (const [location, item] of Object.entries(lock.packages)) {
  if (!location.includes("node_modules/") || item.link) continue;
  const path = resolve(location);
  // Optional binaries for other operating systems remain represented in the SBOM.
  const present = existsSync(join(path, "package.json"));
  const meta = present
    ? JSON.parse(readFileSync(join(path, "package.json"), "utf8"))
    : item;
  const name = meta.name ?? location.split("node_modules/").at(-1);
  const license = meta.license ?? item.license;
  if (!allowed.has(license) && !(item.dev && license === "MPL-2.0"))
    throw new Error(
      `LICENSE_REVIEW_REQUIRED: ${name}@${item.version}: ${license}`,
    );
  let notices = present
    ? readdirSync(path)
        .filter((name) =>
          /^(?:.*-)?(?:licen[cs]e|notice|copying)(?:[.-]|$)/i.test(name),
        )
        .map((name) => ({
          file: name,
          text: readFileSync(join(path, name), "utf8"),
        }))
    : [];
  if (present && notices.length === 0) {
    const fallback = name.startsWith("@biomejs/cli-")
      ? "node_modules/@biomejs/biome"
      : name.startsWith("@rolldown/binding-")
        ? "node_modules/rolldown"
        : name === "@pixi/colord"
          ? "third-party/colord"
          : undefined;
    if (fallback)
      notices = readdirSync(fallback)
        .filter((name) => /(?:licen[cs]e|notice)/i.test(name))
        .map((name) => ({
          file: name,
          text: readFileSync(join(fallback, name), "utf8"),
        }));
  }
  if (present && notices.length === 0)
    throw new Error(`LICENSE_NOTICE_MISSING: ${name}`);
  packages.push({
    name,
    version: item.version,
    license,
    dev: !!item.dev,
    installed: present,
    integrity: item.integrity ?? null,
    notices,
  });
}
packages.sort(
  (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
);
const index = process.argv.indexOf("--out");
if (index >= 0) {
  const output = process.argv[index + 1];
  if (!output) throw new Error("--out requires a directory");
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "LICENSE.txt"), readFileSync("LICENSE", "utf8"));
  writeFileSync(
    join(output, "sbom.json"),
    `${JSON.stringify({ schema: "simpludify-dependencies-v1", packages: packages.map(({ notices: _, ...pkg }) => pkg) }, null, 2)}\n`,
  );
  const notice = packages
    .filter((pkg) => pkg.installed)
    .map(
      (pkg) =>
        `## ${pkg.name}@${pkg.version} (${pkg.license})\n\n${pkg.notices.map((item) => `${basename(item.file)}\n${item.text}`).join("\n")}`,
    )
    .join("\n\n");
  writeFileSync(
    join(output, "THIRD-PARTY-NOTICES.txt"),
    `Third-party dependency notices (runtime and build tools)\n\n${notice}\n`,
  );
}
console.log(
  `License allowlist and notices verified for ${packages.length} locked dependencies.`,
);
