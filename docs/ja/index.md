<p class="eyebrow">Code-first · TypeScript · 2D</p>

# ゲームのしくみを、<br>理解できるコードで。

Simpludifyは、TypeScriptを中心に2Dゲームをつくる実験的なゲームエンジンです。ActorとComponentを組み合わせ、必要なときにイベントを使い、通常のコードとブラウザの道具で開発できます。

<div class="actions"><a class="primary" href="getting-started.html">最初のゲームをつくる →</a><a href="examples.html">ブラウザで試す</a></div>

> Experimental v0.2.0のnpm SDKを公開済みです。[配布アーカイブ・npm導入ガイド](npm.md)で独立プロジェクトを構築できます。統一入力・ゲームパッドAPIや入力Binding・仮想入力もnpmから利用できます。v0.1.7から更新する場合は[移行ガイド](migrate-0.2.0.md)を参照してください。APIは変更される可能性があります。Windows版やネットワーク機能は未実装です。

<div class="feature-grid">
<section class="feature"><h2>組み合わせてつくる</h2><p>Characterの既定値から始め、Transform・Renderable・Motionや独自Componentへ段階的に進めます。イベント駆動は必須ではありません。</p></section>
<section class="feature"><h2>見える部分と、動く部分を分ける</h2><p>DOM非依存のCoreでシミュレーションを実行。Webが描画・入力・非同期準備・DOM UIを担当します。</p></section>
<section class="feature"><h2>接触をゲームのルールへ</h2><p>円と回転矩形、TriggerとSolid、接触通知と問い合わせ。軽量な位置補正を必要なSceneだけに追加できます。</p></section>
<section class="feature"><h2>静的ファイルで配信する</h2><p>シングルプレイのサンプルはゲームサーバーなしで動作します。サブパス配信と独自ドメイン用のビルドに対応します。</p></section>
</div>

> 公開済みv0.1.6では[入力Binding・単一入力キャプチャ](./specs/input-bindings.md)を追加しています。キーボード・マウス・ゲームパッドの共通設定、実行中の変更、設定保存・復元を扱えます。

> 公開済みv0.1.5以降では[仮想スティック・ポインター入力](./specs/virtual-input.md)を利用できます。固定・浮動・追従、左右領域、マルチタッチ、方向あり／なしボタンに対応しています。

## 小さく始める

```ts verify
import {
  Action,
  ActionController,
  Character,
  defineActions,
  Game,
  KeyboardBindings,
} from "@simpludify/web";

const game = new Game();
const Actions = defineActions({ Move: Action.axis2D() });
const controls = new ActionController(Actions, {
  scene: game.engine.scene,
  input: game.engine.input,
  bindings: { Move: KeyboardBindings.WASD },
});
game.add(Character({ movement: controls.reader(Actions.Move) }));
await game.run();
```

ゲーム領域へフォーカスしてWASDで移動します。ページには高さが必要です。実行可能なHTMLとセットアップは[導入](getting-started.md)を参照してください。

## 試してから、仕組みを読む

[サンプルギャラリー](examples.md)では実行例を試せます。最小のCharacter、UI / Scenes、Beacon Field、30秒の収集ゲームSignal Run、落ち物パズルBlockfall、シューティングPrism Raid、画像アニメーションのSprite garden、地形配置のTile trail、Canvas UIと入力を統合したCanvas trail、数値・Actor・UI演出のTween lab、三角形・六角形のTile geometry lab、2人用のUnified input labから選べます。Signal Run・Blockfall・Prism Raid・Canvas trailはスマートフォンのタッチ操作に対応します。

[2人用入力ラボ](./specs/unified-input.md)では同じActorを維持した入力元の切り替えを試せます。[ゲームパッド](./specs/gamepads.md)と[レイアウト](layout.md)にも対応する英語ガイドがあります。

[基本概念](concepts.md) → [入力](./specs/action-input.md) → [SceneとUI](scenes-ui.md) → [衝突判定](collision.md)の順に読むと、サンプルを自分のゲームへ展開できます。

## 設計と検証を公開する

短さだけでAPIを選びません。所有権・更新順序・エラー時の状態を明確にし、ヘッドレステストとブラウザテストで検証します。AIによる生成・解析も、同じ型・コード・CLIを利用できます。ゲーム実行時にAIサービスは不要です。

[設計思想](architecture.md)、[現在の制約](limitations.md)、[API仕様](api.md)もあわせて確認してください。
