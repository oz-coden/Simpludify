import {
  CanvasColumn,
  CanvasTextInput,
  CanvasUI,
  Lifetime,
} from "@simpludify/core";
import { afterEach, expect, it, vi } from "vitest";
import { nativeGeometry } from "../../packages/web/src/canvas-native";
import { Game } from "../../packages/web/src/game";
import { PixiRenderer } from "../../packages/web/src/renderer";
import { Label } from "../../packages/web/src/ui";

afterEach(() => vi.unstubAllGlobals());

it("updates only subscribed text and releases subscriptions", () => {
  const label = Label("one");
  const values: string[] = [];
  const unsubscribe = label.subscribe((value) => values.push(value));
  label.setText("two");
  label.setText("two");
  unsubscribe();
  label.setText("three");
  expect(values).toEqual(["two"]);
  expect(label.text).toBe("three");
});

it("rejects prototype theme names, unknown token keys and CSS-injecting token values before DOM creation", () => {
  expect(() => new Game({ theme: "toString" as never })).toThrow(
    expect.objectContaining({ code: "INVALID_THEME" }),
  );
  for (const tokens of [
    { toString: "#000000" },
    { unknown: "#000000" },
    { background: "   " },
    { background: "#000; position:fixed" },
    { surface: "url(https://evil.example/track)" },
    { font: "sans-serif} body { display:none" },
  ]) {
    expect(() => new Game({ tokens: tokens as never })).toThrow(
      expect.objectContaining({ code: "INVALID_THEME_TOKEN" }),
    );
  }
});

it("assigns nativeGeometry fontFamily via CSSOM instead of cssText interpolation", () => {
  vi.stubGlobal("document", { activeElement: null });
  const owner = new Lifetime(),
    input = CanvasTextInput(
      { value: "ok" },
      { width: 120, height: 32, fontFamily: '"Trebuchet MS", sans-serif' },
    ),
    ui = new CanvasUI(owner, CanvasColumn([input]));
  ui.layout(200, 100, () => ({ width: 40, height: 16 }));
  const el = {
    disabled: false,
    style: { cssText: "", fontFamily: "" },
    blur: vi.fn(),
  } as unknown as HTMLInputElement;
  nativeGeometry(el, input, ui, { x: 0, y: 0, width: 200, height: 100 });
  expect(el.style.cssText).not.toContain("font-family:");
  expect(el.style.fontFamily).toBe('"Trebuchet MS", sans-serif');
  owner.dispose();
});

it("restricts PixiRenderer image acquisition to safe asset URL protocols", async () => {
  vi.stubGlobal("document", { baseURI: "https://game.example/play/" });
  const acquire = (
    PixiRenderer.prototype as unknown as {
      acquireImage(url: string, signal: AbortSignal): Promise<string>;
    }
  ).acquireImage;
  const fake = {
    images: { acquire: (href: string) => Promise.resolve(href) },
  };
  const signal = new AbortController().signal;
  await expect(acquire.call(fake, "./hero.svg", signal)).resolves.toBe(
    "https://game.example/play/hero.svg",
  );
  await expect(
    acquire.call(fake, "data:image/svg+xml,<svg/>", signal),
  ).resolves.toBe("data:image/svg+xml,<svg/>");
  for (const href of [
    "http://game.example/hero.png?version=1#frame",
    "https://user:pass@game.example/hero.png",
    "blob:https://game.example/1234",
    "file:///game/assets/hero.png",
  ]) {
    await expect(acquire.call(fake, href, signal)).resolves.toBe(href);
  }
  for (const unsafe of [
    "javascript:alert(1)",
    "vbscript:msgbox(1)",
    "ws://evil.example/socket",
    "custom-handler://open",
  ]) {
    await expect(acquire.call(fake, unsafe, signal)).rejects.toMatchObject({
      code: "ASSET_LOAD_FAILED",
    });
  }
});
