import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { API } from "typescript/unstable/sync";

// Use the workspace's pinned TypeScript completion implementation; no editor required.
const root = resolve(".");
const file = join(root, "tests/types/collision-completions.ts");
const source = `import { SpriteSheet, CollisionResponse, type Collider } from '@simpludify/core';
import { ProposedTilemap, ProposedContactEnter } from '../prototypes/collision-api';
const sheet = SpriteSheet.grid('terrain.png', { frameWidth:32, frameHeight:32, names:{grass:0, wall:1, water:2} });
const map=new ProposedTilemap({sheet,tiles:[[0]],tileWidth:32,tileHeight:32, collision:{tiles:[{tile: '',response:CollisionResponse.Solid}]}});
map.setTileCollision('', {response:CollisionResponse.Solid});
declare const collider: Collider;
collider.events.on(ProposedContactEnter, contact => {
  if(contact.other.kind==='tile') { contact.other./*tile*/; }
  else { contact.other./*actor*/; }
});`;
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
    for (const marker of ["tile: '", "map.setTileCollision('"]) {
      const position = source.indexOf(marker) + marker.length;
      const names = project.checker
        .getCompletionsAtPosition(file, position)
        ?.entries.map((entry) => entry.name)
        .sort();
      assert.deepEqual(names, ["grass", "wall", "water"]);
      results[marker] = names;
    }
    for (const [marker, include, exclude] of [
      [
        "/*tile*/",
        ["kind", "map", "tileX", "tileY", "tileId", "policy"],
        ["actor", "collider"],
      ],
      ["/*actor*/", ["kind", "actor", "collider"], ["map", "tileX"]],
    ]) {
      const position = source.indexOf(marker);
      const names =
        project.checker
          .getCompletionsAtPosition(file, position)
          ?.entries.map((entry) => entry.name)
          .sort() ?? [];
      for (const name of include)
        assert(names.includes(name), `${marker}: missing ${name}`);
      for (const name of exclude)
        assert(!names.includes(name), `${marker}: unexpected ${name}`);
      results[marker] = names;
    }
    console.log(JSON.stringify(results));
  } finally {
    snapshot.dispose();
  }
} finally {
  api.close();
}
