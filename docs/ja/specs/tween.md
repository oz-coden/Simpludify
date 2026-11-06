# Tweenとアニメーション

Tweenは明示的な秒数を使用して**数値**を補間します。Coreにはレシピ、イージング、再生ハンドル、スケジューラが含まれており、レンダラー、ブラウザクロック、DOM依存関係を持ちません。Actor、Canvas UI、アプリケーションの独自レコードがすべて同一の仕組みを使用します。[Tween lab](../../../examples/tween/README.md)で動作を確認できます。

## Sceneクロックから始める

```ts
import { Tween, Easing } from "@simpludify/web";
const state = { intensity: 0 };
const playback = scene.tweens.play(
  Tween.to(Tween.property(state, "intensity"), 1, {
    duration: 0.4,
    easing: Easing.OutCubic,
  }),
  { owner: scene, onComplete: () => console.log(state.intensity) },
);
playback.pause();
playback.resume();
```

`Tween.property(record, key)`は、プレーンオブジェクト上の書き込み可能な自身の数値プロパティを受け入れます。読み取り専用フィールド、アクセサー、クラスインスタンスには暗黙のリフレクションではなく明示的なアダプターが必要です。有限の開始／終了値と非負の有限duration/delayが必須です。文字列、ベクトル、色の暗黙的な型変換は行われません。

`scene.tweens`はシミュレーション秒を使用し、ポスト更新の接触判定の後、タイマーの前に進みます。適格性は入力コールバックの前に捕捉されるため、step中に開始された処理は次のstepで開始されます。Engineの一時停止はこのクロックを停止します。`scene.presentationTweens`は可視の表示フレーム秒を使用し、シミュレーションの一時停止中も継続します。Webは既存の上限付きdeltaを供給します。リサイズやレイアウトによって時間が進むことはなく、非表示や復帰フレームで失われた実時間をまとめて取り戻すことはありません。GameとSceneContextは同じ2つのクロックを公開します。表示アニメーションはリプレイ状態ではありません。SpriteAnimationはシミュレーション時間を使用してLateUpdateで画像フレームを選択し続け、数値描画プロパティのTweenと共存できます。

ヘッドレスやカスタムホストでは、`new TweenScheduler({ owner, scope })`を作成して`advance(seconds)`を呼び出します。Sceneベースのホストは表示フレームごとに1回`scene.advancePresentation(seconds)`を呼び出します。Web管理のクロックを2回進めてはいけません。スケジューラの`speed`は有限・非負（既定1）で、0に設定すると経過時間が停止します。

## 再生とイージング

`play(recipe, { owner?, conflict?, onComplete?, onCancel? })`は、`state`、`elapsed`、`duration`、キャンセル理由`reason`を持つPlaybackを返します。

| 操作                    | 意味                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `pause()` / `resume()`  | 現在値とチャネル所有権を保持し、経過時間を停止／再開する          |
| `cancel()`              | 現在値を保持し、所有権を解放し、キャンセルを1回通知する           |
| `stop()`                | 理由`stopped`でキャンセルする。巻き戻しは行わない                 |
| `finish()`              | 有限レシピの終端状態を適用して1回完了する。無限レシピは拒否される |
| スケジューラ`dispose()` | 実行中の処理をキャンセルし、すべての購読とチャネル要求を解放する  |

新しい`play`はレシピを開始します。終端に達したハンドルを再起動することはできません。0秒の処理は、play内部ではなく次回のadvanceまたは明示的なfinishで実行されます。`repeat`は**追加**の反復回数（非負の整数またはInfinity）です。`yoyo: true`は方向を交互に反転します。遅延（delay）はリーフの再生の前に1回入ります。無限の0秒繰り返しは拒否されます。大きな経過時間は有界な計算を行い、スキップされたサイクルごとにコールバックが発火することはありません。

`Easing.Linear`、`InQuad`、`OutQuad`、`InOutQuad`、`InCubic`、`OutCubic`、`InOutCubic`は同期関数です。他のカーブには独自の同期関数`(progress: number) => number`を指定してください。端点は厳密に保たれます。独自のイージングは有限の正規化された値（0〜1）を返さなければなりません。オーバーシュートカーブはこの数値リビジョンではサポートされていません。不透明度アダプターも0〜1を要求します。

