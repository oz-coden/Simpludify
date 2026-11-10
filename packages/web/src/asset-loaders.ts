import { EngineError } from "@simpludify/core";
import { Texture } from "pixi.js";
import type { AssetAdapter, AssetKind, AssetResource } from "./assets";
import {
  type ImageLease,
  type ImageResource,
  SharedImages,
} from "./shared-images";

const missing = "simpludify:missing-image";

export async function assetResponse(
  url: string,
  signal: AbortSignal,
  reload: boolean,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      cache: reload ? "reload" : "default",
    });
  } catch (cause) {
    signal.throwIfAborted();
    throw new EngineError(
      "ASSET_NETWORK",
      "Asset request did not complete",
      {},
      { cause },
    );
  }
  if (!response.ok) {
    const status = response.status;
    const transient = status === 408 || status === 429 || status >= 500;
    throw new EngineError(
      transient ? "ASSET_NETWORK" : "ASSET_LOAD_FAILED",
      "Asset request failed",
      { status },
    );
  }
  return response;
}

function decodeImage(
  url: string,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const image = new Image();
    const cleanup = () => {
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      image.removeAttribute("src");
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(
        new EngineError("ASSET_LOAD_FAILED", "Image could not be decoded", {
          path: url,
        }),
      );
    };
    image.crossOrigin = "anonymous";
    image.src = url;
  });
}

function checkerboard(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const draw = canvas.getContext("2d");
  if (draw) {
    draw.fillStyle = "#000";
    draw.fillRect(0, 0, 16, 16);
    draw.fillStyle = "#f0f";
    draw.fillRect(0, 0, 8, 8);
    draw.fillRect(8, 8, 8, 8);
  }
  return canvas;
}

export async function loadImageResource(
  url: string,
  signal: AbortSignal,
  mode?: "explicit" | "reload",
): Promise<ImageResource> {
  let objectURL: string | undefined;
  try {
    if (mode && url !== missing) {
      const response = await assetResponse(url, signal, mode === "reload");
      objectURL = URL.createObjectURL(await response.blob());
    }
    const image =
      url === missing
        ? checkerboard()
        : await decodeImage(objectURL ?? url, signal);
    signal.throwIfAborted();
    const texture = Texture.from(image, true);
    if (!(texture.width > 0 && texture.height > 0)) {
      texture.destroy(true);
      throw new EngineError(
        "ASSET_LOAD_FAILED",
        "Image has no drawable dimensions",
      );
    }
    let released = false;
    return {
      texture,
      release: () => {
        if (released) return;
        released = true;
        texture.destroy(true);
      },
    };
  } finally {
    if (objectURL) URL.revokeObjectURL(objectURL);
  }
}

export function createImagePool(load = loadImageResource): SharedImages {
  return new SharedImages(load);
}

function imageAsset(image: ImageLease): AssetResource {
  return {
    value: Object.freeze({
      width: image.texture.width,
      height: image.texture.height,
    }),
    image,
    release: image.release,
  };
}

let nextFont = 0;
const systemFont = "system-ui, sans-serif";

async function registerFont(
  data: ArrayBuffer,
  signal: AbortSignal,
): Promise<AssetResource> {
  const family = `SimpludifyFont${++nextFont}`;
  const face = await new FontFace(family, data).load();
  signal.throwIfAborted();
  document.fonts.add(face);
  return {
    value: `${family}, ${systemFont}`,
    release: () => {
      document.fonts.delete(face);
    },
  };
}

export function browserAssetAdapter(
  images: SharedImages,
  decode: (data: ArrayBuffer) => Promise<AudioBuffer>,
): AssetAdapter {
  const load = async (
    kind: AssetKind,
    url: string,
    signal: AbortSignal,
    reload: boolean,
  ): Promise<AssetResource> => {
    if (kind === "image")
      return imageAsset(
        await images.acquire(reload ? Symbol() : url, signal, {
          url,
          mode: reload ? "reload" : "explicit",
        }),
      );
    const response = await assetResponse(url, signal, reload);
    if (kind === "json") return { value: await response.json(), release() {} };
    const data = await response.arrayBuffer();
    signal.throwIfAborted();
    if (kind === "font") return await registerFont(data, signal);
    return { value: await decode(data), release() {} };
  };
  return {
    load,
    fallback: async (kind, url, signal) => {
      if (url) return await load(kind, url, signal, false);
      if (kind === "image")
        return imageAsset(await images.acquire(missing, signal));
      if (kind === "audio") return { value: null, release() {} };
      if (kind === "font") return { value: systemFont, release() {} };
    },
  };
}
