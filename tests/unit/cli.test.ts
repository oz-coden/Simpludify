import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
// @ts-expect-error The site preview server is a JavaScript tooling module.
import { serveSite } from "../../scripts/site-server.mjs";

function cli(...args: string[]) {
  const result = spawnSync(
    process.execPath,
    ["scripts/cli.mjs", ...args, "--json"],
    { encoding: "utf8" },
  );
  return {
    status: result.status,
    data: JSON.parse((result.stdout || result.stderr).trim()) as {
      ok: boolean;
      diagnostics: Array<{ code: string }>;
    },
  };
}
it("emits structured diagnostics and meaningful exit codes", () => {
  expect(cli("doctor")).toMatchObject({ status: 0, data: { ok: true } });
  expect(cli("build", "--target", "windows")).toMatchObject({
    status: 2,
    data: { ok: false, diagnostics: [{ code: "TARGET_UNSUPPORTED" }] },
  });
  expect(cli("build", "--example", "missing")).toMatchObject({
    status: 2,
    data: { diagnostics: [{ code: "EXAMPLE_NOT_FOUND" }] },
  });
  expect(cli("create", ".")).toMatchObject({
    status: 2,
    data: { diagnostics: [{ code: "DESTINATION_EXISTS" }] },
  });
  expect(cli("create", "docs/inside-repo-test")).toMatchObject({
    status: 2,
    data: { diagnostics: [{ code: "INVALID_ARGUMENT" }] },
  });
  expect(cli("unknown")).toMatchObject({
    status: 2,
    data: { diagnostics: [{ code: "INVALID_ARGUMENT" }] },
  });
});

it("serves static files inside root with nosniff and rejects encoded path traversal", async () => {
  const server = await serveSite({
    base: "/Simpludify/",
    port: 0,
    dir: "examples/character",
  });
  try {
    const ok = await fetch(server.url);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    const origin = new URL(server.url).origin;
    for (const attack of [
      "/Simpludify/..%2f..%2fpackage.json",
      "/Simpludify/..%5c..%5cpackage.json",
      "/Simpludify/%2findex.html",
      "/Simpludify/%5cindex.html",
      "/Simpludify/index.html%00",
    ]) {
      const res = await fetch(`${origin}${attack}`);
      expect(res.status).toBe(404);
    }
  } finally {
    await server.close();
  }
});
