import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { build, preview, createServer as viteServer } from "vite";
import { sdkVersion } from "./sdk-version.mjs";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const output = resolve("test-results/packages");
mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), "simpludify-packed-"));
const registryMode = process.argv.includes("--registry");
const report = {
  mode: registryMode ? "public-registry" : "local-tarballs",
  temporary,
  checks: [],
  packages: [],
};
async function run(command, args, cwd = root) {
  return await new Promise((done, reject) => {
    const executable = command === npm ? process.execPath : command;
    const arguments_ =
      command === npm ? [process.env.npm_execpath, ...args] : args;
    if (arguments_.some((arg) => typeof arg !== "string"))
      throw new Error("Run package validation with npm run test:packages");
    const child = spawn(executable, arguments_, {
      cwd,
      env: { ...process.env, NODE_PATH: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? done(stdout)
        : reject(
            new Error(
              `${command} ${args.join(" ")}: ${code}\n${stdout}\n${stderr}`,
            ),
          ),
    );
  });
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const checks = (message) => {
  report.checks.push(message);
  console.log(`PASS ${message}`);
};
let registry, browser;
try {
  const tarballs = {};
  if (!registryMode) {
    await run(npm, ["run", "build:packages"]);
    for (const name of ["core", "web"]) {
      const packed = JSON.parse(
        await run(npm, [
          "pack",
          `./packages/${name}`,
          "--ignore-scripts",
          "--json",
          "--pack-destination",
          output,
        ]),
      )[0];
      const pkg = JSON.parse(
        readFileSync(`packages/${name}/package.json`, "utf8"),
      );
      assert.equal(pkg.version, sdkVersion);
      assert.equal(pkg.private, undefined);
      const paths = packed.files.map((file) => file.path);
      for (const path of paths)
        assert.match(path, /^(dist\/|package\.json$|README\.md$|LICENSE$)/);
      for (const file of [
        "dist/index.js",
        "dist/index.d.ts",
        "dist/index.js.map",
        "LICENSE",
        "README.md",
      ])
        assert(paths.includes(file));
      assert(
        !paths.some((path) =>
          /(?:test|benchmark|tsconfig|\.tsbuildinfo)/.test(path),
        ),
      );
      if (name === "web") {
        assert(paths.includes("dist/style.css"));
        assert.equal(pkg.dependencies["@simpludify/core"], sdkVersion);
      }
      const map = JSON.parse(
        readFileSync(`packages/${name}/dist/index.js.map`, "utf8"),
      );
      assert.equal(map.sources.length, map.sourcesContent.length);
      assert(map.sourcesContent.every((source) => typeof source === "string"));
      assert(
        map.sources.every(
          (source) =>
            !source.startsWith("/") && !source.includes("node_modules"),
        ),
      );
      const data = readFileSync(join(output, packed.filename));
      assert.equal(
        `sha512-${createHash("sha512").update(data).digest("base64")}`,
        packed.integrity,
      );
      tarballs[name] = {
        pkg,
        data,
        packed,
        path: join(output, packed.filename),
      };
      report.packages.push(packed);
    }
    checks(
      "restricted tarball files, declarations, embedded-source maps and integrity",
    );
  }
  const core = join(temporary, "core-only"),
    web = join(temporary, "web-only");
  for (const directory of [core, web]) {
    mkdirSync(directory);
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        name: "external-sdk-test",
        private: true,
        type: "module",
      }),
    );
  }
  const coreSpec = registryMode
    ? `@simpludify/core@${sdkVersion}`
    : tarballs.core.path;
  await run(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", coreSpec],
    core,
  );
  assert(!existsSync(join(core, "node_modules/@simpludify/web")));
  assert(!existsSync(join(core, "node_modules/pixi.js")));
  const coreProgram = `import {Engine, Actor, Transform, Grid, TileGeometry, Tween, ENGINE_VERSION} from '@simpludify/core';
if (ENGINE_VERSION !== '${sdkVersion}') throw new Error('Wrong packed engine version');
const engine = new Engine(); const actor = new Actor(); actor.add(new Transform()); engine.scene.add(actor); engine.step(1/60); engine.dispose();
if (typeof Grid !== 'function' || !TileGeometry || !Tween) throw new Error('Missing API');\n`;
  writeFileSync(join(core, "main.mjs"), coreProgram);
  writeFileSync(join(core, "main.ts"), coreProgram);
  await run(process.execPath, ["main.mjs"], core);
  await run(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--lib",
      "ES2022",
      "--types",
      "",
      "main.ts",
    ],
    core,
  );
  checks(
    "Core-only tarball install, browser-free Node import/lifecycle and NodeNext public types",
  );
  if (!registryMode) {
    const requested = [];
    registry = createServer((request, response) => {
      requested.push(request.url);
      const path = decodeURIComponent(request.url);
      const name = path.includes("core")
        ? "core"
        : path.includes("web")
          ? "web"
          : undefined;
      if (!name || request.method !== "GET") {
        response.writeHead(404).end();
        return;
      }
      const entry = tarballs[name];
      if (path.endsWith(".tgz")) {
        response.setHeader("Content-Type", "application/octet-stream");
        response.end(entry.data);
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          name: entry.pkg.name,
          "dist-tags": { latest: sdkVersion },
          versions: {
            [sdkVersion]: {
              ...entry.pkg,
              dist: {
                tarball: `http://127.0.0.1:${registry.address().port}/${name}.tgz`,
                integrity: entry.packed.integrity,
              },
            },
          },
        }),
      );
    });
    await new Promise((done) => registry.listen(0, "127.0.0.1", done));
    writeFileSync(
      join(web, ".npmrc"),
      `@simpludify:registry=http://127.0.0.1:${registry.address().port}/\n`,
    );
    await run(
      npm,
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        tarballs.web.path,
      ],
      web,
    );
    assert(
      requested.some((url) =>
        decodeURIComponent(url).includes("@simpludify/core"),
      ),
    );
    report.registryRequests = requested;
  } else
    await run(
      npm,
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        `@simpludify/web@${sdkVersion}`,
      ],
      web,
    );
  const webManifest = JSON.parse(
    readFileSync(join(web, "package.json"), "utf8"),
  );
  assert(!webManifest.dependencies["@simpludify/core"]);
  for (const name of ["core", "web"]) {
    const installed = join(web, "node_modules/@simpludify", name);
    assert(!lstatSync(installed).isSymbolicLink());
    assert(realpathSync(installed).startsWith(temporary));
  }
  await run(npm, ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], web);
  await run(npm, ["ls", "@simpludify/core", "pixi.js", "--all"], web);
  checks(
    "Web-only install resolves packed Core transitively, with physical external dependencies",
  );
  const tooling = JSON.parse(
    readFileSync("package.json", "utf8"),
  ).devDependencies;
  await run(
    npm,
    [
      "install",
      "--save-dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      `vite@${tooling.vite}`,
      `typescript@${tooling.typescript}`,
    ],
    web,
  );
  cpSync("tests/package-fixture", web, { recursive: true });
  writeFileSync(
    join(web, "explicit-css.ts"),
    'import "@simpludify/web/style.css";\n',
  );
  writeFileSync(
    join(web, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        skipLibCheck: false,
        noEmit: true,
      },
      include: ["main.ts", "explicit-css.ts"],
    }),
  );
  await run(
    process.execPath,
    [join(web, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    web,
  );
  checks(
    "Web consumer public declarations typecheck without workspace paths or skipLibCheck",
  );
  await build({
    configFile: false,
    root: web,
    base: "/external-game/",
    build: {
      outDir: join(web, "dist"),
      target: "es2022",
      assetsInlineLimit: 0,
    },
  });
  const assets = readdirSync(join(web, "dist/assets"));
  assert(assets.some((name) => name.endsWith(".svg")));
  assert(
    assets.some(
      (name) =>
        name.endsWith(".css") &&
        readFileSync(join(web, "dist/assets", name), "utf8").includes(
          ".simpludify",
        ),
    ),
  );
  checks(
    "external Vite production subpath build includes scoped CSS and app image asset",
  );
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
    args: [
      "--enable-webgl",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  for (const production of [false, true]) {
    const config = {
      configFile: false,
      root: web,
      base: production ? "/external-game/" : "/",
      server: { host: "127.0.0.1", port: 0 },
      preview: { host: "127.0.0.1", port: 0 },
      build: { outDir: join(web, "dist"), target: "es2022" },
    };
    const server = production
      ? await preview(config)
      : await viteServer(config);
    if (!production) await server.listen();
    try {
      for (const viewport of [
        { width: 1280, height: 720 },
        { width: 390, height: 844 },
        { width: 320, height: 740 },
      ]) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(server.resolvedUrls.local[0]);
        await page.waitForFunction(() => window.packageProbe);
        assert.equal(
          await page
            .locator(".simpludify")
            .evaluate((element) => getComputedStyle(element).position),
          "relative",
        );
        assert.equal(await page.locator(".simpludify > canvas").count(), 1);
        assert.equal(
          await page
            .getByRole("textbox", { name: "Coordinate", exact: true })
            .getAttribute("inputmode"),
          "numeric",
        );
        assert.equal(
          await page
            .locator(".s-canvas-label")
            .filter({ hasText: "Packed SDK" })
            .count(),
          1,
        );
        const diagnostics = await page.evaluate(
          () => window.packageProbe.game.renderer.diagnostics,
        );
        assert.equal(diagnostics.visuals, 2);
        assert.equal(diagnostics.imageEntries, 1);
        assert.equal(diagnostics.imageReferences, 2);
        const initial = await page.evaluate(() => window.packageProbe.x);
        const worldCenter = await page.evaluate(() => {
          const v = window.packageProbe.game.viewport;
          if (v.width <= 0 || v.height <= 0)
            throw new Error("Empty bound world region");
          return { x: v.x + v.width / 2, y: v.y + v.height / 2 };
        });
        await page.locator(".simpludify").click({ position: worldCenter });
        await page.keyboard.down("d");
        await page.waitForFunction(
          (x) => window.packageProbe.x > x + 5,
          initial,
        );
        await page.keyboard.up("d");
        // Pointer and native accessibility both address the same Canvas control.
        const bounds = await page.evaluate(() => window.packageProbe.bounds);
        await page.mouse.click(
          bounds.x + bounds.width / 2,
          bounds.y + bounds.height / 2,
        );
        await page.waitForFunction(
          () =>
            window.packageProbe.clicks === 1 &&
            window.packageProbe.disposals === 1,
        );
        await page
          .getByRole("button", { name: "Next scene", exact: true })
          .focus();
        await page.keyboard.press("Enter");
        await page.waitForFunction(
          () =>
            window.packageProbe.clicks === 2 &&
            window.packageProbe.disposals === 2,
        );
        await page.screenshot({
          path: join(
            output,
            `${production ? "production" : "development"}-${viewport.width}.png`,
          ),
        });
        const state = await page.evaluate(() => {
          const probe = window.packageProbe;
          probe.dispose();
          return {
            disposals: probe.disposals,
            uiDisposed: probe.uiDisposed,
            actors: probe.game.engine.scene.actors.length,
            host: document.querySelectorAll(".simpludify").length,
            renderer: probe.game.renderer.diagnostics,
          };
        });
        assert.equal(state.disposals, 3);
        assert.equal(state.uiDisposed, true);
        assert.equal(state.actors, 0);
        assert.equal(state.host, 0);
        assert.equal(state.renderer.visuals, 0);
        assert.equal(state.renderer.textures, 0);
        assert.equal(state.renderer.presentations, 0);
        assert.equal(state.renderer.imageReferences, 0);
        assert.equal(state.renderer.imageEntries, 0);
        assert.equal(state.renderer.pendingImages, 0);
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await server.close();
    }
    checks(
      `${production ? "production subpath" : "development"}: desktop/narrow rendering, automatic CSS, input, Canvas pointer/keyboard, scene replacement, idempotent cleanup`,
    );
  }
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  await browser?.close();
  await new Promise((done) => (registry ? registry.close(done) : done()));
  writeFileSync(
    join(output, registryMode ? "public-registry.json" : "validation.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
