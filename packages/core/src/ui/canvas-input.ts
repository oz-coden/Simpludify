import type { CanvasNativeControl } from "./native-edit";
import { EngineError } from "../foundation/diagnostics";
import { defineEvent } from "../foundation/events";
import { cleanupAll, type LifetimeOwner } from "../foundation/lifetime";
import type {
  CanvasActivation,
  CanvasControlModel,
  CanvasControlPort,
} from "./canvas-control";
import { canvasSliderGeometry } from "./canvas-control";
import {
  CanvasNode,
  type CanvasNodeKind,
  type CanvasStyle,
} from "./canvas-node";

export type CanvasValueSource = CanvasActivation | "program";
export interface CanvasValueChange<T> {
  readonly node: CanvasInputNode<T>;
  readonly previous: T;
  readonly value: T;
  readonly source: CanvasValueSource;
}
export interface CanvasEditEnd<T> {
  readonly node: CanvasInputNode<T>;
  readonly previous: T;
  readonly value: T;
  readonly source: CanvasActivation;
}
const boolean = (value: boolean): boolean => {
  if (typeof value !== "boolean")
    throw new EngineError("INVALID_UI", "Control flag must be boolean");
  return value;
};
/** Small value/lifetime foundation. Existing buttons and panels do not inherit it. */
export abstract class CanvasInputNode<T> extends CanvasNode {
  private current: T;
  private locked: boolean;
  private inputRevision = 0;
  private edit: { previous: T; source: CanvasActivation } | undefined;
  private readonly changeEvent =
    defineEvent<CanvasValueChange<T>>("CanvasValueChange");
  private readonly commitEvent =
    defineEvent<CanvasEditEnd<T>>("CanvasValueCommit");
  private readonly cancelEvent =
    defineEvent<CanvasEditEnd<T>>("CanvasValueCancel");
  private readonly port: CanvasControlPort;
  protected constructor(
    kind: CanvasNodeKind,
    text: string,
    initial: T,
    private readonly normalize: (value: T) => T,
    readOnly: boolean,
    style: CanvasStyle,
    keys: readonly string[] = [],
    pointerAxis?: "horizontal",
  ) {
    const value = normalize(initial),
      locked = boolean(readOnly);
    super(kind, {
      text,
      style: {
        padding: 12,
        minHeight: 44,
        pointerEvents: "auto",
        background: 0x23594e,
        ...style,
      },
    });
    this.current = value;
    this.locked = locked;
    const self = this;
    this.port = Object.freeze({
      get model() {
        return self.model();
      },
      get revision() {
        return self.inputRevision;
      },
      get native() { return self.nativeControl; },
      keys,
      ...(pointerAxis ? { pointerAxis } : {}),
      key: (code: string) => self.controlKey(code),
      beginPointer: (x: number, y: number) => self.beginPointer(x, y),
      movePointer: (x: number, y: number) => self.movePointer(x, y),
      endPointer: (cancelled: boolean) => self.endPointer(cancelled),
    });
    this.onDispose(() => this.endPointer(true));
  }
  override get control(): CanvasControlPort {
    return this.port;
  }
  protected abstract model(): CanvasControlModel;
  protected get nativeControl(): CanvasNativeControl | undefined { return undefined; }
  protected valueReplaced(): void {}
  protected controlKey(_code: string): void {}
  protected beginPointer(_x: number, _y: number): boolean {
    return false;
  }
  protected movePointer(_x: number, _y: number): void {}
  protected assertInputAlive(): void {
    if (this.disposed)
      throw new EngineError("OWNER_DISPOSED", "UI control has been disposed");
  }
  get value(): T {
    return this.current;
  }
  set value(value: T) {
    this.setValue(value);
  }
  get readOnly(): boolean {
    return this.locked;
  }
  set readOnly(value: boolean) {
    this.assertInputAlive();
    const next = boolean(value);
    if (next === this.locked) return;
    this.nativeControl?.end("interrupt");
    this.locked = next;
    this.inputRevision++;
    const edit = this.takeEdit();
    cleanupAll(
      [() => this.changed(), () => this.cancelled(edit)],
      "Control read-only change failed",
    );
  }
  get editing(): boolean {
    return this.edit !== undefined;
  }
  onChange(
    handler: (event: CanvasValueChange<T>) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(this.changeEvent, handler, owner);
  }
  onCommit(
    handler: (event: CanvasEditEnd<T>) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(this.commitEvent, handler, owner);
  }
  onCancel(
    handler: (event: CanvasEditEnd<T>) => void,
    owner?: LifetimeOwner,
  ): () => void {
    return this.events.on(this.cancelEvent, handler, owner);
  }
  /** Validated program command, even for disabled/read-only controls; cancels pending pointer editing, including equal writes. */
  setValue(value: T): void {
    this.assertInputAlive();
    const next = this.normalize(value),
      previous = this.current;
    this.nativeControl?.end("interrupt");
    const edit = this.takeEdit();
    this.current = next;
    this.inputRevision++;
    this.valueReplaced();
    cleanupAll(
      [
        () => this.changed(),
        () => this.notify(previous, next, "program"),
        () => this.cancelled(edit),
      ],
      "Program control update failed",
    );
  }
  protected userValue(value: T, source: CanvasActivation, commit = true): void {
    if (!this.available || this.readOnly) return;
    const next = this.normalize(value),
      previous = this.current;
    if (Object.is(previous, next)) return;
    this.current = next;
    const revision = this.inputRevision;
    cleanupAll(
      [
        () => this.changed(),
        () => this.notify(previous, next, source),
        () => {
          if (
            commit &&
            !this.disposed &&
            this.inputRevision === revision &&
            Object.is(this.current, next)
          )
            this.events.emit(
              this.commitEvent,
              Object.freeze({ node: this, previous, value: next, source }),
            );
        },
      ],
      "User control update failed",
    );
  }
  protected beginEdit(source: CanvasActivation = "pointer"): boolean {
    if (!this.available || this.readOnly || this.edit) return false;
    this.edit = { previous: this.current, source };
    this.changed();
    return true;
  }
  private takeEdit(): { previous: T; source: CanvasActivation } | undefined {
    const edit = this.edit;
    this.edit = undefined;
    return edit;
  }
  private notify(previous: T, value: T, source: CanvasValueSource): void {
    if (!this.disposed && !Object.is(previous, value))
      this.events.emit(
        this.changeEvent,
        Object.freeze({ node: this, previous, value, source }),
      );
  }
  private cancelled(edit: { previous: T; source: CanvasActivation } | undefined): void {
    if (edit)
      this.events.emit(
        this.cancelEvent,
        Object.freeze({
          node: this,
          previous: edit.previous,
          value: this.current,
          source: edit.source,
        }),
      );
  }
  /** Cancellation retains the latest immediate value; it never creates a commit or rolls back application state. */
  protected endPointer(cancelled: boolean): void {
    const edit = this.takeEdit();
    if (!edit) return;
    const value = this.current,
      revision = this.inputRevision;
    cleanupAll(
      [
        () => {
          if (!this.disposed && !this.ui?.disposed) this.changed();
        },
        () => {
          if (cancelled) this.cancelled(edit);
          else if (
            !this.disposed &&
            this.inputRevision === revision &&
            Object.is(this.current, value) &&
            !Object.is(edit.previous, value)
          )
            this.events.emit(
              this.commitEvent,
              Object.freeze({
                node: this,
                previous: edit.previous,
                value,
                source: edit.source,
              }),
            );
        },
      ],
      "Control edit completion failed",
    );
  }
}
export interface CanvasCheckboxOptions {
  checked?: boolean;
  readOnly?: boolean;
}
export class CanvasCheckboxNode extends CanvasInputNode<boolean> {
  constructor(
    text: string,
    options: CanvasCheckboxOptions = {},
    style: CanvasStyle = {},
  ) {
    super(
      "checkbox",
      text,
      options.checked === undefined ? false : options.checked,
      boolean,
      options.readOnly === undefined ? false : options.readOnly,
      style,
    );
  }
  get checked(): boolean {
    return this.value;
  }
  set checked(value: boolean) {
    this.setValue(value);
  }
  protected override model(): CanvasControlModel {
    return Object.freeze({
      kind: "checkbox",
      checked: this.value,
      readOnly: this.readOnly,
    });
  }
  override activate(source: CanvasActivation = "accessibility"): void {
    this.userValue(!this.value, source);
  }
}
export function CanvasCheckbox(
  text: string,
  options: CanvasCheckboxOptions = {},
  style: CanvasStyle = {},
): CanvasCheckboxNode {
  return new CanvasCheckboxNode(text, options, style);
}

