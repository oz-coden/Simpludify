import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

// Run after: npm run build -- --target web --example sprites --base /Simpludify/
const server = await preview({
  configFile: false,
  base: "/Simpludify/",
  build: { outDir: resolve("dist") },
  preview: { host: "127.0.0.1", port: 4175, strictPort: true },
  logLevel: "error",
});
let browser;
try {
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
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto("http://127.0.0.1:4175/Simpludify/");
    await page.getByRole("heading", { name: "Sprite garden" }).waitFor();
    const center = async () => {
      // Capture compositor pixels: WebGL's default framebuffer may be cleared
      // before a later task reads canvas directly (preserveDrawingBuffer=false).
      const png = await page.locator("canvas").screenshot();
      return page.evaluate(
        async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          const copy = document.createElement("canvas");
          copy.width = image.width;
          copy.height = image.height;
          const context = copy.getContext("2d");
          if (!context) throw Error("Missing context");
          context.drawImage(image, 0, 0);
          const data = context.getImageData(0, 0, copy.width, copy.height).data;
          let total = 0,
            count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (Math.floor(i / 4 / copy.width) < copy.height * 0.43) continue;
            if (data[i] === 115 && data[i + 1] === 227 && data[i + 2] === 192) {
              total += (i / 4) % copy.width;
              count++;
            }
          }
          return count ? total / count : 0;
        },
        `data:image/png;base64,${png.toString("base64")}`,
      );
    };
    let before = await center();
    for (let i = 0; before === 0 && i < 10; i++) {
      await page.evaluate(() => new Promise(requestAnimationFrame));
      before = await center();
    }
    await page.screenshot({
      path: `test-results/sprites-production-${viewport.width}.png`,
    });
    assert(before > 0, "Sheet artwork must render");
    await page.locator(".simpludify").focus();
    await page.keyboard.down("KeyD");
    let moved = false;
    for (let i = 0; i < 20; i++) {
      if ((await center()) > before + 5) {
        moved = true;
        break;
      }
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await page.keyboard.up("KeyD");
    assert(moved, "Production WASD must move the visible green sprite");
    await page.getByRole("button", { name: "Stop friend" }).click();
    await page.getByRole("button", { name: "Wave again" }).click();
    await page.screenshot({
      path: `test-results/sprites-production-${viewport.width}.png`,
    });
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Leave field →" }).click();
      await page.getByRole("button", { name: "← Return to field" }).waitFor();
      assert.equal(await center(), 0, "Old sprite pixels must disappear");
      await page.getByRole("button", { name: "← Return to field" }).click();
      await page.getByRole("heading", { name: "Sprite garden" }).waitFor();
    }
    await page.evaluate(() =>
      window.dispatchEvent(new Event("simpludify:dispose")),
    );
    assert.equal(await page.locator("canvas").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Sprite production pixels, WASD, controls, transitions and disposal passed at both sizes.",
  );
} finally {
  await browser?.close();
  await server.close();
}
