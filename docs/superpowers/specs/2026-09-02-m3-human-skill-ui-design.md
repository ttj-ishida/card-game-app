# M3 サブプロジェクト3：人間のスキル使用UI 設計書

- 文書ID：GAME-SPEC-M3-HUMAN-SKILL-UI
- 版数：0.1
- 作成日：2026-09-02
- 基準文書：`独自カードゲーム_要件定義書_v0.2.md`（v0.4 本文）、`独自カードゲーム_M3_詳細TODO_v0.2.md` §M3-EX-01/02/07
- 対象 TODO：M3-EX-01（Jokerの場流し／変化選択UI）、M3-EX-02（追加封印・革命カード使用UI）、M3-EX-07（不正選択理由と出せるカード支援表示）
- 実装場所：`packages/game-core/src/`、`apps/mobile/src/features/cpu-game/`、`apps/mobile/src/state/`、`apps/mobile/src/app/cpu-game/`、`apps/mobile/src/i18n/`

---

## 1. 目的とスコープ

CPU戦の対局画面で、人間プレイヤーが保有スキル（勇者/聖女Joker・追加封印・革命）を合法に使用できるようにする。あわせて、選択が不成立のときにその理由と出せる手数を表示する初心者支援（M3-EX-07）を追加する。

`enumerateLegalPlays(round, { includeSkills: true })`（M3 サブプロジェクト1 で実装済み）を人間の合法手の唯一の真実とし、選択札がどの `LegalPlay` に一致するかで提出ボタンを出す。変化Jokerの宣言（数字1〜9 × 属性1種）だけは列挙できないので専用パネル。

画面は既存の `apps/mobile/src/app/cpu-game/play.tsx` へのインラインパネルとして追加する（M2 と同じ「機能プレースホルダ — 将来デザイン版に差し替え」方針。`boardViewModel` とストア契約は不変を保つ）。

### スコープ外

| 項目 | 理由 / 行き先 |
|---|---|
| 手番タイマー（TIMER-004：Joker宣言も30秒に含める） | M4 |
| Joker宣言の独立画面（§22.1 の画面一覧では別画面） | 将来デザイン版。今回はインラインパネル |
| CPU が人間を引き継いだときのスキル判断 | M3-EX-03 で CPU 側は実装済み。引き継ぎ自体は M4 |
| BGM/SE、演出短縮 | M3-EX-08 / 別サブプロジェクト |
| 実機確認（M3-QA-02 全スキル・全上がり境界） | ユーザー作業（別 QA タスク） |

## 2. Global Constraints

- game-core（`packages/game-core`）はゼロ依存の純 TypeScript。`node:test` + `tsx`。`npm run game-core:test` / `:typecheck`。ソース import は `.ts` 指定子。
- モバイルのテストは `.test.ts` のみ（`tsx --test`、react-test-renderer なし）。`npm run mobile:test` / `npm --prefix apps/mobile run typecheck` / `lint`。
- 純ロジックモジュールは `fetch` / `AsyncStorage` / `Date` / `Math.random` を直接 import しない。
- 表示名・日本語文言を内部IDや対局状態へ保存しない。表示は言語リソースキー（`translate()`）経由。
- `apps/mobile/src/app/cpu-game/play.tsx` は薄い画面に保つ。ゲームロジック・合法性判定は画面に書かない。
- スキル使用も含め、すべての人間入力は `humanPlay`（= `resolvePlay`）と `assertCardConservation` を通す。不正時は state を変えず理由を返す（TX-002 / M1-EX-09）。
- 決定論：`legalPlaysForHuman` を含め、同じ `DriverState` に対する出力は決定的。

## 3. 要件マッピング

