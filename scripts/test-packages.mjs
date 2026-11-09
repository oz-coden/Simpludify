import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { build, preview, createServer as viteServer } from "vite";
import {
  assertInstalledSdk,
  candidateDirectory,
  installFlags,
  publicRegistry,
  publicSdkUrl,
  readCandidate,
  sdkNames,
  writeSdkRegistry,
} from "./sdk-candidate.mjs";
import { sdkVersion } from "./sdk-version.mjs";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);
const output = candidateDirectory;
mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), "simpludify-packed-"));
const registryMode = process.argv.includes("--registry");
const cache = registryMode
  ? ["--cache", join(temporary, "registry-cache")]
  : [];
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
  if (!registryMode && !process.argv.includes("--packed"))
    await run(npm, ["run", "pack:packages"]);
  const tarballs = registryMode ? undefined : readCandidate();
  if (tarballs) {
    for (const name of sdkNames) {
      const { packed } = tarballs[name];
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
      report.packages.push(packed);
    }
    checks("restricted tarball files, declarations and integrity");
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
  if (registryMode) {
    for (const project of [core, web])
      writeSdkRegistry(project, publicRegistry);
  }
  const coreSpec = registryMode
    ? `@simpludify/core@${sdkVersion}`
    : tarballs.core.path;
  await run(
    npm,
    ["install", "--ignore-scripts", ...installFlags, ...cache, coreSpec],
    core,
  );
  assert(!existsSync(join(core, "node_modules/@simpludify/web")));
  assert(!existsSync(join(core, "node_modules/pixi.js")));
  const coreProgram = `import {Engine, Actor, Transform, Grid, TileGeometry, Tween, ENGINE_VERSION, Action, ActionController, defineActions, ScenePointer, VirtualInput, VirtualRegions, PointerRouting, screenPoint, worldPoint, InputCapture, InputCaptureState, InputDevice, MouseButton} from '@simpludify/core';
if (ENGINE_VERSION !== '${sdkVersion}') throw new Error('Wrong packed engine version');
const engine = new Engine(); const actor = new Actor(); actor.add(new Transform()); engine.scene.add(actor);
const A = defineActions({Move:Action.axis2D()}); const controls = new ActionController(A,{scene:engine.scene,input:engine.input});
const pointer = new ScenePointer(engine.scene), virtual = new VirtualInput(pointer,engine.input), routing = new PointerRouting();
const stick = virtual.stick(controls,A.Move,{region:VirtualRegions.Left,position:{space:'screen',x:10,y:10},radius:10,deadZone:0});
routing.setScene(pointer);engine.step(0);
const down = {pointerId:1,pointerType:'mouse',button:0,buttons:1,screen:screenPoint(10,10),world:worldPoint(10,10),inside:true};
routing.down(down);routing.move({...down,screen:screenPoint(20,10)});engine.step(1/60);
if(controls.value(A.Move).x !== 1) throw new Error('Packed virtual Action not sampled');
routing.cancel(1,false);engine.step(0);if(controls.value(A.Move).x !== 0) throw new Error('Packed virtual input retained');
engine.dispose();if(!stick.disposed || !virtual.disposed) throw new Error('Packed virtual lifetime retained');
const capture = new InputCapture({devices:[InputDevice.Mouse]});capture.arm();capture.accept({device:InputDevice.Mouse,button:MouseButton.Back});const captured = await capture.result;
if(capture.state !== InputCaptureState.Completed || captured?.binding.mouse?.[0] !== 3) throw new Error('Packed capture missing');
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
  const coreEntry = JSON.parse(
    readFileSync(join(core, "package-lock.json"), "utf8"),
  ).packages["node_modules/@simpludify/core"];
  assert.equal(coreEntry.version, sdkVersion);
  assert(
    !lstatSync(join(core, "node_modules/@simpludify/core")).isSymbolicLink(),
  );
  if (tarballs)
    assert.equal(coreEntry.integrity, tarballs.core.packed.integrity);
  else assert.equal(coreEntry.resolved, publicSdkUrl("core"));
  checks(
    "Core-only install, browser-free Node import/lifecycle and NodeNext public types",
  );
  let candidateRegistry;
  if (tarballs) {
    const requested = [];
    registry = createServer((request, response) => {
      requested.push(request.url);
      const path = decodeURIComponent(request.url);
      const name = sdkNames.find(
        (name) => path === `/@simpludify/${name}` || path === `/${name}.tgz`,
      );
      if (!name || request.method !== "GET") {
        response.writeHead(404).end();
        return;
      }
      const entry = tarballs[name];
      const pkg = JSON.parse(
        readFileSync(`packages/${name}/package.json`, "utf8"),
      );
      if (path.endsWith(".tgz")) {
        response.setHeader("Content-Type", "application/octet-stream");
        response.end(entry.data);
        return;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          name: pkg.name,
          "dist-tags": { latest: sdkVersion },
          versions: {
            [sdkVersion]: {
              ...pkg,
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
    candidateRegistry = `http://127.0.0.1:${registry.address().port}`;
    writeSdkRegistry(web, `${candidateRegistry}/`);
    await run(
      npm,
      [
        "install",
        "--ignore-scripts",
        ...installFlags,
        ...cache,
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
        ...installFlags,
        ...cache,
        `@simpludify/web@${sdkVersion}`,
      ],
      web,
    );
  const webManifest = JSON.parse(
    readFileSync(join(web, "package.json"), "utf8"),
  );
  assert(!webManifest.dependencies["@simpludify/core"]);
  await run(npm, ["ci", "--ignore-scripts", ...installFlags, ...cache], web);
  const webLock = JSON.parse(
    readFileSync(join(web, "package-lock.json"), "utf8"),
  );
  assertInstalledSdk(web, {
    resolved: (name) =>
      registryMode
        ? publicSdkUrl(name)
        : name === "core"
          ? `${candidateRegistry}/core.tgz`
          : webLock.packages[""].dependencies["@simpludify/web"],
    ...(tarballs
      ? { integrity: (name) => tarballs[name].packed.integrity }
      : {}),
  });
  for (const name of sdkNames) {
    const map = JSON.parse(
      readFileSync(
        join(web, `node_modules/@simpludify/${name}/dist/index.js.map`),
        "utf8",
      ),
    );
    assert.equal(map.sources.length, map.sourcesContent.length);
    assert(map.sourcesContent.every((source) => typeof source === "string"));
    assert(
      map.sources.every(
        (source) => !source.startsWith("/") && !source.includes("node_modules"),
      ),
    );
  }
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
      ...installFlags,
      ...cache,
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
        await page.addInitScript(() => {
          window.consumerPad = {
            index: 0,
            id: "Consumer pad",
            connected: true,
            mapping: "standard",
            axes: [0, 0],
            buttons: [{ value: 0, pressed: false }],
          };
          Object.defineProperty(navigator, "getGamepads", {
            value: () => [window.consumerPad],
          });
        });
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
            .getByRole("heading", { name: "Packed SDK", level: 1 })
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
        assert.equal(
          await page.evaluate(() => window.packageProbe.roundTrip()),
          true,
        );
        await page.mouse.move(worldCenter.x, worldCenter.y);
        await page.mouse.down();
        assert.equal(await page.evaluate(() => window.packageProbe.jump), true);
        await page.mouse.up();
        await page.keyboard.down("Space");
        await page.evaluate(() => {
          window.consumerPad.buttons[0] = { value: 1, pressed: true };
          window.packageProbe.game.engine.step(0);
        });
        await page.keyboard.up("Space");
        assert.equal(await page.evaluate(() => window.packageProbe.jump), true);
        await page.evaluate(() => {
          window.consumerPad.buttons[0] = { value: 0, pressed: false };
          window.packageProbe.game.engine.step(0);
        });
        await page.evaluate(() => window.packageProbe.beginCapture());
        await page.keyboard.down("Control");
        assert.equal(
          (await page.evaluate(() => window.packageProbe.readCapture())).code,
          "ControlLeft",
        );
        assert.equal(
          await page.evaluate(() => window.packageProbe.jump),
          false,
        );
        await page.keyboard.up("Control");
        await page.keyboard.down("Control");
        assert.equal(await page.evaluate(() => window.packageProbe.jump), true);
        await page.keyboard.up("Control");
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
            virtualDisposed: probe.virtualDisposed,
            actors: probe.game.engine.scene.actors.length,
            host: document.querySelectorAll(".simpludify").length,
            renderer: probe.game.renderer.diagnostics,
          };
        });
        assert.equal(state.disposals, 3);
        assert.equal(state.uiDisposed, true);
        assert.equal(state.virtualDisposed, true);
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
