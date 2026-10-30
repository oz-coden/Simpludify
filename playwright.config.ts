import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  // Focus/blur and held-input fixtures need one foreground game at a time.
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["json"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: [
        "--enable-webgl",
        "--use-gl=angle",
        // WebGL remains SwiftShader-backed; keep browser compositing in software.
        process.env.SWIFTSHADER_DRIVER === "1"
          ? "--use-angle=swiftshader"
          : "--use-angle=swiftshader-webgl",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "narrow",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
