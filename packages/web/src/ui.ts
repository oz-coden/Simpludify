export const Layout = { Column: "column", Row: "row", Grid: "grid" } as const;
export type Layout = (typeof Layout)[keyof typeof Layout];
export const Theme = { Dark: "dark", Light: "light" } as const;
export type Theme = (typeof Theme)[keyof typeof Theme];
export interface ThemeTokens {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  font: string;
}
export const Themes: Readonly<Record<Theme, ThemeTokens>> = {
  dark: {
    background: "#101922",
    surface: "#172630",
    text: "#eff7f6",
    muted: "#afc4ca",
    accent: "#73e3c0",
    font: "system-ui, sans-serif",
  },
  light: {
    background: "#eaf2ef",
    surface: "#ffffff",
    text: "#17332d",
    muted: "#45645d",
    accent: "#17654f",
    font: "system-ui, sans-serif",
  },
};
export interface LabelNode {
  readonly kind: "label";
  readonly text: string;
  readonly muted: boolean;
  setText(text: string): void;
  subscribe(listener: (text: string) => void): () => void;
}
export interface ButtonNode {
  readonly kind: "button";
  readonly text: string;
  readonly onClick: () => void | Promise<void>;
}
export interface PanelNode {
  readonly kind: "panel";
  readonly layout: Layout;
  readonly children: readonly UINode[];
  readonly title?: string;
}
export type UINode = LabelNode | ButtonNode | PanelNode;
export function Label(
  text: string,
  options: { muted?: boolean } = {},
): LabelNode {
  let value = text;
  const listeners = new Set<(text: string) => void>();
  return {
    kind: "label",
    muted: options.muted ?? false,
    get text() {
      return value;
    },
    setText(next) {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export function Button(
  text: string,
  onClick: () => void | Promise<void>,
): ButtonNode {
  return { kind: "button", text, onClick };
}
export function Panel(
  children: readonly UINode[],
  options: { layout?: Layout; title?: string } = {},
): PanelNode {
  return {
    kind: "panel",
    children,
    layout: options.layout ?? Layout.Column,
    ...(options.title === undefined ? {} : { title: options.title }),
  };
}
export interface MountedUI {
  readonly element: HTMLDivElement;
  dispose(): void;
}
export function mountUI(
  nodes: readonly UINode[],
  onError: (error: unknown) => void,
): MountedUI {
  const element = document.createElement("div");
  element.className = "s-ui";
  const controller = new AbortController();
  const subscriptions: Array<() => void> = [];
  const render = (node: UINode): HTMLElement => {
    if (node.kind === "label") {
      const label = document.createElement("p");
      label.textContent = node.text;
      if (node.muted) label.className = "s-muted";
      subscriptions.push(
        node.subscribe((text) => {
          label.textContent = text;
        }),
      );
      return label;
    }
    if (node.kind === "button") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = node.text;
      button.addEventListener(
        "click",
        async () => {
          if (button.disabled) return;
          button.disabled = true;
          try {
            await node.onClick();
          } catch (error) {
            onError(error);
          } finally {
            button.disabled = false;
          }
        },
        { signal: controller.signal },
      );
      return button;
    }
    const panel = document.createElement("section");
    panel.className = `s-panel s-${node.layout}`;
    if (node.title) {
      const title = document.createElement("h2");
      title.textContent = node.title;
      panel.append(title);
    }
    panel.append(...node.children.map(render));
    return panel;
  };
  element.append(...nodes.map(render));
  return {
    element,
    dispose() {
      controller.abort();
      for (const unsubscribe of subscriptions) unsubscribe();
      element.remove();
    },
  };
}
