import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pages } from "../site/config.mjs";

// Mark complete, independently compilable examples with a `ts verify` fence.
// Partial snippets remain explicitly contextual examples, not false standalone fixtures.
export function checkSnippets() {
  const folder = resolve(".site-build/snippets");
  mkdirSync(folder, { recursive: true });
  const files = [],
    origins = new Map();
  for (const source of new Set([
    "README.md",
    ...pages.map((page) => page.source),
  ])) {
    const text = readFileSync(source, "utf8");
    for (const match of text.matchAll(/```ts verify\n([\s\S]*?)\n```/g)) {
      const file = `${folder}/example-${files.length}.ts`;
      writeFileSync(file, match[1]);
      origins.set(
        file,
        `${source}:${text.slice(0, match.index).split("\n").length}`,
      );
      files.push(file);
    }
  }
  assert(
    files.length >= 5,
    "Standalone documentation fixtures must not disappear silently",
  );
  const config = `${folder}/tsconfig.json`;
  writeFileSync(
    config,
    JSON.stringify(
      {
        extends: resolve("tsconfig.json"),
        compilerOptions: { noUnusedLocals: false, noUnusedParameters: false },
        files: [resolve("env.d.ts"), ...files],
        include: [],
      },
      null,
      2,
    ),
  );
  try {
    execFileSync(
      process.execPath,
      ["node_modules/typescript/bin/tsc", "-p", config],
      { stdio: "inherit" },
    );
  } catch {
    console.error("Source examples:", Object.fromEntries(origins));
    throw new Error("Documentation code examples do not typecheck");
  }
  console.log(`Standalone documentation examples typechecked: ${files.length}`);
}
