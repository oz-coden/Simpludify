import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
// @ts-expect-error JavaScript tooling module.
import { validateCoreDependency } from "../../scripts/core-boundary.mjs";
// @ts-expect-error JavaScript tooling module.
import { isPathInside, physicalPath } from "../../scripts/path-boundary.mjs";
// @ts-expect-error JavaScript tooling module.
import { serveSite } from "../../scripts/site-server.mjs";

it("compares POSIX and Windows drive, UNC and parent boundaries by segment", () => {
  for (const [paths, root] of [
    [path.posix, "/repo/core"],
    [path.win32, "C:\\repo\\core"],
    [path.win32, "\\\\server\\share\\core"],
  ] as const) {
    expect(
      isPathInside(root, paths.join(root, "..assets", "file"), paths),
    ).toBe(true);
    expect(isPathInside(root, root, paths)).toBe(true);
    expect(isPathInside(root, paths.resolve(root, "../outside"), paths)).toBe(
      false,
    );
    expect(isPathInside(root, `${root}-sibling`, paths)).toBe(false);
    expect(() =>
      validateCoreDependency(
        root,
        paths.join(root, "ui/model.ts"),
        "../foundation/lifetime",
        false,
        paths,
      ),
    ).not.toThrow();
    for (const target of [
      "../runtime/engine",
      "../../../outside",
      "../../core-other/ui/model",
    ]) {
      expect(() =>
        validateCoreDependency(
          root,
          paths.join(root, "ui/model.ts"),
          target,
          false,
          paths,
        ),
      ).toThrow("CORE_BOUNDARY");
    }
    expect(() =>
      validateCoreDependency(
        root,
        paths.join(root, "toString/model.ts"),
        "../ui/model",
        false,
        paths,
      ),
    ).toThrow("CORE_BOUNDARY");
  }
  expect(isPathInside("C:\\repo", "D:\\repo", path.win32)).toBe(false);
});

it("resolves nonexistent output through real ancestors and blocks recursive CLI copies", () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "simpludify-boundary-"));
  const root = process.cwd();
  const alias = path.join(temporary, "repository");
  try {
    symlinkSync(root, alias, process.platform === "win32" ? "junction" : "dir");
    expect(physicalPath(path.join(alias, "not-created", "child"))).toBe(
      path.join(root, "not-created", "child"),
    );
    expect(
      isPathInside(
        physicalPath(root),
        physicalPath(path.join(temporary, "..outside")),
      ),
    ).toBe(false);
    for (const output of [
      path.join(root, "..audit-child"),
      path.join(alias, "not-created", "child"),
    ]) {
      const result = spawnSync(
        process.execPath,
        ["scripts/cli.mjs", "create", output, "--json"],
        { encoding: "utf8" },
      );
      expect(result.status).toBe(2);
      expect(JSON.parse(result.stderr).diagnostics[0].code).toBe(
        "INVALID_ARGUMENT",
      );
      expect(existsSync(output)).toBe(false);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

it("serves legitimate dot-prefixed names and internal links while blocking external symlinks", async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "simpludify-preview-"));
  const root = path.join(temporary, "site");
  mkdirSync(root);
  writeFileSync(path.join(root, "..notes.txt"), "inside");
  writeFileSync(path.join(temporary, "secret.txt"), "outside");
  symlinkSync(
    root,
    path.join(root, "internal"),
    process.platform === "win32" ? "junction" : "dir",
  );
  symlinkSync(
    temporary,
    path.join(root, "external"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const server = await serveSite({ base: "/Simpludify/", port: 0, dir: root });
  try {
    for (const name of ["..notes.txt", "internal/..notes.txt"]) {
      const response = await fetch(`${server.url}${name}`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("inside");
    }
    const response = await fetch(`${server.url}external/secret.txt`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("outside");
  } finally {
    await server.close();
    rmSync(temporary, { recursive: true, force: true });
  }
});

it("rejects mismatched release tags before inspecting archives or contacting npm", () => {
  const result = spawnSync(process.execPath, ["scripts/publish-packages.mjs"], {
    encoding: "utf8",
    env: { ...process.env, RELEASE_TAG: "v0.1.3-malformed" },
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("Approved tag must match SDK version");
});