| 要件ID | 内容 | 対応 |
|---|---|---|
| JOKER-002 | Joker使用時に場流しまたは変化を選択できる | スキルパネルの場流し／変化ボタン |
| JCLR-001 / JCLR-002 | 場があるときだけ場流しJoker可、空のとき不可 | `skillPanel.jokerClearAvailable = held && round.activeField != null` |
| JCLR-006 / JCLR-009 | 場流し後、同手番で新しい場を作る／最後の数字カードでの上がりを認める | `resolveCardPlay` のアトミック JOKER_CLEAR（既存）。UI は「リード札を選んで場流し」1ステップ |
| JTR-001 / UI-JOKER-001 | 変化Joker使用時に数字1〜9と属性1種を宣言させる | 宣言パネル（rank 1–9 ピッカー + 属性ピッカー） |
| UI-JOKER-002 | 完全重複・不正な組み合わせになる宣言を確定できない | `jokerTransform.canConfirm`（`resolvePlay` ドライラン） |
| UI-JOKER-003 | 宣言後のカード表現を確定前にプレビュー | 宣言カードのプレビュー（`CardFace` を宣言 rank/suit で描画） |
| UI-JOKER-004 | 確定後、Joker上へ宣言内容を重ねて表示 | 既存 `isTransformedJokerCard` + `CardFace` が宣言 rank/suit を描画（変更なし） |
| JTR-009 / JTR-010 / WIN-008 / UI-BATTLE-011 | 最後の数字カード＋変化Jokerでの上がりを禁止・確定不可 | `jokerTransform.forbiddenGoOut`（`resolvePlay` が `TRANSFORM_JOKER_GO_OUT` を返す）。確定ボタン無効 |
| SKILL-006 / SEAL-001 / REVSKILL-001 | 追加封印・革命は数字カードと同時に使用 | 選択札に対する「追加封印して出す」「革命して出す」ボタン（`useSkill` 付き提出） |
| SEAL-002 / SEAL-006 | 数字カードを反映した後に封印を有効化・継続 | `resolveCardPlay` 既存。UI は「この手番の後、追加封印が有効になります」注記 |
| REVSKILL-002 / CARD-104 | 革命は先に昼夜を反転し反転後に判定 | 革命プレビュー（反転後の昼夜・強弱順を表示）。判定自体は `resolvePlay` が `usesRevolutionSkill` 経由で処理（既存） |
| EFFECT-003 / UI-BATTLE-005 | 属性ロックと追加封印を別々に表示 | 既存（変更なし） |
| UI-BATTLE-007 | 使用可能なスキルとその効果説明を本人へ表示 | `skillPanel.heldEffectKey` + `heldEffectDescKey` |
| UI-BATTLE-010 | 不正な選択では確定を無効にするか理由を表示して拒否 | `selectionHint.rejectionReasonKey`（`resolvePlay` ドライラン） |
| M3-EX-07 完了条件「初心者が不成立理由を理解できる」 | `selectionHint`：理由文 + 「出せる手：N通り」 |

## 4. game-core の申し送り回収（M3-EX-01/02 の前提）

`packages/game-core/src/core.ts` の `resolveCardPlay` に `jokerDeclarations` の検証を追加する。現状は列挙器だけが宣言を生成するため潜在バグだが、人間UIが `PlayInput` を組むようになる前に固める。

新 `PlayRejectionReason` メンバー：**`"INVALID_JOKER_DECLARATION"`**。

検証位置：`play.useSkill` の `skillMatches` 検証の直後、`isJokerClear` 等の分岐の前。

```ts
const declarations = play.jokerDeclarations ?? [];
if (play.useSkill === "JOKER_TRANSFORM") {
  if (declarations.length !== 1) return reject("INVALID_JOKER_DECLARATION");
  if (!player.skill || declarations[0].skillId !== player.skill.skillId) {
    return reject("INVALID_JOKER_DECLARATION");
  }
} else if (declarations.length > 0) {
  return reject("INVALID_JOKER_DECLARATION");
}
```

（`player` / `player.skill` はこの関数のスコープに既にある。`player.skill` の `used` チェックは既存の `skillMatches` 分岐が担う。）

