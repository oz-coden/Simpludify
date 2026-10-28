# 描画・座標・カメラ

ゲーム内の単位、CSSピクセル、描画バッファのピクセルを分けると、画面サイズに依存しにくいロジックを作れます。

## 座標の区別

| 概念                | 意味                                         |
| ------------------- | -------------------------------------------- |
| WorldPoint          | ゲーム世界の位置。速度は世界単位/秒          |
| LogicalResolution   | 既定800×450の論理的な表示範囲                |
| Camera              | 世界上の表示原点x/yと中心を基準としたzoom    |
| Viewport            | ホスト内のCSS座標の矩形。x/yオフセットを含む |
| ScreenPoint         | ホスト内のCSSピクセル位置                    |
| PhysicalPoint / DPR | 実際の描画バッファ。世界の計算には使わない   |

`worldPoint` / `screenPoint`の空間タグと変換関数で誤用を防ぎます。`game.worldToScreen`と`screenToWorld`は現在のCameraとViewportを反映します。

## 画面への収め方

`Aspect.Fit`は比率を保って全体を表示し余白を作ります。`Fill`は比率を保って一部を切り取り、`Adaptive`はViewportのCSSサイズを論理解像度として扱います。DOM UIは独立してホスト全体で再配置されます。

`pixelRatio`は既定でmin(devicePixelRatio,2)です。DPRを上げてもゲーム内の速度・座標は変えません。単一Camera・単一Viewportのみ実装しています。

## 表示と画像

RenderableはTransformを必要とします。同じComponentを維持したまま、色・幅・高さ・source・opacity・visible・zIndexを変更できます。

```ts verify
import { Actor, Renderable, SpriteFit, Transform } from "@simpludify/core";
const actor = new Actor();
actor.add(new Transform());
const view = actor.add(
  new Renderable({ width: 32, height: 32, color: 0x73e3c0 }),
);
view.width = 48;
view.height = 48;
view.color = 0xffffff;
view.source = {
  kind: "image",
  url: import.meta.env.BASE_URL + "player.svg",
  fit: SpriteFit.Contain,
};
view.opacity = 0.5;
```

`source`は`{ kind: "shape", shape: Shape.Triangle }`などの図形、または`{ kind: "image", url, fit? }`の画像です。省略時はBox、画像のfit省略時はContain。Stretchは幅・高さ全体へ伸縮します。sourceはコピー・凍結されるため、画像やfitの変更はsource全体を再代入します。同じ内容の指定はrevisionも画像要求も変えません。

幅・高さは正の有限数、colorは0〜0xffffffの整数、opacityは0〜1、zIndexは有限数、visibleはbooleanです。不正値は状態変更前に拒否します。表示状態のrevisionはSceneの構造revisionと独立し、依存Componentや所有権を変えません。Transform・Colliderの寸法も変更しません。

初期色は図形がミント、画像が無着色の白です。source変更後もcolorは維持するため、色付き図形から画像へ変えるときは必要に応じて白を指定します。図形では塗り色、画像ではRGB乗算です。元画像を任意の単色へ置き換える効果とは異なります。Characterの目は本体と異なる色を維持します。

画像は選択サンプルのpublicへ置くかVite importを使います。外部URLは適切なCORS設定が必要です。高いzIndexが手前、同値はActorの挿入順です。actor.enabledは更新と表示を止めますが、visibleだけをfalseにしても接触は続きます。非表示でもリソースを保持し、画像準備は行います。

## 画像の切り替えと待機

```ts verify
import { Actor, Game, Renderable, Shape, Transform } from "@simpludify/web";
const game = new Game();
const actor = game.add(new Actor());
actor.add(new Transform({ x: 200, y: 150 }));
const view = actor.add(new Renderable());
await game.run();
view.color = 0xffffff;
view.source = { kind: "image", url: import.meta.env.BASE_URL + "player.svg" };
try {
  await game.whenReady();
} catch (error) {
  view.source = { kind: "shape", shape: Shape.Box };
  await game.whenReady();
  console.error(error);
}
game.dispose();
```

代入は同期的で、次の描画・準備同期で反映します。新画像のロード中は旧画像や図形を維持し、旧表示がない初回画像では未表示です。現在の寸法・色・透明度・Transformは旧表示にも適用しますが、旧画像のfitは新画像への切り替えまで保持します。

