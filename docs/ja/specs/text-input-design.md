# ネイティブ文字編集と選択コントロール

Core/Webは`CanvasSelect`、`CanvasTextInput`、`CanvasNumberInput`をexportします。ゲームコードは通常のCanvasノードを構築し、Web Hostがネイティブの選択ポップアップとフォーカスされたテキストエディタを所有します。CoreはDOM、ブラウザIME、Pixi APIをインポートしません。これは単一行編集の基盤であり、リッチテキストエディタではありません。ブラウザ自動化や合成イベントテストは、Windows/macOSの日本語IMEや物理モバイルキーボードの完全な互換性を保証するものではありません。

## コントロールの作成

```ts verify
import {
  CanvasColumn,
  CanvasNumberInput,
  CanvasSelect,
  CanvasTextInput,
  Game,
} from "@simpludify/web";
const difficulty = CanvasSelect(
  [
    { label: "やさしい", value: "easy" },
    { label: "普通", value: "normal" },
    { label: "難しい", value: "hard", disabled: true },
  ],
  { label: "Difficulty", value: "normal" },
);
const name = CanvasTextInput({
  label: "Player name",
  value: "Player",
  placeholder: "名前を入力",
  maxLength: 40,
});
const count = CanvasNumberInput({
  label: "Count",
  value: 3,
  min: -10,
  max: 10,
  step: 0.5,
});
name.onDraftChange(({ draft }) => console.log(draft.text, draft.composing));
name.onChange(({ value, source }) => console.log("Accepted", value, source));
name.onCommit(({ value }) => console.log("Committed", value));
name.onCancel(({ value }) => console.log("Retained", value));
const game = new Game();
game.canvasUI(
  CanvasColumn([difficulty, name, count], { gap: 12, padding: 16 }),
);
await game.run();
```

`label`はアクセシビリティ用にコントロールに名前を付けます。フォームの可視キャプションには、Settings labのように隣に配置したCanvasLabelを使用してください。すべてのfactoryは最後の引数としてCanvasStyleを受け取り、CanvasInputNodeサブクラスを返します。`value`、`setValue`、`onChange`、`onCommit`、`onCancel`、`readOnly`、`enabled`、`visible`、`setStyle`、およびScene所有権は[値コントロール基盤](canvas-controls.md)を再利用します。無効化中や読み取り専用中でも値の変更は可能です。無効なプログラムコマンドは既存の編集を無効化する前にスローします。等しい書き込みを含む有効なプログラム書き込みは既存の編集を破棄して置き換えます。テキストコントロールはさらに`draft`、`onDraftChange`、`commit()`、`cancel()`を公開します。

## Select

`CanvasSelect(options, { label = "Select", value?, readOnly = false }, style?)`はラベル付きの選択肢をコピーして凍結します。値には文字列、数値、列挙型、オブジェクト参照を使用でき、`Object.is`の同一性で比較されます。重複または未定義のoption値、不正なラベルやフラグは拒否されます。オブジェクト自体がディープクローンされることはありません。optionのインデックスは内部的なHost識別子であり、アプリケーションの値と置き換わることはありません。

初期値は最初の有効なoptionであり、すべて無効な場合は最初のoptionへフォールバックします。空の選択肢はundefined値を持ちます。指定された値やプログラム値は選択肢に含まれていなければなりません。コードから無効化された値を選択することは許可されますが、ユーザーによる選択は拒否されます。`setOptions(options)`はアトミックに検証し、現在のセッションをキャンセルし、生き残った値を保持します。それ以外の場合は初期値フォールバックを使用します。このプログラムコマンドは、受け入れ値が変化した場合にのみchangeイベントを発行します。

Web HostはCanvas上で解決されたボックスにネイティブの`<select>`を配置します。ブラウザやOSのポップアップ配置、長いリストのスクロール、無効化された選択肢、タッチピッカー、キー操作の慣習はネイティブのままです。ポップアップは祖先のCanvasマスクをエスケープし、ブラウザ／OSのViewportによって制約されます。Escapeはネイティブの保留選択をキャンセルします。Tab/Shift+TabはCanvasUIの共有トラバーサルを使用し、ツリーを抜けるとページ全体のナビゲーションへ戻ります。

## テキストの値、ドラフト、確定（Commit）

`CanvasTextInput({ label = "Text", value = "", placeholder = "", maxLength?, readOnly = false }, style?)`は単一行文字列を受け付けます。`value`は**最後に確定・受け入れられた値**であり、現在の編集途中ドラフトではありません。`draft`は変更不可な`{ text, selectionStart, selectionEnd, direction, composing }`を含みます。オフセットはネイティブ入力APIと一致するUTF-16位置です。エンジンが物理キーコードからテキストを再構築したり、個々のコードユニットを描画することはありません。書記素の移動・削除、グリフ成形、双方向テキスト、サロゲートペア、結合文字列はネイティブ編集が処理します。

