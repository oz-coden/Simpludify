# Prism Raid — Triangleシューティング

三角形の機体で3ウェーブを迎撃する、小さな縦型シューティングです。自機は上向き、敵は下向きに回転したTriangleで描画します。弾は矩形と円、背景は細い矩形です。画像・音声・外部サービス・AIモデルは使いません。

[サンプルギャラリー](../../site/ja/examples.md)から起動できます。Start missionで開始し、Watch autopilotでは通常の入力APIを使う自動プレイヤーを観察できます。

## 操作

| 操作             | PC                    | タッチ                    |
| ---------------- | --------------------- | ------------------------- |
| 移動             | WASD／矢印            | 下部の4方向ボタンを長押し |
| ダッシュ         | Shiftを長押し         | DASHを長押し              |
| 連射             | Spaceを長押し         | FIREを長押し              |
| 一時停止・再開   | P／Esc、Pause／Resume | Pause／Resume             |
| 再開始・メニュー | Restart／Menu         | Restart／Menu             |

移動と射撃は同時に使えます。タッチは方向とFIREに2本の指を使います。Start missionとRestart後は盤面へフォーカスします。盤面の外へフォーカスが移る、windowがblurする、タブが隠れるとブラウザ入力は解放されます。ネイティブボタン上のキーはゲームに奪われません。

## ルール

- HPは5。敵本体・敵弾への接触で1減り、その後1シミュレーション秒は接触ダメージを受けません。敵弾と接触した敵本体は消費されます。
- 下端を突破した敵はrelayへ1ダメージを与えます。これは自機の無敵時間と独立した失点です。
- 3ウェーブの敵数は6／8／10。全出現済みの敵がいなくなると次へ進み、最後を生き残るとクリアです。HPが0、または75シミュレーション秒に達するとゲームオーバーです。
- 珊瑚色のscoutはHP1・100点、琥珀色のdrifterはHP2・160点、紫のgunnerはHP3・220点。drifterは狙い弾、gunnerは狙い弾と左右への弾を撃ちます。
- 自機は0.16秒ごとに2発を発射します。弾は貫通せず、消費後の同一フレームの接触から重複ダメージ・得点を発生させません。
- Restartは新しいSceneを作り、敵・弾・入力元・購読・タイマー・描画を破棄します。Engineの乱数列は継続します。初回seedは2026です。

## 公開APIでの構成

| ソース                     | 責務とAPI                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [logic.ts](logic.ts)       | Actor・Component・Transform・Motion・型付きRaidActions、Trigger、型付きイベント、Sceneタイマーで移動・発射・HP・ウェーブを実装 |
| [view.ts](view.ts)         | 公開RenderableでTriangle・Box・Circleを配置し、透明度と背景を更新                                                              |
| [main.ts](main.ts)         | Game・Scene、ActionController、ActionSource、Button／HoldButton、Label、ポーズと破棄をブラウザへ結び付ける                     |
| [autoplay.ts](autoplay.ts) | コピーされたゲーム状態を読むルールベースの照準・回避。書き込みは通常のActionSource.setのみ                                     |

ロジックはDOM・Pixi・Web実行環境をimportしません。描画の有無でゲーム用乱数の消費順が変わらないよう、背景の配置は別の固定パターンです。`Raid.snapshot()`が固有のHP・弾・敵・武器待機時間・ウェーブ等をコピーし、Engine.snapshot()が入力・seed状態・一般的なActor状態を提供します。復元APIではありません。

## Triangleと接触の近似

```ts verify
import {
  Actor,
  Collider,
  CollisionResponse,
  CollisionShape,
  Renderable,
  Shape,
  Transform,
} from "@simpludify/core";
const ship = new Actor();
ship.add(new Transform());
ship.add(
  new Renderable({
    source: { kind: "shape", shape: Shape.Triangle },
    width: 28,
    height: 36,
    color: 0x65a8ed,
  }),
);
ship.add(
  new Collider({
    shape: CollisionShape.Circle,
    radius: 11,
    response: CollisionResponse.Trigger,
  }),
);
```

Triangleの既定は上向き、原点は外接矩形の中心です。頂点は`(0,-height/2), (width/2,height/2), (-width/2,height/2)`。敵はTransform.rotationを約πにして下向きへ回します。描画と接触形状は独立しており、自機は半径11、敵は14／19、自機弾は6、敵弾は5の円で近似します。Solid・CollisionBodyはこのゲームには不要です。

接触判定は離散的です。自機弾300、敵弾165世界単位／秒、WebのmaxDeltaは1/30秒に設定し、薄すぎない当たり判定を使います。大きなEngine.stepや極端な弾速ではすり抜けます。テストは高速弾の見逃しを再現し、同じ経路を小さなステップで検出します。接線付近の全経路や連続衝突を保証するものではありません。

ContactEnterで弾を最初にdisposeしてからダメージを適用します。相手の破棄も確認し、複数接触で二重撃破しません。ContactExitは通知済みで生存する相手だけが受け取れるため、消費済みの弾の後処理には使用しません。

## 起動・検証

リポジトリのルートで実行します。

```sh
npm ci
npm run dev -- --example prism-raid
npm test -- tests/unit/prism-raid.test.ts
npm run build -- --target web --example prism-raid --base /Simpludify/
npm run site:build -- --base /Simpludify/
npm run site:check
npm run test:site
```

同じseed・入力列・時間刻みでゲーム状態を再現できます。ヘッドレス検証と自動プレイヤーは実時間を待たずに進めます。Webの可変フレームやGPU出力を含む全環境でのビット一致は保証しません。大きなステップはタイマーの欠落回数や接触経路を変えるため、高速検証でも小さな固定刻みを使います。

[APIの使い勝手・性能・検証記録](../../docs/shooter-validation.md)を参照してください。自動ブラウザ検証はChromiumと合成タッチが対象であり、実機Safari／Firefoxや任意のGPUでの保証とは分けています。

## Action入力とリバインド

RaidActions.MoveはAxis2D、Fire・Sprint・PauseはButtonです。new Raid(scene, engine.input, random)で構成し、移動Componentと戦闘ルールは物理キーを参照しません。キーボードはcontrolsのbindings、タッチは独立ActionSource、自動プレイヤーはround.inputへMove/Fireを設定します。controls.rebindで物理キーを変更しても、タッチ・自動プレイや戦闘ロジックは変わりません。pause/resumeは停止中も捕捉するonPressedを利用します。[詳細な入力契約](../../docs/action-input.md)には所有権・合成・設定保存をまとめています。

移動は標準ActionMovementが担当し、Inputフェーズのゲーム固有SprintScaleがscaleを1／2へ設定します。Motion.speedは基準速度220で、ダッシュ倍率とは別の責務です。移動後のクランプ・射撃・寿命判定はLateUpdateで接触判定より前に行います。

## 記録と再生

`replay.ts`は同じゲームロジックを名前付き`enemy`乱数ストリームで動かし、論理Actionを記録・JSON往復・再生して状態を比較します。通常のブラウザプレイでは記録を有効にしません。Sprint Action追加後のサンプルゲーム版はprism-raid-replay-2です。旧版はAction定義が一致しないため再記録してください。ReplayData形式はv1のままです。

```sh
npm run replay:demo
npm run replay:demo -- --out mission.json
```

ファイル保存はCLI側の処理で、CoreのReplayはメモリ上のJSON互換データだけを扱います。ゲームバージョンはサンプル自身が指定します。[Random・Replay・固定ステップ](../../docs/replay.md)に手順と制約をまとめています。
