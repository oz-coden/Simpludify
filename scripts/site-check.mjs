import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("site-dist");
const manifest = JSON.parse(readFileSync(`${root}/site-manifest.json`, "utf8"));
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(`${dir}/${entry.name}`)
      : [`${dir}/${entry.name}`],
  );
const documents = files(root).filter((file) => file.endsWith(".html"));
const ids = new Map(
  documents.map((file) => [
    file,
    new Set(
      [...readFileSync(file, "utf8").matchAll(/\bid="([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ]),
);
let references = 0;
for (const file of documents) {
  const html = readFileSync(file, "utf8");
  const path = file.slice(root.length + 1);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const href = match[1].replaceAll("&amp;", "&");
    if (/^(?:https?:|mailto:|data:)/.test(href)) continue;
    const address = new URL(href, `https://local.test${manifest.base}${path}`);
    assert(
      address.pathname.startsWith(manifest.base),
      `Base escape: ${path}: ${href}`,
    );
    let target = resolve(
      root,
      decodeURIComponent(address.pathname.slice(manifest.base.length)),
    );
    if (address.pathname.endsWith("/")) target += "/index.html";
    assert(target.startsWith(`${root}/`), `Output escape: ${href}`);
    assert(existsSync(target), `Missing target: ${path}: ${href}`);
    if (address.hash && target.endsWith(".html"))
      assert(
        ids.get(target)?.has(decodeURIComponent(address.hash.slice(1))),
        `Missing anchor: ${path}: ${href}`,
      );
    references++;
  }
}
for (const { route } of manifest.pages) assert(existsSync(`${root}/${route}`));
for (const id of manifest.examples)
  assert(existsSync(`${root}/play/${id}/index.html`));
for (const file of [
  "LICENSE.txt",
  "THIRD-PARTY-NOTICES.txt",
  "sbom.json",
  ".nojekyll",
])
  assert(existsSync(`${root}/${file}`));
console.log(
  `Site references verified: ${documents.length} HTML documents, ${references} links/assets, base ${manifest.base}`,
);
