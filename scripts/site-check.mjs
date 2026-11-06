import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { isPathInside } from "./path-boundary.mjs";
import { languagePairs, pages } from "./site-config.mjs";
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

// Check unpaired fallback routing and banner presence
for (const page of pages) {
  const isPaired = paired.has(page.route);
  const html = readFileSync(join(root, page.route), "utf8");
  if (!isPaired) {
    assert(
      html.includes('class="language-fallback-banner"'),
      `Missing fallback banner on unpaired page: ${page.route}`,
    );
    const expectedDest =
      page.lang === "en"
        ? `${manifest.base}index.html`
        : `${manifest.base}en/examples.html`;
    assert(
      html.includes(`data-language-link href="${expectedDest}"`),
      `Wrong fallback language destination on ${page.route}`,
    );
    if (page.lang === "en") {
      assert(
        html.includes("この技術資料は英語版のみ提供されています"),
        `Missing fallback message on English page: ${page.route}`,
      );
    }
  } else {
    assert(
      !html.includes('class="language-fallback-banner"'),
      `Paired page must not show fallback banner: ${page.route}`,
    );
  }

  // Check language continuity on brand and header links
  const expectedBrand = `${manifest.base}${page.lang === "en" ? "en/index.html" : "index.html"}`;
  assert(
    html.includes(`class="brand" href="${expectedBrand}"`),
    `Wrong brand link on ${page.route}`,
  );
  const expectedStart = `${manifest.base}${page.lang === "en" ? "en/getting-started.html" : "getting-started.html"}`;
  const expectedExamples = `${manifest.base}${page.lang === "en" ? "en/examples.html" : "examples.html"}`;
  assert(
    html.includes(`href="${expectedStart}"`),
    `Wrong getting-started header link on ${page.route}`,
  );
  assert(
    html.includes(`href="${expectedExamples}"`),
    `Wrong examples header link on ${page.route}`,
  );

  // Check navigation separation in sidebar
  const sidebarMatch = html.match(
    /<aside id="sidebar"[^>]*>([\s\S]*?)<\/aside>/,
  );
  assert(sidebarMatch, `Sidebar missing on ${page.route}`);
  const sidebarContent = sidebarMatch[1];
  if (page.lang === "ja") {
    assert(
      !sidebarContent.includes(`href="${manifest.base}en/api.html"`),
      `Japanese sidebar leaked English guide: ${page.route}`,
    );
    assert(
      !sidebarContent.includes(
        `href="${manifest.base}en/getting-started.html"`,
      ),
      `Japanese sidebar leaked English getting-started: ${page.route}`,
    );
    assert(
      !sidebarContent.includes(`href="${manifest.base}en/architecture.html"`),
      `Japanese sidebar leaked English architecture: ${page.route}`,
    );
    assert(
      sidebarContent.includes("技術資料 (英語)"),
      `Japanese sidebar missing fallback technical section: ${page.route}`,
    );
    assert(
      sidebarContent.includes(
        `href="${manifest.base}en/scroll-performance.html"`,
      ),
      `Japanese sidebar missing fallback record link: ${page.route}`,
    );
    assert(
      sidebarContent.includes('class="lang-tag"'),
      `Japanese sidebar missing lang tag: ${page.route}`,
    );
  } else {
    assert(
      !sidebarContent.includes(`href="${manifest.base}api.html"`),
      `English sidebar leaked Japanese guide: ${page.route}`,
    );
    assert(
      !sidebarContent.includes(`href="${manifest.base}getting-started.html"`),
      `English sidebar leaked Japanese getting-started: ${page.route}`,
    );
    assert(
      !sidebarContent.includes(`href="${manifest.base}architecture.html"`),
      `English sidebar leaked Japanese architecture: ${page.route}`,
    );
    assert(
      !sidebarContent.includes("はじめに"),
      `English sidebar leaked Japanese section title: ${page.route}`,
    );
    assert(
      !sidebarContent.includes("ガイド"),
      `English sidebar leaked Japanese section title: ${page.route}`,
    );
    assert(
      sidebarContent.includes("Getting started"),
      `English sidebar missing Getting started section: ${page.route}`,
    );
    assert(
      sidebarContent.includes("Guides"),
      `English sidebar missing Guides section: ${page.route}`,
    );
    assert(
      sidebarContent.includes("Engineering records"),
      `English sidebar missing Engineering records section: ${page.route}`,
    );
  }
}

// Check syntax highlighting presence on code-bearing pages
const sampleCodePage = readFileSync(join(root, "getting-started.html"), "utf8");
assert(sampleCodePage.includes('class="shiki'), "Shiki code blocks missing");
assert(sampleCodePage.includes("data-copy-code"), "Copy button missing");
assert(
  sampleCodePage.includes('class="code-block"'),
  "Code block container missing",
);
assert(
  sampleCodePage.includes("--shiki-light"),
  "Shiki light theme variable missing",
);
assert(
  sampleCodePage.includes("--shiki-dark"),
  "Shiki dark theme variable missing",
);

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