- **i18n**：`apps/mobile/src/i18n/translate.ts` に `sandbox.reason.INVALID_JOKER_DECLARATION`、`translate.test.ts` の `REASON_CODES` に `INVALID_JOKER_DECLARATION: true` を追加。
- **不変性の検証**：`enumerateLegalPlays` は常に `skillId` 一致・`length === 1` の宣言を生成するため、この検証で列挙結果は変わらない。seed sweep（`packages/game-core` の既存テスト形式）で `enumerateLegalPlays({ includeSkills: true })` の件数がハードニング前後で一致することを assert する。
- **game-core テスト**：`resolveCardPlay` 直呼びで
  - `useSkill: 'JOKER_TRANSFORM'` + `jokerDeclarations: []` → `INVALID_JOKER_DECLARATION`、state 不変
  - `jokerDeclarations: [decl, decl2]`（length 2）→ `INVALID_JOKER_DECLARATION`
  - `jokerDeclarations[0].skillId` が保有スキルと不一致 → `INVALID_JOKER_DECLARATION`
  - `useSkill: 'EXTENSION_SEAL'` + `jokerDeclarations: [decl]` → `INVALID_JOKER_DECLARATION`
  - 正常な変化Joker手（`skillId` 一致・length 1）は従来どおり合法

## 5. `legalPlaysForHuman` の変更

`apps/mobile/src/features/cpu-game/turnDriver.ts`：

```ts
export function legalPlaysForHuman(state: DriverState): LegalPlay[] {
  return state.phase === 'HUMAN_TURN'
    ? enumerateLegalPlays(state.round, { includeSkills: true })
    : [];
}
```

M3 サブプロジェクト1 では「人間UIは M3-EX-01/02」として数字のみに留めていた。今回そこを解禁する。`cpuStep` は既に `{ includeSkills: true }`。

影響：ストアの `legalPlays` にスキル手が混ざる。`handSelection.canSelectCard` は「選択 ⊆ いずれかの手の cardIds」判定なので、スキル手の実カード cardIds に対して自然に働く（スキル手の cardIds は実カードのみ）。素の提出可否は §7 で `canSubmitPlain` に分離する。

## 6. `skillPlayOptions.ts`（新規・純関数）

実装場所：`apps/mobile/src/features/cpu-game/skillPlayOptions.ts`。`@card-game-app/game-core` と `./turnDriver` / `./handSelection` の型のみ import。

```ts
export type SkillSubmitOption = {
  useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION';
  input: PlayInput;
};

export type JokerDeclarationDraft = {
  rankCode: RankCode | null;
  suitCode: SuitCode | null;
};

export type JokerTransformResolution =
  | { status: 'ok'; input: PlayInput }
  | { status: 'forbidden-go-out' }
  | { status: 'illegal'; rejectionReasonKey: string }
  | { status: 'incomplete' };

/** 手番の人間が未使用で保有するスキルの effectCode。無ければ null。 */
export function heldSkillEffect(state: DriverState): SkillEffectCode | null;

/**
 * 選択札 == cardIds（集合一致）の合法手を種別ごとに返す。
 * legalPlays（enumerateLegalPlays({includeSkills:true}) 由来）から絞る。
 */
export function submitOptionsForSelection(
  legalPlays: LegalPlay[],
  selection: HandSelection,
): { plain: PlayInput | null; skills: SkillSubmitOption[] };

/**
 * 変化Joker：選択実カード + 宣言 draft から JOKER_TRANSFORM 手を組み、resolvePlay で判定。
 * skillId は state の人間席 skill.skillId から取る。宣言未完なら 'incomplete'。
 */
export function resolveJokerTransform(
  state: DriverState,
  selection: HandSelection,
  draft: JokerDeclarationDraft,
): JokerTransformResolution;

/** 革命併用時のプレビュー（表示のみ）。 */
export function revolutionPreview(
  state: DriverState,
): { dayNightAfter: DayNight; strengthOrderAfter: number[] };

/** その手番の非PASS合法手の数（M3-EX-07）。legalPlays から数える。 */
export function legalMoveCount(legalPlays: LegalPlay[]): number;

/**
 * 選択札が素でもスキルでも提出できないときの理由キー（M3-EX-07）。
 * - 選択が空 → null
 * - 選択が legalPlays のいずれか（素・スキル問わず）の cardIds と集合一致 → null
 *   （スキルボタン／宣言パネルで出せるので理由は出さない）
 * - それ以外 → 素の `{ kind:'PLAY', cardIds: selection }` を resolvePlay ドライランし、
 *   その `reason` を `sandbox.reason.${reason}` キーに写して返す
 */
export function selectionRejectionReasonKey(
  state: DriverState,
  selection: HandSelection,
  legalPlays: LegalPlay[],
): string | null;
```

