import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: {
      "@simpludify/core": resolve("packages/core/src/index.ts"),
      "@simpludify/web": resolve("packages/web/src/index.ts"),
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