コールバックやフックは同期的です。Promiseを返すことは診断エラーになります。実行フック／セッターの失敗は影響を受ける処理をキャンセルして解放し、他の適格な処理の後に集約されます。終端コールバックの失敗は、クリーンアップがすでに終了した状態で完了／キャンセル状態を保持し、再度の通知なしに集約されます。終端クリーンアップは通知に先行し、コールバック内で作成された処理は新しい更新境界を待ちます。再入的なadvance/finishは拒否されます。

## 所有権と競合する書き込み

SceneクロックはSceneの破棄時にキャンセルされます。ActorバインディングはRenderableを所有し、Canvasバインディングはノードを所有します。任意のPlayback所有者は別のキャンセル寿命を追加します。Renderableの除去や置き換え、Actorの破棄、UIの除去や破棄は関連する処理をキャンセルします。アダプタースコープにより、Sceneにバインドされた機能を別のSceneのクロックへ移動することが防止されます。

各バインディングは、スケジューラ全体で正規のターゲット／キーチャネルを予約します。既定の`conflict: "replace"`は、新しい処理が実行される前に重複するPlayback全体をキャンセルします。`conflict: "error"`はアトミックに拒否します。一時停止されたチャネルや将来のシーケンスチャネルも予約されたままです。加算ブレンディングは実装されていません。

外部からの変更は書き込み前に検査され、`external-write`でキャンセルされます。Sliderの明示的な意図も即座に監視され、等しいプログラム書き込み、編集開始、範囲変更が含まれます。外部リソースには`Tween.bind({ target, key, read, write, owner?, scope?, valid?, validate?, stamp?, watch? })`を使用してください。セッターが`false`を返すと書き込みは拒否されます。

## Actor: 描画状態と物理

```ts
import { actorTween, Tween } from "@simpludify/web";
scene.tweens.play(
  Tween.parallel(
    Tween.to(actorTween(actor).offsetX, 120, { duration: 0.6 }),
    Tween.to(actorTween(actor).rotation, Math.PI, { duration: 0.6 }),
    Tween.to(actorTween(actor).opacity, 0.3, { duration: 0.6 }),
  ),
);
```

`actorTween`はRenderableの`offsetX`、`offsetY`、相対的な`rotation`（ラジアン）、`scaleX`、`scaleY`、`opacity`を公開します。既定値は0/0/0/1/1/1です。描画オフセットはワールド軸を使用し、Actorと共に回転することはありません。拡縮と回転はTransformおよび画像fitと合成されます。これらは描画にのみ影響します。Transform、Motion、Body、Collider、および接触判定は権威的なままです。オフセットされたスプライトが衝突ボディを動かすことはありません。物理的な移動にはMotionまたは明示的なゲームプレイコマンドを使用してください。Tweenをワールド座標に競合してバインドしないでください。SpriteAnimationはソース／フレームの責務を保持します。

## Canvas UI: レイアウトと表示

```ts
import { canvasTween, Tween } from "@simpludify/web";
panel.setPresentation({ offsetX: 60, opacity: 0 });
scene.presentationTweens.play(
  Tween.parallel(
    Tween.to(canvasTween(panel).offsetX, 0, { duration: 0.4 }),
    Tween.to(canvasTween(panel).opacity, 1, { duration: 0.4 }),
  ),
);
```

`node.presentation`は読み取り専用のoffsetX/offsetY/opacityスナップショットです。`setPresentation`は有限のオフセットと0〜1の不透明度を検証します。プレゼンテーションはFlexスタイルから独立しており、平行移動はレイアウトを再計測することなくキャッシュされた境界を再投影します。子孫ノード、ヒットテスト、クリッピング、ネイティブエディタ、フォーカス幾何形状は同じ投影境界を使用します。オフセットは兄弟の配置やスクロールコンテンツサイズを変更しません。不透明度は祖先を通じて乗算され、不透明度0は入力やフォーカスの利用可能性を除外しますが、プログラムアニメーションによるフェードインは許可されます。

## Slider: 論理値または表示値