最後に同期した要求を優先し、取り消した古い要求が遅れて完了しても表示しません。色・寸法・同じURLのfit変更では画像を再ロードしません。図形同士はGraphics、画像同士はSpriteを再利用し、両経路の間ではバックエンドの表示オブジェクトだけを交換します。

`game.whenReady()`は起動後の現在の表示を捕捉し、最新の同期済み要求が完了するまで追従します。置き換えた要求や除去した要求は待たず、現在の失敗は別画像が未完了でも速やかにrejectします。成功時は準備済み状態を描画します。将来の代入や別に準備中のScene遷移は待ちません。遷移には`await game.goTo(id)`を使います。

失敗はASSET_LOAD_FAILEDの診断と待機のrejectで通知し、旧表示とゲーム更新を維持します。別の正常なsourceで復旧できます。同じ失敗URLの再代入は再試行しません。再試行には別sourceを選んで描画・whenReadyで同期した後、元URLを指定します。無限の自動再試行はありません。

待機中の表示やGameが破棄された場合はGAME_DISPOSEDでrejectします。通常のフレームは変更を自動同期し、手動ホストではrenderまたはreadyを呼びます。setter自体はブラウザ処理を予約せず、ポーリングタイマーも追加しません。

## 同じ画像の共有

画像参照は従来の`source: { kind: "image", url, fit? }`を維持します。不変の表示要求と、Web側の画像実体は別です。参照のコピーやJSON保存だけではロードや所有権は発生せず、Rendererで表示・準備すると利用参照を取得します。共有のためのload/dispose呼び出しや新しいクラスは不要です。

```ts verify
import { Actor, Game, Renderable, Transform } from "@simpludify/web";
const game = new Game();
const url = import.meta.env.BASE_URL + "player.svg";
function spawn(x: number, color: number) {
  const actor = game.add(new Actor());
  actor.add(new Transform({ x, y: 100 }));
  actor.add(
    new Renderable({
      source: { kind: "image", url },
      width: 48,
      height: 48,
      color,
    }),
  );
  return actor;
}
const first = spawn(100, 0xff8080);
const second = spawn(200, 0xffffff);
await game.run();
first.require(Renderable.type).opacity = 0.5;
first.dispose(); // secondの表示と共有画像は維持
await game.whenReady();
second.dispose(); // 最後の利用参照を解放
await game.whenReady();
game.dispose();
```

同じキーへの並行要求はImageロード1回、Texture・TextureSource各1つへ統合します。各VisualのSprite、色、opacity、寸法、fit、visible、zIndex、Transformは独立です。非表示・無効化では利用参照を解放しません。

共有範囲はRendererインスタンスです。既定GameではGameごとに独立し、プロセス全体のキャッシュはありません。同じURLやsourceオブジェクトを別Gameで使っても、一方の終了は他方に影響しません。Scene遷移では準備中と現行Sceneが共有し、準備成功後に旧Sceneの参照を解放します。準備失敗では候補の参照だけを解放します。

キーは取得時の`new URL(url, document.baseURI).href`です。相対・絶対の同等表記は共有し、標準URL解決の範囲で正規化します。クエリの並べ替え・除去、フラグメントの除去、リダイレクト先による統合、埋め込み認証情報の無視は行いません。クエリやフラグメントが違えば、ブラウザのネットワーク応答が共通でも別エントリです。読み込みはanonymous CORS固定で、画像ごとの設定はありません。将来設定を追加する場合は同一性に影響する設定もキーに含めます。data/blob URLも利用可能ですが、利用中のblob URLをゲーム側でrevokeしないでください。

baseURIや認証状態が変わっても、変更されていないsourceを自動的に再取得しません。別sourceの指定や除去・再取得で明示的に扱います。同一オリジンのcookieはブラウザのanonymous CORSの規則に従います。

新画像の保留参照と、表示中の旧画像の確定参照は別々に保持します。新画像の準備成功までは旧画像を解放しません。片方のVisualが要求を取り消しても、他方が待つロードは継続します。最後の利用者がいなくなった場合だけ中断し、中断できない処理の遅延結果も新しい要求へ混入させず解放します。解放は二重に呼ばれても安全です。

