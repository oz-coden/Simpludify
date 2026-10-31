import { EngineError } from "../foundation/diagnostics";
import type { CanvasActivation, CanvasControlModel } from "./canvas-control";
import { CanvasInputNode } from "./canvas-input";
import type { CanvasStyle } from "./canvas-node";
import { type CanvasNativeControl, type CanvasNativeSession, nativeSession } from "./native-edit";

export interface CanvasSelectOption<T> {
  readonly label: string;
  readonly value: T;
  readonly disabled?: boolean;
}
export interface CanvasSelectOptions<T> {
  label?: string;
  value?: T;
  readOnly?: boolean;
}
function copyOptions<T>(options: readonly CanvasSelectOption<T>[]) {
  const result = options.map((option, index) => {
    if (typeof option.label !== "string" || option.value === undefined ||
        (option.disabled !== undefined && typeof option.disabled !== "boolean") ||
        options.some((o, i) => i < index && Object.is(o.value, option.value)))
      throw new EngineError("INVALID_UI", "Select requires labels and unique defined values");
    return Object.freeze({ label: option.label, value: option.value, disabled: option.disabled ?? false });
  });
  return Object.freeze(result);
}
/** Native popup presentation is Host-owned; typed values/options and transactions are portable. */
export class CanvasSelectNode<T> extends CanvasInputNode<T | undefined> {
  private readonly state: { options: ReturnType<typeof copyOptions<T>> };
  private session: CanvasNativeSession<number> | undefined;
  private draftIndex = -1;
  constructor(options: readonly CanvasSelectOption<T>[], config: CanvasSelectOptions<T> = {}, style: CanvasStyle = {}) {
    const state = { options: copyOptions(options) };
    const first = () => state.options.find((o) => !o.disabled)?.value ?? state.options[0]?.value;
    super("select", config.label ?? "Select", config.value === undefined ? first() : config.value,
      (value) => {
        if (value === undefined && state.options.length === 0) return value;
        if (!state.options.some((o) => Object.is(o.value, value)))
          throw new EngineError("INVALID_UI", "Select value must belong to its options");
        return value;
      }, config.readOnly ?? false, { width: 260, maxWidth: "100%", height: 48, textWrap: false, ...style });
    this.state = state;
    this.onDispose(() => this.session?.cancel());
  }
  get options(): readonly CanvasSelectOption<T>[] { return this.state.options; }
  /** Atomically replace copied options. Missing values fall back to the first enabled option (then first option). */
  setOptions(options: readonly CanvasSelectOption<T>[]): void {
    this.assertInputAlive();
    const next = copyOptions(options);
    this.nativeControl.end("interrupt");
    this.state.options = next;
    this.setValue(next.some((o) => Object.is(o.value, this.value)) ? this.value : next.find((o) => !o.disabled)?.value ?? next[0]?.value);
  }
  private get selectedIndex(): number { return this.state.options.findIndex((o) => Object.is(o.value, this.value)); }
  protected override model(): CanvasControlModel {
    return Object.freeze({ kind: "select", options: this.state.options, selectedIndex: this.selectedIndex, readOnly: this.readOnly });
  }
  protected override get nativeControl(): CanvasNativeControl & { kind: "select" } {
    return { kind: "select", begin: (source) => this.beginSelection(source), end: (reason) => {
      if (reason === "blur" && this.available && !this.readOnly) this.session?.commit();
      else this.session?.cancel();
    } };
  }
  beginSelection(source: CanvasActivation = "keyboard"): CanvasNativeSession<number> | undefined {
    if (this.session?.active) return this.session;
    if (!this.beginEdit(source)) return;
    this.draftIndex = this.selectedIndex;
    const revision = this.control.revision;
    const session: CanvasNativeSession<number> = nativeSession<number>(
      () => this.available && !this.readOnly && this.control.revision === revision && this.session === session,
      (index) => {
        if (!Number.isInteger(index) || !this.state.options[index] || this.state.options[index]?.disabled)
          throw new EngineError("INVALID_UI", "Selection requires an enabled option index");
        this.draftIndex = index;
      },
      (commit) => {
        this.session = undefined;
        const option = this.state.options[this.draftIndex];
        try {
          if (commit && option && !option.disabled && this.available && !this.readOnly)
            this.userValue(option.value, source, false);
        } finally { this.endPointer(!commit); }
        return commit;
      },
    );
    this.session = session;
    return session;
  }
  override changed(layout = false): void {
    if (!this.available) this.session?.cancel();
    super.changed(layout);
  }
}
export function CanvasSelect<T>(options: readonly CanvasSelectOption<T>[], config: CanvasSelectOptions<T> = {}, style: CanvasStyle = {}): CanvasSelectNode<T> {
  return new CanvasSelectNode(options, config, style);
}
