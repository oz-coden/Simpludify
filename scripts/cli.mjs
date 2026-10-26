#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raw = process.argv.slice(2);
const json = raw.includes("--json");
const args = raw.filter((arg) => arg !== "--json");
const command = args.shift();
function fail(code, message, exitCode = 1) {
  const diagnostic = { code, message };
  if (json)
    console.error(JSON.stringify({ ok: false, diagnostics: [diagnostic] }));
  else console.error(`${code}: ${message}`);
  process.exit(exitCode);
}
function run(bin, values) {
  const result = spawnSync(process.execPath, [join(root, bin), ...values], {
    cwd: root,
    stdio: json ? "pipe" : "inherit",
    encoding: "utf8",
  });
  if (result.error || result.status !== 0)
    fail(
      "COMMAND_FAILED",
      result.error?.message ??
        `${bin} exited ${result.status}${json ? `\n${result.stdout}\n${result.stderr}` : ""}`,
    );
}
function ok(details = {}) {
  if (json)
    console.log(JSON.stringify({ ok: true, diagnostics: [], ...details }));
}
function noArgs() {
  if (args.length)
    fail("INVALID_ARGUMENT", `Unexpected arguments: ${args.join(" ")}`, 2);
}
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--"))
    fail("INVALID_ARGUMENT", `${name} requires a value`, 2);
  args.splice(index, 2);
  return value;
}
try {
  if (command === "check") {
    noArgs();
    run("node_modules/typescript/bin/tsc", ["--noEmit"]);
    run("node_modules/typescript/bin/tsc", [
      "-p",
      "packages/core/tsconfig.json",
    ]);
    run("node_modules/@biomejs/biome/bin/biome", ["check", "."]);
    run("scripts/validate.mjs", []);
    run("scripts/licenses.mjs", ["--check"]);
    ok();
  } else if (command === "test") {
    noArgs();
    run("node_modules/vitest/vitest.mjs", ["run"]);
    ok();
  } else if (command === "doctor") {
    noArgs();
    if (!existsSync(join(root, "node_modules/vite/package.json")))
      fail("DEPENDENCIES_MISSING", "Run npm ci in the project directory");
    const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
    if (major < 22 || (major === 22 && minor < 12))
      fail("NODE_UNSUPPORTED", "Use Node >=22.12");
    ok({
      node: process.versions.node,
      targets: { web: "available", windows: "pending" },
    });
    if (!json)
      console.log(
        `Node ${process.versions.node}; web tooling available. Windows packaging pending.`,
      );
  } else if (command === "dev" || command === "build") {
    const target = option("--target", "web"),
      example = option("--example", "ui-scenes"),
      base = option("--base", "./");
    noArgs();
    if (target !== "web")
      fail(
        "TARGET_UNSUPPORTED",
        `Target ${target} is not implemented; use web`,
        2,
      );
    if (!["character", "ui-scenes", "composition"].includes(example))
      fail(
        "EXAMPLE_NOT_FOUND",
        "Choose character, ui-scenes or composition",
        2,
      );
    if (!(base.startsWith("/") || base.startsWith("./")) || base.includes(".."))
      fail(
        "INVALID_ARGUMENT",
        "Base must start with / or ./ and contain no ..",
        2,
      );
    if (command === "dev" && json)
      fail("INVALID_ARGUMENT", "--json is reserved for finite commands", 2);
    const { createServer, build } = await import("vite");
    const config = {
      configFile: false,
      root: join(root, "examples", example),
      base,
      server: {
        host: "127.0.0.1",
        port: 4173,
        strictPort: true,
        fs: { allow: [root] },
      },
      build: { outDir: join(root, "dist"), emptyOutDir: true },
      logLevel: json ? "silent" : "info",
    };
    if (command === "dev") {
      const server = await createServer(config);
      await server.listen();
      server.printUrls();
    } else {
      await build(config);
      run("scripts/licenses.mjs", ["--out", "dist"]);
      ok({ target, example, output: "dist" });
    }
  } else if (command === "create") {
    const destination = args.shift();
    noArgs();
    if (!destination || destination.startsWith("-"))
      fail("INVALID_ARGUMENT", "Usage: npm run create -- <new-directory>", 2);
    const output = isAbsolute(destination)
      ? destination
      : resolve(process.cwd(), destination);
    if (existsSync(output))
      fail("DESTINATION_EXISTS", "Choose a directory that does not exist", 2);
    mkdirSync(output, { recursive: true });
    for (const path of [
      "third-party",
      "benchmarks",
      "SPEC.md",
      "packages",
      "scripts",
      "examples",
      "tsconfig.json",
      "env.d.ts",
      "biome.json",
      "vitest.config.ts",
      "playwright.config.ts",
      "tests",
      "LICENSE",
      "README.md",
      "docs",
      "AGENTS.md",
      ".gitignore",
      "package-lock.json",
    ]) {
      cpSync(join(root, path), join(output, path), { recursive: true });
    }
    const manifest = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    );
    writeFileSync(
      join(output, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    ok({ output });
    if (!json)
      console.log(
        `Created ${output}\nNext: cd into the directory, run npm ci, then npm run dev.`,
      );
  } else
    fail(
      "INVALID_ARGUMENT",
      "Commands: create <directory>, dev, check, test, build --target web, doctor [--json]",
      2,
    );
} catch (error) {
  fail(
    "COMMAND_FAILED",
    error instanceof Error ? error.message : String(error),
  );
}
