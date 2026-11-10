import { expect, test } from "@playwright/test";

const sdk = `/@fs/${process.cwd()}/packages/web/src/index.ts`;
// Synthetic one-glyph TrueType fixture. The glyph is a simple triangle.
const font =
  "data:font/ttf;base64,AAEAAAAKAIAAAwAgT1MvMkUhRDUAAAEoAAAAYGNtYXAADACUAAABkAAAADRnbHlmc8EcWQAAAcwAAAAaaGVhZC+exrAAAACsAAAANmhoZWEFegJbAAAA5AAAACRobXR4BLAAAAAAAYgAAAAIbG9jYQANAAAAAAHEAAAABm1heHAABAAFAAABCAAAACBuYW1lIE2tqAAAAegAAAFBcG9zdAAoAAAAAAMsAAAAJgABAAAAAQAAfxzrXl8PPPUAAwPoAAAAAOcYQYoAAAAA5xhBigAAAAACWAK8AAAAAwACAAAAAAAAAAEAAAMg/zgAAAK8AAAAZAJYAAEAAAAAAAAAAAAAAAAAAAACAAEAAAACAAMAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwJYAZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAPz8/PwAAAEEAQQMg/zgAAAMgAMgAAAAAAAAAAAAAAAAAAAAgAAAB9AAAArwAAAAAAAIAAAADAAAAFAADAAEAAAAUAAQAIAAAAAQABAABAAAAQf//AAAAQf///8AAAQAAAAAAAAAAAA0AAAABAAAAAAJYArwAAgAAMQEBASwBLAK8/UQAAAAAAAAKAH4AAQAAAAAAAQAOAAAAAQAAAAAAAgAHAA4AAQAAAAAAAwAWABUAAQAAAAAABAAWACsAAQAAAAAABgAWABUAAwABBAkAAQAcAEEAAwABBAkAAgAOAF0AAwABBAkAAwAsAGsAAwABBAkABAAsAJcAAwABBAkABgAsAGtTaW1wbHVkaWZ5VGVzdFJlZ3VsYXJTaW1wbHVkaWZ5VGVzdC1SZWd1bGFyU2ltcGx1ZGlmeVRlc3QgUmVndWxhcgBTAGkAbQBwAGwAdQBkAGkAZgB5AFQAZQBzAHQAUgBlAGcAdQBsAGEAcgBTAGkAbQBwAGwAdQBkAGkAZgB5AFQAZQBzAHQALQBSAGUAZwB1AGwAYQByAFMAaQBtAHAAbAB1AGQAaQBmAHkAVABlAHMAdAAgAFIAZQBnAHUAbABhAHIAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAJAAA";

test("shares decoded audio, resumes through a browser gesture and releases Scene-owned voices", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  const setup = await page.evaluate(async (url) => {
    const { Game } = (await import(url)) as typeof import("@simpludify/web");
    window.demo.dispose();
    const game = new Game<"away">({
      logging: { console: false },
      assets: { cacheEntries: 0 },
    });
    game.scene("away", () => {});
    await game.run();
    const bytes = new Uint8Array(44 + 16000);
    const data = new DataView(bytes.buffer);
    const text = (offset: number, value: string) => {
      for (const [i, char] of Array.from(value).entries())
        bytes[offset + i] = char.charCodeAt(0);
    };
    text(0, "RIFF");
    data.setUint32(4, bytes.byteLength - 8, true);
    text(8, "WAVE");
    text(12, "fmt ");
    data.setUint32(16, 16, true);
    data.setUint16(20, 1, true);
    data.setUint16(22, 1, true);
    data.setUint32(24, 8000, true);
    data.setUint32(28, 16000, true);
    data.setUint16(32, 2, true);
    data.setUint16(34, 16, true);
    text(36, "data");
    data.setUint32(40, 16000, true);
    const path = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    const scope = game.assets.scope();
    const sound = game.assets.load({ kind: "audio", url: path });
    const shared = scope.load({ kind: "audio", url: path });
    const silent = scope.load({ kind: "audio", url: "data:audio/wav,invalid" });
    await Promise.all([sound.ready, shared.ready, silent.ready]);
    URL.revokeObjectURL(path);
    const group = game.audio.group("limited", {
      parent: "effects",
      volume: 0.5,
      maxVoices: 1,
    });
    const first = game.audio.play(sound, { group: group.name, loop: true });
    const next = game.audio.play(shared, {
      group: group.name,
      loop: true,
      owner: game.engine.scene,
    });
    const music = game.audio.play(sound, {
      group: "music",
      loop: true,
      volume: 0.4,
    });
    const fallback = game.audio.play(silent);
    scope.dispose();
    Object.assign(window, {
      mediaState: () => music.state,
      mediaResult: async () => {
        const beforePause = music.state;
        music.pause();
        const paused = music.state;
        music.resume();
        const resumed = music.state;
        await game.changeScene("away");
        const ownerEnd = await next.finished;
        const musicContinued = music.state;
        const silentEnded = await fallback.finished;
        game.dispose();
        return {
          beforePause,
          paused,
          resumed,
          ownerEnd,
          musicContinued,
          silentEnded,
          musicEnd: await music.finished,
          state: game.audio.state,
          progress: game.assets.progress.total,
        };
      },
    });
    return {
      duration: sound.value?.duration,
      shared: sound.id === shared.id,
      replaced: await first.finished,
      group: group.volume,
      initial: music.state,
      context: game.audio.state,
    };
  }, sdk);
  expect(setup).toMatchObject({
    duration: 1,
    shared: true,
    replaced: "replaced",
    group: 0.5,
  });
  if (setup.context !== "running") expect(setup.initial).toBe("pending");
  await page.getByLabel("Game world").click();
  await page.waitForFunction(
    () =>
      (window as unknown as { mediaState(): string }).mediaState() ===
      "playing",
  );
  const result = await page.evaluate(() =>
    (window as unknown as { mediaResult(): Promise<unknown> }).mediaResult(),
  );
  expect(result).toEqual({
    beforePause: "playing",
    paused: "paused",
    resumed: "playing",
    ownerEnd: "stopped",
    musicContinued: "playing",
    silentEnded: "ended",
    musicEnd: "stopped",
    state: "closed",
    progress: 0,
  });
});

