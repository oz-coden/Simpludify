# Scene・状態・UI

ゲームのルールとDOM表示を分け、型付きScene IDで画面を移動します。メニューとプレイの状態はゲーム側で定義します。

## Sceneを登録する

```ts verify
import {
  Button,
  Character,
  Game,
  Label,
  Movement,
  Panel,
} from "@simpludify/web";

const game = new Game<"menu" | "play">();
game.scene("menu", ({ ui }) => {
  ui(Panel([Label("Ready?"), Button("Start", () => game.goTo("play"))]));
});
game.scene("play", ({ add, ui }) => {
  add(Character({ movement: Movement.WASD }));
  ui(Panel([Button("Menu", () => game.goTo("menu"))]));
});
await game.run("menu");
```

`run`をawaitしてから`goTo`します。準備の間は旧Sceneが動き続け、準備失敗なら旧Sceneを保ちます。成功した切り替えで旧Sceneは破棄されます。同じIDへ完了後に遷移しても新しいインスタンスを作るので、再プレイにも使えます。

## 非同期準備とキャンセル

setupはPromiseを返せます。contextの`signal`をロードへ渡し、await前に`onDispose`へ片付けを登録します。SceneやGameの破棄は保留遷移をキャンセルしますが、任意のPromiseを強制停止することはできません。

CoreのScene状態はPreparing → Ready → Active → Inactive → Disposedです。Webはアセット準備と表示の整合性を担当します。WebのScene factoryから`Engine.activate`や`markReady`を直接操作しないでください。

## 状態をUIへ反映する

`Label.setText`は値が変わったときだけ表示を更新します。ゲーム側モデルを通常のコードで読み取るか、変更イベントから反映します。

```ts
const score = Label("Score 0");
scene.events.on(
  ScoreChanged,
  (state) => {
    score.setText(`Score ${state.score}`);
  },
  scene,
);
ui(Panel([score]));
```

Signal Runの`Round`はHP・スコア・残り時間・勝敗をCoreだけで扱い、WebのSceneがラベルと遷移へ結び付けます。全状態を自動シリアライズするストアはありません。

## レイアウトと操作

PanelはColumnが既定、`Layout.Row`は折り返し、Gridは自動配置します。`Placement.Top` / Center / Bottom、`Theme.Dark` / Light、部分的なtokensを選べます。DOM UIはCameraのzoomに影響されません。

Buttonはネイティブ要素でTab・Enter/Spaceに対応します。非同期handler実行中はボタンを無効化し、失敗を診断へ渡します。handlerへ渡るAbortSignalはUI破棄で中断されます。固定CSS配置は独自にクリッピングを検証してください。

## 所有権とエラー

購読・タイマー・InputSourceはScene/Actor/Componentへ所有させます。独自DOMリスナーはsetupのsignal、または明示的なcleanupを使います。破棄は冪等で、あるcleanupが失敗しても他を実行します。

切り替えの準備前エラーは旧Sceneを維持しますが、コミット後のライフサイクル通知エラーは新Sceneを巻き戻しません。更新中の変更も自動ロールバックしません。詳細は[英語のArchitecture](../en/architecture.html)に記載しています。