`revolutionPreview` は `dayNightAfter = state.round.dayNight === 'DAY' ? 'NIGHT' : 'DAY'`、`strengthOrderAfter` はその昼夜の強弱順（`boardViewModel` の `DAY_STRENGTH_ORDER` / `NIGHT_STRENGTH_ORDER` を共有 export するか再定義）。

`selectionRejectionReasonKey` は素の `{ kind:'PLAY', cardIds: selection }` を `resolvePlay` ドライランし、`ok` でなければその `reason` を返す。宣言が要る変化Joker特有の不成立は §7 の `jokerTransform` フィールドが別途扱う。

## 7. `boardViewModel.ts` 拡張

`buildBoardViewModel` のシグネチャに `jokerTransform` 状態を追加：

```ts
export function buildBoardViewModel(
  state: DriverState,
  selection: HandSelection,
  legalPlays: LegalPlay[],
  opts?: { cpuThinking?: boolean; jokerTransform?: JokerDeclarationDraft & { active: boolean } },
): BoardViewModel
```

`BoardViewModel` に追加するフィールド：

```ts
skillPanel: {
  heldEffectKey: string;          // 'sandbox.skill.SKILL_...'
  heldEffectDescKey: string;      // 'cpuGame.skill.effect.SKILL_...'
  jokerClearAvailable: boolean;   // held HERO/SAINT && field != null
  jokerTransformAvailable: boolean;
  sealAvailable: boolean;
  revolutionAvailable: boolean;
  revolutionPreview: { dayNightAfter: DayNight; strengthOrderAfter: number[] } | null; // revolutionAvailable のとき
} | null;                         // null = 保有スキルなし or 手番でない

submitOptions: {
  plain: boolean;                 // 選択が素の合法手と一致
  skills: { useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION'; labelKey: string }[];
};

jokerTransform: {
  active: boolean;
  rankCode: RankCode | null;
  suitCode: SuitCode | null;
  canConfirm: boolean;            // resolveJokerTransform === 'ok'
  forbiddenGoOut: boolean;        // === 'forbidden-go-out'（UI-BATTLE-011）
  rejectionReasonKey: string | null; // === 'illegal'
  previewCard: { rank: number; suitCode: SuitCode } | null; // 宣言完了時
};

selectionHint: {
  rejectionReasonKey: string | null; // M3-EX-07（UI-BATTLE-010）
  legalMoveCount: number;            // M3-EX-07
};
```

- 既存フィールド（`humanSkillNameKey` 等）は変更しない。
- `canSubmit` は現状「選択がいずれかの手の cardIds と集合一致」。スキル手も含む `legalPlays` を渡されるようになるので、**素の提出可否は `submitOptions.plain` を見る**。既存 `canSubmit` フィールドは後方互換のため残すが、画面は `submitOptions.plain` を使う（テストで両者の関係を固定）。
- `handSelection.ts` に `canSubmitPlain(selection, legalPlays)`（`useSkill === undefined` の手に限定した集合一致）を追加し、`submitOptions.plain` はこれで計算。
- `skillPanel` の `heldEffectKey` は `heldSkillEffect(state)` から。`revolutionPreview` は `revolutionAvailable` のときだけ埋める。

## 8. `handSelection.ts` 拡張

```ts
/** 選択が「素の」合法手（useSkill なし）と集合一致するか。 */
export function canSubmitPlain(selection: HandSelection, legalPlays: LegalPlay[]): boolean;
```

既存 `canSelectCard` / `canSubmit` / `toggleCard` は変更しない（`legalPlays` にスキル手が増えても集合部分集合判定はそのまま正しい）。`toPlayInput` も変更しない（素の提出用）。

## 9. `cpuGameStore.ts` 拡張

新 state：

```ts
jokerTransform: { active: boolean; rankCode: RankCode | null; suitCode: SuitCode | null };
```

`INITIAL` に `jokerTransform: { active: false, rankCode: null, suitCode: null }` を追加。

新アクション：

```ts
openJokerTransform: () => void;    // { active: true, rankCode: null, suitCode: null }
closeJokerTransform: () => void;   // { active: false, rankCode: null, suitCode: null }
setJokerDeclaration: (rankCode: RankCode, suitCode: SuitCode) => void;
submitSkillPlay: (useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION') => CpuGamePlayResult;
submitJokerTransform: () => CpuGamePlayResult;
```

