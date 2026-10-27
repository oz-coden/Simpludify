import {
  Character,
  Renderable,
  Shape,
  SpriteFit,
  type VisualSource,
} from "@simpludify/core";
export function visualTypes(): void {
  const view = new Renderable({ source: { kind: "image", url: "a.png" } });
  view.width = 48;
  view.color = 0x804020;
  view.source = { kind: "image", url: "b.png", fit: SpriteFit.Stretch };
  view.source = { kind: "shape", shape: Shape.Triangle };
  Character({ source: view.source });
  // @ts-expect-error legacy ambiguous source options are removed
  new Renderable({ sprite: "a.png" });
  // @ts-expect-error shape must be selected inside source
  new Renderable({ shape: Shape.Box });
  // @ts-expect-error image requires its URL
  view.source = { kind: "image" };
  // @ts-expect-error shape and image cannot be combined
  view.source = { kind: "shape", shape: Shape.Box, url: "a.png" };
  // @ts-expect-error invalid image fit
  view.source = { kind: "image", url: "a.png", fit: "cover" };
  // @ts-expect-error source data cannot be mutated through the getter
  view.source.kind = "image";
  // @ts-expect-error revision is observed, never assigned by callers
  view.revision = 10;
  // @ts-expect-error color is numeric RGB
  view.color = "red";
  const source: VisualSource = {
    kind: "image",
    url: "a.png",
    // @ts-expect-error image cannot carry a shape
    shape: Shape.Box,
  };
  void source;
}
