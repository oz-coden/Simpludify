import type { CanvasControlModel } from "./canvas-control";
import { CanvasTextEditorNode } from "./canvas-editor";
import { canvasNumericRange, canvasNumericValue, type CanvasSliderRange } from "./canvas-input";
import type { CanvasStyle } from "./canvas-node";
export interface CanvasNumberInputOptions extends CanvasSliderRange {
  label?: string;
  value?: number;
  placeholder?: string;
  readOnly?: boolean;
}
/** Locale-independent decimal/exponent input. Incomplete drafts never become numeric values. */
export class CanvasNumberInputNode extends CanvasTextEditorNode<number> {
  private readonly range: ReturnType<typeof canvasNumericRange>;
  constructor(options: CanvasNumberInputOptions = {}, style: CanvasStyle = {}) {
    const range = canvasNumericRange(options), initial = canvasNumericValue(options.value ?? range.min,range);
    super("number-input",options.label ?? "Number",initial,(value)=>canvasNumericValue(value,range),
      options.readOnly ?? false,options.placeholder ?? "",String(initial),style,["ArrowUp","ArrowDown","PageUp","PageDown"]);
    this.range=range;
  }
  get min():number {return this.range.min;}
  get max():number {return this.range.max;}
  get step():number {return this.range.step;}
  setRange(patch: CanvasSliderRange):void {
    this.assertInputAlive();
    const next=canvasNumericRange({...this.range,...patch});
    this.cancel();
    Object.assign(this.range,next);
    this.setValue(this.value);
  }
  protected override format(value:number):string {return String(value);}
  protected override parse(text:string):{value:number}|undefined {
    const trimmed=text.trim();
    if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed))return;
    const value=Number(trimmed);
    return Number.isFinite(value) ? {value:canvasNumericValue(value,this.range)} : undefined;
  }
  protected override model():CanvasControlModel {
    const model=super.model();
    if(model.kind!=="text")return model;
    return Object.freeze({...model,numeric:Object.freeze({value:this.value,...this.range})});
  }
  protected override controlKey(code:string):void {
    if(!this.available || this.readOnly || this.draft.composing || !this.control.keys.includes(code))return;
    const base=this.editing ? this.parse(this.draft.text)?.value ?? this.value : this.value;
    this.cancel();
    const direction=code==="ArrowUp"||code==="PageUp" ? 1 : -1;
    const next=Math.max(this.min,Math.min(this.max,base+direction*this.step*(code.startsWith("Page")?10:1)));
    this.userValue(next,"keyboard");
    this.valueReplaced();
  }
}
export function CanvasNumberInput(options:CanvasNumberInputOptions={},style:CanvasStyle={}):CanvasNumberInputNode {
  return new CanvasNumberInputNode(options,style);
}