- `submitSkillPlay(useSkill)`：`applyHumanInput({ kind: 'PLAY', playerId: activeSeatId(driver), cardIds: [...selection], useSkill })`。
- `submitJokerTransform()`：`driver.round.players` の人間席（`config.seats` の `kind === 'HUMAN'`）の `skill.skillId` を読み、`jokerDeclarations: [{ skillId, rankCode, suitCode }]` を組んで `applyHumanInput`。宣言が未完（`rankCode` or `suitCode` が null）なら `{ ok: false }`。
- `applyHumanInput` の成功時 `set` に `jokerTransform: { active: false, rankCode: null, suitCode: null }` を追加（提出成功で宣言状態をリセット）。
- `startMatch` / `rematch` / `exit` は `...INITIAL` を撒くので自動的にリセットされる。
- `selectCard` / `clearSelection` は `jokerTransform` を触らない（宣言はカード選択を変えても保持）。

## 10. `play.tsx` 拡張（インラインパネル）

既存レイアウトの「手札の下・アクション行の周辺」に以下を追加：

1. **スキルパネル**（`vm.skillPanel != null`）：`translate(vm.skillPanel.heldEffectKey)` と `translate(vm.skillPanel.heldEffectDescKey)`。
2. **提出ボタン群**：
   - 素の「出す」= `vm.submitOptions.plain` で有効（既存 `onSubmit` を `submitOptions.plain` 判定に変更）。
   - `vm.submitOptions.skills` を map して「追加封印して出す」/「革命して出す」/「Jokerで場を流して出す」ボタン（`translate(opt.labelKey)`）。押下で `cpuGameStore.getState().submitSkillPlay(opt.useSkill)`。
   - 革命ボタンの近くに `vm.skillPanel.revolutionPreview`（「革命後：夜 / 強弱 9→8→…」）。
3. **変化Jokerパネル**（`vm.skillPanel?.jokerTransformAvailable`）：
   - `vm.jokerTransform.active` でない → 「変化Jokerを使う」ボタン → `openJokerTransform()`。
   - active → rank ピッカー（1–9）と属性ピッカー（火水風土）。選択で `setJokerDeclaration`。
   - `vm.jokerTransform.previewCard` があれば `CardFace` でプレビュー。
   - 「確定」= `vm.jokerTransform.canConfirm` で有効 → `submitJokerTransform()`。「やめる」→ `closeJokerTransform()`。
   - `vm.jokerTransform.forbiddenGoOut` → 「禁止上がりです」、`rejectionReasonKey` → その理由文。
4. **支援表示**（M3-EX-07、アクション行の下）：
   - `vm.selectionHint.rejectionReasonKey` があれば `translate()` した理由文。
   - 「出せる手：{vm.selectionHint.legalMoveCount}通り」。0 のときは「出せる手がありません」。

既存の `reasonText` / `invalidReason` state はそのまま（提出失敗時の即時フィードバック）。

## 11. i18n 追加キー（`apps/mobile/src/i18n/translate.ts`）

| キー | 文言（例） |
|---|---|
| `sandbox.reason.INVALID_JOKER_DECLARATION` | `Joker宣言が不正です` |
| `cpuGame.skill.effect.SKILL_JOKER_HERO` | `場を流す／数字と属性を宣言して変化させる` |
| `cpuGame.skill.effect.SKILL_JOKER_SAINT` | （HERO と同文）|
| `cpuGame.skill.effect.SKILL_EXTENSION_SEAL` | `数字カードと同時に使用。以後、同数字追加と連番拡張を禁止` |
| `cpuGame.skill.effect.SKILL_REVOLUTION` | `数字カードと同時に使用。先に昼夜を反転してから判定` |
| `cpuGame.skill.submit.JOKER_CLEAR` | `Jokerで場を流して出す` |
| `cpuGame.skill.submit.EXTENSION_SEAL` | `追加封印して出す` |
| `cpuGame.skill.submit.REVOLUTION` | `革命して出す` |
| `cpuGame.skill.jokerTransform.open` | `変化Jokerを使う` |
| `cpuGame.skill.jokerTransform.declareRank` | `数字を宣言` |
| `cpuGame.skill.jokerTransform.declareSuit` | `属性を宣言` |
| `cpuGame.skill.jokerTransform.confirm` | `この宣言で出す` |
| `cpuGame.skill.jokerTransform.cancel` | `やめる` |
| `cpuGame.skill.jokerTransform.forbiddenGoOut` | `最後の数字カードと変化Jokerでは上がれません` |
| `cpuGame.skill.jokerTransform.preview` | `宣言後のカード` |
| `cpuGame.skill.revolutionPreviewLabel` | `革命後` |
| `cpuGame.hint.legalMoveCount` | `出せる手：{count}通り`（`{count}` は画面で差し込み。既存の差し込みパターンに合わせる） |
| `cpuGame.hint.noMoves` | `出せる手がありません` |

