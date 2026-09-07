# デザイン刷新 サブプロジェクト W3：カード演出 設計書

- 文書ID：GAME-SPEC-SHELL-W3
- 版数：0.2
- 作成日：2026-09-07
- ステータス：**実装完了**（2026-09-07、`ade0fcf`〜`9e07c12`）。W3.0 ドラッグFAB / W3.A 扇形手札（`fanLayout` 純関数＋`HandFan`）/ W3.B 場出し演出（`FieldCardRow` の slam-down 入場＋金パルス。§4 の `measureInWindow` 版ではなく堅い入場演出を採用）/ W3.C 革命の昼夜逆転（§5 の Canva 新規背景ではなく day/night ペアを流用したクロスフェード＋金フラッシュ）。mobile 381 / ui 8 / game-core 218 緑。実機ブラウザで W3.0/W3.A を確認、W3.B/C はコードレビュー＋非革命状態の目視。革命クロスフェードの実地確認は未実施。
- 前提：SP1 / SP2 / SHELL-W1 / SHELL-W2 実装済み。
- 実装場所：`apps/mobile/src/components/`、`apps/mobile/src/features/theme/`、`apps/mobile/src/features/cpu-game/`、対戦2画面、`assets/backgrounds/`

---

## 1. 目的とスコープ

遊戯王マスターデュエル / パズドラを参照し、カード操作と場出しの手触りを作り込む。

- **W3.0**：フローティングボタンをドラッグで移動可能に（位置は永続化・フレーム内にクランプ）。短タップは従来どおりメニューを開く。
- **W3.A**：手札の**扇形レイアウト** `<HandFan>`。カードを弧上に配置、タップで持ち上げ選択。現行 `handRow`（`cpu-game/play.tsx` / `online-room/play.tsx`）を置換。
- **W3.B**：**場に出す演出**。確定時に選択カードが手札位置→場スロットへ移動＋回転補正＋スケール（250–320ms ease-out）、着地で金の発光パルス。CPU の出し手は画面外→場。
- **W3.C**：**革命の昼夜逆転**。革命成立で盤面フラッシュ→背景を通常 ⇄ 反転バリアントへクロスフェード。反転バリアント背景を Canva で1枚生成。

### 共通制約

- 依存追加なし。RN コア `Animated` / `PanResponder`。`react-native-gesture-handler` / `react-native-svg` は入れない。
- `settings.lowMotion`（既存）と web の `prefers-reduced-motion` を尊重：true なら演出時間 0 か大幅短縮、扇の回転は残す（レイアウトなので）。
- ゲームロジック（`game-core` / viewModel / store）は不変。演出は表示層のみ。乱数消費・手番進行に影響しない。
- 既存テストに回帰なし。`tsc`/`eslint`/`prettier` クリーン。
- コミット `main` 直、`[SHELL-W3]`、明示パスのみ `git add`、末尾 Co-Authored-By。

## 2. W3.0：ドラッグ可能な FAB

### 2.1 位置ストア `fabPosition.ts`（純）＋ `fabPositionStore.ts`

- `type FabAnchor = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'` … ではなく **自由位置**：`{ x: number; y: number }`（フレーム左上原点、FAB 中心）。
- `clampFabPosition(pos, frame, fabSize, margin)`：フレーム内に収める純関数。テスト対象。
- `fabPositionStore`（zustand + AsyncStorage、`themeStore` と同型）：`position: {x,y} | null`（null=既定=左下）、`load()`、`setPosition(pos)`。キー `card-game-app:fab-position:v1`。`_layout` で `load()`。

### 2.2 `MenuFab` 改修

- `PanResponder`：
  - `onStartShouldSetPanResponder` → true。
  - `onPanResponderGrant` → ドラッグ開始位置を記録、`dragging=true`。
  - `onPanResponderMove` → `Animated.ValueXY` を更新（`useNativeDriver:false`）。
  - `onPanResponderRelease` → 移動量が小さい（< 6px）なら `onPress()`（＝メニュー）。大きければ `clampFabPosition` して `fabPositionStore.setPosition()`。
