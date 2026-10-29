import type { PixiRenderer } from "@simpludify/web";
/** Test-only pinned Pixi inspection. Counts live managed resources separately from null hash slots. */
export function inspectCanvasResources(renderer: PixiRenderer) {
  const r = (
    renderer as unknown as {
      app: {
        renderer: {
          graphicsContext?: {
            _managedContexts: { items: Record<string, unknown> };
          };
          canvasText?: { _activeTextures: Record<string, unknown> };
          renderPipes: {
            text?: { _managedTexts: { items: Record<string, unknown> } };
          };
        };
      };
    }
  ).app.renderer;
  const graphics = r.graphicsContext?._managedContexts.items ?? {},
    texts = r.renderPipes.text?._managedTexts.items ?? {},
    textures = r.canvasText?._activeTextures ?? {};
  return {
    graphics: Object.values(graphics).filter(Boolean).length,
    texts: Object.values(texts).filter(Boolean).length,
    textures: Object.values(textures).filter(Boolean).length,
    graphicsSlots: Object.keys(graphics).length,
    textSlots: Object.keys(texts).length,
    textureSlots: Object.keys(textures).length,
  };
}
