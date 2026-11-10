import {
  cleanupAll,
  EngineError,
  type LifetimeOwner,
  type Logger,
} from "@simpludify/core";
import type { AssetHandle, AssetStore } from "./assets";

export interface AudioGroupOptions {
  readonly parent?: string;
  readonly volume?: number;
  readonly maxVoices?: number;
}

export interface AudioPlayOptions {
  readonly group?: string;
  readonly owner?: LifetimeOwner;
  readonly volume?: number;
  readonly loop?: boolean;
  /** Optional cap for simultaneous instances of this asset. */
  readonly maxVoices?: number;
}

export type AudioEndReason = "ended" | "stopped" | "replaced" | "failed";
export type AudioPlaybackState =
  | "pending"
  | "playing"
  | "paused"
  | AudioEndReason;

function volume(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1)
    throw new EngineError(
      "INVALID_VALUE",
      "Audio volume must be between zero and one",
    );
  return value;
}
function voiceLimit(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0))
    throw new EngineError(
      "INVALID_VALUE",
      "Audio voice limit must be a positive integer",
    );
  return value;
}

export class AudioGroup {
  private gain: GainNode | undefined;
  private level: number;
  readonly maxVoices: number | undefined;

  /** @internal */
  constructor(
    readonly name: string,
    readonly parent: AudioGroup | undefined,
    options: AudioGroupOptions = {},
  ) {
    this.level = volume(options.volume ?? 1);
    this.maxVoices = voiceLimit(options.maxVoices);
  }

  get volume(): number {
    return this.level;
  }
  set volume(value: number) {
    this.level = volume(value);
    if (this.gain) this.gain.gain.value = this.level;
  }

  /** @internal */
  node(context: AudioContext): GainNode {
    if (this.gain) return this.gain;
    const output = this.parent?.node(context) ?? context.destination;
    const gain = context.createGain();
    gain.gain.value = this.level;
    gain.connect(output);
    this.gain = gain;
    return gain;
  }

  /** @internal */
  disconnect(): void {
    this.gain?.disconnect();
    this.gain = undefined;
  }
}

export class AudioPlayback {
  readonly finished: Promise<AudioEndReason>;
  readonly assetId: string;
  private resolve: (reason: AudioEndReason) => void = () => {};
  private phase: AudioPlaybackState = "pending";
  private done = false;
  private source: AudioBufferSourceNode | undefined;
  private gain: GainNode | undefined;
  private buffer: AudioBuffer | null | undefined;
  private position = 0;
  private startedAt = 0;
  private level: number;
  private looping: boolean;
  private offOwner: (() => void) | undefined;

  /** @internal */
  constructor(
    private readonly audio: GameAudio,
    private readonly use: AssetHandle<"audio">,
    readonly group: AudioGroup,
    options: AudioPlayOptions,
  ) {
    this.assetId = use.id;
    this.level = volume(options.volume ?? 1);
    this.looping = options.loop ?? false;
    this.finished = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.offOwner = options.owner?.onDispose(() => this.stop());
    void use.ready
      .then(() => this.startIfReady())
      .catch((cause) => this.fail(cause));
  }

  get state(): AudioPlaybackState {
    return this.phase;
  }
  get volume(): number {
    return this.level;
  }
  set volume(value: number) {
    this.level = volume(value);
    if (this.gain) this.gain.gain.value = this.level;
  }
  get loop(): boolean {
    return this.looping;
  }
  set loop(value: boolean) {
    if (typeof value !== "boolean")
      throw new EngineError("INVALID_VALUE", "Audio loop must be boolean");
    this.looping = value;
    if (this.source) this.source.loop = value;
  }

  pause(): void {
    if (this.phase !== "playing" && this.phase !== "pending") return;
    try {
      if (this.phase === "playing") {
        this.position += Math.max(
          0,
          this.audio.device().currentTime - this.startedAt,
        );
        this.clearSource(true);
      }
      this.phase = "paused";
    } catch (cause) {
      this.fail(cause);
    }
  }

  resume(): void {
    if (this.phase !== "paused") return;
    this.phase = "pending";
    this.startIfReady();
  }

  stop(): void {
    this.finish("stopped");
  }

