# 独立SDKアプリの組み込みパターン

公開済みCore/Web 0.1.4は、エンジンをコピーしない独立npm/Viteアプリ向けです。統一入力・ゲームパッドAPIもnpmから導入できます。実装内部のパスや配布物の書き換えには依存しません。

## Canvas領域とワールドを結ぶ

```ts verify
import { CanvasColumn, CanvasLabel, CanvasPanel, Game } from "@simpludify/web";
const game = new Game();
game.scene("play", ({ canvasUI }) => {
  const world = CanvasPanel([], {
    width: "100%",
    grow: 1,
    minHeight: 120,
    pointerEvents: "none",
  });
  const ui = canvasUI(
    CanvasColumn([CanvasLabel("HUD"), world], {
      width: "100%",
      height: "100%",
    }),
  );
  game.bindViewport(ui, world);
});
await game.run("play");
```

v0.1.2以降はbindViewportで解決済みFlex領域を使えます。HUD高さの重複計算や独自ResizeObserverで競合させず、世界の選択にはGame.pointerToWorldやTilemap.worldToTileを使います。UI scaleをCSSピクセルへ変換し、DPRは描画側だけに残します。スクロールする任意マスクの代用にはしません。

## 入力とFocus

Scene factory内でActionControllerを作り、ReaderをActorへ注入します。プログラム・タッチ・ゲームパッドは同じSource合成です。フォームの編集中はHostのネイティブ面へ任せ、キーボードのkeydownやIME候補をアプリで再構築しません。Canvasラベル更新や選択肢・命令列の並べ替えではノードを可能な限り維持し、入力Sessionと選択範囲を不必要に作り直しません。

v0.1.3以降の明示focusは動的レイアウトを解決し、移動した項目を表示します。アプリ固有のフレーム待ちでSDKのFocus契約を置き換えません。CanvasLabelはテキスト・heading/status/alertを宣言でき、文字入力のinputModeヒントも使えます。実機IME・支援技術の検証は別です。

## 整数ステップと表示時計

パズルの世界状態は整数tickなどの純粋なモデルで更新し、見た目の補間はpresentationTweensへ分けられます。シミュレーションをpauseしても表示時計は進められます。Tweenの見た目を衝突・マス占有・Replayの正式状態へ戻さず、同じ対象プロパティを別時計で競合させません。

## 寿命・配信・検証

SceneはUI・購読・タイマー・Sourceを所有し、Game.disposeは埋め込み解除やHMRで呼びます。処理途中の非同期UI／画像変更には世代とキャンセルの契約を守り、遅い結果が新Sceneを触らないようにします。

Viteで適切なbaseを指定して本番ビルドし、アプリ自身の画像・フォントと全依存ライセンスを配布します。SDKのMIT文面と依存の通知だけで、任意のアプリ資産まで自動的に許諾されるわけではありません。スターターはnotice生成の実例です。

型・純粋モデル単体・本番サブパス・実ブラウザ操作・実描画を分けて確認します。読み上げ用DOMが存在するだけで、GPUキャッシュが正常に描けているとは判定しません。候補のCore/Webは同時に導入し、元アプリの公開済み依存とlockfileを維持します。

[SDK導入](npm.md)、[レイアウト](layout.md)、[Canvas UI](canvas-ui.md)、[ゲームパッド](gamepads.md)、[Replay](replay.md)に各契約をまとめています。
