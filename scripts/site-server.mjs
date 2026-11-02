import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isAbsolute, relative, resolve } from "node:path";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};
export async function serveSite({ base, port = 4177, dir = "site-dist" }) {
  const root = resolve(dir);
  const server = createServer(async (request, response) => {
    try {
      const address = new URL(request.url, "http://localhost");
      if (address.pathname === base.slice(0, -1)) {
        response.writeHead(302, { Location: base });
        response.end();
        return;
      }
      if (!address.pathname.startsWith(base)) throw new Error("outside base");
      const path = decodeURIComponent(address.pathname.slice(base.length));
      if (path.startsWith("/") || path.includes("\\") || path.includes("\0"))
        throw new Error("invalid path");
      const file = resolve(
        root,
        path + (address.pathname.endsWith("/") ? "index.html" : ""),
      );
      const rel = relative(root, file);
      if (!rel || rel.startsWith("..") || isAbsolute(rel))
        throw new Error("outside output");
      const body = await readFile(file);
      response.writeHead(200, {
        "Content-Type":
          mime[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  await new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "127.0.0.1", ok);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}${base}`,
    close: () =>
      new Promise((ok, fail) =>
        server.close((error) => (error ? fail(error) : ok())),
      ),
  };
}
