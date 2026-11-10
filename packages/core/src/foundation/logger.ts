import { EngineError } from "./diagnostics";
import type { LifetimeOwner } from "./lifetime";

const priorities = { debug: 0, info: 1, warn: 2, error: 3 } as const;
export type LogLevel = keyof typeof priorities;

export interface DiagnosticOptions {
  readonly code?: string;
  readonly source?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
  readonly fatal?: boolean;
}

export interface Diagnostic extends DiagnosticOptions {
  readonly level: LogLevel;
  readonly message: string;
}

export type DiagnosticSink = (entry: Diagnostic) => void;

export interface LoggerOptions {
  /** Threshold for the standard sink only. Subscribers receive all levels. */
  readonly minimumLevel?: LogLevel;
  readonly deduplicate?: boolean;
  readonly sink?: DiagnosticSink;
}

export interface FaultOptions {
  readonly source?: string;
  readonly fatal?: boolean;
  /** Safe summary when the original error text may contain private data. */
  readonly message?: string;
}

/** Compare plain diagnostic data without invoking accessors or retaining a log history. */
function signature(entry: Diagnostic): string | undefined {
  const visited = new Set<object>();
  let remaining = 256;
  function encode(value: unknown, depth: number): unknown {
    if (--remaining < 0 || depth > 12)
      throw new Error("Diagnostic is too large");
    switch (typeof value) {
      case "string":
        if (value.length > 16384) throw new Error("Diagnostic is too large");
        return value;
      case "boolean":
        return value;
      case "number":
        return ["number", Object.is(value, -0) ? "-0" : String(value)];
      case "bigint":
        return ["bigint", String(value)];
      case "undefined":
        return ["undefined"];
      case "object": {
        if (value === null) return null;
        if (visited.has(value) || Object.getOwnPropertySymbols(value).length)
          throw new Error("Opaque diagnostic value");
        const prototype = Object.getPrototypeOf(value);
        const error = value instanceof Error;
        if (
          !error &&
          !Array.isArray(value) &&
          prototype !== Object.prototype &&
          prototype !== null
        )
          throw new Error("Opaque diagnostic value");
        visited.add(value);
        const fields = Object.getOwnPropertyDescriptors(value);
        const keys = Object.keys(fields)
          .filter((key) => !(error && key === "stack"))
          .sort();
        const result = keys.map((key) => {
          const field = fields[key];
          if (!field || !("value" in field))
            throw new Error("Opaque diagnostic accessor");
          return [key, encode(field.value, depth + 1)];
        });
        visited.delete(value);
        // Error name can be inherited, but its stack is location-specific.
        const name =
          error && prototype
            ? Object.getOwnPropertyDescriptor(prototype, "name")?.value
            : Array.isArray(value)
              ? "array"
              : "object";
        return [error ? "error" : "data", name, result];
      }
      default:
        throw new Error("Opaque diagnostic value");
    }
  }
  try {
    const key = JSON.stringify(encode(entry, 0));
    return key.length <= 16384 ? key : undefined;
  } catch {
    // Incomparable payloads are never merged.
    return undefined;
  }
}

/** Game-local diagnostic fan-out with no retained history. */
export class Logger {
  private readonly subscribers = new Set<DiagnosticSink>();
  private emitting = false;
  private readonly threshold: number;
  private last: string | undefined;

  constructor(private readonly options: LoggerOptions = {}) {
    const minimum = options.minimumLevel ?? "debug";
    if (!Object.hasOwn(priorities, minimum))
      throw new EngineError("INVALID_VALUE", "Unknown minimum log level");
    this.threshold = priorities[minimum];
  }

  subscribe(sink: DiagnosticSink, owner?: LifetimeOwner): () => void {
    if (owner?.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Cannot subscribe with a disposed owner",
      );
    const subscriber = (entry: Diagnostic) => sink(entry);
    this.subscribers.add(subscriber);
    let removeOwnership: (() => void) | undefined;
    const off = () => {
      this.subscribers.delete(subscriber);
      const remove = removeOwnership;
      removeOwnership = undefined;
      remove?.();
    };
    try {
      removeOwnership = owner?.onDispose(off);
    } catch (error) {
      off();
      throw error;
    }
    return off;
  }

  debug(message: string, options?: DiagnosticOptions): void {
    this.emit("debug", message, options);
  }

  info(message: string, options?: DiagnosticOptions): void {
    this.emit("info", message, options);
  }

  warn(message: string, options?: DiagnosticOptions): void {
    this.emit("warn", message, options);
  }

  error(message: string, options?: DiagnosticOptions): void {
    this.emit("error", message, options);
  }

  report(cause: unknown, options: FaultOptions = {}): void {
    const engineError = cause instanceof EngineError ? cause : undefined;
    const source = options.source ?? engineError?.source;
    const fatal = options.fatal ?? engineError?.fatal;
    this.error(options.message ?? "Unexpected runtime error", {
      code: engineError?.code ?? "UNEXPECTED_ERROR",
      ...(source === undefined ? {} : { source }),
      ...(fatal === undefined ? {} : { fatal }),
      ...(engineError ? { details: engineError.details } : {}),
      cause,
    });
  }

  private deliver(sink: DiagnosticSink, entry: Diagnostic): void {
    try {
      const result: unknown = sink(entry);
      if (
        result &&
        (typeof result === "object" || typeof result === "function") &&
        "then" in result
      )
        void Promise.resolve(result).catch(() => {});
    } catch {
      // A faulty output or diagnostic subscriber must not change engine control flow.
    }
  }

  private emit(
    level: LogLevel,
    message: string,
    options?: DiagnosticOptions,
  ): void {
    if (this.emitting) return;
    this.emitting = true;
    try {
      const entry: Diagnostic = Object.freeze({ ...options, level, message });
      const sink = this.options.sink;
      if (sink && priorities[level] >= this.threshold) {
        const key =
          this.options.deduplicate === false ? undefined : signature(entry);
        if (key === undefined || key !== this.last) {
          this.last = key;
          this.deliver(sink, entry);
        }
      }
      for (const subscriber of [...this.subscribers])
        if (this.subscribers.has(subscriber)) this.deliver(subscriber, entry);
    } finally {
      this.emitting = false;
    }
  }
}
