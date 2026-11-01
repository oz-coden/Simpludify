import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const publish = process.argv.includes("--publish");
if (process.argv.some((value, index) => index > 1 && value !== "--publish"))
  throw new Error("Usage: node scripts/publish-packages.mjs [--publish]");
if (publish) {
  assert.equal(
    process.env.GITHUB_ACTIONS,
    "true",
    "Publishing requires GitHub Actions OIDC",
  );
  assert(
    process.env.ACTIONS_ID_TOKEN_REQUEST_URL &&
      process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    "Missing OIDC capability",
  );
  assert(
    !process.env.NODE_AUTH_TOKEN && !process.env.NPM_TOKEN,
    "Token credentials are not accepted by this workflow",
  );
}
const output = resolve("test-results/packages");
mkdirSync(output, { recursive: true });
const record = {
  commit: process.env.GITHUB_SHA,
  tag: process.env.RELEASE_TAG,
  publish,
  packages: [],
};
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
async function metadata(name) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/0.1.0`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return undefined;
  if (!response.ok)
    throw new Error(`Registry request failed: ${response.status} ${name}`);
  return await response.json();
}
try {
  const entries = ["core", "web"].map((name) => {
    const packed = JSON.parse(
      readFileSync(`${output}/${name}-pack.json`, "utf8"),
    )[0];
    const manifest = JSON.parse(
      readFileSync(`packages/${name}/package.json`, "utf8"),
    );
    assert.equal(manifest.name, `@simpludify/${name}`);
    assert.equal(manifest.version, "0.1.0");
    assert.equal(manifest.private, undefined);
    assert.equal(
      manifest.repository.url,
      "git+https://github.com/oz-coden/Simpludify.git",
    );
    const path = resolve(output, packed.filename);
    assert.equal(
      `sha512-${createHash("sha512").update(readFileSync(path)).digest("base64")}`,
      packed.integrity,
    );
    return {
      name: manifest.name,
      version: manifest.version,
      integrity: packed.integrity,
      path,
    };
  });
  // Check both versions before the first irreversible operation.
  for (const entry of entries) {
    const existing = await metadata(entry.name);
    if (existing)
      assert.equal(
        existing.dist.integrity,
        entry.integrity,
        `Existing ${entry.name}@0.1.0 differs: never overwrite or silently skip it`,
      );
  }
  for (const entry of entries) {
    const existing = await metadata(entry.name);
    const item = {
      ...entry,
      status: existing ? "already-published-identical" : "not-published",
    };
    record.packages.push(item);
    if (publish && !existing) {
      execFileSync(
        "npm",
        [
          "publish",
          entry.path,
          "--access",
          "public",
          "--tag",
          "latest",
          "--ignore-scripts",
          "--registry",
          "https://registry.npmjs.org/",
        ],
        { stdio: "inherit" },
      );
      item.status = "publish-command-succeeded";
      let result;
      for (let attempt = 0; attempt < 12; attempt++) {
        result = await metadata(entry.name);
        if (result) break;
        await pause(5000);
      }
      assert(
        result,
        `Publication not visible for ${entry.name}; inspect registry before retry`,
      );
      assert.equal(result.dist.integrity, entry.integrity);
      item.status = "published-verified";
    }
    console.log(`${entry.name}@${entry.version}: ${item.status}`);
  }
  record.ok = true;
} catch (error) {
  record.ok = false;
  record.error = String(error);
  throw error;
} finally {
  const text = `${JSON.stringify(record, null, 2)}\n`;
  writeFileSync(`${output}/publication.json`, text);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n### npm publication\n\n\`\`\`json\n${text}\`\`\`\n`,
    );
  }
}