失敗したキャッシュエントリは除去し、現在の各待機者へ失敗を伝えます。Visual自身の失敗状態と旧表示は維持し、自動再試行しません。新しい利用者は同じURLを明示的に要求できますが、成功しても別Visualの失敗は勝手に解除しません。失敗した各sourceを置換・除去して復旧してください。利用参照が0の画像は直ちに解放し、常駐・LRU・事前読み込みハンドルは用意していません。

### 診断

| 項目            | 意味                                                             |
| --------------- | ---------------------------------------------------------------- |
| presentations   | 準備中を含むScene表示の数                                        |
| visuals         | 初回画像待機・非表示を含むVisual数                               |
| textures        | 所有中の画像Texture数。現行バックエンドではTextureSourceも各1つ  |
| imageReferences | 保留要求と確定表示の利用参照数。画像置換中は1体で2参照の場合あり |
| imageEntries    | 利用者を持つ一意のロード中・準備済みキー数                       |
| pendingImages   | 利用者を持つ一意のロード数。待機Visual数とは異なる               |

通常のGame終了後はすべて0です。中断不能な外部処理が遅れて完了する場合、その結果を受け取って解放します。JSカウンターはブラウザ・GPUの物理メモリやキャッシュを測るものではありません。共有Mapの参照は画像要求の変更時だけ、診断の走査も診断取得時だけに行います。固定したPixiのCanvas2D経路ではTextureと色ごとの着色済みCanvasを追加保持することがあり、共有元画像1つがすべての経路で物理割り当て1つになるとは限りません。

第3段階の画像を使う実ゲームでは、大量生成・個別被弾色・画像の遅延や失敗・Scene遷移・連続再開始を実機でも検証する方針です。[SpriteSheetとアニメーション](sprites.md)はこの利用参照の境界へ接続しています。事前読み込みは未実装です。[英語ガイドの検証・測定記録](../en/rendering.html)も参照してください。

## 画像共有の測定結果

第1段階7e288c7と共有実装88b6438を、Node 24.22.1・Chromium 156.0.8078.4・Linux・Intel Xeon Platinum 8573C、Vite開発サーバー、WebGL/SwiftShader、1000×800/DPR1・720×540キャンバス・32×32のSVGで比較しました。他のローカルテストやビルドを止め、各負荷2回のウォームアップ＋5回測定を、共有前後3組交互に実施しています。表は各組の中央値の中央値で、共有前→共有後です。

| 負荷            | 準備時間ms   | ロード・Texture・TextureSource数 | 準備時のJSヒープ増加KiB | Scene破棄ms |
| --------------- | ------------ | -------------------------------- | ----------------------- | ----------- |
| 同じ画像100体   | 7.3 → 3.4    | 100 → 1                          | 411.5 → 342.8           | 1.7 → 1.3   |
| 同じ画像1,000体 | 100.4 → 18.8 | 1000 → 1                         | 3711.3 → 2856.4         | 11.8 → 7.1  |
| 異なる画像100体 | 8.6 → 10.1   | 100 → 100                        | 381.9 → 466.0           | 1.9 → 3.1   |

1,000体でもSpriteは個別に1,000個です。利用中の2画像間の20回切り替えは11.5→3.1ms、追加ロード20→0回。同じ画像を使う100体の次Scene準備は5.8→1.6ms、追加ロード100→0回でした。Scene重複期間は200参照・Texture/TextureSource各1つ、旧Scene破棄後は100参照・各1つを維持しています。各測定の最終カウンターは0です。

異なる画像100体では、準備・破棄の時間やJSヒープが増えています。共有Map・URL解決・利用ハンドルには追加処理がありますが、実行回によって前後が逆転する項目もあり、差全体の原因を一つに断定しません。Renderer全体の終了にはソフトウェア描画のコンテキスト破棄も含まれ、同一画像100体の中央値は142.0→159.7ms、画像切り替え負荷では827.4→866.7msと大きく変動しています。Scene破棄とは別項目です。

JSヒープ増加はActor生成前と準備・初回描画後のforced-GC performance.memoryの差です。モデル・ホスト・ツールの状態を含み、画像デコードやGPUの物理メモリは含みません。ロード数はエンジンのImage/Texture生成要求数で、HTTP回数ではありません。初回描画のCPU送出と準備を測定しており、定常FPSや通常のGPU性能、メモリリークの不存在は保証しません。[英語ガイド](../en/rendering.html)から全生データと再実行手順を参照できます。

