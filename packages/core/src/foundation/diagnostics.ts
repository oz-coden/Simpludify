export interface EngineErrorOptions extends ErrorOptions {
  readonly source?: string;
  readonly fatal?: boolean;
}

export class EngineError extends Error {
  readonly source: string | undefined;
  readonly fatal: boolean | undefined;

  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
    options?: EngineErrorOptions,
  ) {
    super(message, options);
    this.name = "EngineError";
    this.source = options?.source;
    this.fatal = options?.fatal;
  }
  toJSON() {
    return { ...this.details, code: this.code, message: this.message };
  }
}
export function positive(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new EngineError(
      "INVALID_VALUE",
      `${name} must be finite and positive`,
      { field: name },
    );
  return value;
}
