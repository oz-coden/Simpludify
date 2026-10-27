import { readFileSync } from "node:fs";
import { serveSite } from "./site-server.mjs";

const { base } = JSON.parse(
  readFileSync("site-dist/site-manifest.json", "utf8"),
);
const server = await serveSite({ base });
console.log(`Official site preview: ${server.url}`);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    await server.close();
    process.exit();
  });
