# Canvasの値コントロール

CanvasCheckboxとCanvasSliderは、既存Canvasツリー・Focus・PointerRouting・所有権を使う値ノードです。単純な設定やプレビューに使い、フォームの取り消しでゲーム状態全体を巻き戻す機能ではありません。

```ts verify
import {
  CanvasCheckbox,
  CanvasColumn,
  CanvasSlider,
  Game,
} from "@simpludify/web";
const game = new Game();
game.scene("settings", ({ canvasUI }) => {
  const sound = CanvasCheckbox("Sound", { checked: true });
  const volume = CanvasSlider({
    label: "Volume",
    min: 0,
    max: 1,
    step: 0.05,
    value: 0.5,
  });
  volume.onChange(({ value }) => console.log(value));
  canvasUI(CanvasColumn([sound, volume], { padding: 16, gap: 12 }));
});
await game.run("settings");
```

## 共通契約

value／readOnlyは検証された状態です。プログラム書き込みと利用者操作は変更元を区別し、onChangeは変化、onCommitは利用者編集の確定、onCancelは中断を通知します。購読は解除関数を返し、LifetimeOwnerへ所有させられます。同期EventBusの順序・再入・非同期拒否規則を守ります。コールバックエラーは既に保存された値を巻き戻しません。

Sliderの値は操作中から即座に変わります。キャンセルしても最後の値や外部副作用を巻き戻さず、フォーム全体の取消が必要ならアプリがスナップショットを持ってプログラム書き込みで戻します。変化しなかった編集からcommitは発生せず、プログラム変更などで中断された編集から古いcommitは発生しません。

## Checkbox

CanvasCheckbox(label,{checked?,readOnly?},style?)はchecked=false、readOnly=falseが既定です。checkedはboolean valueの別名です。setTextで表示・読み上げラベルを更新し、非booleanは変更前に拒否します。

主ポインターを内側で離すと一度切り替え、外側・cancel・祖先へのスクロール移譲では切り替えません。Enter/Spaceは対応する解放で切り替え、repeatを増幅しません。blur・readOnly／プログラム変更は保留操作を取り消します。readOnlyでもfocusでき、disabled／hiddenは祖先を含むavailabilityに従います。

ラベルの隣に30 UI単位を確保し、既定padding=12、minHeight=44です。文字折り返し、focus／hover／press描画は通常のCanvasスタイルです。

## Slider

CanvasSlider({label?,min?,max?,step?,value?,readOnly?},style?)は横方向のスカラー操作です。既定label=Value、範囲0～100、step=1、value=min、readOnly=false。幅260、maxWidth=100%、高さ76、padding=12です。数値の文字編集欄ではありません。

setRange({min?,max?,step?})は全範囲を検証してから保留入力を取り消し、既存値をclamp/snapします。有限値、min<max、step>0、有限span、安全なstep数、端点で表現可能な変化を要求します。値は範囲内へ制限し、minを基準とする最寄りstepへ丸め、maxが格子上でなくても両端へ到達できます。任意精度演算ではありません。不正な変更は値・範囲・入力を変えません。

矢印は1step、PageUp/Downは10step、Home/Endは端点です。祖先スクロールより優先し、Tabは通常のFocus移動です。readOnlyではキーを消費して値を変えません。主ポインターが編集を開始し、track上のxを範囲へ対応させ、外側はclampします。1つのSliderは1ポインターが所有し、別Sliderは独立です。方向確定前はスクロール可能な祖先へ移譲でき、既定dragThreshold=8 Host単位の水平移動でSliderへ固定します。Sliderの慣性はありません。

プログラム／範囲／readOnly変更、非表示・無効、UI scale、除去、blur、Scene交換、破棄で編集所有権を解放します。キャンセル済み物理IDは離すまで抑止し、ワールドや交換Sceneへ操作を引き継ぎません。

## Host・読み上げ・数値文字列

Webは既存のネイティブミラーへcheckbox/slider role、checked/range/readOnly、disabled、Tab focusを供給し、Canvasポインター判定を二重化しません。CoreのCanvasControlPort、canvasSliderGeometry、canvasControlTextは独自Host向けで、通常のゲームはfactory/value/eventsを使います。カメラ・DPRとUI単位は分離し、コントロールごとのRAFは作りません。

Scene/UI破棄でイベント・編集・描画・ミラーを解放します。実機スクリーンリーダーやモバイル適合性の保証ではありません。生の整数文字列を独自検証したい場合はCanvasTextInput({inputMode:"numeric"})を使えます。[ネイティブ編集](editing.md)を参照してください。
