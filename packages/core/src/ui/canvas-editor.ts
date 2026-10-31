import { EngineError } from "../foundation/diagnostics";
import { defineEvent } from "../foundation/events";
import type { LifetimeOwner } from "../foundation/lifetime";
import type { CanvasActivation, CanvasControlModel } from "./canvas-control";
import { CanvasInputNode } from "./canvas-input";
import type { CanvasNodeKind, CanvasStyle } from "./canvas-node";
import {
  type CanvasNativeControl,
  type CanvasNativeSession,
  type CanvasTextSnapshot,
  nativeSession,
} from "./native-edit";

function snapshot(text: string): CanvasTextSnapshot {
  return Object.freeze({
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
    direction: "none",
    composing: false,
  });
}
function checkedSnapshot(value: CanvasTextSnapshot): CanvasTextSnapshot {
  if (
    typeof value.text !== "string" ||
    /[\r\n]/.test(value.text) ||
    !Number.isInteger(value.selectionStart) ||
    !Number.isInteger(value.selectionEnd) ||
    value.selectionStart < 0 ||
    value.selectionStart > value.selectionEnd ||
    value.selectionEnd > value.text.length ||
    !["forward", "backward", "none"].includes(value.direction) ||
    typeof value.composing !== "boolean"
  )
    throw new EngineError(
      "INVALID_UI",
      "Native editor requires single-line text and bounded UTF-16 selection",
    );
  return Object.freeze({ ...value });
}
export interface CanvasDraftChange<T> {
  readonly node: CanvasTextEditorNode<T>;
  readonly draft: CanvasTextSnapshot;
}
/** Shared portable native text session. Values are accepted state; drafts include composition and incomplete numbers. */
export abstract class CanvasTextEditorNode<T> extends CanvasInputNode<T> {
  private buffer: CanvasTextSnapshot;
  private session: CanvasNativeSession<CanvasTextSnapshot> | undefined;
  private readonly draftEvent =
    defineEvent<CanvasDraftChange<T>>("CanvasDraftChange");
  private hint: string;
  protected constructor(
    kind: CanvasNodeKind,
    label: string,
    value: T,
    normalize: (value: T) => T,
    readOnly: boolean,
    placeholder: string,
    initialText: string,
    style: CanvasStyle,
    keys: readonly string[] = [],
  ) {
    if (typeof placeholder !== "string")
      throw new EngineError("INVALID_UI", "Placeholder must be text");
    super(
      kind,
      label,
      value,
      normalize,
      readOnly,
      { width: 260, maxWidth: "100%", height: 48, textWrap: false, ...style },
      keys,
    );
    this.hint = placeholder;
    this.buffer = snapshot(initialText);
    this.onDispose(() => this.session?.cancel());
  }
  protected abstract format(value: T): string;
  protected abstract parse(text: string): { value: T } | undefined;
  protected get limit(): number | undefined {
    return undefined;
  }
  get draft(): CanvasTextSnapshot {
    return this.buffer;
  }
  get placeholder(): string {
    return this.hint;
  }
  set placeholder(value: string) {
    this.assertInputAlive();
    if (typeof value !== "string")
      throw new EngineError("INVALID_UI", "Placeholder must be text");
    this.hint = value;
    this.changed();
  }
  onDraftChange(
    handler: (event: CanvasDraftChange<T>) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(this.draftEvent, handler, owner);
  }
  protected override valueReplaced(): void {
    this.buffer = snapshot(this.format(this.value));
  }
  protected override model(): CanvasControlModel {
    return Object.freeze({
      kind: "text",
      text: this.editing ? this.buffer.text : this.format(this.value),
      placeholder: this.hint,
      maxLength: this.limit,
      inputMode: this.kind === "number-input" ? "decimal" : "text",
      readOnly: this.readOnly,
    });
  }
  protected override get nativeControl(): CanvasNativeControl & {
    kind: "text";
  } {
    return {
      kind: "text",
      begin: (source) => this.beginTextEdit(source),
      end: (reason) => {
        if (
          reason === "blur" &&
          this.available &&
          !this.readOnly &&
          !this.buffer.composing
        )
          this.session?.commit();
        else this.session?.cancel();
      },
    };
  }
  beginTextEdit(
    source: CanvasActivation = "keyboard",
  ): CanvasNativeSession<CanvasTextSnapshot> | undefined {
    if (this.session?.active) return this.session;
    if (!this.beginEdit(source)) return;
    this.buffer = snapshot(this.format(this.value));
    const revision = this.control.revision;
    const session: CanvasNativeSession<CanvasTextSnapshot> =
      nativeSession<CanvasTextSnapshot>(
        () =>
          this.available &&
          !this.readOnly &&
          this.control.revision === revision &&
          this.session === session,
        (draft) => {
          const next = checkedSnapshot(draft);
          if (JSON.stringify(next) === JSON.stringify(this.buffer)) return;
          this.buffer = next;
          this.changed();
          this.events.emit(
            this.draftEvent,
            Object.freeze({ node: this, draft: next }),
          );
        },
        (commit) => {
          this.session = undefined;
          const parsed =
            commit && !this.buffer.composing
              ? this.parse(this.buffer.text)
              : undefined;
          const accepted = !!parsed && this.available && !this.readOnly;
          this.buffer = snapshot(this.format(parsed?.value ?? this.value));
          try {
            if (accepted && parsed) this.userValue(parsed.value, source, false);
          } finally {
            this.endPointer(!accepted);
          }
          return accepted;
        },
      );
    this.session = session;
    return session;
  }
  /** Explicit form boundary; composition cannot be committed as a form value. */
  commit(): boolean {
    return this.session?.commit() ?? true;
  }
  cancel(): void {
    this.session?.cancel();
  }
  override changed(layout = false): void {
    if (!this.available) this.session?.cancel();
    super.changed(layout);
  }
}
