import { expect, test } from "@playwright/test";

const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;

test("retains scene-owned loads and restores the same actors after a failed reactivation", async ({
  page,
}) => {
  let continueLoad: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    continueLoad = resolve;
  });
  await page.route("**/retained-scene.json", async (route) => {
    await gate;
    await route.fulfill({ json: { answer: 42 } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  await page.evaluate(async (url) => {
    const { Actor, Game, Label, Transform } = (await import(
      url
    )) as typeof import("@simpludify/web");
    window.demo.dispose();
    let fail = true;
    const counts = {
      setup: 0,
      activate: 0,
      deactivate: 0,
      dispose: 0,
      otherDispose: 0,
      timer: 0,
      presentations: 0,
    };
    const game = new Game<"home" | "other">({
      sceneRetention: "retain",
      logging: { console: false },
      frames: { request: () => 1, cancel: () => {} },
      renderer: () => ({
        init: async () => {},
        resize() {},
        dispose() {},
        prepare: async (scene) => {
          if (scene.id === "home" && scene.state === "inactive" && fail) {
            fail = false;
            throw new Error("retained presentation rejected");
          }
          counts.presentations++;
          return {
            render() {},
            dispose() {
              counts.presentations--;
            },
          };
        },
      }),
    });
    const resources: { load?: import("@simpludify/web").AssetHandle<"json"> } =
      {};
    game.scene(
      "home",
      ({ scene, assets, add, ui, onActivate, onDeactivate, onDispose }) => {
        counts.setup++;
        resources.load = assets.load({
          kind: "json",
          url: "/retained-scene.json",
        });
        add(new Actor({ id: "player" })).add(new Transform());
        ui(Label("Home only"));
        onActivate(() => counts.activate++);
        onDeactivate(() => counts.deactivate++);
        onDispose(() => counts.dispose++);
        scene.after(1, () => counts.timer++);
      },
    );
    game.scene(
      "other",
      ({ onDispose }) => {
        onDispose(() => counts.otherDispose++);
      },
      { retention: "dispose" },
    );
    await game.run("home");
    const home = game.engine.scene;
    const transform = home.find("player")?.require(Transform.type);
    if (!resources.load || !transform)
      throw new Error("Missing retained state");
    const ownedAsset = resources.load;
    transform.x = 9;
    game.engine.step(0.5);
    await game.changeScene("other");
    game.engine.step(4);
    const inactive = {
      state: home.state,
      loading: ownedAsset.loading,
      overlayHidden: !game.element.textContent?.includes("Home only"),
      timer: counts.timer,
    };
    Object.assign(window, {
      retainedResult: async () => {
        await ownedAsset.ready;
        const retryError = await game
          .changeScene("home")
          .catch((error: Error) => error.message);
        const oldPresentation = game.engine.scene.id;
        await game.changeScene("home");
        const sameScene = game.engine.scene === home;
        await game.changeScene("home");
        const overlayRestored = game.element.textContent?.includes("Home only");
        game.engine.step(0.5);
        const value = ownedAsset.value;
        await game.changeScene("other");
        game.dispose();
        return {
          inactive,
          retryError,
          oldPresentation,
          sameScene,
          overlayRestored,
          position: transform.x,
          value,
          counts,
          released: ownedAsset.status,
          disposed: home.disposed,
        };
      },
    });
  }, sdk);
  continueLoad();
  const result = await page.evaluate(() =>
    (
      window as unknown as { retainedResult(): Promise<unknown> }
    ).retainedResult(),
  );
  expect(result).toEqual({
    inactive: {
      state: "inactive",
      loading: true,
      overlayHidden: true,
      timer: 0,
    },
    retryError: "retained presentation rejected",
    oldPresentation: "other",
    sameScene: true,
    overlayRestored: true,
    position: 9,
    value: { answer: 42 },
    counts: {
      setup: 1,
      activate: 2,
      deactivate: 2,
      dispose: 1,
      otherDispose: 2,
      timer: 1,
      presentations: 0,
    },
    released: "released",
    disposed: true,
  });
});
