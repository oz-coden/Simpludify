import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

// Compare complete path segments; names such as "..assets" are ordinary children.
export function isPathInside(root, target, paths = path) {
  const rel = paths.relative(paths.resolve(root), paths.resolve(target));
  return (
    rel !== ".." && !rel.startsWith(`..${paths.sep}`) && !paths.isAbsolute(rel)
  );
}

// Resolve symlinked ancestors even when the destination has not been created yet.
export function physicalPath(target) {
  let ancestor = path.resolve(target);
  const missing = [];
  while (!existsSync(ancestor)) {
    missing.unshift(path.basename(ancestor));
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error("No existing path ancestor");
    ancestor = parent;
  }
  return path.resolve(realpathSync(ancestor), ...missing);
}
