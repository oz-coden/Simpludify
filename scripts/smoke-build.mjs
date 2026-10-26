import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const exampleIndex = process.argv.indexOf("--example");
const example = exampleIndex < 0 ? "ui-scenes" : process.argv[exampleIndex + 1];
assert.ok(
  ["ui-scenes", "composition", "signal-run"].includes(example),
  "Choose ui-scenes, composition or signal-run",
);
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
    const response = await page.goto("http://127.0.0.1:4175/Simpludify/");
    assert.equal(response?.status(), 200);
    if (example === "signal-run") {
      await page
        .getByRole("button", { name: "Start run", exact: true })
        .click();
      await page.getByText("HP 3/3", { exact: true }).waitFor();
      assert.equal(await page.locator("canvas").count(), 1);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await page.getByRole("button", { name: "Resume", exact: true }).click();
      await page.getByRole("button", { name: "Restart", exact: true }).click();
      await page.getByText("Signals 0/6", { exact: true }).waitFor();
    } else if (example === "composition") {
      await page.getByRole("heading", { name: "Beacon field" }).waitFor();
      assert.equal(await page.locator("canvas").count(), 1);
      await page
        .getByRole("button", { name: "Add beacon", exact: true })
        .click();
      await page.getByRole("button", { name: "Zoom", exact: true }).click();
      await page.getByRole("button", { name: "Restart", exact: true }).click();
      await page.getByText(/^Beacons collected:/).waitFor();
    } else {
      await page.getByRole("heading", { name: "The garden" }).waitFor();
      assert.equal(await page.locator("canvas").count(), 1);
      await page.locator(".simpludify").focus();
      await page.keyboard.down("d");
      await page.waitForFunction(
        () => window.demo.engine.snapshot().actors[0].transform.x > 405,
      );
      await page.keyboard.up("d");
      await page.getByRole("button", { name: "Visit the studio" }).click();
      await page.getByRole("heading", { name: "The studio" }).waitFor();
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Production output passed at /Simpludify/ for 1440x900 and 390x844.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
