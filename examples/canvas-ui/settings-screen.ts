import {
  CanvasButton,
  CanvasCheckbox,
  CanvasColumn,
  CanvasLabel,
  CanvasRow,
  CanvasScroll,
  CanvasSlider,
} from "@simpludify/core";
/** Portable settings composition; values remain application state and Apply stores a separate snapshot. */
export function createSettingsScreen(
  back: () => void | Promise<void> = () => {},
) {
  const sound = CanvasCheckbox("音声 / Sound", { checked: true });
  const volume = CanvasSlider({ label: "音量 / Volume", value: 50 });
  const speed = CanvasSlider({
    label: "速度 / Speed",
    min: 0.5,
    max: 2,
    step: 0.1,
    value: 1,
  });
  const grid = CanvasCheckbox("グリッドを表示 / Show grid");
  const readOnly = CanvasCheckbox("読み取り専用 / Read only");
  const preview = CanvasLabel("", { fontSize: 16 });
  let applied: Readonly<{
    sound: boolean;
    volume: number;
    speed: number;
    grid: boolean;
  }> = Object.freeze({
    sound: true,
    volume: 50,
    speed: 1,
    grid: false,
  });
  const snapshot = () =>
    Object.freeze({
      sound: sound.value,
      volume: volume.value,
      speed: speed.value,
      grid: grid.value,
    });
  const status = CanvasLabel(
    "Adjust the controls, then Apply / 設定を変更して適用",
    { fontSize: 14 },
  );
  const apply = CanvasButton("Apply / 適用", () => {
    applied = snapshot();
    status.setText(`Applied: ${JSON.stringify(applied)}`);
  });
  const reset = CanvasButton("Reset / リセット", () => {
    readOnly.value = false;
    sound.value = true;
    volume.value = 50;
    speed.value = 1;
    grid.value = false;
    status.setText("Defaults restored / 初期値に戻しました");
  });
  const scroll = CanvasScroll([sound, volume, speed, grid, readOnly], {
    height: 250,
    shrink: 0,
    gap: 12,
    padding: 8,
    background: 0x16242c,
  });
  const root = CanvasColumn(
    [
      CanvasLabel("Canvas settings / 設定", { fontSize: 28 }),
      CanvasLabel(
        "Drag volume horizontally; scroll vertically. Tab, Space and arrow keys also work.",
        { fontSize: 14 },
      ),
      preview,
      scroll,
      CanvasRow([apply, reset, CanvasButton("Back", back)], {
        gap: 8,
        wrap: true,
      }),
      status,
    ],
    { padding: 16, gap: 12, background: 0x101922, pointerEvents: "auto" },
  );
  const update = () =>
    preview.setText(
      `Preview: ${sound.value ? "ON" : "OFF"} · ${volume.value}% · ${speed.value}× · Grid ${grid.value ? "ON" : "OFF"}`,
    );
  for (const control of [sound, grid]) control.onChange(update, root);
  for (const control of [volume, speed]) control.onChange(update, root);
  readOnly.onChange(() => {
    for (const c of [sound, volume, speed, grid]) c.readOnly = readOnly.value;
  }, root);
  update();
  return {
    root,
    scroll,
    sound,
    volume,
    speed,
    grid,
    readOnly,
    preview,
    status,
    apply,
    reset,
    get applied() {
      return applied;
    },
  };
}