  /** @internal */
  replace(): void {
    this.finish("replaced");
  }

  /** @internal */
  startIfReady(): void {
    if (this.phase !== "pending") return;
    const current = this.buffer === undefined ? this.use.value : this.buffer;
    if (current === undefined) return;
    try {
      const context = this.audio.device();
      if (context.state !== "running") return;
      this.buffer = current;
      const buffer = current ?? context.createBuffer(1, 1, context.sampleRate);
      if (buffer.duration <= 0) {
        this.finish("ended");
        return;
      }
      if (this.position >= buffer.duration) {
        if (!this.looping) {
          this.finish("ended");
          return;
        }
        this.position %= buffer.duration;
      }
      if (!this.gain) {
        this.gain = context.createGain();
        this.gain.gain.value = this.level;
        this.gain.connect(this.group.node(context));
      }
      const source = context.createBufferSource();
      this.source = source;
      source.buffer = buffer;
      source.loop = this.looping;
      source.connect(this.gain);
      source.onended = () => {
        if (this.source === source) this.finish("ended");
      };
      this.startedAt = context.currentTime;
      source.start(0, this.position);
      this.phase = "playing";
    } catch (cause) {
      this.fail(cause);
    }
  }

  private clearSource(stop: boolean): void {
    const source = this.source;
    this.source = undefined;
    if (!source) return;
    source.onended = null;
    try {
      if (stop) source.stop();
    } finally {
      source.disconnect();
    }
  }

  private fail(cause: unknown): void {
    if (this.done) return;
    this.audio.report(cause, "Audio playback failed");
    this.finish("failed");
  }

  private finish(reason: AudioEndReason): void {
    if (this.done) return;
    this.done = true;
    this.phase = reason;
    this.buffer = undefined;
    this.audio.remove(this);
    try {
      cleanupAll(
        [
          () => this.clearSource(reason !== "ended"),
          () => this.gain?.disconnect(),
          () => this.offOwner?.(),
          () => this.use.release(),
        ],
        "Audio playback cleanup failed",
      );
    } catch (cause) {
      this.audio.report(cause, "Audio playback cleanup failed");
    } finally {
      this.offOwner = undefined;
      this.gain = undefined;
      this.resolve(reason);
    }
  }
}

/** One Web Audio context per Game, created only when audio is requested. */
export class GameAudio {
  private readonly shutdown = new AbortController();
  private readonly groups = new Map<string, AudioGroup>();
  private readonly voices = new Set<AudioPlayback>();
  private context: AudioContext | undefined;
  readonly master = new AudioGroup("master", undefined);

  /** @internal */
  constructor(
    host: HTMLElement,
    private readonly assets: AssetStore,
    private readonly logger: Logger,
  ) {
    this.groups.set("master", this.master);
    this.group("music");
    this.group("effects");
    const gesture = (event: Event) => {
      if (event.isTrusted && (this.context || this.voices.size))
        void this.unlock();
    };
    const options = { capture: true, signal: this.shutdown.signal };
    host.addEventListener("pointerup", gesture, options);
    host.addEventListener("keydown", gesture, options);
  }

  get state(): AudioContextState | "idle" {
    return (
      this.context?.state ?? (this.shutdown.signal.aborted ? "closed" : "idle")
    );
  }

  group(name: string, options?: AudioGroupOptions): AudioGroup {
    this.assertAlive();
    if (typeof name !== "string" || !name.trim())
      throw new EngineError(
        "INVALID_VALUE",
        "Audio group name cannot be empty",
      );
    const existing = this.groups.get(name);
    if (existing) {
      if (options)
        throw new EngineError(
          "AUDIO_GROUP_EXISTS",
          "Audio group is already configured",
        );
      return existing;
    }
    const parent = this.groups.get(options?.parent ?? "master");
    if (!parent)
      throw new EngineError(
        "AUDIO_GROUP_UNKNOWN",
        "Unknown parent audio group",
      );
    const group = new AudioGroup(name, parent, options);
    this.groups.set(name, group);
    return group;
  }

