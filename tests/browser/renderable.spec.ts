import { expect, test } from "@playwright/test";

const fixtureURL = `/@fs/${process.cwd()}/tests/browser/renderable-fixture.ts`;
for (const fallback of [false, true]) {
  test.describe(fallback ? "live Canvas2D" : "live WebGL", () => {
    test.beforeEach(async ({ page }) => {
      if (fallback)
        await page.addInitScript(() => {
          Object.defineProperty(navigator, "gpu", { get: () => undefined });
          for (const prototype of [
            HTMLCanvasElement.prototype,
            typeof OffscreenCanvas === "undefined"
              ? undefined
              : OffscreenCanvas.prototype,
          ]) {
            if (!prototype) continue;
            const get = prototype.getContext;
            prototype.getContext = function (
              this: HTMLCanvasElement | OffscreenCanvas,
              kind: string,
              ...args: unknown[]
            ) {
              return kind.includes("webgl")
                ? null
                : Reflect.apply(get, this, [kind, ...args]);
            } as typeof prototype.getContext;
          }
        });
      await page.goto("/");
      await page.waitForFunction(() => !!window.demo);
    });
    test("updates real pixels while retaining Renderable, dependencies and display objects", async ({
      page,
    }) => {
      const result = await page.evaluate(async (url) => {
        const { fixture, imageURL } = (await import(
          url
        )) as typeof import("./renderable-fixture");
        const { Actor, Transform, Renderable, Shape, SpriteFit } =
          (await import(url)) as typeof import("./renderable-fixture");
        const f = await fixture();
        const { game, view, pixel } = f;
        const original = f.display(),
          sceneRevision = game.engine.scene.revision;
        const initial = pixel();
        view.color = 0x00ff00;
        const green = pixel();
        view.width = 120;
        const wider = pixel(250, 150);
        view.height = 80;
        const taller = pixel(200, 180);
        view.source = { kind: "shape", shape: Shape.Circle };
        const corner = pixel(230, 180);
        view.source = { kind: "shape", shape: Shape.Triangle };
        const tip = pixel(200, 120);
        const sameGraphics = f.display() === original;
        view.source = { kind: "image", url: imageURL("white") };
        const retainedShape = pixel();
        view.color = 0xffffff;
        await game.whenReady();
        const white = pixel(),
          sprite = f.display();
        let loads = 0;
        const load = f.internal.image.bind(f.internal);
        f.internal.image = (...args) => {
          loads++;
          return load(...args);
        };
        view.color = 0x804020;
        const tinted = pixel();
        view.width = 80;
        view.height = 80;
        const containOutside = pixel(200, 180);
        view.source = {
          kind: "image",
          url: imageURL("white"),
          fit: SpriteFit.Stretch,
        };
        const stretch = pixel(200, 180);
        const rev = view.revision;
        view.source = {
          kind: "image",
          url: imageURL("white"),
          fit: SpriteFit.Stretch,
        };
        await game.whenReady();
        const noOp = view.revision === rev;
        const sameSprite = f.display() === sprite;
        view.opacity = 0.5;
        const alpha = pixel();
        view.visible = false;
        const hidden = pixel();
        view.visible = true;
        view.opacity = 1;
        const stableStructure = sceneRevision === game.engine.scene.revision;
        const blue = game.add(new Actor());
        blue.add(new Transform({ x: 200, y: 150 }));
        const back = blue.add(
          new Renderable({
            width: 100,
            height: 100,
            color: 0x0000ff,
            zIndex: -1,
          }),
        );
        const front = pixel();
        back.zIndex = 2;
        const raised = pixel();
        view.zIndex = 3;
        const restored = pixel();
        blue.dispose();
        view.source = { kind: "shape", shape: Shape.Box };
        view.color = 0xff0000;
        const shapeAgain = pixel();
        const held = {
          sameView: f.actor.require(Renderable.type) === view,
          dependent: f.observer.view === view && !f.observer.disposed,
          structureUnchanged: stableStructure,
        };
        const current = game.engine.scene.revision;
        view.width = 90;
        view.color = 0x334455;
        pixel();
        const noStructureChange = current === game.engine.scene.revision;
        game.dispose();
        return {
          initial,
          green,
          wider,
          taller,
          corner,
          tip,
          sameGraphics,
          retainedShape,
          white,
          tinted,
          containOutside,
          stretch,
          noOp,
          sameSprite,
          loads,
          alpha,
          hidden,
          front,
          raised,
          restored,
          shapeAgain,
          held,
          noStructureChange,
          resources: f.renderer.diagnostics,
        };
      }, fixtureURL);
      expect(result.initial).toEqual([255, 0, 0]);
      expect(result.green).toEqual([0, 255, 0]);
      expect(result.wider).toEqual([0, 255, 0]);
      expect(result.taller).toEqual([0, 255, 0]);
      expect(result.corner).toEqual([0, 0, 0]);
      expect(result.tip).toEqual([0, 255, 0]);
      expect(result.sameGraphics).toBe(true);
      expect(result.retainedShape).toEqual([0, 255, 0]);
      expect(result.white).toEqual([255, 255, 255]);
      expect(result.tinted).toEqual([128, 64, 32]);
      expect(result.containOutside).toEqual([0, 0, 0]);
      expect(result.stretch).toEqual([128, 64, 32]);
      expect(result.sameSprite).toBe(true);
      expect(result.loads).toBe(0);
      expect(result.noOp).toBe(true);
      expect(result.alpha[0]).toBeGreaterThanOrEqual(63);
      expect(result.alpha[0]).toBeLessThanOrEqual(65);
      expect(result.hidden).toEqual([0, 0, 0]);
      expect(result.front).toEqual([128, 64, 32]);
      expect(result.raised).toEqual([0, 0, 255]);
      expect(result.restored).toEqual([128, 64, 32]);
      expect(result.shapeAgain).toEqual([255, 0, 0]);
      expect(
        result.held.sameView &&
          result.held.dependent &&
          result.noStructureChange,
      ).toBe(true);
      expect(result.resources).toEqual({
        presentations: 0,
        visuals: 0,
        textures: 0,
        pendingImages: 0,
      });
    });
    test("retains the old display, ignores late completions and follows latest requests", async ({
      page,
    }) => {
      const result = await page.evaluate(async (url) => {
        const { fixture, imageURL } = (await import(
          url
        )) as typeof import("./renderable-fixture");
        const f = await fixture();
        const { game, view, pixel } = f;
        view.color = 0xffffff;
        view.source = { kind: "image", url: imageURL("red") };
        await game.whenReady();
        const a = pixel();
        const sprite = f.display();
        const original = f.internal.image.bind(f.internal);
        const gates = new Map<string, () => void>();
        const acquired = new Set<string>();
        f.internal.image = async (url, signal) => {
          const resource = await original(url, signal);
          if (url === imageURL("blue") || url === imageURL("yellow")) {
            await new Promise<void>((resolve) => {
              gates.set(url, resolve);
              acquired.add(url);
            });
          }
          return resource;
        };
        view.source = { kind: "image", url: imageURL("blue") };
        let settled = false;
        const waiting = game.whenReady().then(() => {
          settled = true;
        });
        while (!acquired.has(imageURL("blue")))
          await new Promise(requestAnimationFrame);
        const whileLoading = pixel();
        view.source = { kind: "image", url: imageURL("lime") };
        await game.whenReady();
        await waiting;
        const c = pixel();
        gates.get(imageURL("blue"))?.();
        await new Promise(requestAnimationFrame);
        const afterLate = pixel();
        const reused = f.display() === sprite;
        view.source = { kind: "image", url: "./missing-live.png" };
        let failure = "";
        try {
          await game.whenReady();
        } catch (e) {
          failure = (e as { code: string }).code;
        }
        const retained = pixel();
        const active = game.engine.scene.state;
        view.source = { kind: "image", url: imageURL("cyan") };
        await game.whenReady();
        const recovered = pixel();
        view.source = { kind: "image", url: imageURL("yellow") };
        const cancelled = game.whenReady().then(
          () => "ready",
          (e) => (e as { code: string }).code,
        );
        while (!acquired.has(imageURL("yellow")))
          await new Promise(requestAnimationFrame);
        game.dispose();
        const cancellation = await cancelled;
        gates.get(imageURL("yellow"))?.();
        await new Promise(requestAnimationFrame);
        return {
          a,
          whileLoading,
          c,
          afterLate,
          reused,
          settled,
          failure,
          retained,
          active,
          recovered,
          cancellation,
          errors: f.errors,
          resources: f.renderer.diagnostics,
        };
      }, fixtureURL);
      expect(result.a).toEqual([255, 0, 0]);
      expect(result.whileLoading).toEqual([255, 0, 0]);
      expect(result.c).toEqual([0, 255, 0]);
      expect(result.afterLate).toEqual([0, 255, 0]);
      expect(result.reused && result.settled).toBe(true);
      expect(result.failure).toBe("ASSET_LOAD_FAILED");
      expect(result.retained).toEqual([0, 255, 0]);
      expect(result.active).toBe("active");
      expect(result.recovered).toEqual([0, 255, 255]);
      expect(result.cancellation).toBe("GAME_DISPOSED");
      expect(result.errors).toEqual(["ASSET_LOAD_FAILED"]);
      expect(result.resources).toEqual({
        presentations: 0,
        visuals: 0,
        textures: 0,
        pendingImages: 0,
      });
    });
    test("fails preparation promptly despite a blocked image and cancels removed requests", async ({
      page,
    }) => {
      await page.route("**/never-live.svg", () => {});
      const result = await page.evaluate(async (url) => {
        const { fixture } = (await import(
          url
        )) as typeof import("./renderable-fixture");
        const { Actor, Transform, Renderable } = (await import(
          url
        )) as typeof import("./renderable-fixture");
        const f = await fixture();
        const { game, view } = f;
        game.scene("broken", ({ add }) => {
          for (const path of ["./never-live.svg", "./missing-live.png"]) {
            const a = add(new Actor());
            a.add(new Transform());
            a.add(new Renderable({ source: { kind: "image", url: path } }));
          }
        });
        let failure = "";
        try {
          await game.goTo("broken");
        } catch (e) {
          failure = (e as { code: string }).code;
        }
        const preserved = game.engine.scene.actors.includes(f.actor);
        view.source = { kind: "image", url: "./never-live.svg" };
        const removed = game.whenReady();
        await Promise.resolve();
        f.actor.dispose();
        await removed;
        const componentActor = game.add(new Actor());
        componentActor.add(new Transform());
        componentActor.add(
          new Renderable({
            source: { kind: "image", url: "./never-live.svg" },
          }),
        );
        const componentWaiting = game.whenReady();
        await Promise.resolve();
        componentActor.remove(Renderable.type);
        await componentWaiting;
        const actor = game.add(new Actor());
        actor.add(new Transform());
        actor.add(
          new Renderable({
            source: { kind: "image", url: "./never-live.svg" },
          }),
        );
        const waiting = game.whenReady().then(
          () => "ready",
          (e) => (e as { code: string }).code,
        );
        await Promise.resolve();
        await game.goTo("empty");
        const changed = await waiting;
        game.dispose();
        return {
          failure,
          preserved,
          changed,
          resources: f.renderer.diagnostics,
        };
      }, fixtureURL);
      expect(result.failure).toBe("ASSET_LOAD_FAILED");
      expect(result.preserved).toBe(true);
      expect(result.changed).toBe("GAME_DISPOSED");
      expect(result.resources).toEqual({
        presentations: 0,
        visuals: 0,
        textures: 0,
        pendingImages: 0,
      });
    });
  });
}