`npm run bench:images -- --out /tmp/images.json`で同じ負荷を実行できます。本番サイトのsmokeテストも、ビルド済みPrism Raid内へ100体を追加し、WebGL／Canvas2Dで色の独立・片方破棄後の画素・最終解放を確認します。大型画像ゲームは追加していません。

ヘッドレスPrism Raidも別途単独で前後1組を測定し、60勝・172,796ステップ・約1,439.97秒分の進行・撃破1,440・生成した弾と敵18,774が一致しました。実時間は4.920→4.717秒でしたが、単一組から性能向上とは判断しません。Core・入力・Random・Replay・固定ステップの実装は変更していません。Replayデモの2,707ステップ・勝利・スコア3,420もJSON往復後に一致しています。

## 旧APIからの移行

- `shape: Shape.Triangle` → `source: { kind: "shape", shape: Shape.Triangle }`
- `sprite: url, fit: SpriteFit.Stretch` → `source: { kind: "image", url, fit: SpriteFit.Stretch }`
- Characterのspriteも同じsource指定へ変更
- 寸法・色・画像のためのComponent差し替え → 同じRenderableのプロパティ変更
- 画像への明示的なcolor指定は着色になるため、以前の無着色結果には白を指定

図形と画像の暗黙の優先順位はありません。Signal Runは被弾色と透明度を同じRenderableへ反映し、Blockfallは盤面セルのActorを維持して色を更新します。画像はRenderer単位で自動共有します。公開TextureRefとMaterialは導入していません。SpriteSheet・アニメーションは[専用ガイド](sprites.md)を参照してください。第1段階のsource APIは変更せず、通常のゲームコードの移行は不要です。診断にはimageReferences/imageEntriesを追加し、pendingImagesはVisual数ではなく共有ロード数を数えます。

## 三角形

```ts verify
import { Actor, Renderable, Shape, Transform } from "@simpludify/core";
const ship = new Actor();
ship.add(new Transform({ x: 160, y: 300 }));
ship.add(
  new Renderable({
    source: { kind: "shape", shape: Shape.Triangle },
    width: 32,
    height: 40,
    color: 0x65a8ed,
  }),
);
```

Triangleは上向きの二等辺三角形です。ローカル頂点は`(0,-height/2)`、`(width/2,height/2)`、`(-width/2,height/2)`。原点・回転中心は外接矩形の中心で、重心ではありません。幅と高さ、回転（ラジアン）、正負の拡大縮小を既存形状と同じように扱います。`opacity`・`visible`・`zIndex`も共通です。

描画形状と衝突形状は独立しています。三角形の機体にも、操作感に合わせた円・矩形のTriggerを付けられます。Triangleの追加は三角形ColliderやSolidの処理を変更しません。

## カメラ追従

```ts
import { CameraFollow } from "@simpludify/core";
const follow = new CameraFollow(game.camera, {
  bounds: { x: 0, y: 0, width: 800, height: 450 },
});
scene.onUpdate((seconds) => follow.update(player, seconds));
```

位置補正後に追従します。`player`はx/yを持つ値、例えばCharacterActorやTransformです。`responsiveness`は既定0で即時追従、正値で指数平滑化します。zoomを変えた直後に座標変換するなら`follow.update(player, 0)`も呼びます。独自論理解像度を使う場合は追従にも同じresolutionを指定します。

## リソースと失敗

Scene/Actor破棄で対応する表示・保留画像を解放します。`Game.dispose()`でフレーム、入力、ResizeObserver、DOM、rendererを破棄します。画像準備が失敗したScene遷移は候補を破棄して現在のSceneを維持します。実行中の画像失敗はwhenReadyのrejectと診断で扱い、旧表示とSceneを維持します。既知の失敗は無関係な未完了画像を待ちません。各Visualは利用参照を所有し、破棄では自分の参照だけを解放します。他の利用者がいるロードやTextureは維持し、最後の利用参照がなくなった時だけロード中断・TextureとTextureSourceの破棄を行います。遅延完了した結果は解放します。背景の更新・描画エラーはWeb Gameを停止・破棄します。WebGLコンテキスト喪失からの自動復旧は未検証・未対応です。
