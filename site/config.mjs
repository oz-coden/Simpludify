export const repository = "https://github.com/oz-coden/Simpludify";
export const examples = [
  {
    id: "blockfall",
    title: "Blockfall",
    summary: "整数グリッドの落ち物パズル・seed付き7-bag・ホールド・ゴースト",
    controls:
      "← →移動、↑ / X・Z回転、↓ソフトドロップ、Spaceハードドロップ、C / Shiftホールド、P / Esc一時停止。スマートフォンは下部ボタンで全操作に対応。",
    guide: "guides/blockfall.html",
  },
  {
    id: "character",
    title: "Character",
    summary: "最小のキャラクター移動",
    controls:
      "ゲーム領域をクリック／Tabで選択し、WASDで移動。スマートフォンでは外付けキーボードが必要です。",
    guide: "guides/input.html",
  },
  {
    id: "ui-scenes",
    title: "UI / Scenes",
    summary: "DOM UIとSceneの切り替え",
    controls:
      "WASDで移動。ボタンをクリック／タップ、またはTab・EnterでSceneを切り替えます。タッチだけでもUI操作を試せます。",
    guide: "guides/scenes-ui.html",
  },
  {
    id: "composition",
    title: "Beacon Field",
    summary: "Component・イベント・タイマーを組み合わせる",
    controls:
      "WASDで琥珀色のビーコンを収集。空き領域のクリック／タップで追加。Add beacon・Zoom・Restartはタッチ対応。移動にはキーボードが必要です。",
    guide: "concepts.html",
  },
  {
    id: "signal-run",
    title: "Signal Run",
    summary: "Trigger・Solid・勝敗・再プレイ",
    controls:
      "Start runから開始。WASD／矢印、空き領域のクリック／タップ、または下部の長押しボタンで移動。30秒以内に6個の信号を収集し、赤を避け、青い壁に沿って進みます。Pause・Restart・Menu・Zoomも利用できます。",
    guide: "guides/collision.html",
  },
];
export const pages = [
  [
    "guides/blockfall.html",
    "examples/blockfall/README.md",
    "Blockfallのルールと実装",
    "サンプル",
  ],
  ["index.html", "site/ja/index.md", "ホーム", "はじめに"],
  [
    "getting-started.html",
    "site/ja/getting-started.md",
    "導入と最初のゲーム",
    "はじめに",
  ],
  ["concepts.html", "site/ja/concepts.md", "基本概念", "はじめに"],
  ["guides/input.html", "site/ja/input.md", "入力とゲームループ", "ガイド"],
  [
    "guides/rendering.html",
    "site/ja/rendering.md",
    "描画・座標・カメラ",
    "ガイド",
  ],
  [
    "guides/scenes-ui.html",
    "site/ja/scenes-ui.md",
    "Scene・状態・UI",
    "ガイド",
  ],
  [
    "guides/collision.html",
    "site/ja/collision.md",
    "衝突判定と位置補正",
    "ガイド",
  ],
  ["api.html", "site/ja/api.md", "APIリファレンス", "リファレンス"],
  ["examples.html", "site/ja/examples.md", "サンプルギャラリー", "サンプル"],
  [
    "architecture.html",
    "site/ja/architecture.md",
    "設計思想と責務",
    "プロジェクト",
  ],
  [
    "limitations.html",
    "site/ja/limitations.md",
    "制約とロードマップ",
    "プロジェクト",
  ],
  ["hosting.html", "site/ja/hosting.md", "ビルド・公開・通信", "プロジェクト"],
  ["licensing.html", "site/ja/licensing.md", "ライセンス", "プロジェクト"],
  ["en/index.html", "site/en.md", "English documentation", "English"],
  ["en/api.html", "docs/api.md", "API contracts", "English"],
  ["en/architecture.html", "docs/architecture.md", "Architecture", "English"],
  ["en/roadmap.html", "docs/roadmap.md", "Roadmap", "English"],
  ["en/performance.html", "docs/performance.md", "Performance", "English"],
  ["en/licensing.html", "docs/licensing.md", "Licensing", "English"],
].map(([route, source, title, section]) => ({
  route,
  source,
  title,
  section,
  lang: route.startsWith("en/") ? "en" : "ja",
}));
