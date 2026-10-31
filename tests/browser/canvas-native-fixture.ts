import { Action, ActionController, defineActions } from "@simpludify/web";
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
  return { ...f, actions, Actions, changes, commits, cancels, drafts };
}
declare global {
  interface Window {
    nativeProbe: Awaited<ReturnType<typeof nativeFixture>>;
  }
}
