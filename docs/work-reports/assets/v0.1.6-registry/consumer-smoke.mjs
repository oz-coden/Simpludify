// Run from a 0.1.6 source checkout with npm ci; the engine itself comes only from npm.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../../../..");
const consumer = mkdtempSync(join(tmpdir(), "simpludify-registry-bindings-"));
const run = (command, args, cwd, env = process.env) =>
  new Promise((done, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });
    child.stderr.on("data", (data) => {
      output += data;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? done(output) : reject(new Error(output)),
    );
  });
const report = {
  mode: "public-registry-bindings-consumer",
  consumer,
  packages: [],
  checks: [],
};
let server, browser;
try {
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "@simpludify/core@0.1.6",
      "@simpludify/web@0.1.6",
    ],
    consumer,
  );
  for (const name of ["core", "web"]) {
    const pkg = JSON.parse(
      readFileSync(
        join(consumer, `node_modules/@simpludify/${name}/package.json`),
        "utf8",
      ),
    );
    const lock = JSON.parse(
      readFileSync(join(consumer, "package-lock.json"), "utf8"),
    ).packages[`node_modules/@simpludify/${name}`];
    assert.equal(pkg.version, "0.1.6");
    assert.match(lock.resolved, /^https:\/\/registry\.npmjs\.org\//);
    report.packages.push({
      name: pkg.name,
      version: pkg.version,
      resolved: lock.resolved,
      integrity: lock.integrity,
    });
  }
  const target = join(consumer, "play/input-bindings");
  mkdirSync(target, { recursive: true });
  mkdirSync(join(consumer, "play/shared"), { recursive: true });
  cpSync(
    join(root, "examples/input-bindings/index.html"),
    join(target, "index.html"),
  );
  cpSync(
    join(root, "examples/shared/start.ts"),
    join(consumer, "play/shared/start.ts"),
  );
  // HMR is source-tooling-only; all game code and public SDK imports are unchanged.
  const main = readFileSync(
    join(root, "examples/input-bindings/main.ts"),
    "utf8",
  ).replace(
    "if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());",
    "",
  );
  writeFileSync(
    join(target, "main.ts"),
    main +
      "\nObject.assign(window, { registryBindingLab: { game, Actions, get current() { return current; }, get capture() { return capture; }, get lastCapture() { return lastCapture; } } });\n",
  );
  writeFileSync(
    join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        strict: true,
        noEmit: true,
        types: [],
      },
      include: ["play/**/*.ts"],
    }),
  );
  await run(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      join(consumer, "tsconfig.json"),
    ],
    consumer,
  );
  report.checks.push(
    "Strict public declarations; no workspace aliases or engine source imports",
  );
  const { build, preview } = await import(
    pathToFileURL(join(root, "node_modules/vite/dist/node/index.js")).href
  );
  await build({
    root: consumer,
    configFile: false,
    base: "/verify/",
    logLevel: "error",
    build: { rollupOptions: { input: join(target, "index.html") } },
  });
  report.checks.push("Production subpath build from public Core/Web 0.1.6");
  server = await preview({
    root: consumer,
    configFile: false,
    base: "/verify/",
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");

  const { chromium } = await import(
    pathToFileURL(join(root, "node_modules/playwright/index.mjs")).href
  );
  browser = await chromium.launch({
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
  report.browser = browser.version();
  report.cases = [];
  for (const width of [1440, 390]) {
    for (const fallback of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript((fallback) => {
        if (fallback) {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const proto of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!proto) continue;
            const get = proto.getContext;
            proto.getContext = function (kind, ...args) {
              return String(kind).includes("webgl")
                ? null
                : Reflect.apply(get, this, [kind, ...args]);
            };
          }
        }
        window.registryPad = {
          index: 0,
          id: "Registry test pad",
          connected: true,
          mapping: "standard",
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({
            value: 0,
            pressed: false,
          })),
        };
        Object.defineProperty(navigator, "getGamepads", {
          value: () => [window.registryPad],
        });
      }, fallback);
      const origin = `http://127.0.0.1:${address.port}/verify/`;
      assert.equal(
        (
          await page.goto(
            new URL("play/input-bindings/index.html", origin).href,
          )
        ).status(),
        200,
      );
      await page.waitForFunction(
        () =>
          window.registryBindingLab?.current &&
          window.registryBindingLab.game.engine.scene.state === "active",
      );
      await page.locator(".simpludify").focus();
      const state = () =>
        page.evaluate(() => {
          const {
            game,
            current: c,
            Actions: a,
            capture,
          } = window.registryBindingLab;
          game.engine.step(0);
          return {
            jump: c.controls.value(a.Jump),
            attack: c.controls.value(a.Attack),
            capture: capture?.state,
          };
        });
      const roundTrip = await page.evaluate(() => {
        const { current: c, Actions: a } = window.registryBindingLab,
          actor = c.actor;
        const saved = c.controls.exportBindings();
        c.controls.rebind(a.Jump, {});
        c.controls.importBindings(saved);
        c.controls.addBindings(a.Attack, {
          keys: ["Space"],
          gamepad: { buttons: [0] },
        });
        return {
          sameActor: actor === c.actor,
          saved:
            JSON.stringify(c.controls.getBinding(a.Jump)) ===
            JSON.stringify(saved.bindings.Jump),
          conflicts: c.controls.conflicts("all").length,
        };
      });
      assert(roundTrip.sameActor && roundTrip.saved && roundTrip.conflicts > 0);
      await state();
      await page.keyboard.down("Space");
      assert.deepEqual(await state(), {
        jump: true,
        attack: true,
        capture: undefined,
      });
      await page.evaluate(() => {
        window.registryPad.buttons[0] = { value: 1, pressed: true };
      });
      await state();
      await page.keyboard.up("Space");
      assert((await state()).jump);
      await page.evaluate(() => {
        window.registryPad.buttons[0] = { value: 0, pressed: false };
      });
      assert.equal((await state()).jump, false);
      const point = await page.evaluate(() => {
        const { game, current: c, Actions: a } = window.registryBindingLab;
        c.controls.rebind(a.Jump, { mouse: [0, 2] });
        const r = game.element.getBoundingClientRect(),
          v = game.view.clip;
        return {
          x:
            r.left +
            ((v.x + v.width * 0.55) * r.width) / game.element.clientWidth,
          y:
            r.top +
            ((v.y + v.height * 0.72) * r.height) / game.element.clientHeight,
        };
      });
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      assert((await state()).jump);
      await page.mouse.down({ button: "right" });
      await page.mouse.up();
      assert((await state()).jump);
      await page.mouse.up({ button: "right" });
      assert.equal((await state()).jump, false);
      await page
        .getByRole("button", { name: "Capture Jump input", exact: true })
        .focus();
      await page.keyboard.down("Enter");
      assert.equal((await state()).capture, "arming");
      await page.keyboard.press("r");
      assert.equal((await state()).capture, "arming");
      await page.keyboard.up("Enter");
      assert.equal((await state()).capture, "listening");
      await page.keyboard.down("Shift");
      await page.waitForFunction(
        () => window.registryBindingLab.lastCapture?.code === "ShiftLeft",
      );
      assert.equal((await state()).jump, false);
      await page.keyboard.up("Shift");
      await page.keyboard.down("Shift");
      assert((await state()).jump);
      await page.keyboard.up("Shift");
      await page.evaluate(() => {
        window.registryBindingLab.current.begin(["mouse"]);
      });
      const exposed = await page.evaluate(() => {
        const r =
          window.registryBindingLab.game.element.getBoundingClientRect();
        return { x: r.right - 12, y: r.bottom - 12 };
      });
      assert.equal(
        await page.evaluate(
          (p) => document.elementFromPoint(p.x, p.y)?.tagName,
          exposed,
        ),
        "CANVAS",
      );
      await page.mouse.move(exposed.x, exposed.y);
      await page.mouse.down({ button: "right" });
      await page.waitForFunction(
        () => window.registryBindingLab.lastCapture?.device === "mouse",
      );
      assert.equal(
        await page.evaluate(() => window.registryBindingLab.lastCapture.button),
        2,
      );
      await page.mouse.up({ button: "right" });
      await page.evaluate(() => {
        window.registryPad.buttons[0] = { value: 1, pressed: true };
        window.registryBindingLab.current.begin(["gamepad"]);
      });
      assert.equal((await state()).capture, "arming");
      await page.evaluate(() => {
        window.registryPad.buttons[0] = { value: 0, pressed: false };
      });
      assert.equal((await state()).capture, "listening");
      await page.evaluate(() => {
        window.registryPad.buttons[1] = { value: 1, pressed: true };
      });
      await state();
      await page.waitForFunction(
        () => window.registryBindingLab.lastCapture?.device === "gamepad",
      );
      assert.equal((await state()).jump, false);
      await page.evaluate(() => {
        window.registryPad.buttons[1] = { value: 0, pressed: false };
      });
      await state();
      await page.evaluate(() => {
        window.registryPad.buttons[1] = { value: 1, pressed: true };
      });
      assert((await state()).jump);
      await page.evaluate(() => {
        window.registryPad.buttons[1] = { value: 0, pressed: false };
      });
      await state();
      const cleanup = await page.evaluate(async () => {
        const { game, current: old, Actions: a } = window.registryBindingLab;
        old.program.set(a.Jump, true);
        const session = old.begin(["keyboard"]);
        game.engine.step(0);
        const programHeld = old.controls.value(a.Jump);
        session.cancel();
        await game.goTo("play");
        const oldDisposed = old.controls.disposed;
        game.dispose();
        game.dispose();
        return {
          programHeld,
          oldDisposed,
          sources: game.engine.input.sourceCount,
          hosts: document.querySelectorAll(".simpludify").length,
          captures: game.pointerDiagnostics.captures,
        };
      });
      assert.deepEqual(cleanup, {
        programHeld: true,
        oldDisposed: true,
        sources: 0,
        hosts: 0,
        captures: 0,
      });
      assert.deepEqual(errors, []);
      report.cases.push({
        width,
        renderer: fallback ? "canvas2d" : "webgl",
        roundTrip,
        cleanup,
        errors,
      });
      await page.close();
    }
  }
  report.checks.push(
    "Public-registry production lab: shared keyboard/pad OR, held mouse buttons, runtime persistence, native opener neutral arming, keyboard/mouse/pad capture and fresh-input rearming, program preservation and terminal cleanup",
  );
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = String(error.stack ?? error);
  throw error;
} finally {
  await browser?.close();
  await server?.close();
  mkdirSync(join(root, "test-results/packages"), { recursive: true });
  writeFileSync(
    join(root, "test-results/packages/bindings-registry.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report));
}
