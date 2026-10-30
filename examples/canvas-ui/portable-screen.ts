// This entire screen definition is shared by headless tests and any rendering Host.
import {
  CanvasButton,
  CanvasColumn,
  CanvasHoldButton,
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
    maxHeight: 260,
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
  const holdStatus = CanvasLabel("Hold: released", { fontSize: 14 });
  let holding = false,
    holdChanges = 0;
  const hold = CanvasHoldButton(
    "Hold, then drag",
    (value) => {
      holding = value;
      holdChanges++;
      holdStatus.setText(value ? "Hold: pressed" : "Hold: released");
    },
    { height: 44, fontSize: 14 },
  );
  const nested = CanvasScroll(
    Array.from({ length: 5 }, (_, i) =>
      CanvasButton(
        `Card ${i + 1}`,
        () => {
          holdStatus.setText(`Card ${i + 1} tapped`);
        },
        { width: 180, height: 110, shrink: 0, fontSize: 14 },
      ),
    ),
    {
      scroll: "both",
      direction: "row",
      gap: 8,
      height: 70,
      shrink: 0,
      scrollbar: "always",
      background: 0x203a38,
    },
  );
  const secondary = CanvasScroll(
    [
      nested,
      hold,
      CanvasLabel(
        "Independent viewport · drag cards on both axes; start another drag at an edge to reach the parent.",
        { height: 90, fontSize: 13 },
      ),
    ],
    {
      height: 140,
      shrink: 0,
      gap: 6,
      padding: 4,
      inertia: false,
      scrollbar: "always",
      background: 0x292b40,
    },
  );
  const inertiaButton = CanvasButton(
    "Inertia: ON",
    () => {
      list.setStyle({ inertia: !list.style.inertia });
      inertiaButton.setText(
        list.style.inertia ? "Inertia: ON" : "Inertia: OFF",
      );
    },
    { fontSize: 14, padding: 8 },
  );
  const barsButton = CanvasButton(
    "Bars: auto",
    () => {
      const modes = ["auto", "always", "hidden"] as const;
      const next =
        modes[(modes.indexOf(list.style.scrollbar) + 1) % modes.length] ??
        "auto";
      list.setStyle({ scrollbar: next });
      barsButton.setText(`Bars: ${next}`);
    },
    { fontSize: 14, padding: 8 },
  );
  const dragButton = CanvasButton(
    "Drag: ON",
    () => {
      list.setStyle({ dragScroll: !list.style.dragScroll });
      dragButton.setText(list.style.dragScroll ? "Drag: ON" : "Drag: OFF");
    },
    { fontSize: 14, padding: 8 },
  );
  const secondaryButton = CanvasButton(
    "Other inertia: OFF",
    () => {
      secondary.setStyle({ inertia: !secondary.style.inertia });
      secondaryButton.setText(
        secondary.style.inertia ? "Other inertia: ON" : "Other inertia: OFF",
      );
    },
    { fontSize: 14, padding: 8 },
  );
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
      inertiaButton,
      barsButton,
      dragButton,
      secondaryButton,
    ],
    { wrap: true, gap: 6, shrink: 0 },
  );
  const root = CanvasColumn(
    [
      CanvasLabel("Portable UI lab", { fontSize: 26, shrink: 0 }),
      CanvasLabel(
        "Drag entries or thumbs · toggle inertia/bars · Tab reveals entries",
        { fontSize: 14, shrink: 0 },
      ),
      controls,
      status,
      list,
      holdStatus,
      secondary,
    ],
    { padding: 16, gap: 10, background: 0x101922, pointerEvents: "auto" },
  );
  return {
    root,
    list,
    status,
    add,
    controls,
    secondary,
    nested,
    hold,
    holdStatus,
    get holding() {
      return holding;
    },
    get holdChanges() {
      return holdChanges;
    },
  };
}
