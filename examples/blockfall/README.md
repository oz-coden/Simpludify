# Blockfall — 落ち物パズル

Simpludifyの公開APIでつくる、10列×20行の整数グリッド型パズルです。入力は型付きPuzzleActionsとActionControllerで受け、個別のkeydownキューを持ちません。7種類のテトロミノ、ライン消去、レベル、次の5個、ホールド、ゴースト、一時停止、再開始を備えます。固有のゲームルールはサンプル側に置き、Colliderやエンジン内部APIには依存しません。

[サンプルギャラリー](../../site/ja/examples.md)から「Blockfall」を起動できます。

## 操作

最初に盤面をクリック／タップ、またはTabで選択します。キーボードは盤面にフォーカスがある間だけ取得します。下部のボタンはタッチ・マウス・TabとEnter／Spaceで操作できます。

| 操作           | キー／ボタン                        |
| -------------- | ----------------------------------- |
| 左右移動       | ←／→、Move left／Move rightを長押し |
| 時計回り       | ↑／X、Rotate right                  |
| 反時計回り     | Z、Rotate left                      |
| ソフトドロップ | ↓、Soft dropを長押し                |
| ハードドロップ | Space、Hard drop                    |
| ホールド       | C／Shift、Hold                      |
| 一時停止・再開 | P／Esc、Pause／Resume               |
| 再開始         | Restart                             |

ホールドは1ピースの固定まで1回。ゴーストの位置にハードドロップします。ゲームオーバー後はRestartで新しい盤面を開始します。再開始はSceneを置き換え、以前のComponent・入力元・タイマー・UI・描画を解放します。乱数は同じEngineの列を継続します。

## 回転・固定・得点の仕様

- 7-bag：7種類をFisher–Yatesでシャッフルして順番に消費します。乱数は`Engine.random.next()`、初期seedは2026です。
- Iは4×4、J/L/S/T/Zは3×3の正方行列を90度回転します。Oは回転しても変わりません。
- 壁蹴りは**独自の簡易ルール**です。回転後の座標へ `(0,0), (-1,0), (1,0), (-2,0), (2,0), (0,-1), (-1,-1), (1,-1), (0,-2)` の順にオフセットを試します。下向きが正です。全ピース・回転方向で同じ順序を使い、SRS・T-spin・公式競技規則は実装していません。
- 出現位置は通常x=3、Oはx=4、y=-1。上端より上のセルは一時的に許可します。出現が塞がるか、上端より上で固定されるとゲームオーバーです。
- 自然落下の間隔は`max(0.06, 0.8 × 0.8^(level-1))`秒。ソフトドロップは0.035秒／セルです。
- 接地後0.45シミュレーション秒で固定。接地中の成功した移動・回転による猶予リセットは1ピース15回までです。
- 左右長押しは初動直後に0.16秒待ち、その後0.055秒ごとに反復します。
- 1／2／3／4行同時消去で100／300／500／800点×消去前のレベル。ソフトドロップ1点／セル、ハードドロップ2点／セルです。10行ごとにレベルが上がります。コンボ・back-to-back・落下速度の公式互換性はありません。

## 実装と主要API

| ファイル             | 責務                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| [logic.ts](logic.ts) | DOM非依存の盤面・回転・占有判定・得点、Componentによる入力とシミュレーション時間の適用                     |
| [view.ts](view.ts)   | Actor・Transform・Renderableによるセル表示とDOMプレビュー                                                  |
| [main.ts](main.ts)   | Game・Scene、ActionController、所有者付きActionSource、Button／HoldButton、Sceneタイマー、フォーカスと破棄 |

`Engine.step()`で描画を起動せずに同じロジックを進められます。同じseedだけでなく、入力列・時間刻み・Scene再開始の順序も一致させると結果を再現できます。Webはフレーム時間を利用するため、実時間で手動操作したプレイが常に同じ結果になるという保証ではありません。

盤面には固定ブロックのみを保存し、落下中のピースとゴーストは別に計算します。表示は状態の読み手であり、盤面判定や得点を変更しません。操作反復・固定猶予はゲームルールなのでサンプルで管理します。ActionControllerが短押しとButton間の順序を保持し、Componentが捕捉済みeventsを消費します。長押しも同じActionの保持状態から扱い、個別のDOMキー処理は持ちません。盤面や得点の処理は引き続きゲーム側に置きます。

## 起動・検証・配布

リポジトリのルートで実行します。

```sh
npm ci
npm run dev -- --example blockfall
npm test -- tests/unit/blockfall.test.ts
npm run build -- --example blockfall --target web --base /Simpludify/
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
```

ゲーム単体の成果物は`dist/`、統合サイトは`site-dist/`です。どちらも静的HTTPホストで配信できます。ブラウザ入力は外部送信しません。画像・音声・外部フォント・商用作品のブランド素材は使用していません。

単体テストでは回転・壁・積みブロック・行消去・得点・ゲームオーバー・ポーズ・seedと入力の再現・100,000ステップのヘッドレス実行を検証します。統合サイトのブラウザテストはキーボード、合成タッチ、再開始、iframe終了時のEngine／入力元の破棄を検証します。実機スマートフォンや全ブラウザでの動作保証とは分けて扱います。

## Action入力と検証

createPuzzle(scene, engine.input, random)がScene所有のActionControllerを構成します。Left/Right/SoftDrop、RotateCW/RotateCCW、Drop、Hold、Pauseはゲーム側の定義です。Controllerのeventsで複数の短押し順序を保ち、長押しのリピート時間はゲーム側が管理します。キーボードの割り当て変更はcontroller.controls.rebindで行い、盤面ルールは変更しません。controller.inputはヘッドレス操作用の論理sourceです。タッチも独立した論理sourceを使い、Scene再開始時に破棄されます。[入力契約](../../docs/action-input.md)を参照してください。
