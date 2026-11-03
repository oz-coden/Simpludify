# Select・文字・数値のネイティブ編集

CanvasSelect／CanvasTextInput／CanvasNumberInputはCoreで値・下書き・Focus・寿命を持ち、Webがネイティブの選択・キャレット・選択範囲・クリップボード・IMEを担当します。アプリはHTML入力要素やネイティブ編集イベントを組み立てません。非編集中はCanvas上へ描画します。

```ts verify
import {
  CanvasColumn,
  CanvasNumberInput,
  CanvasSelect,
  CanvasTextInput,
  Game,
} from "@simpludify/web";
const game = new Game();
game.scene("settings", ({ canvasUI }) => {
  const name = CanvasTextInput({
    label: "Name",
    value: "Player",
    maxLength: 40,
  });
  const count = CanvasNumberInput({
    label: "Count",
    min: 0,
    max: 100,
    step: 1,
    value: 3,
  });
  const mode = CanvasSelect(
    [
      { label: "Easy", value: "easy" },
      { label: "Hard", value: "hard" },
    ],
    { label: "Mode", value: "easy" },
  );
  name.onCommit(({ value }) => console.log(value));
  canvasUI(CanvasColumn([name, count, mode], { padding: 16, gap: 12 }));
});
await game.run("settings");
```

## 値と下書き

valueは受理済みの値、draftはネイティブ編集の最新スナップショットです。onDraftChangeで編集中の全文とcomposingを確認し、onCommitで確定値を使います。compositionendは下書きを更新し、通常のEnter／blurが受理を行います。IME途中のEnter/Escapeは候補操作を優先します。compositionend.dataとinput.dataを両方追記せず、全文スナップショットで削除・選択置換・貼り付けを維持します。

キャンセル・プログラム変更・非表示・無効・除去・Scene交換・破棄は編集世代を無効化し、古いDOMイベントが新しいSessionへ値やFocusを戻すことを防ぎます。readOnlyはフォーカス可能ですが利用者による値変更を許しません。購読と同期コールバックのエラーは値ノード共通規則で、ゲーム状態全体の巻き戻しではありません。

## TextInput

CanvasTextInputは単一行の文字列です。label、value、placeholder、maxLength、readOnlyとinputModeを指定できます。文字の正規化、ローマ字かな変換、正誤判定はゲームの規則です。inputModeのnumeric/decimalはソフトキーボードへのヒントで、受理する文字列を勝手に数値化・clampしません。整数の独自検証では"日本語"などの不正値をアプリ側で扱えます。

## NumberInput

CanvasNumberInputはmin/max/step/valueを持ち、数値への変換と範囲・step処理を提供します。有限性・正しい範囲を検証し、編集中の途中文字列と受理済み数値を区別します。数値として成立しない下書きをゲーム値へそのまま混入しません。生の入力を独自ルールで厳密検証したい場合はTextInput＋numericヒントを選んでください。

## Select

CanvasSelect(options,{label?,value?,readOnly?},style?)の各項目はlabel/value/disabledです。値はundefinedではない任意の型で、選択肢はコピーします。setOptionsは整合性を検証し、編集を中断して新しい候補へ更新します。値の同一性と削除時の選択状態を意識し、毎フレーム無条件に候補を生成し直してネイティブ選択を中断しないでください。

WebはネイティブSelect／入力の標準ポップアップ・キャレットを使い、OS UIをCanvasで模倣しません。生のプログラム値の変更は通知元を区別でき、利用者の確定操作と同じコマンドだとはみなしません。

## 投影と入力の優先順位

HostはUI bounds、scale、clipと重なりを使ってネイティブ面を投影します。カメラのワールド座標やDPRをUI位置へ重複適用しません。非表示・切り抜き・後方の編集面が上のCanvas操作を覆わないよう、共通PointerRoutingと入力世代を使います。

ネイティブ編集はゲームのキーボード・パッド入力より優先し、ゲーム用の保持状態を解放します。Tabは現在の宣言順に従うCanvas Focus／ブラウザ移動で、ゲームに閉じ込めません。動的な追加・並べ替え・文字更新は、維持可能なネイティブ編集Sessionと選択範囲を不必要に作り直しません。Sourceが独立したプログラム／タッチ入力は自分の所有権に従います。

検証はChromiumの合成compositionイベントと実DOM編集を対象とし、実OSのIME候補UI、物理ソフトキーボード、全ブラウザ、スクリーンリーダーの保証ではありません。[Canvas UI](canvas-ui.md)、[ゲームパッド](gamepads.md)、[制約](../ja/limitations.md)も参照してください。
