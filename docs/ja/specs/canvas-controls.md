# Canvas入力コントロール

`CanvasCheckbox`と`CanvasSlider`は移植可能なCore UIノードであり、Webから再exportされます。その状態、イベント、幾何形状、操作の意味はDOMやPixiに依存しません。WebはこれらをゲームCanvas内に描画し、スコープ付きのネイティブフォーカスとARIAミラーを提供します。`CanvasSelect`、`CanvasTextInput`、`CanvasNumberInput`は同一の値基盤を拡張し、Hostネイティブの選択／テキスト編集を提供します。[ネイティブ文字編集契約](text-input-design.md)でドラフト／確定セマンティクスとIME検証限界を説明しています。

## 設定画面をつくる

```ts verify
import {
  CanvasButton,
  CanvasCheckbox,
  CanvasColumn,
  CanvasLabel,
  CanvasScroll,
  CanvasSlider,
  Game,
} from "@simpludify/web";
const sound = CanvasCheckbox("音声 / Sound", { checked: true });
const volume = CanvasSlider({
  label: "音量 / Volume",
  min: 0,
  max: 100,
  value: 50,
});
const status = CanvasLabel("Ready");
volume.onChange(({ value, source }) => status.setText(`${value}% (${source})`));
volume.onCommit(({ value }) => console.log("Volume gesture completed", value));
const root = CanvasColumn(
  [
    CanvasScroll([sound, volume], { height: 200, gap: 12 }),
    status,
    CanvasButton("Reset", () => {
      sound.checked = true;
      volume.value = 50;
    }),
  ],
  { padding: 16, gap: 12 },
);
const game = new Game();
game.canvasUI(root);
await game.run();
```

Canvas trail → **Settings lab**は[Coreのみの定義](../../../examples/canvas-ui/settings-screen.ts)を使用しています。音声／グリッド設定、音量／速度スライダー、難易度選択、プレイヤー名編集、連動する数値音量入力欄、読み取り専用モード、プレビュー、Applyスナップショット、Reset、Backが含まれます。ユーザーコードはDOM要素の作成やPixiの直接操作を行いません。Applyは現在の値をコピーします。さらなる編集が適用済みスナップショットを変更することはありません。Resetはドラフトの既定値を復元し、以前適用されたスナップショットを復元するわけではありません。

## 値とイベントの契約

両コントロールは、通常の[CanvasNode](canvas-ui.md)ツリー／スタイル／寿命APIに加えて、特化した`CanvasInputNode<T>`サブクラスを返します。

| メンバー                  | 契約                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| value / setValue(value)   | 検証済みの値を取得または同期的設定。無効化や読み取り専用中でもプログラムからの書き込みは許可され、実際の値変更時のみ通知し、等しい値であっても保留中のポインター／キー入力をキャンセルし、ユーザーコミットは発行しない。                              |
| readOnly                  | ブール値、既定false。ユーザーによる変更はブロックされるが、フォーカスとプログラム更新は利用可能。変更すると保留中の入力がキャンセルされる。`enabled = false`は既存の利用可能性契約を通じて入力とフォーカスを除外する。                                |
| editing                   | 連続的なポインター編集中のみtrue。チェックボックスやキーボードの変更は即時の単発操作。                                                                                                                                                                |
| onChange(handler, owner?) | 型付きの`{ node, previous, value, source }`。sourceは`program`、`pointer`、`keyboard`、`accessibility`。同期ハンドラが実行される時点で値は保存済み。等しい正規化値は何も発行しない。                                                                  |
| onCommit(handler, owner?) | 変更を伴うユーザー操作完了後に型付きの`{ node, previous, value, source }`を発行。チェックボックスの切り替えと各有効なスライダーキーコマンドは1回コミットし、スライダードラッグ解放時は初期値から1回コミットする。プログラム書き込みはコミットしない。 |
| onCancel(handler, owner?) | 連続的なポインター編集が中断された際に発行。`previous`は押下前の値、`value`は現在値。中断された編集の後にコミットは発行されない。                                                                                                                     |