test("registers a real FontFace, switches the Game default and removes the final registration", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
  const result = await page.evaluate(
    async ([url, font]) => {
      const { CanvasColumn, CanvasLabel, Game } = (await import(
        url
      )) as typeof import("@simpludify/web");
      window.demo.dispose();
      const game = new Game({
        logging: { console: false },
        assets: { cacheEntries: 0 },
        frames: { request: () => 1, cancel: () => {} },
      });
      const label = CanvasLabel("A");
      const inherited = CanvasLabel("B");
      game.canvasUI(CanvasColumn([label, inherited]));
      await game.run();
      const scope = game.assets.scope();
      const invalid = scope.load({
        kind: "font",
        url: "data:font/ttf,invalid",
      });
      const face = scope.load({ kind: "font", url: font });
      await Promise.all([invalid.ready, face.ready]);
      const fallback = invalid.value;
      const family = face.value?.split(",")[0];
      const registered = () =>
        Array.from(document.fonts).some(
          (fontFace) => fontFace.family === family,
        );
      const loaded = registered();
      game.setFont(face);
      await game.whenReady();
      const applied = game.element.style
        .getPropertyValue("--s-font")
        .includes(family ?? "missing");
      const renderer = (
        game as unknown as {
          renderer: {
            canvasPresentations: Set<{
              entries: Map<
                object,
                { text?: { style: { fontFamily: string | string[] } } }
              >;
            }>;
          };
        }
      ).renderer;
      const canvasFont = (target = label) =>
        [...renderer.canvasPresentations][0]?.entries.get(target)?.text?.style
          .fontFamily;
      const canvasApplied = String(canvasFont()).includes(family ?? "missing");
      label.setStyle({ fontFamily: "system-ui, sans-serif" });
      await game.whenReady();
      const explicitFont = !String(canvasFont()).includes(family ?? "missing");
      scope.dispose();
      const retained = registered();
      game.setFont();
      const removed = !registered();
      const restoredWithoutTick = !String(canvasFont(inherited)).includes(
        family ?? "missing",
      );
      const late = game.assets.load({ kind: "font", url: font });
      game.setFont(late);
      await late.ready;
      const lateFamily = late.value?.split(",")[0];
      const lateAppliedWithoutTick = String(canvasFont(inherited)).includes(
        lateFamily ?? "missing",
      );
      game.dispose();
      return {
        fallback,
        loaded,
        applied,
        canvasApplied,
        explicitFont,
        retained,
        removed,
        restoredWithoutTick,
        lateAppliedWithoutTick,
      };
    },
    [sdk, font] as const,
  );
  expect(result).toEqual({
    fallback: "system-ui, sans-serif",
    loaded: true,
    applied: true,
    canvasApplied: true,
    explicitFont: true,
    retained: true,
    removed: true,
    restoredWithoutTick: true,
    lateAppliedWithoutTick: true,
  });
});
