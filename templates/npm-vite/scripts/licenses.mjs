import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

// Generate notices from the actual lockfile's production dependency locations, including nested packages.
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
if (lock.lockfileVersion < 2)
  throw new Error("A package-lock v2/v3 is required");
const sections = [];
for (const [location, item] of Object.entries(lock.packages)) {
  if (!location.includes("node_modules/") || item.dev || item.link) continue;
  const directory = resolve(location),
    manifest = join(directory, "package.json");
  if (!existsSync(manifest)) {
    if (item.optional) continue; // Platform-specific optional dependency is not redistributed on this host.
    throw new Error(`Missing production dependency: ${location}; run npm ci`);
  }
  const meta = JSON.parse(readFileSync(manifest, "utf8"));
  if (meta.version !== item.version)
    throw new Error(`Lock/install mismatch: ${location}`);
  const notices = (path) =>
    readdirSync(path)
      .filter(
        (file) =>
          /^(?:.*-)?(?:licen[cs]e|notice|copying)(?:[.-]|$)/i.test(file) &&
          statSync(join(path, file)).isFile(),
      )
      .map((file) => `${file}\n${readFileSync(join(path, file), "utf8")}`);
  let texts = notices(directory);
  // Reviewed exception only for this exact published version; re-review after any upgrade.
  if (
    !texts.length &&
    meta.name === "@pixi/colord" &&
    meta.version === "2.9.6" &&
    meta.license === "MIT"
  ) {
    texts = notices("third-party/colord");
    texts.push(readFileSync("third-party/colord/README.md", "utf8"));
  }
  if (
    !texts.length ||
    texts.some((text) => !text.slice(text.indexOf("\n") + 1).trim())
  )
    throw new Error(`LICENSE_NOTICE_MISSING: ${meta.name}@${meta.version}`);
  sections.push(
    `## ${meta.name}@${meta.version} (${meta.license ?? "review required"})\n\n${texts.join("\n\n")}`,
  );
}
mkdirSync("public", { recursive: true });
writeFileSync("public/LICENSE.txt", readFileSync("LICENSE", "utf8"));
writeFileSync(
  "public/THIRD-PARTY-NOTICES.txt",
  `Locked production dependency notices\n\n${sections.sort().join("\n\n")}\n`,
);
console.log(
  `Generated notices for ${sections.length} installed production packages.`,
);
