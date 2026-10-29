import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { API } from "typescript/unstable/sync";

// Use the workspace's pinned TypeScript completion implementation; no editor required.
const root = resolve(".");
const file = join(root, "tests/types/canvas-ui-completions.ts");
const source = `import {Game,Action,defineActions,CanvasButton,CanvasRow,PointerClick} from '@simpludify/web';
const game=new Game();const A=defineActions({Move:Action.axis2D(),Fire:Action.button()});
game.scene('play',({actions,canvasUI,pointer})=>{
const c=actions(A);c.value(A./*actions*/);
const button=CanvasButton('Menu',()=>{});button.setStyle({/*style*/});
CanvasRow([],{align:'/*align*/'});
pointer.events.on(PointerClick,event=>{event./*pointer*/;});
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
    for (const [marker, required] of [
      ["/*actions*/", ["Fire", "Move"]],
      [
        "/*style*/",
        [
          "width",
          "height",
          "grow",
          "shrink",
          "gap",
          "padding",
          "wrap",
          "clip",
          "align",
          "justify",
          "pointerEvents",
        ],
      ],
      ["/*align*/", ["start", "center", "end", "stretch"]],
      [
        "/*pointer*/",
        [
          "screen",
          "world",
          "pointerId",
          "pointerType",
          "inside",
          "button",
          "buttons",
        ],
      ],
    ]) {
      const names =
        project.checker
          .getCompletionsAtPosition(file, source.indexOf(marker))
          ?.entries.map((e) => e.name.replace(/\?$/, ""))
          .sort() ?? [];
      for (const name of required)
        assert(names.includes(name), `${marker} missing ${name}: ${names}`);
      if (marker === "/*pointer*/") assert(!names.includes("otherActor"));
      results[marker] = names;
    }
    console.log(JSON.stringify(results));
  } finally {
    snapshot.dispose();
  }
} finally {
  api.close();
}
