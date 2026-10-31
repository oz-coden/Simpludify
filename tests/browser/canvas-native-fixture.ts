import {
  Action,
  ActionController,
  CanvasButton,
  CanvasPanel,
  CanvasTextInput,
  defineActions,
} from "@simpludify/web";
import { controlsFixture } from "./canvas-controls-fixture";
export async function nativeFixture() {
  const f = await controlsFixture();
  const Actions = defineActions({
    Confirm: Action.button(),
    Move: Action.axis1D(),
  });
  const actions = new ActionController(Actions, {
    scene: f.game.engine.scene,
    input: f.game.engine.input,
    bindings: { Confirm: { keys: ["Enter"] } },
  });
  const changes: string[] = [],
    commits: string[] = [],
    cancels: string[] = [],
    drafts: string[] = [];
  f.screen.playerName.onChange((e) => changes.push(e.value));
  f.screen.playerName.onCommit((e) => commits.push(e.value));
  f.screen.playerName.onCancel((e) => cancels.push(e.value));
  f.screen.playerName.onDraftChange((e) => drafts.push(e.draft.text));
  let coveredClicks = 0;
  const overlap = () => {
    f.screen.root.clear();
    const field = CanvasTextInput(
      { label: "Overlap input", value: "under" },
      { height: 100, shrink: 0 },
    );
    const cover = CanvasButton(
      "Cover input",
      () => {
        coveredClicks++;
      },
      { height: 48, shrink: 0 },
    );
    f.screen.root.add(CanvasPanel([field], { height: 40, shrink: 0 }), cover);
    f.tick();
    f.focus(field);
    return { field, cover };
  };
  return {
    ...f,
    actions,
    Actions,
    changes,
    commits,
    cancels,
    drafts,
    overlap,
    coveredClicks: () => coveredClicks,
  };
}
declare global {
  interface Window {
    nativeProbe: Awaited<ReturnType<typeof nativeFixture>>;
  }
}
