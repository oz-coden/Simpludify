# Tweenとアニメーション

Tweenは数値を時間で補間するCore機能です。Actorの描画、Canvas UI、ゲーム独自の状態に共通で利用できます。[Tween lab](../examples.html)ではEasing比較、Pause、Sequence/Parallel、SliderとHP表示を操作できます。詳細なAPIとコード例は[英語リファレンス](../en/tween.html)を参照してください。

## 2つの時間軸

- `scene.tweens`：シミュレーション時間。接触通知の後、タイマーの前に進み、EngineのPauseで停止します。ステップ中に追加したTweenは次のステップから進みます。
- `scene.presentationTweens`：表示時間。ゲームをPauseしてもUI演出は継続します。Webが可視フレームの上限付きdeltaを供給し、非表示からの復帰で経過時間を一度に追いかけません。

GameとSceneContextからも同じ時計にアクセスできます。Coreだけの場合は`TweenScheduler.advance(seconds)`、独自Hostでは`scene.advancePresentation(seconds)`を使用します。Web管理の時計を二重更新しないでください。表示時間はリプレイのゲーム状態ではありません。

## 基本操作

`Tween.to(binding, end, { duration, easing, delay, repeat, yoyo })`でレシピを作り、時計の`play`で開始します。時間は秒です。`Tween.property(state, "intensity")`は通常のオブジェクトの書き込み可能な数値フィールド用です。クラスの内部状態には明示的なアダプターを使います。

EasingはLinear、In/Out/InOutのQuad・Cubicと独自の同期関数を指定できます。`repeat`は追加再生回数、`yoyo`は交互の往復です。負の時間や非有限値は拒否されます。ゼロ秒は次の更新またはfinishで実行されます。

Playbackの`pause`/`resume`は所有権を維持します。`cancel`/`stop`は現在値を維持して解放し、完了通知を呼びません。`finish`は有限レシピの終端まで進め、一度だけ完了します。コールバックは同期処理です。

## 所有権と競合

Scene破棄、ActorのRenderable削除、UI削除で関連Tweenはキャンセルされます。同じ対象・プロパティのTweenは標準で新しいものが全体を置換します。`conflict: "error"`なら競合を拒否します。外部更新を検出するとTweenが制御を譲ります。独自bindingではread/write、Lifetime、無効化、プロパティ識別を正しく定義してください。任意のsetterの副作用はエンジンから取り消せません。

## ActorとCanvas UI

`actorTween(actor)`はRenderableのoffsetX/offsetY、rotation、scaleX/scaleY、opacityを提供します。ワールド軸の**描画オフセット**であり、Transformや物理Body・Colliderは移動しません。WASDやMotionは引き続きゲーム位置を制御します。SpriteAnimationは画像フレームを変更し、Tweenと併用できます。

`canvasTween(node)`はoffsetX/offsetY/opacityを提供します。`node.setPresentation`はFlex配置と独立し、子要素、クリッピング、ヒットテスト、ネイティブ入力欄も同じ表示座標へ移動します。兄弟の配置やスクロール内容サイズは変えません。透明度は親子で乗算され、0では入力・フォーカス対象から外れます。回転・拡大縮小・色の補間は今回のCanvas APIに含みません。

## SliderとHP表示

`sliderTween(slider)`は論理値を変更し、onChangeのsourceはprogram、利用者のonCommitは発火しません。`sliderTween(slider, "display")`はdisplayValueだけを滑らかに変えます。HPの論理値・読み上げ値は即座に更新し、バーだけ追従させられます。

両モードは同じ制御権を使い、利用者のドラッグ開始・キー操作、プログラム更新、範囲変更、無効化・破棄でキャンセルします。displayValueをゲーム状態として書き戻さないでください。

## 合成と検証範囲

`Tween.sequence`は順次、`Tween.parallel`は同時、`Tween.delay`は待機です。途中の余剰時間は次の子へ渡されます。合成全体が一つの所有権を持ち、キャンセルも全体に作用します。並列の同じプロパティは拒否します。繰り返しは個別の数値Tweenに対応し、合成全体のループやタイムライン編集は未実装です。

WebGL・Canvas2D、画面幅、ポインター、ネイティブ入力欄の位置などは自動テストの対象です。実行結果は作業報告書に記録します。実OSの日本語IME・物理モバイルキーボードは別途実機検証が必要です。TweenがFPSや物理移動の安全性を保証するものではありません。