`cpuGame.skill.heldNote`（現在「M3で使用可能」）は「保有中」等に更新するか、画面から参照を外す。`translate.test.ts` の M2 必須キー一覧に新キーを追加。

## 12. テスト

| ファイル | 内容 |
|---|---|
| `packages/game-core` 新規または既存受入テスト | §4 の `resolveCardPlay` 検証ケース、列挙器バイト一致 |
| `apps/mobile/.../skillPlayOptions.test.ts`（新規） | `heldSkillEffect` / `submitOptionsForSelection` / `resolveJokerTransform`（ok・forbidden-go-out・illegal・incomplete）/ `revolutionPreview` / `legalMoveCount` / `selectionRejectionReasonKey` |
| `apps/mobile/.../boardViewModel.test.ts`（拡張） | `skillPanel` / `submitOptions` / `jokerTransform` / `selectionHint` を各スキル保有シナリオで検証 |
| `apps/mobile/.../handSelection.test.ts`（拡張） | `canSubmitPlain`、スキル手混在時の `canSelectCard` |
| `apps/mobile/.../cpuGameStore.test.ts`（拡張） | `openJokerTransform` / `setJokerDeclaration` / `submitJokerTransform` / `submitSkillPlay` フロー、提出成功で `jokerTransform` リセット、カード保存則 |
| `apps/mobile/.../turnDriver.test.ts`（拡張） | `legalPlaysForHuman` がスキル手を含むこと（人間席がスキル保有の seed で） |
| `apps/mobile/src/i18n/translate.test.ts`（拡張） | 新キー・新 reason コード |

**スキル保有シナリオの作り方**：`dealRound` は seed 決定的でスキルを1席1枚配る（`skillDeck()` を shuffle）。テストヘルパー `findSeedForHumanSkill(effectCode, playerCount)` で `initGame({config, seed}).round.players[0].skill?.effectCode === effectCode` になる seed を線形探索する（`turnDriver.test.ts` の既存 seed スイープと同規模、上限付き）。

## 13. 確認手順

- `npm run game-core:test` / `npm run game-core:typecheck`
- `npm run mobile:test` / `npm --prefix apps/mobile run typecheck` / `lint`
- `npx expo export --platform android`（バンドル可能）
- `git diff --check`
- 進捗記録：`docs/progress/M3-EX-01.md` / `M3-EX-02.md` / `M3-EX-07.md`（既存 `docs/progress/` 書式）

## 14. 将来への申し送り

- Joker宣言の独立画面（§22.1）とデザイン版 `play.tsx` へ差し替え時、`boardViewModel` の `skillPanel` / `jokerTransform` / `submitOptions` / `selectionHint` 契約は維持する。
- 手番タイマー（M4）は宣言操作も同じ制限時間に含める（TIMER-004）。宣言途中でタイムアウトした場合の扱いを M4 で決める。
- `revolutionPreview` の強弱順定義（`DAY_STRENGTH_ORDER` / `NIGHT_STRENGTH_ORDER`）は現在 `boardViewModel.ts` にある。`skillPlayOptions.ts` と共有するため小さな共通モジュールへ切り出すか、game-core 側の `rankStrength` から導出する。
- M3-EX-07 の「出せるカード支援」は最小実装（理由文＋手数）。実機テスト（M3-QA-02）や初心者フィードバック次第で、推奨手のゴースト表示などを追加検討する。