- 表示位置：`position` があればそれ、無ければ既定（left:16, bottom:16）。`Animated.ValueXY` の `getLayout()` で絶対配置。
- フレームサイズは `useWindowDimensions()` ＋ `resolveShellSize`（web）／画面サイズ（native）から算出。`AppShell` からコンテキストで渡すのが綺麗 → `AppShell` が `<ShellSizeContext.Provider value={frameSize}>` を提供、`MenuFab` が `useShellSize()`。
- 対戦2画面では FAB を `opacity: 0.5`（`usePathname()` が `/play` を含むとき）。

### 2.3 テスト

- `clampFabPosition`：4隅はみ出し・中央・ちょうど端。
- `fabPositionStore`：load/setPosition/失敗フォールバック（`themeStore.test.ts` に倣う）。

## 3. W3.A：`<HandFan>`

### 3.1 API

```ts
export type HandFanCard = {
  key: string;                 // cardId
  rank: number; suitCode: SuitCode; isJoker: boolean;
  selected: boolean;
  selectable: boolean;
  locked: boolean;             // selectionLocked
};
export function HandFan({
  cards,
  onPressCard,
  maxWidth,
}: {
  cards: HandFanCard[];
  onPressCard: (key: string) => void;
  maxWidth: number;
}): JSX.Element;
```

### 3.2 レイアウト（純関数 `fanLayout.ts`）

```ts
export type FanSlot = { x: number; y: number; rotateDeg: number; z: number };
export function fanLayout(count: number, opts?: {
  cardWidth?: number;      // default 46（CardFace hand）
  maxWidth?: number;       // コンテナ幅
  maxSpread?: number;      // 端カードの最大回転角 deg, default 16
  arc?: number;            // 弧の深さ px, default 18
}): FanSlot[];
```

- `count<=1` → 単純中央。
- それ以外：i を中心対称の比 `t ∈ [-1, 1]` にし、`rotate = t * maxSpread`、`y = arc * t^2`（端ほど下がる…いや上がる。マスターデュエルは端が下がる＝`y = arc*(1 - cos)`）。`x` はカードが重なる間隔 `step = min(cardWidth*0.7, (maxWidth - cardWidth)/(count-1))` で等間隔、中央寄せ。
- `z`：中央のカードを最前面 or 右肩上がり。選択カードは常に最前面（描画側で上掛け）。
- テスト：count=1/2/5/13 で、対称性（`slot[i].x + slot[n-1-i].x == 2*center`）、回転の端値、maxWidth 超過しないこと、z の一意性。

### 3.3 コンポーネント挙動

- 各カードは `<Animated.View>` に `CardFace` を内包。基準 transform は `fanLayout` の slot。
- `selected` の変化で `translateY -= 22`＋`scale 1.06`（`Animated.spring`, `lowMotion` 時は即時）。
- `selectable=false` → `opacity 0.4`、`locked` → 金枠（現行の handCardLocked 相当を `ACCENT` で）。
- タップ：`onPressCard(key)`。ヒット領域は重なりを考慮し、見た目の上端付近を優先（描画順で最前面が取る）。
- コンテナ高さは `arc + 22 + cardHeight` 程度で固定、横スクロールは廃止（扇に収める）。13枚が `maxWidth` に収まらない場合は `step` をさらに詰める（重なり増）。

### 3.4 差し替え

`cpu-game/play.tsx` / `online-room/play.tsx` の `<ScrollView horizontal ...handRow>` ブロックを `<HandFan cards={…} onPressCard={…} maxWidth={…} />` に置換。`maxWidth` はフレーム幅 - 余白（`useShellSize()` か `useWindowDimensions()`）。VM から `HandFanCard[]` を作るマッピングを各画面に。

## 4. W3.B：場出し演出

### 4.1 仕組み

- `<PlayLayer>`：場スロット領域を子に持ち、`useRef` で各手札カードと場スロットの画面座標を `onLayout` / `measureInWindow` で取得。
- 「出す」確定（`onSubmit` 成功）時：
  1. 直前の選択カード群の座標を控える。
  2. store 更新で手札から消え、場に増える。
  3. その差分を検知し、消えたカードと同じ `key` の**ゴースト** `<Animated.View>`（`CardFace`）を旧手札座標に生成 → 場スロット座標へ `Animated.timing`（duration 280, easing `Easing.out(Easing.cubic)`）で `translate + rotate(→0) + scale(hand→field)`。
  4. 到達時にゴースト破棄、場スロットに金の発光パルス（`Animated` opacity 0→0.7→0, 240ms）。
