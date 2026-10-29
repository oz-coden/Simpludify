// This entire screen definition is shared by headless tests and any rendering Host.
import {
  CanvasButton,
  CanvasColumn,
  CanvasLabel,
  type CanvasNode,
  CanvasRow,
  CanvasScroll,
} from "@simpludify/core";

export function createPortableScreen(
  back: () => void | Promise<void> = () => {},
) {
  let serial = 0;
  let selected: CanvasNode | undefined;
  const status = CanvasLabel("Select an entry", { fontSize: 16 });
  const list = CanvasScroll([], {
    grow: 1,
    minHeight: 100,
    padding: 8,
    gap: 6,
    background: 0x192e3c,
    pointerEvents: "auto",
  });
  const add = () => {
    const id = ++serial;
    const entry = CanvasButton(
      `Entry ${id}`,
      () => {
        selected?.setStyle({ background: 0x23594e });
        selected = entry;
        entry.setStyle({ background: 0x516c2a });
        status.setText(`Selected ${id}`);
      },
      { height: 44, fontSize: 16 },
    );
    list.add(entry);
    return entry;
  };
  for (let i = 0; i < 12; i++) add();
  const controls = CanvasRow(
    [
      CanvasButton("Add entry", () => {
        add();
      }),
      CanvasButton("Reverse", () => {
        for (const entry of [...list.children]) list.move(entry, 0);
      }),
      CanvasButton("Remove selected", () => {
        if (selected) {
          list.remove(selected);
          selected = undefined;
          status.setText("Select an entry");
        }
      }),
      CanvasButton("Scroll up", () => {
        list.scrollBy(0, -100);
      }),
      CanvasButton("Scroll down", () => {
        list.scrollBy(0, 100);
      }),
      CanvasButton("Back", back),
    ],
    { wrap: true, gap: 6, shrink: 0 },
  );
  const root = CanvasColumn(
    [
      CanvasLabel("Portable UI lab", { fontSize: 26, shrink: 0 }),
      CanvasLabel(
        "Wheel or scroll buttons · Tab reveals entries · Enter selects",
        { fontSize: 14, shrink: 0 },
      ),
      controls,
      status,
      list,
    ],
    { padding: 16, gap: 10, background: 0x101922, pointerEvents: "auto" },
  );
  return { root, list, status, add, controls };
}
