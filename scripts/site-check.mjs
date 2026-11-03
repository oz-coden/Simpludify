import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { languagePairs, pages } from "../site/config.mjs";
import { isPathInside } from "./path-boundary.mjs";
import { checkSnippets } from "./site-snippets.mjs";

const root = resolve("site-dist");
const manifest = JSON.parse(
  readFileSync(join(root, "site-manifest.json"), "utf8"),
);
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
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
assert.equal(
  new Set(pages.map((p) => p.route)).size,
  pages.length,
  "Duplicate page route",
);
assert.equal(
  new Set(pages.map((p) => p.source)).size,
  pages.length,
  "Duplicate page source",
);
const paired = new Set();
for (const pair of languagePairs) {
  assert.equal(pair.length, 2);
  for (const [i, route] of pair.entries()) {
    assert(!paired.has(route), `Duplicate language pair: ${route}`);
    paired.add(route);
    assert.equal(
      pages.find((p) => p.route === route)?.lang,
      i === 0 ? "ja" : "en",
    );
    const html = readFileSync(join(root, route), "utf8");
    assert(
      html.includes(`data-language-link href="${manifest.base}${pair[1 - i]}"`),
      `Wrong language destination: ${route}`,
    );
  }
}
let references = 0;
for (const file of documents) {
  const html = readFileSync(file, "utf8");
  const path = relative(root, file).replaceAll("\\", "/");
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
    if (address.pathname.endsWith("/")) target = join(target, "index.html");
    assert(isPathInside(root, target), `Output escape: ${href}`);
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

checkSnippets();
