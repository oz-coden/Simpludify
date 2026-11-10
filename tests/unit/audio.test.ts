import { Lifetime, Logger } from "@simpludify/core";
import { expect, it, vi } from "vitest";
import {
  type AssetAdapter,
  AssetScope,
  AssetStore,
} from "../../packages/web/src/assets";
import { GameAudio } from "../../packages/web/src/audio";

class Gain {
  gain = { value: 0 };
  output: Gain | object | undefined;
  connect(output: Gain | object) {
    this.output = output;
  }
  disconnect() {
    this.output = undefined;
  }
}

class Source {
  buffer: { duration: number } | null = null;
  loop = false;
  onended: (() => void) | null = null;
  readonly start = vi.fn();
  readonly stop = vi.fn();
  readonly disconnect = vi.fn();
  output: Gain | undefined;
  connect(output: Gain) {
    this.output = output;
  }
}

class Device extends EventTarget {
  static last: Device | undefined;
  state: "running" | "suspended" | "closed" = "suspended";
  currentTime = 0;
  readonly destination = {};
  readonly sampleRate = 44100;
  readonly sources: Source[] = [];
  constructor() {
    super();
    Device.last = this;
  }
  createGain() {
    return new Gain();
  }
  createBufferSource() {
    const source = new Source();
    this.sources.push(source);
    return source;
  }
  async resume() {
    this.state = "running";
    this.dispatchEvent(new Event("statechange"));
  }
  async close() {
    this.state = "closed";
  }
}

it("unlocks queued voices, routes hierarchical gain and resumes with a new source at the saved offset", async () => {
  vi.stubGlobal("AudioContext", Device);
  vi.stubGlobal("navigator", { userActivation: { isActive: false } });
  const logger = new Logger();
  let generation = { duration: 4 };
  const adapter: AssetAdapter = {
    load: async () => ({ value: generation, release() {} }),
    fallback: async () => undefined,
  };
  const store = new AssetStore(adapter, logger, "https://game.example/");
  const assets = new AssetScope(store, undefined, true);
  const audio = new GameAudio(new EventTarget() as HTMLElement, store, logger);
  try {
    const asset = await assets.load({ kind: "audio", url: "/music" }).ready;
    const owner = new Lifetime();
    const group = audio.group("stage", { parent: "music", volume: 0.5 });
    audio.group("music").volume = 0.6;
    audio.master.volume = 0.75;
    const voice = audio.play(asset, { owner, group: "stage", volume: 0.4 });
    await vi.waitFor(() => expect(audio.state).toBe("suspended"));
    expect(await audio.unlock()).toBe(false);
    expect(voice.state).toBe("pending");
    const device = Device.last;
    if (!device) throw new Error("Missing device");
    expect(device.sources).toHaveLength(0);
    generation = { duration: 5 };
    await asset.reload();
    const unlockedGeneration = generation;
    vi.stubGlobal("navigator", { userActivation: { isActive: true } });
    expect(await audio.unlock()).toBe(true);
    expect(voice.state).toBe("playing");
    const first = device.sources[0];
    if (!first) throw new Error("Missing playback source");
    expect(first.buffer).toBe(unlockedGeneration);
    const gains: number[] = [];
    let route = first.output;
    while (route) {
      gains.push(route.gain.value);
      route = route.output instanceof Gain ? route.output : undefined;
    }
    expect(gains).toEqual([0.4, 0.5, 0.6, 0.75]);
    group.volume = 0.2;
    const groupGain = first.output?.output;
    expect(groupGain instanceof Gain && groupGain.gain.value).toBe(0.2);
    device.currentTime = 1.25;
    voice.pause();
    expect(voice.state).toBe("paused");
    expect(first.stop).toHaveBeenCalledTimes(1);
    generation = { duration: 6 };
    await asset.reload();
    voice.resume();
    expect(device.sources[1]?.buffer).toBe(unlockedGeneration);
    expect(device.sources[1]?.start).toHaveBeenCalledWith(0, 1.25);
    owner.dispose();
    expect(await voice.finished).toBe("stopped");
    expect(device.sources[1]?.stop).toHaveBeenCalledTimes(1);
    audio.dispose();
    expect(device.state).toBe("closed");
  } finally {
    audio.dispose();
    store.dispose();
    vi.unstubAllGlobals();
  }
});

it("handles zero-duration audio buffers and non-running context pauses without NaN offsets or leaked nodes", async () => {
  vi.stubGlobal("AudioContext", Device);
  vi.stubGlobal("navigator", { userActivation: { isActive: true } });
  const logger = new Logger();
  let duration = 0;
  const adapter: AssetAdapter = {
    load: async () => ({ value: { duration }, release() {} }),
    fallback: async () => undefined,
  };
  const store = new AssetStore(adapter, logger, "https://game.example/");
  const assets = new AssetScope(store, undefined, true);
  const audio = new GameAudio(new EventTarget() as HTMLElement, store, logger);
  try {
    const empty = await assets.load({ kind: "audio", url: "/empty" }).ready;
    expect(await audio.unlock()).toBe(true);
    const loopEmpty = audio.play(empty, { loop: true });
    expect(await loopEmpty.finished).toBe("ended");
    expect(Device.last?.sources).toHaveLength(0);

    duration = 4;
    await empty.reload();
    const voice = audio.play(empty);
    await vi.waitFor(() => expect(voice.state).toBe("playing"));
    const device = Device.last;
    if (!device) throw new Error("Missing device");
    const first = device.sources[0];
    device.state = "suspended";
    device.currentTime = 1;
    voice.pause();
    expect(voice.state).toBe("paused");
    voice.resume();
    expect(voice.state).toBe("pending");
    voice.pause();
    expect(voice.state).toBe("paused");
    await device.resume();
    expect(voice.state).toBe("paused");
    expect(device.sources).toHaveLength(1);
    expect(first?.stop).toHaveBeenCalledTimes(1);
    voice.resume();
    expect(voice.state).toBe("playing");
    expect(device.sources[1]?.start).toHaveBeenCalledWith(0, 1);
  } finally {
    audio.dispose();
    store.dispose();
    vi.unstubAllGlobals();
  }
});
