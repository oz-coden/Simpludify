import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("documentation site features", () => {
  const root = resolve("site-dist");

  it("manifest and key output pages exist", () => {
    assert(existsSync(resolve(root, "site-manifest.json")));
    assert(existsSync(resolve(root, "index.html")));
    assert(existsSync(resolve(root, "getting-started.html")));
    assert(existsSync(resolve(root, "en/index.html")));
    assert(existsSync(resolve(root, "en/getting-started.html")));
    assert(existsSync(resolve(root, "en/examples.html")));
  });

  it("renders Shiki syntax highlighting and copy buttons on code blocks", () => {
    const html = readFileSync(resolve(root, "getting-started.html"), "utf8");
    expect(html).toContain('class="shiki');
    expect(html).toContain("data-copy-code");
    expect(html).toContain('class="code-block"');
    expect(html).toContain("--shiki-light");
    expect(html).toContain("--shiki-dark");
  });

  it("separates navigation so Japanese pages do not display English guides in sidebar", () => {
    const html = readFileSync(resolve(root, "getting-started.html"), "utf8");
    const sidebar = html.split('<aside id="sidebar"')[1]?.split("</aside>")[0];
    assert(sidebar, "Sidebar must exist");

    // English guides should NOT appear in Japanese sidebar
    expect(sidebar).not.toContain('href="/Simpludify/en/api.html"');
    expect(sidebar).not.toContain('href="/Simpludify/en/getting-started.html"');
    expect(sidebar).not.toContain('href="/Simpludify/en/architecture.html"');

    // Japanese pages should appear
    expect(sidebar).toContain('href="/Simpludify/getting-started.html"');
    expect(sidebar).toContain('href="/Simpludify/api.html"');
    expect(sidebar).toContain('href="/Simpludify/architecture.html"');

    // English-only fallback documents should appear under fallback section
    expect(sidebar).toContain("技術資料 (英語)");
    expect(sidebar).toContain('href="/Simpludify/en/scroll-performance.html"');
    expect(sidebar).toContain('class="lang-tag"');
  });

  it("separates navigation so English pages contain only English pages in sidebar", () => {
    const html = readFileSync(resolve(root, "en/getting-started.html"), "utf8");
    const sidebar = html.split('<aside id="sidebar"')[1]?.split("</aside>")[0];
    assert(sidebar, "Sidebar must exist");

    // Japanese pages should NOT appear in English sidebar
    expect(sidebar).not.toContain('href="/Simpludify/getting-started.html"');
    expect(sidebar).not.toContain('href="/Simpludify/api.html"');
    expect(sidebar).not.toContain('href="/Simpludify/architecture.html"');
    expect(sidebar).not.toContain("はじめに");
    expect(sidebar).not.toContain("ガイド");

    // English pages should appear
    expect(sidebar).toContain('href="/Simpludify/en/getting-started.html"');
    expect(sidebar).toContain('href="/Simpludify/en/api.html"');
    expect(sidebar).toContain('href="/Simpludify/en/architecture.html"');
    expect(sidebar).toContain("Getting started");
    expect(sidebar).toContain("Guides");
    expect(sidebar).toContain("Engineering records");
  });

  it("displays fallback banner on English-only technical records", () => {
    const fallbackHtml = readFileSync(
      resolve(root, "en/scroll-performance.html"),
      "utf8",
    );
    expect(fallbackHtml).toContain('class="language-fallback-banner"');
    expect(fallbackHtml).toContain("この技術資料は英語版のみ提供されています");

    // Language toggle should go back to Japanese index without dead-ending
    expect(fallbackHtml).toContain(
      'data-language-link href="/Simpludify/index.html"',
    );
  });

  it("does not display fallback banner on paired pages", () => {
    const jaHtml = readFileSync(resolve(root, "getting-started.html"), "utf8");
    const enHtml = readFileSync(
      resolve(root, "en/getting-started.html"),
      "utf8",
    );
    expect(jaHtml).not.toContain('class="language-fallback-banner"');
    expect(enHtml).not.toContain('class="language-fallback-banner"');
  });

  it("preserves language continuity on brand logo, header links, and footer", () => {
    const jaHtml = readFileSync(resolve(root, "getting-started.html"), "utf8");
    const enHtml = readFileSync(
      resolve(root, "en/getting-started.html"),
      "utf8",
    );

    // Brand logo
    expect(jaHtml).toContain('class="brand" href="/Simpludify/index.html"');
    expect(enHtml).toContain('class="brand" href="/Simpludify/en/index.html"');

    // Header nav links
    expect(jaHtml).toContain('href="/Simpludify/getting-started.html"');
    expect(jaHtml).toContain('href="/Simpludify/examples.html"');
    expect(enHtml).toContain('href="/Simpludify/en/getting-started.html"');
    expect(enHtml).toContain('href="/Simpludify/en/examples.html"');

    // Language toggle links
    expect(jaHtml).toContain(
      'data-language-link href="/Simpludify/en/getting-started.html"',
    );
    expect(enHtml).toContain(
      'data-language-link href="/Simpludify/getting-started.html"',
    );
  });
});
