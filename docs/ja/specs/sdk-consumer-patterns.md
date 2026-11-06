# 公開SDK利用パターン

公開npmパッケージ`@simpludify/core@0.1.6`および`@simpludify/web@0.1.6`は独立したプロジェクトでの利用を想定しています。このページでは、[Run To Exit](https://github.com/oz-coden/Run-To-Exit)をエンジンソース直接参照からnpmパッケージ導入へ移行した際に得られた実践的な統合パターンをまとめます。

## インストールと配布

[npm SDK導入ガイド](../npm.md)から始めます。npmからインストールし、生成されたlockfileをコミットし、CIでは`npm ci`を使用します。WebパッケージはCoreの公開APIを再exportし、同バージョンのCoreを要求します。エンジンのソースコピーやエイリアスではなく、公開パッケージのエクスポートを使用してください。

バンドルしたゲームを再配布する際は、依存パッケージのライセンス本文とnoticeを含めてください。**実際にロックされた本番依存関係**を確認してください。推移的依存パッケージの中には、公開アーカイブからライセンスファイルが欠落しているものがあります。自動通知ジェネレータは、欠落を暗黙に無視するのではなく明示的に報告するべきです。

## Canvas HUDとゲームワールドViewportの連動

Canvas UIはCSSサイズのレイアウトを使用し、ワールド描画はGameのViewportによって制御されます。v0.1.2以降では、HUDの高さを定数で二重管理するのではなく、解決されたFlex領域をバインドできます。

```ts
const region = CanvasPanel([], { grow: 1, pointerEvents: "none" });
const ui = context.canvasUI(
  CanvasColumn([hud, region, hint], { height: "100%" }),
);
game.bindViewport(ui, region);
```

このバインディングはレイアウト変更、テキスト折り返し、UI scale、ホストのリサイズに自動追従します。解決されたUI単位をCSS Viewportピクセルに変換し、空領域をクリップし、UIまたは領域ノードが破棄された際に自動解除されます。ワールド入力を遮らないよう、操作のないスペーサー領域には`pointerEvents: "none"`を指定してください。[APIリファレンス](../api.md)および[SDK統合ラボ](../../../examples/sdk-integration/README.md)を参照してください。

ポインターのワールド座標変換には、ブラウザのクライアント座標をタイルサイズで割るのではなく、`tilemap.worldToTile`を使用してください。

## CanvasとDOMのフォーカス統合

Canvasコントロールは指示エディタやページ切り替え可能なイベントログも構成できます。有界なフォームにはScrollを使用し、シミュレーション更新中もノードの同一性を保持し、構造変更後に論理フォーカスを復元します。

- キーボード操作可能なマップ領域には、アクセス可能な名前、可視のフォーカス状態、選択中セルのテキスト説明を与えます。矢印キーは**その領域にフォーカスがあるときのみ**使用し、DOMのテキストや数値入力欄がキーを所有できるようにします。
- 行の挿入・削除・並べ替えの後にDOMコマンド列を再構築する際は、フォーカスを引き継ぐ生存コントロールを特定します。古いDOM要素ではなく論理行の同一性を優先してください。
- アクセシビリティ／ミラーサポートを通じてCanvasコントロールを期待通りのTab順序に保ち、CanvasとDOMの間のフォーカス遷移をテストします。
- 狭幅画面のスクロールやネイティブ編集の挙動を含め、実際のポインター／タッチ入力をキーボード入力とは個別にテストします。

## 決定論的ワールド状態と表示Tween

ターン制や整数ステップのゲームでは、**まず離散的なワールド状態をコミット**し、`scene.presentationTweens`を使って*独立した*数値表示進行度をアニメーションさせます。表示フレームが衝突、占有、ドアの開閉スケジュール、リプレイ状態に影響を与えることは絶対に避けてください。

以下のパターンはその分離を示しています。`renderBetween`はゲーム側に属し、2つの変更不可なワールドスナップショットを読み取ります。

```ts
import { Tween, Easing } from "@simpludify/web";

const display = { progress: 1 };
let oldWorld = world;
let newWorld = world;
let active: ReturnType<typeof scene.presentationTweens.play> | undefined;

function showCommittedWorld(committed: World) {
  active?.finish(); // 前回の有限アニメーションを完了
  oldWorld = newWorld;
  newWorld = committed;
  display.progress = 0;
  active = scene.presentationTweens.play(
    Tween.to(Tween.property(display, "progress"), 1, {
      duration: 0.24,
      easing: Easing.InOutCubic,
    }),
    { owner: scene },
  );
}

context.onUpdate(() => renderBetween(oldWorld, newWorld, display.progress));
```

これは**パターンスケッチ**であり、そのままコピー＆ペーストして動作するスタンドアロン例ではありません（`world`、`World`、`renderBetween`はアプリケーション側のシンボルです）。ステップの急速な進行や初期状態へのリスタート時には、古いアニメーションを完了させるかキャンセルするかを決定し、端点を適切にリセットしてください。Scene所有権により、Scene破棄時のクリーンアップが保証されます。

[Tweenとアニメーション](tween.md)および[Tween lab](../../../examples/tween/README.md)を参照してください。

## 実行可能な統合例と独立スターター

[SDK統合ラボ](../../../examples/sdk-integration/README.md)は、Flexが所有するワールド領域、DOM/CanvasのTab移動、表示専用の離散Tween、Sceneの差し替えを実証しています。

[独立npm/Viteスターター](../../../templates/npm-vite/README.md)は、レイアウト連動Viewportを含む公開APIを使用しています。コミットされたlockfile、`npm ci`、明示的なCSS、Sceneの起動と破棄、Pages `--base`、不足時に失敗する本番ライセンス生成を備えています。