- CPU / 相手の出し手：旧座標が不明なので「場スロット中心の上 120px・opacity 0・scale 1.15」から場へ。`pendingCpuReveal` / オンラインの `eventLog` 差分をトリガに。
- `lowMotion` / reduced-motion：ゴースト移動を省き、発光パルスのみ 120ms。

### 4.2 実装場所

- `components/PlayLayer.tsx`（新）＋ `features/cpu-game/useCardFlight.ts`（座標管理フック、純ではないが薄く）。
- 座標計測は web/native 差があるので `measureInWindow` を使い、失敗時は演出スキップ（degrade）。
- **リスク**：expo-router + web で `measureInWindow` が不安定なことがある。実装時に web で確認し、ダメなら web は発光パルスのみ、native はフル演出、と割り切る。

## 5. W3.C：革命の昼夜逆転

### 5.1 反転バリアント背景

- Canva で `ragnarok-battle-bg` の**反転版**を1枚生成：`ragnarok-battle-bg-revolution.png`（1920×1080）。空が白む／熾火が霜／環が赤熱、など「昼夜逆転」を表す。dark テーマ用（ライトテーマ時の革命は §5.3）。

### 5.2 `<AppBackground>` 拡張

- 新 prop `revolutionActive?: boolean`（default false）。
- `battle` variant のとき、`revolutionActive` に応じて通常 ⇄ 反転バリアントを**2枚重ねてクロスフェード**（`Animated` opacity, 220ms。`lowMotion` 時 0ms）。
- 革命状態は VM にある（`vm.dayNight` / `strengthOrder` 反転、`revolutionPreview`）。対戦画面が `revolutionActive={vm.dayNight === 'DAY' ? … }` … ではなく「その局で革命が1回でも起きたか」を表す真偽を VM から取得（無ければ `boardViewModel` に `revolutionActive` を追加。表示専用フラグなのでロジック不変）。
- フラッシュ：革命成立の瞬間だけ全画面 `ACCENT` を opacity 0→0.35→0（180ms）。`cpu-game/play.tsx` 側で `vm` の革命フラグ立ち上がりを検知。

### 5.3 ライトテーマ時

- ライトは既に「昼」背景。革命時は `battle-bg-day` ⇄ `battle-bg`（dark）へクロスフェード（＝文字通り昼夜逆転）。テキスト色は据え置き（革命は一時的で、可読性は許容）。
- 実装は §5.2 の 2枚重ねを `scheme` と `revolutionActive` の XOR で選ぶだけ。

### 5.4 テスト

- `resolveBackgroundSource` を拡張 or 新 `resolveBattleLayers(scheme, revolutionActive)` → `{ base, overlay, overlayOpacityTarget }` の純関数をテスト。

## 6. 実装順序

1. **W3.0**：`fabPosition.ts` + `fabPositionStore.ts` + テスト、`ShellSizeContext`（AppShell）、`MenuFab` ドラッグ化、`_layout` 配線。→ web 目視 → コミット。
2. **W3.A**：`fanLayout.ts` + テスト、`HandFan.tsx`、対戦2画面差し替え。→ web/native 目視 → コミット。
3. **W3.B**：`PlayLayer.tsx` + `useCardFlight.ts`、対戦2画面配線。→ 目視（web で measure 確認）→ コミット。
4. **W3.C**：Canva で反転背景生成、`AppBackground` 拡張、`boardViewModel` に表示フラグ、対戦2画面配線。→ 目視 → コミット。
5. 総合検証・スペック更新・メモリ更新・push。

## 7. 未解決 / レビュー確認事項

1. 扇の最大回転角 16°・弧 18px でよいか（実機で調整）。
2. 場出し演出 280ms・発光パルス金でよいか。
3. `measureInWindow` が web で不安定な場合、web は発光のみに割り切る方針でよいか。
4. 反転バリアント背景の絵柄（霜／赤熱／白む空）の方向性。