export interface CanvasSliderRange {
  min?: number;
  max?: number;
  step?: number;
}
export interface CanvasSliderOptions extends CanvasSliderRange {
  label?: string;
  value?: number;
  readOnly?: boolean;
}
interface Range {
  min: number;
  max: number;
  step: number;
}
export function canvasNumericRange(options: CanvasSliderRange): Range {
  const { min = 0, max = 100, step = 1 } = options;
  if (
    ![min, max, step].every(Number.isFinite) ||
    max <= min ||
    step <= 0 ||
    !Number.isFinite(max - min) ||
    !Number.isFinite((max - min) / step) ||
    (max - min) / step > Number.MAX_SAFE_INTEGER ||
    (step < max - min && (min + step === min || max - step === max))
  )
    throw new EngineError(
      "INVALID_UI",
      "Slider requires finite min < max and a positive, representable step",
    );
  return { min, max, step };
}
export function canvasNumericValue(value: number, range: Range): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new EngineError("INVALID_UI", "Slider value must be finite");
  const { min, max, step } = range;
  if (value <= min) return min;
  if (value >= max) return max;
  const raw = min + Math.round((value - min) / step) * step;
  const rounded = Number(raw.toPrecision(15));
  return Math.max(
    min,
    Math.min(
      max,
      Math.abs(raw - rounded) <= Math.max(1, Math.abs(raw)) * Number.EPSILON * 2
        ? rounded
        : raw,
    ),
  );
}
const sliderKeys = Object.freeze([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);
export class CanvasSliderNode extends CanvasInputNode<number> {
  private readonly range: Range;
  constructor(options: CanvasSliderOptions = {}, style: CanvasStyle = {}) {
    const range = canvasNumericRange(options);
    super(
      "slider",
      options.label === undefined ? "Value" : options.label,
      options.value === undefined ? range.min : options.value,
      (value) => canvasNumericValue(value, range),
      options.readOnly === undefined ? false : options.readOnly,
      { width: 260, maxWidth: "100%", height: 76, ...style },
      sliderKeys,
      "horizontal",
    );
    this.range = range;
  }
  get min(): number {
    return this.range.min;
  }
  get max(): number {
    return this.range.max;
  }
  get step(): number {
    return this.range.step;
  }
  /** Atomic range validation; clamps/snaps the value and cancels active pointer editing. */
  setRange(patch: CanvasSliderRange): void {
    this.assertInputAlive();
    const next = canvasNumericRange({ ...this.range, ...patch });
    Object.assign(this.range, next);
    this.setValue(this.value);
  }
  protected override model(): CanvasControlModel {
    return Object.freeze({
      kind: "slider",
      value: this.value,
      ...this.range,
      ratio: (this.value - this.min) / (this.max - this.min),
      readOnly: this.readOnly,
    });
  }
  protected override controlKey(code: string): void {
    if (this.editing || !sliderKeys.includes(code)) return;
    const direction = ["ArrowRight", "ArrowUp", "PageUp"].includes(code)
      ? 1
      : -1;
    this.userValue(
      code === "Home"
        ? this.min
        : code === "End"
          ? this.max
          : Math.max(
              this.min,
              Math.min(
                this.max,
                this.value +
                  direction * this.step * (code.startsWith("Page") ? 10 : 1),
              ),
            ),
      "keyboard",
    );
  }
  protected override beginPointer(x: number, y: number): boolean {
    if (!this.beginEdit()) return false;
    if (this.editing) this.movePointer(x, y);
    return this.editing;
  }
  protected override movePointer(x: number, _y: number): void {
    if (!this.editing || !Number.isFinite(x)) return;
    const geometry = canvasSliderGeometry(this);
    if (geometry && geometry.track.width > 0)
      this.userValue(
        this.min +
          Math.max(
            0,
            Math.min(1, (x - geometry.track.x) / geometry.track.width),
          ) *
            (this.max - this.min),
        "pointer",
        false,
      );
  }
}
export function CanvasSlider(
  options: CanvasSliderOptions = {},
  style: CanvasStyle = {},
): CanvasSliderNode {
  return new CanvasSliderNode(options, style);
}