Sliderの値は**即座に**変更され、音声やプレビューの操作に適しています。キャンセルは最新の即時値を維持し、アプリケーション側の副作用をロールバックしません。値の変化がないポインター編集はコミットを発行しません。中断された編集はキャンセルを発行します。フォームのロールバックが必要なアプリケーションは、自身でスナップショットを保持し、プログラム書き込みで復元してください。

購読は登録解除関数を返し、LifetimeOwnerを指定できます。すべて既存の同期的EventBus規則を使用します。リスナーは登録順に実行され、エラーは集約され、非同期リスナーや同一イベントトークンの再帰的発行は拒否されます。

## Checkbox

`CanvasCheckbox(label, { checked?: boolean, readOnly?: boolean }, style?)`は`CanvasCheckboxNode`を返します。既定値: checked false, readOnly false。`checked`はブール値`value`のエイリアスです。`setText(label)`は表示／アクセシビリティラベルを変更します。

内側でのプライマリポインター解放によって1回トグルします。ポインターキャンセル、スクロールへのドラッグ、外側での解放、副ボタン操作ではトグルしません。Enter/Spaceは対応する解放でトグルし、キーリピートによる重複発火はありません。Blurやプログラム／読み取り専用の変更は保留中のキーをキャンセルします。読み取り専用コントロールは`aria-readonly`付きでフォーカス可能なままです。

レンダラーはラベルの隣に30 UI単位（20単位のボックスと間隔）を予約します。テキストは残りの幅の中で折り返されます。既定値はpadding 12、minHeight 44です。

## Slider

`CanvasSlider({ label?, min?, max?, step?, value?, readOnly? }, style?)`は`CanvasSliderNode`を返します。既定値: label `Value`, range 0–100, step 1, value min, readOnly false; width 260, maxWidth 100%, height 76, padding 12。表示ラベルには現在値が含まれます。これは**水平方向**のスカラーコントロールであり、数値テキストエディタではありません。

`min`、`max`、`step`は読み取り専用ゲッターです。`setRange({ min?, max?, step? })`は範囲全体をアトミックに検証し、保留中の入力をキャンセルし、既存の値をクランプ／スナップします。値と範囲は有限でなければならず、min < max、step > 0、range spanは有限かつspan/stepはNumber.MAX_SAFE_INTEGER以下でなければなりません。値の書き込みは端点にクランプされ、minから最も近いステップにスナップします。maxがグリッド上にない場合でも両端点は到達可能です。

ArrowRight/Upはstep分増加し、ArrowLeft/Downはstep分減少します。PageUp/Downは10ステップを使用し、Home/Endは端点を選択します。これらのコマンドは祖先のスクロールより優先されます。キーボードコマンドは消費されますが、読み取り専用コントロールを変更することはありません。ネイティブコントロールがキーボードフォーカスを所有している間、ゲームプレイActionは除外されます。

プライマリポインターの押下により即時値が更新され、編集が開始されます。共有されたCoreトラック幾何形状が後続のx座標を範囲にマッピングし、範囲外はクランプします。方向意図が解決される前であれば、可動な祖先がスクロールを要求してスライダーをキャンセルできます。コントロールの`dragThreshold`（既定8ホストスクリーン単位）に達する水平移動はスライダー所有権をロックします。スライダーの慣性は開始されません。

## Hostとライフサイクル

Coreの`CanvasControlPort`は、描画スナップショット、入力リビジョン、サポートされるキー、同期的キー／ポインターコマンドを記述します。標準のPointerRoutingがこれを呼び出し、ジェスチャーキャンセルを所有します。

Webはポインター透過のネイティブボタンミラーを`role=checkbox` / `role=slider`、ARIA値、無効状態、ネイティブTabフォーカスと共に再利用します。正確なテキストメトリクスは`canvasControlText(node)`とチェックボックスの予約ラベル空間を使用します。

Scene/UIの破棄はアクティブな編集をキャンセルし、イベント、ルーティング所有権、ネイティブミラー、テキストメトリクス、グラフィックスを既存の寿命を通じて解放します。

数値ソフトキーボードを要求する生の検証済み整数フィールドには、`CanvasTextInput({ inputMode: "numeric" })`を使用できます。[文字入力設計](text-input-design.md#数値キーボードヒントv013以降)を参照してください。