  play(
    asset: AssetHandle<"audio">,
    options: AudioPlayOptions = {},
  ): AudioPlayback {
    this.assertAlive();
    if (asset?.kind !== "audio")
      throw new EngineError("INVALID_VALUE", "An audio asset is required");
    if (options.owner?.disposed)
      throw new EngineError(
        "OWNER_DISPOSED",
        "Audio playback owner is disposed",
      );
    volume(options.volume ?? 1);
    if (options.loop !== undefined && typeof options.loop !== "boolean")
      throw new EngineError("INVALID_VALUE", "Audio loop must be boolean");
    const limit = voiceLimit(options.maxVoices);
    const group = this.groups.get(options.group ?? "effects");
    if (!group)
      throw new EngineError("AUDIO_GROUP_UNKNOWN", "Unknown playback group");
    const use = asset.retain(this.assets);
    let voice: AudioPlayback;
    try {
      voice = new AudioPlayback(this, use, group, options);
    } catch (error) {
      use.release();
      throw error;
    }
    this.voices.add(voice);
    if (limit !== undefined)
      this.enforceLimit(limit, (item) => item.assetId === voice.assetId);
    for (let node: AudioGroup | undefined = group; node; node = node.parent) {
      const limit = node.maxVoices;
      const ancestor = node;
      if (limit !== undefined)
        this.enforceLimit(limit, (item) => {
          for (
            let parent: AudioGroup | undefined = item.group;
            parent;
            parent = parent.parent
          )
            if (parent === ancestor) return true;
          return false;
        });
    }
    return voice;
  }

  private enforceLimit(
    limit: number,
    applies: (voice: AudioPlayback) => boolean,
  ): void {
    const voices = [...this.voices].filter(applies);
    for (const voice of voices.slice(0, Math.max(0, voices.length - limit)))
      voice.replace();
  }

  private assertAlive(): void {
    if (this.shutdown.signal.aborted)
      throw new EngineError("GAME_DISPOSED", "Audio is disposed");
  }

  /** @internal */
  device(): AudioContext {
    this.assertAlive();
    if (!this.context) {
      this.context = new AudioContext();
      this.context.addEventListener("statechange", this.drain, {
        signal: this.shutdown.signal,
      });
    }
    return this.context;
  }

  /** @internal */
  decode(bytes: ArrayBuffer): Promise<AudioBuffer> {
    return this.device().decodeAudioData(bytes);
  }

  /** Call from a trusted user gesture to start pending playback. */
  async unlock(): Promise<boolean> {
    if (this.shutdown.signal.aborted) return false;
    try {
      const context = this.device();
      if (context.state !== "running") {
        if (navigator.userActivation?.isActive === false) return false;
        const signal = this.shutdown.signal;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let abort: () => void = () => {};
        try {
          await Promise.race([
            context.resume(),
            new Promise<void>((resolve) => {
              abort = resolve;
              signal.addEventListener("abort", abort, { once: true });
              timer = setTimeout(resolve, 1500);
            }),
          ]);
        } finally {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
        }
      }
      if (this.shutdown.signal.aborted || context.state !== "running")
        return false;
      this.drain();
      return true;
    } catch (cause) {
      if (!this.shutdown.signal.aborted)
        this.report(cause, "Audio context could not resume");
      return false;
    }
  }

  private readonly drain = () => {
    for (const voice of [...this.voices]) voice.startIfReady();
  };

  /** @internal */
  remove(voice: AudioPlayback): void {
    this.voices.delete(voice);
  }

  /** @internal */
  report(cause: unknown, message: string): void {
    this.logger.report(cause, {
      source: "engine.audio",
      message,
      fatal: false,
    });
  }

  /** @internal */
  dispose(): void {
    if (this.shutdown.signal.aborted) return;
    this.shutdown.abort();
    const context = this.context;
    this.context = undefined;
    try {
      cleanupAll(
        [
          ...[...this.voices].map((voice) => () => voice.stop()),
          ...[...this.groups.values()]
            .reverse()
            .map((group) => () => group.disconnect()),
        ],
        "Audio cleanup failed",
      );
    } finally {
      this.groups.clear();
      if (context && context.state !== "closed")
        void context
          .close()
          .catch((cause) =>
            this.report(cause, "Audio context could not close"),
          );
    }
  }
}