- フォーカスまたはアクティブ化によりセッションが開始されます。ネイティブの入力および選択スナップショットがドラフト通知を更新します。同一のスナップショットは重複排除されます。編集途中や変換中のドラフトに対して`onChange`や`onCommit`が発火することはありません。
- Enterは変換中でない有効なドラフトを受け入れます。通常のblurやTabも受け入れます。値の変更は`onChange`を発行し、そのトランザクションがまだ値を所有していれば続いて`onCommit`を発行します。変更のないテキストの受け入れは編集を終了しますが、値変更やコミット通知は発行しません。
- Escape、blur中の変換状態、無効化／非表示、プログラムによる置き換え、除去、ウィンドウの非表示／フォーカス喪失、破棄によって編集はキャンセルされます。受け入れ済みの値が保持され、ドラフトは元に戻ります。`onCancel`は元の開始入力元と受け入れ値を報告します。キャンセルは冪等です。
- `commit()`は現在の有効なドラフトを明示的に受け入れ、成功を返します。無効または変換中のドラフトはキャンセルしてfalseを返します。アクティブなセッションがない場合はtrueを返します。`cancel()`は受け入れ済みテキストを復元します。
- `maxLength`はUTF-16単位をカウントし、ネイティブのmaxlengthと一致します。Hostは一時的に制限を超えた変換ドラフトも保持しますが、制限を超えた最終ドラフトはキャンセルされます。サロゲートペアの半分だけが残ることはありません。`placeholder`は動的に代入可能であり、値自体は変更しません。

ネイティブ入力はフォーカス中にテキスト／キャレット／選択を所有し、Coreの完全な境界、クリッピング、フォント、パディング、UI scaleに追従します。アイドル時のテキストはCanvas描画され、ネイティブ入力は透明なアクティブ化ターゲットとして保持されるため、ポインター／タッチフォーカスが同期的に発生できます。

## 数値ドラフトとSlider値の共有

`CanvasNumberInput({ label = "Number", value?, min = 0, max = 100, step = 1, placeholder = "", readOnly = false }, style?)`は、`inputMode = "decimal"`とスピンボタンセマンティクスを持つ同一の単一行ネイティブテキストエディタを使用します。既定値、範囲検証、クランプ、スナップはSliderと一致します。値は有限の数値です。プログラム更新において`NaN`やInfinity、表現不可能な範囲／ステップはスローされます。

編集中は空のテキスト、`-`、`.`、`1e`などのドラフトが保持されます。確定時、パーサーは前後の空白を除去したASCIIの小数／分数／指数表記（`.5`、`-2.3`、`1e2`）を許容します。16進数、桁区切り文字、小数点カンマ、非有限の結果は拒否されます。有効な結果はSliderのポリシーでクランプ／スナップされ、`String(number)`で標準的に表示されます。無効なコミットは以前受け入れられた数値を復元し、キャンセルを発行します。

ArrowUp/Downは1ステップ変更し、PageUp/Downは10ステップ変更します。変換中はこれらすべてのコマンドがネイティブのままになります。

```ts verify
import { CanvasNumberInput, CanvasSlider } from "@simpludify/core";
const slider = CanvasSlider({ value: 50 });
const number = CanvasNumberInput({ value: 50 });
slider.onChange(({ value }) => {
  if (number.value !== value) number.value = value;
});
number.onChange(({ value }) => {
  if (slider.value !== value) slider.value = value;
});
```

等しい値の代入をガードすることで循環イベントを防ぎます。同一の数値設定を共有する際は、範囲とステップを等しく保ってください。

## Core/Host契約と移行

`CanvasControlPort.native`はSelectとテキスト編集を識別します。Hostは`begin(source)`を呼び出して`CanvasNativeSession<D>`を保持します。セッションは単調増加IDと`active`、`update`、`commit`、`cancel`を持ちます。通常フォーカス境界には`end("blur")`を、解体処理には`end("interrupt")`を使用します。Coreはすべてのコールバックでセッションの同一性、コントロールのリビジョン、利用可能性を検証します。

Webはプレゼンテーションのライフサイクル、同期的なネイティブアクティブ化、エディタリビジョンガードと置き換え、ネイティブイベント、スコープ付きリスナー破棄を所有します。BrowserInputは、ゲームプレイActionからネイティブ入力要素やIME変換を除外します。エディタへのフォーカス進入は保持されたブラウザキーをクリアします。終了時のEnterやEscapeはエディタフォーカスを維持するため、編集を抜けるにはTabを使用してください。

## IMEと検証の限界

変換の開始／更新／終了はネイティブドラフト状態を運びます。`isComposing`中のEnterやEscape、keyCode 229はIMEに任され、フォームをコミットしたりゲームActionを起動したりすることはありません。compositionendはドラフトの更新であり、フォームの確定ではありません。

自動テストはCoreスナップショット、ブラウザ編集、Unicode／選択／クリップボード、変換イベント順序、フォーカス、クリッピング、数値検証、読み取り専用、クリーンアップをカバーしています。**実際のWindows/macOS日本語IME、物理Android/iOSキーボード、他ブラウザエンジン、ネイティブピッカーの外観、支援技術は未検証のままです。**

## 数値キーボードヒント（v0.1.3以降）

`CanvasTextInput({ inputMode: "numeric" })`は、通常のテキスト／ドラフト／IMEセマンティクスを維持したまま、数値ソフトキーボードを要求します。`CanvasTextInputMode`は`"text" | "numeric" | "decimal"`であり、既定はtextです。この作成時ヒントはテキストを解析、拒否、クランプ、正規化するものではなく、特定の物理キーボードレイアウトを保証するものでもありません。

空欄、`0`、`001`、範囲外の整数など、生の入力に対してアプリケーション側でバリデーションエラーを表示する必要がある座標、個数、コードの入力に使用してください。
