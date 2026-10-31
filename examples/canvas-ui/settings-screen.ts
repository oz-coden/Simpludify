import {
  CanvasButton,
  CanvasCheckbox,
  CanvasColumn,
  CanvasLabel,
  CanvasNumberInput,
  CanvasRow,
  CanvasScroll,
  CanvasSelect,
  CanvasSlider,
  CanvasTextInput,
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
  const difficulty = CanvasSelect(
    [
      { label: "やさしい / Easy", value: "easy" },
      { label: "普通 / Normal", value: "normal" },
      { label: "難しい / Hard", value: "hard" },
      { label: "準備中 / Locked", value: "locked", disabled: true },
    ],
    { label: "難易度 / Difficulty", value: "normal" },
  );
  const playerName = CanvasTextInput({
    label: "プレイヤー名 / Player name",
    value: "Player",
    placeholder: "名前を入力",
    maxLength: 40,
  });
  const volumeNumber = CanvasNumberInput({
    label: "音量（数値） / Volume number",
    value: 50,
  });
  const grid = CanvasCheckbox("グリッドを表示 / Show grid");
  const readOnly = CanvasCheckbox("読み取り専用 / Read only");
  const preview = CanvasLabel("", { fontSize: 16 });
  let applied: Readonly<{
    sound: boolean;
    volume: number;
    speed: number;
    grid: boolean;
    difficulty: string | undefined;
    playerName: string;
  }> = Object.freeze({
    sound: true,
    volume: 50,
    speed: 1,
    grid: false,
    difficulty: "normal",
    playerName: "Player",
  });
  const snapshot = () =>
    Object.freeze({
      sound: sound.value,
      volume: volume.value,
      speed: speed.value,
      grid: grid.value,
      difficulty: difficulty.value,
      playerName: playerName.value,
    });
  const status = CanvasLabel(
    "Adjust the controls, then Apply / 設定を変更して適用",
    { fontSize: 14 },
  );
  const apply = CanvasButton("Apply / 適用", () => {
    if (!playerName.commit() || !volumeNumber.commit()) {
      status.setText("Invalid draft / 入力値を確認してください");
      return;
    }
    applied = snapshot();
    status.setText(`Applied: ${JSON.stringify(applied)}`);
  });
  const reset = CanvasButton("Reset / リセット", () => {
    readOnly.value = false;
    sound.value = true;
    volume.value = 50;
    speed.value = 1;
    grid.value = false;
    difficulty.value = "normal";
    playerName.value = "Player";
    volumeNumber.value = 50;
    status.setText("Defaults restored / 初期値に戻しました");
  });
  const scroll = CanvasScroll(
    [
      sound,
      volume,
      speed,
      grid,
      CanvasLabel("難易度 / Difficulty", { fontSize: 16 }),
      difficulty,
      CanvasLabel("プレイヤー名 / Player name", { fontSize: 16 }),
      playerName,
      CanvasLabel("音量（数値） / Volume number", { fontSize: 16 }),
      volumeNumber,
      readOnly,
    ],
    {
      height: 250,
      shrink: 0,
      gap: 12,
      padding: 8,
      background: 0x16242c,
    },
  );
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
  volume.onChange((e) => {
    if (volumeNumber.value !== e.value) volumeNumber.value = e.value;
  }, root);
  volumeNumber.onChange((e) => {
    if (volume.value !== e.value) volume.value = e.value;
  }, root);
  const update = () =>
    preview.setText(
      `Preview: ${sound.value ? "ON" : "OFF"} · ${volume.value}% · ${speed.value}× · Grid ${grid.value ? "ON" : "OFF"}`,
    );
  for (const control of [sound, grid]) control.onChange(update, root);
  for (const control of [volume, speed]) control.onChange(update, root);
  difficulty.onChange(update, root);
  playerName.onChange(update, root);
  readOnly.onChange(() => {
    for (const c of [
      sound,
      volume,
      speed,
      grid,
      CanvasLabel("難易度 / Difficulty", { fontSize: 16 }),
      difficulty,
      CanvasLabel("プレイヤー名 / Player name", { fontSize: 16 }),
      playerName,
      CanvasLabel("音量（数値） / Volume number", { fontSize: 16 }),
      volumeNumber,
    ])
      c.readOnly = readOnly.value;
  }, root);
  update();
  return {
    root,
    scroll,
    sound,
    volume,
    speed,
    grid,
    difficulty,
    playerName,
    volumeNumber,
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
