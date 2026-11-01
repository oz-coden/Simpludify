import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const selected = process.argv.slice(2);
if (selected.some((name) => !["core", "web"].includes(name)))
  throw new Error("Usage: node scripts/build-packages.mjs [core|web]");
const targets = selected.length ? selected : ["core", "web"];
function declarations(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) declarations(path);
    else if (path.endsWith(".d.ts")) {
      const source = readFileSync(path, "utf8");
      // Emitted declarations contain only static from/import-type specifiers.
      const result = source.replace(
        /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.[^"']+)\2/g,
        (match, prefix, quote, specifier) => {
          if (specifier.endsWith(".js")) return match;
          const suffix = existsSync(resolve(dirname(path), `${specifier}.d.ts`))
            ? ".js"
            : "/index.js";
          if (
            !existsSync(
              resolve(
                dirname(path),
                suffix === ".js"
                  ? `${specifier}.d.ts`
                  : `${specifier}/index.d.ts`,
              ),
            )
          )
            throw new Error(`Unresolved declaration: ${path}: ${specifier}`);
          return `${prefix}${quote}${specifier}${suffix}${quote}`;
        },
      );
      writeFileSync(path, result);
    }
  }
}
for (const name of targets) {
  const directory = `packages/${name}`;
  rmSync(`${directory}/dist`, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "-p",
      `${directory}/tsconfig.build.json`,
    ],
    { stdio: "inherit" },
  );
  declarations(`${directory}/dist`);
  await build({
    configFile: false,
    build: {
      target: "es2022",
      outDir: `${directory}/dist`,
      emptyOutDir: false,
      sourcemap: true,
      minify: false,
      lib: {
        entry: `${directory}/src/index.ts`,
        formats: ["es"],
        fileName: "index",
        cssFileName: "style",
      },
      rollupOptions: {
        external: (id) =>
          id === "@simpludify/core" ||
          id === "pixi.js" ||
          id.startsWith("pixi.js/"),
        output: name === "web" ? { banner: 'import "./style.css";' } : {},
      },
    },
  });
  if (name === "web")
    writeFileSync(`${directory}/dist/style.css.d.ts`, "export {};\n");
  cpSync("LICENSE", `${directory}/LICENSE`);
}
