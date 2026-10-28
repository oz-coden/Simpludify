import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { API } from "typescript/unstable/sync";

// Use the workspace's pinned TypeScript completion implementation; no editor required.
const root = resolve(".");
const file = join(root, "tests/types/sprite-completions.ts");
const source = `import { SpriteSheet, SpriteAnimation } from '@simpludify/core';
const sheet = SpriteSheet.grid('hero.png', { frameWidth:32, frameHeight:32, names:{idle:0, walk:2} });
const animation = new SpriteAnimation({sheet, clips:{idle:{frames:[0]}, walk:{frames:[1]}}});
sheet.get('');
animation.play('');`;
const api = new API({
  cwd: root,
  fs: {
    fileExists: (path) => (path === file ? true : undefined),
    readFile: (path) => (path === file ? source : undefined),
    getAccessibleEntries: (path) => {
      if (path !== dirname(file)) return undefined;
      const entries = readdirSync(path, { withFileTypes: true });
      return {
        files: [
          ...entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name),
          basename(file),
        ],
        directories: entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name),
      };
    },
  },
});
try {
  const snapshot = api.updateSnapshot({
    openProjects: [join(root, "tsconfig.json")],
    openFiles: [file],
  });
  try {
    const project = snapshot.getDefaultProjectForFile(file);
    assert(project);
    const results = {};
    for (const marker of ["sheet.get('", "animation.play('"]) {
      const position = source.indexOf(marker) + marker.length;
      const names = project.checker
        .getCompletionsAtPosition(file, position)
        ?.entries.map((entry) => entry.name)
        .sort();
      assert.deepEqual(names, ["idle", "walk"]);
      results[marker] = names;
    }
    console.log(JSON.stringify(results));
  } finally {
    snapshot.dispose();
  }
} finally {
  api.close();
}
