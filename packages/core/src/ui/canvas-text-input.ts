import { EngineError } from "../foundation/diagnostics";
import { CanvasTextEditorNode } from "./canvas-editor";
import type { CanvasStyle } from "./canvas-node";
export interface CanvasTextInputOptions {
  label?: string;
  value?: string;
  placeholder?: string;
  /** Maximum UTF-16 length, matching native maxlength. Composition drafts may temporarily exceed it. */
  maxLength?: number;
  readOnly?: boolean;
}
function lengthLimit(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
    throw new EngineError("INVALID_UI", "maxLength must be a nonnegative safe integer");
  return value;
}
function validText(value: string, limit: number | undefined): string {
  if (typeof value !== "string" || /[\r\n]/.test(value) || (limit !== undefined && value.length > limit))
    throw new EngineError("INVALID_UI", "Text value must be single-line and within maxLength");
  return value;
}
export class CanvasTextInputNode extends CanvasTextEditorNode<string> {
  private readonly constraints: { maxLength: number | undefined };
  constructor(options: CanvasTextInputOptions = {}, style: CanvasStyle = {}) {
    const constraints = {maxLength:lengthLimit(options.maxLength)}, initial = validText(options.value ?? "", constraints.maxLength);
    super("text-input", options.label ?? "Text", initial, (value) => validText(value,constraints.maxLength),
      options.readOnly ?? false, options.placeholder ?? "", initial, style);
    this.constraints = constraints;
  }
  protected override format(value: string): string { return value; }
  protected override parse(text: string): {value:string} | undefined {
    if (this.maxLength !== undefined && text.length > this.maxLength) return;
    return {value:text};
  }
  protected override get limit(): number | undefined { return this.maxLength; }
  get maxLength(): number | undefined { return this.constraints.maxLength; }
  /** Atomic: shrinking below the accepted value is rejected. Valid changes supersede active editing. */
  setMaxLength(value: number | undefined): void {
    this.assertInputAlive();
    const next = lengthLimit(value);
    validText(this.value,next);
    this.constraints.maxLength = next;
    this.setValue(this.value);
  }
}
export function CanvasTextInput(options: CanvasTextInputOptions = {}, style: CanvasStyle = {}): CanvasTextInputNode {
  return new CanvasTextInputNode(options, style);
}