```ts
import { sliderTween, Tween } from "@simpludify/web";
// 論理値の変更: onChange source=program, ユーザーコミットなし
scene.presentationTweens.play(
  Tween.to(sliderTween(volume), 80, { duration: 0.5 }),
);

// 即座に論理HPを変更し、滑らかに追従する読み取り専用バー
const shown = hp.displayValue;
hp.value = 75;
hp.displayValue = shown;
scene.presentationTweens.play(
  Tween.to(sliderTween(hp, "display"), hp.value, {
    duration: 0.7,
  }),
);
```

論理値は既存のステップ／範囲の正規化を維持します。`displayValue`は連続したクランプ付き数値バー値です。ラベル、アクセス可能な値、キーボード／ポインター編集、および`value`は論理的なままです。表示のみの更新は値変更イベントを発行しません。論理Tweenと表示Tweenは単一の所有権チャネルを共有します。ユーザーのポインター／編集開始やキーボード変更はアニメーションをキャンセルします。プログラムコマンド（等しい値を含む）、範囲／readOnly更新、構造的な非表示／無効化、および破棄もキャンセルします。権威ある入力は表示を論理値へ復元します。バーのアニメーション中に中間的な表示値をゲーム状態として書き戻さないでください。

## レシピの合成

```ts
scene.presentationTweens.play(
  Tween.sequence(
    Tween.parallel(
      Tween.to(canvasTween(panel).offsetX, 0, { duration: 0.4 }),
      Tween.to(canvasTween(panel).opacity, 1, { duration: 0.3 }),
    ),
    Tween.delay(0.2),
    Tween.to(canvasTween(panel).opacity, 0.5, { duration: 0.3 }),
  ),
);
```

シーケンスは子要素間で余剰の経過時間を保持し、各子要素の開始時に暗黙の開始状態を捕捉します。パラレルの子要素は同時に開始します。シーケンスはチャネルを再利用できますが、パラレル内で同一チャネルが重複すると遅延があっても拒否されます。子チャネルのキャンセル、置き換え、無効化は合成全体をキャンセルします。リーフのrepeat/yoyoはサポートされますが、合成全体の繰り返しやタイムライン編集は延期されています。定義は変更不可で再利用可能であり、4,096ノード／深さ64に制限されています。

## 検証範囲と限界

自動化されたChromiumテストは、Pixi WebGLとCanvas2Dの両方、デスクトップ／狭幅の入力と描画、ネイティブエディタの幾何形状、Sliderドラッグ、破棄をカバーしています。実際のOS日本語IMEや物理モバイルキーボードには実機検証が必要です。Tweenによって普遍的なFPS、GPU／ネイティブメモリ、物理Tween、Unicode文字成形の保証が追加されることはありません。

## 完全なスタンドアロン検証例

```ts verify
import {
  Actor,
  Transform,
  Renderable,
  Scene,
  Engine,
  Tween,
  Easing,
  actorTween,
  CanvasColumn,
  CanvasSlider,
  CanvasUI,
  canvasTween,
  sliderTween,
} from "@simpludify/core";
const engine = new Engine();
const scene = engine.scene;
const actor = scene.add(new Actor());
actor.add(new Transform({ x: 20, y: 20 }));
actor.add(new Renderable({ width: 16, height: 16 }));
const hp = CanvasSlider({ value: 100, readOnly: true });
const panel = CanvasColumn([hp]);
const ui = new CanvasUI(scene, panel);
const state = { intensity: 0 };
scene.tweens.play(
  Tween.parallel(
    Tween.to(actorTween(actor).offsetX, 50, {
      duration: 1,
      easing: Easing.OutCubic,
    }),
    Tween.to(Tween.property(state, "intensity"), 1, { duration: 1 }),
  ),
);
panel.setPresentation({ offsetX: 30 });
scene.presentationTweens.play(
  Tween.sequence(
    Tween.to(canvasTween(panel).offsetX, 0, { duration: 0.3 }),
    Tween.delay(0.1),
    Tween.to(sliderTween(hp, "display"), 75, { duration: 0.5 }),
  ),
);
engine.step(0.25);
scene.advancePresentation(0.25);
ui.dispose();
engine.dispose();
```
