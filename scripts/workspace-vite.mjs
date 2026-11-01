import { resolve } from "node:path";
import {
  mergeConfig,
  build as viteBuild,
  createServer as viteServer,
} from "vite";

export { preview } from "vite";

// Repository tools always use editable sources. Packed consumers use dist exports.
export const workspaceConfig = {
  resolve: {
    alias: [
      {
        find: /^@simpludify\/web\/style\.css$/,
        replacement: resolve(
          import.meta.dirname,
          "../packages/web/src/style.css",
        ),
      },
      {
        find: /^@simpludify\/core$/,
        replacement: resolve(
          import.meta.dirname,
          "../packages/core/src/index.ts",
        ),
      },
      {
        find: /^@simpludify\/web$/,
        replacement: resolve(
          import.meta.dirname,
          "../packages/web/src/index.ts",
        ),
      },
    ],
  },
};
export const createServer = (config = {}) =>
  viteServer(mergeConfig(workspaceConfig, config));
export const build = (config = {}) =>
  viteBuild(mergeConfig(workspaceConfig, config));
