# Canvasスクロールと入力所有権

CanvasScrollまたはscrollを指定したPanelで、有限のUI内容を切り抜いてスクロールできます。仮想化リストや完全なCSS overflowの再現ではありません。レイアウト・clip・Focus・ネイティブ編集面は同じCoreモデルを使います。

```ts verify
import { CanvasButton, CanvasScroll, Game } from "@simpludify/web";
const game = new Game();
game.scene("list", ({ canvasUI }) => {
  canvasUI(
    CanvasScroll(
      Array.from({ length: 30 }, (_, i) =>
        CanvasButton(`Item ${i + 1}`, () => console.log(i)),
      ),
      { width: 280, height: 220, gap: 8, padding: 8 },
    ),
  );
});
await game.run("list");
```

## 値・範囲・フォーカス

scrollX/scrollY／scrollTo／scrollByなどモデルのスクロール操作は、有効な範囲へ制限して投影を変更します。内容の変更、寸法、scale、可視性の変化で範囲を再計算します。オフセットだけの移動は既存レイアウトの投影を使い、文字計測／Flex全体を繰り返しません。明示focusは祖先を含めて対象を表示し、宣言順のfocusNextは画面外の利用可能な操作項目も辿ります。

Tab/Shift-Tabは現在の深さ優先宣言順で、追加・除去・move・clear後にも更新します。非表示・disabledの祖先は除外し、readOnlyはfocus対象です。最初／最後の境界では通常のブラウザ移動へ戻り、ゲーム内へ閉じ込めません。動的変更後の明示focusはHostの直近計測で保留レイアウトを解決します。

## ホイール・ドラッグ・スクロールバー

Webはwheelのpixel/line/pageをHost単位へ正規化し、ポインター下の最も深い動かせる領域へ渡します。端に達した軸は祖先が消費できます。内容ドラッグ・ノードごとの慣性・overlay scrollbarを提供し、ボタン式スクロールもタッチで使えます。scrollbarはauto/always/hiddenを選びます。

pointerdownで受信者を固定し、dragThresholdを越えた方向に従って、利用可能な祖先へジェスチャーを移譲できます。スクロールに移ったクリックは発火させず、キャンセル済み物理IDは離すまで抑止します。thumbドラッグやSliderの方向ロックも同じ所有権に従い、途中からワールドクリックへ変換しません。

ホイールや入力が消費された場合は背景の世界へ流さず、空の／対象外のUI領域は通常のPointerRoutingを維持します。非表示・無効・破棄・Scene交換・blur・scale変更は保留操作と慣性を適切に止めます。停止状態でもUI操作はシミュレーションとは独立したHost経路です。

## 描画キャッシュと限界

Webは完全にclipされた描画を省きますが、論理ノードや読み上げ文字を削除しません。限定されたWebGLスクロール画面は変更まで合成結果をキャッシュし、Canvas2Dや通常HUDは直接描画します。DPR/UI scaleと4096物理ピクセルのHost上限に従い、アプリが設定するGPUプールではありません。UI破棄は完全なTexture leaseをプールへ返し、Game破棄で管理GPUデータを解放します。

大きなリストのノード数・レイアウト・イベント・hit testの負荷がなくなるわけではありません。再利用された描画ターゲットの実ピクセル検証と意味的なDOM確認は区別します。測定条件・内部実装の詳細はEngineering資料で確認してください。[Canvas UI](canvas-ui.md)、[値コントロール](canvas-controls.md)、[編集](editing.md)と併せて利用します。
