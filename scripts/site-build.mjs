import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, posix, resolve } from "node:path";
import MarkdownIt from "markdown-it";
import { build } from "vite";
import { examples, pages, repository } from "../site/config.mjs";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const args = process.argv.slice(2);
let base = process.env.SITE_BASE ?? "/Simpludify/";
if (args[0] === "--base" && args.length === 2) base = args[1];
else if (args.length)
  throw new Error("Usage: npm run site:build -- [--base /path/]");
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))
  throw new Error(
    "SITE_BASE must be / or an absolute path ending in / (letters, digits, _ and - only)",
  );
const stage = resolve(".site-build"),
  output = resolve("site-dist");
// Only these two dedicated, generated directories are replaced; CLI dist is untouched.
rmSync(stage, { recursive: true, force: true });
rmSync(output, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync("site/assets", `${stage}/assets`, { recursive: true });
const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const url = (path) => base + path;
const md = new MarkdownIt({ html: true, linkify: true });
const sourceRoutes = new Map(pages.map((page) => [page.source, page.route]));
const linkOpen = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index],
    href = token.attrGet("href");
  if (href && !/^(?:[a-z]+:|\/|#)/i.test(href)) {
    const [path, hash] = href.split("#");
    const target = posix.normalize(posix.join(posix.dirname(env.source), path));
    const published = path.replace(/^(?:\.\.\/)+/, "");
    if (
      pages.some((page) => page.route === published) ||
      ["LICENSE.txt", "THIRD-PARTY-NOTICES.txt", "sbom.json"].includes(
        published,
      )
    ) {
      token.attrSet("href", url(published) + (hash ? `#${hash}` : ""));
      return self.renderToken(tokens, index, options);
    }
    if (!sourceRoutes.has(target) && !existsSync(resolve(root, target))) {
      throw new Error(`Unknown repository link in ${env.source}: ${href}`);
    }
    const kind =
      existsSync(target) && statSync(target).isDirectory() ? "tree" : "blob";
    token.attrSet(
      "href",
      sourceRoutes.has(target)
        ? url(sourceRoutes.get(target)) + (hash ? `#${hash}` : "")
        : `${repository}/${kind}/main/${target}${hash ? `#${hash}` : ""}`,
    );
  }
  return linkOpen
    ? linkOpen(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};
const headingOpen = md.renderer.rules.heading_open;
md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const label = tokens[index + 1].content;
  const slug = label
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
  const count = env.ids.get(slug) ?? 0;
  env.ids.set(slug, count + 1);
  const id = slug + (count ? `-${count}` : "");
  tokens[index].attrSet("id", id);
  if (tokens[index].tag === "h2") env.toc.push({ label, id });
  return headingOpen
    ? headingOpen(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};
function gallery() {
  return `<div class="example-grid">${examples.map((example) => `<section class="example-card" id="${example.id}"><span class="eyebrow">${escapeHtml(example.id)}</span><h2>${escapeHtml(example.title)}</h2><p>${escapeHtml(example.summary)}</p><p>${escapeHtml(example.controls)}</p><div class="actions"><button type="button" data-launch="${example.id}">${escapeHtml(example.title)}を起動</button><a href="${url(`play/${example.id}/index.html`)}" target="_blank" rel="noopener">別タブで開く ↗</a></div><p class="related"><a href="${url(example.guide)}">関連ガイド</a> · <a href="${url("en/api.html")}">詳細API</a> · <a href="${repository}/tree/main/examples/${example.id}">ソースコード ↗</a></p></section>`).join("")}</div><section class="playground" hidden aria-labelledby="player-title"><div class="player-toolbar"><h2 id="player-title">サンプル</h2><button type="button" data-restart>再起動</button><button type="button" data-stop>終了する</button></div><p role="status" data-player-status></p><div data-frame-slot></div><p>ゲーム領域をクリック／Tabで選択して入力を開始します。終了すると起動ボタンへフォーカスが戻ります。</p></section>`;
}
for (const page of pages) {
  const env = { source: page.source, ids: new Map(), toc: [] };
  const body = md
    .render(readFileSync(page.source, "utf8"), env)
    .replace("<!--gallery-->", gallery());
  const sidebar = [...new Set(pages.map((p) => p.section))]
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section)}</h2>${pages
          .filter((p) => p.section === section)
          .map(
            (p) =>
              `<a href="${url(p.route)}"${p.route === page.route ? ' aria-current="page"' : ""}>${escapeHtml(p.title)}</a>`,
          )
          .join("")}</section>`,
    )
    .join("");
  const articleClass = page.route === "index.html" ? "home" : "";
  const prefix = "../".repeat(page.route.split("/").length - 1);
  const html = `<!doctype html><html lang="${page.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Simpludify — TypeScriptでつくる、コード中心の2Dゲームエンジン。設計・API・実行可能なサンプル。"><meta name="color-scheme" content="light dark"><title>${escapeHtml(page.title)} | Simpludify</title><script>${readFileSync("site/assets/theme-init.js", "utf8")}</script><link rel="stylesheet" href="${prefix}assets/site.css"><script type="module" src="${prefix}assets/site.js"></script></head><body data-base="${base}"><a class="skip" href="#main">本文へスキップ / Skip to content</a><header class="site-header"><a class="brand" href="${url("index.html")}"><span class="brand-mark" aria-hidden="true">S</span>Simpludify<span class="badge">EXPERIMENTAL</span></a><nav aria-label="メイン"><a href="${url("getting-started.html")}">はじめる</a><a href="${url("examples.html")}">サンプル</a><a href="${repository}">GitHub ↗</a><button type="button" data-theme aria-label="テーマを切り替える">◐</button><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="sidebar">目次</button></nav></header><div class="layout"><aside id="sidebar" aria-label="ドキュメント">${sidebar}</aside><main id="main" tabindex="-1"><article class="${articleClass}">${body}</article><footer><p>実験段階のAPIです。日本語は導入・主要ガイド、英語は詳細契約・技術記録を掲載しています。<a href="${url("en/index.html")}">Language coverage</a></p><a href="${repository}/blob/main/${page.source}">このページをGitHubで編集 ↗</a><p><a href="${url("LICENSE.txt")}">MIT License</a> · <a href="${url("THIRD-PARTY-NOTICES.txt")}">Third-party notices</a> · <a href="${url("sbom.json")}">Dependency inventory</a></p></footer></main><nav class="on-page" aria-label="このページ"><p>このページ / On this page</p>${env.toc.map((item) => `<a href="#${item.id}">${escapeHtml(item.label)}</a>`).join("")}</nav></div></body></html>`;
  const path = `${stage}/${page.route}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
}
await build({
  configFile: false,
  root: stage,
  base,
  build: {
    outDir: output,
    emptyOutDir: false,
    rollupOptions: { input: pages.map((page) => `${stage}/${page.route}`) },
  },
});
for (const example of examples) {
  await build({
    configFile: false,
    root: resolve("examples", example.id),
    base: url(`play/${example.id}/`),
    build: { outDir: `${output}/play/${example.id}`, emptyOutDir: false },
  });
}
execFileSync(process.execPath, ["scripts/licenses.mjs", "--out", output], {
  stdio: "inherit",
});
writeFileSync(`${output}/.nojekyll`, "");
writeFileSync(
  `${output}/site-manifest.json`,
  `${JSON.stringify({ base, pages: pages.map(({ route, lang }) => ({ route, lang })), examples: examples.map(({ id }) => id) }, null, 2)}\n`,
);
console.log(`Official site built in site-dist with base ${base}`);
