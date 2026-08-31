# 場のロック体系（枚数ロック / 属性固定ロック / 属性統一ロック）設計

- 文書ID: SPEC-FIELD-LOCKS
- 日付: 2026-09-01
- 発端: M1-EX-10 サンドボックス実機確認中に、更新後の追加可否と属性制限が要件定義書 v0.2（§8.3 / §9.3 / §9.4 / §10.1）と食い違うことが発覚。要件の決定者（プロジェクトオーナー）と全ルールを確定した。
- 対象: `packages/game-core`（M1-EX-04 / M1-EX-05 相当の作り直し）、要件定義書 v0.2 → v0.3、`docs/qa/M1-QA-03`、`apps/mobile` ルールサンドボックス
- 依存: なし（M1 は完了済み。本件は M1 成果物の rule 訂正）

## 1. 目的

アクティブセットの「更新（REPLACE）」と「追加/拡張（EXTEND）」の可否、および更新に伴う属性の制限を、確定ルールどおりに判定できるようにする。現行の §10.1 属性ロック（LOCK-001〜005）を3種類のロックへ再定義して置き換える。

## 2. 確定ルール（本節が唯一の基準）

用語:
- **リード**: 場が空の状態で最初に出すプレイ。
- **追加/拡張 (EXTEND)**: 既存アクティブセットを残し、同数字（同数セット）または連続数字（連番セット）を継ぎ足す。
- **更新 (REPLACE)**: 既存アクティブセットを捨て札へ移し、同じ枚数・同じ種別のより強い組み合わせを新しいアクティブセットにする。
- **属性の組**: そのプレイのカードの属性を多重集合として見たもの。順序は問わない。例 `炎5・水6・炎7` の属性の組 = `{炎, 炎, 水}`。
- 変化Jokerは宣言した数字・属性を持つ数字カードとして、すべてのロック判定に含める（旧 LOCK-002 の趣旨を継続）。

3種類のロックはすべて、その場が流れた時点（通常の場流し・Jokerによる場流し）で解除される。

### 2.1 枚数ロック

- **発動タイミング**: その場が初めて「更新」されたとき。
- **発動条件**: 常に。
- **固定内容**: 更新直前のアクティブセットの枚数と種別（単体 / 同数セット / 連番セット）。追加で成長していた場合は成長後の枚数。
- **効果**: 以降、その場が流れるまで、追加/拡張を認めない。固定された枚数・種別の更新のみを認める。

受入例:
| 昼 | 局面 | プレイ | 判定 |
|---|---|---|---|
| — | リード`炎5` → 更新`水6` | 単体`8`を追加 | 不正。更新後は追加できない（1枚ロック） |
| — | リード`炎5` → 追加`水5` | （まだ更新なし） | ロック未発動。追加は可能 |
| — | リード`炎5` → 追加`水5` → 更新`炎6水6` | 単体`8`を追加 | 不正。2枚ロック |
| — | リード`炎3炎4炎5` → 追加`炎6` → 更新`水3水4水5水6` | 単体を追加 | 不正。4枚連番ロック |

### 2.2 属性固定ロック

- **発動タイミング**: その場が初めて「更新」されたときのみ。以降は判定しない。
- **発動条件**: その更新で出したカードの属性の組が、置き換えられるアクティブセット（追加で成長していれば成長後）の属性の組と多重集合として一致すること。
- **固定内容**: その属性の組。
- **効果**: 以降の更新は、属性の組がこれと多重集合として完全一致すること。
- 初回更新で属性の組が不一致だった場合、そのアクティブセットには属性固定ロックは一切発生しない（枚数ロックは発生する）。

受入例:
| 昼 | 局面 | プレイ | 判定 |
|---|---|---|---|
| — | リード`炎5` → 更新`炎6` | — | 属性一致 → `{炎}`固定。以降は炎単体の更新のみ |
| — | `{炎}`固定の場`炎6` | `水7`で更新 | 不正。属性の組不一致 |
| — | リード`炎7水7` → 更新`炎8水8` | — | 属性一致 → `{炎,水}`固定 |
| — | `{炎,水}`固定の場`炎8水8` | `炎9炎9`で更新（実在では不可、Joker併用時） | 不正。`{炎,炎}` ≠ `{炎,水}` |
| — | リード`炎5` → 更新`水6` | — | 不一致 → 属性固定ロックなし（枚数ロックのみ） |
| — | 上記の続き（属性固定なし） | `水7`で更新 → `炎8`で更新 | いずれも属性は自由（初回更新でしか判定しない） |
| — | 混色連番`水5風6土7` → 更新`炎5炎6炎7` | — | `{炎,炎,炎}` ≠ `{水,風,土}` → 属性固定なし（枚数ロック3連番のみ） |
| — | リード`炎3炎4炎5` → 追加`炎6` → 更新`炎4炎5炎6炎7` | — | 成長後`{炎×4}`と一致 → `{炎×4}`固定 |

### 2.3 属性統一ロック（旧 §10.1 LOCK-001 の再定義）

- **発動タイミング**: リード時。
- **発動条件**: リードが連番セットであり、かつ全カードが同一属性であること。（同数セットは同一属性になり得ない＝同数字同属性カードは1枚のみ。よって属性統一ロックは連番リード専用。）
- **効果**（初回更新後も継続）:
  - 追加/拡張: 追加カードはアクティブセットと同じ属性であること（セットは同一属性のまま伸びる）。加えて SEQ-004 / SEQ-005 の方向規則を満たすこと。
  - 更新: 出す連番セットは全カードが同一属性であること。属性は変更してよい（例 火の連番を水の連番で更新可）。

受入例:
| 昼 | 局面 | プレイ | 判定 |
|---|---|---|---|
| — | リード`炎3炎4炎5`（同属性連番） | `炎6`を追加 | 合法。場は`炎3炎4炎5炎6` |
| — | 同上 | `水6`を追加 | 不正。属性統一が崩れる |
| — | 同上 | `水4水5水6`で更新 | 合法。統一された連番なら属性は変更可 |
| — | 同上 | `水4炎5風6`で更新 | 不正。更新セットが同一属性でない |
| — | 混色連番`炎3水4風5`をリード | — | 属性統一ロックなし。追加は属性混在可（SEQ範囲内） |

### 2.4 ロックの相互関係

- 3ロックは独立に同時成立し得る。例: 同属性連番リードで属性統一ロック → 同属性で初回更新すると、その更新で枚数ロック＋属性固定ロックも発生し、3つすべて有効。
- 属性統一ロックのみ有効な場（初回更新で属性不一致だった）では、更新は「同一属性の連番なら属性自由」。
- 属性固定ロックが有効な場では、その属性の組が属性統一（全同一属性）を含意する場合は属性統一チェックは自動的に満たされる。

### 2.5 帰結（ルール変更ではないが記録）

- 自然革命 REV-002（3枚以下のアクティブセットへ追加し4枚以上になったとき発生）は、初回更新後は追加不可のため発生し得ない。初回更新前（属性統一ロック中の追加を含む）は従来どおり発生する。REV-001（新規4枚以上のリード）と REV-003（新規4枚以上での更新）は影響なし。
- 旧 §10.1 の「反映結果が3枚以上同属性ならその1属性のみに制限」は廃止。同一属性の連番リードは属性統一ロック（属性変更可の統一制約）になる。

## 3. 要件定義書 v0.2 → v0.3 への反映

### §0.5 変更履歴 / 版数
- 版数 0.2 → **0.3**
- 追加行: `| 0.3 | 2026-09-01 | 場のロック体系を再定義（枚数ロック新設、属性固定ロック新設、§10.1 属性ロックを属性統一ロックへ再定義）。§8.3 / §9.3 / §9.4 / §10.1 / §31.2 を改訂。M1-EX-10 のQAで発覚。 |`

### §8.3 場の追加と更新
- FIELD-005 改訂: 「更新後は更新後の組み合わせだけを次の比較対象とすること。」（"追加" を削除）
- FIELD-006 新規（確定）: 「アクティブセットが一度でも更新された場合、そのアクティブセットが場から流れるまで追加・拡張を認めず、更新直前と同じ枚数・同じ種別のより強い組み合わせによる更新だけを認めること（枚数ロック）。」

### §9.3 単体・同数セットへの応答
- RANKSET-001 改訂: 「現在のアクティブセットが更新されていない場合に限り、現在と同じ数字のカードを1枚以上まとめて追加できること。」
- RANKSET-007 新規（確定）: 「現在のアクティブセットが更新されている場合、追加を認めず、同じ枚数のより強い同数セットによる更新だけを認めること。」
- RANKSET-008 新規（確定）: 「初回更新で出したカードの属性の組が、置き換えるセットの属性の組と多重集合として一致した場合、以降の更新は属性の組が一致すること（属性固定ロック）。初回更新で不一致なら属性固定ロックは発生しないこと。」
- §9.3 受入例に §2.2 / §2.3 の該当行を追加。

### §9.4 連番セットへの応答
- SEQ-004 / SEQ-005 改訂: 各文頭に「現在のアクティブセットが更新されていない場合に限り、」を追加。
- SEQ-009 新規（確定）: 「現在の連番セットが更新されている場合、拡張を認めず、同じ枚数のより強い連番セットによる更新だけを認めること（枚数ロック）。」
- SEQ-010 新規（確定）: RANKSET-008 と同旨の属性固定ロックを連番セットにも適用すること。
- §9.4 受入例に該当行を追加。

### §10.1 属性ロック（全面改訂）
- 節タイトルを「属性ロック（属性統一ロック / 属性固定ロック）」へ。
- LOCK-001 改訂（属性統一ロック）: 「リードが連番セットで全カードが同一属性の場合、属性統一ロックを発生させること。以降、その場が流れるまで、追加は同一属性を維持すること、更新は全カード同一属性の連番セットであること（属性は変更可）。」
- LOCK-002 改訂: 「属性を宣言した変化Jokerを、属性統一ロック・属性固定ロックの判定へ含めること。」
- LOCK-003 改訂: 「属性統一ロック中、アクティブセットの同一属性が崩れる追加・更新を不正とすること。」
- LOCK-004 改訂: 「枚数ロック・属性固定ロック・属性統一ロックを、その場が更新されても継続すること。」
- LOCK-005 改訂: 「通常またはJokerによる場流しで、枚数ロック・属性固定ロック・属性統一ロックをすべて解除すること。」
- LOCK-006 新規（確定）: 「属性固定ロックは §9.3 RANKSET-008 / §9.4 SEQ-010 に従い、初回更新時にのみ判定すること。」
- §10.1 受入例を §2.2 / §2.3 の内容へ差し替え。

### §31.2 必須ルールテスト
- T-RULE-008 改訂: 「昼、同一属性の連番`炎3炎4炎5`をリード | 属性統一ロック発生。追加は炎のみ、更新は同一属性の連番で可」
- T-RULE-023 新規: 「昼、`77`を`88`で更新した後に単体`8`を追加 | 更新後は追加不可で不正（枚数ロック）」
- T-RULE-024 新規: 「昼、`炎7`を`炎8`で更新した後に`水9`で更新 | 属性の組不一致で不正（属性固定ロック）」
- T-RULE-025 新規: 「昼、`炎3炎4炎5`リード後に`水4水5水6`で更新 | 統一連番なので合法（属性統一ロック、属性変更可）」

## 4. game-core アーキテクチャ（Approach 1）

### 4.1 型

```ts
export type FieldLock = {
  countLocked: boolean;          // 枚数ロック（初回更新で true）
  suitFixed: SuitCode[] | null;  // 属性固定ロック（ソート済み多重集合。更新はこれと一致必須）
  suitUniform: boolean;          // 属性統一ロック
};

export type ActiveField = {
  combination: NumberCombination;
  lastPlayerId: string;
  lock: FieldLock;               // 必須
};

export const UNLOCKED_FIELD: FieldLock = {
  countLocked: false,
  suitFixed: null,
  suitUniform: false,
};

export function createActiveField(
  combination: NumberCombination,
  lastPlayerId: string,
  lock: Partial<FieldLock> = {},
): ActiveField {
  return {
    combination,
    lastPlayerId,
    lock: { ...UNLOCKED_FIELD, ...lock },
  };
}
```

### 4.2 ルールセットの継ぎ目（将来のトグル対応）

```ts
export type RulesetOptions = {
  countLock: boolean;
  suitFixedLock: boolean;
  suitUniformLock: boolean;
};

export const RULESET_INITIAL: RulesetOptions = {
  countLock: true,
  suitFixedLock: true,
  suitUniformLock: true,
};
```

- `evaluateNumberPlay` / `evaluateJokerTransformPlay` / `resolvePlay` / `deriveFieldLock` は `ruleset: RulesetOptions = RULESET_INITIAL` を任意引数で受け取る。`evaluateJokerTransformPlay` は `fieldLock` も受け取り `evaluateNumberPlay` へそのまま渡す。
- M1 は常に `RULESET_INITIAL`。将来、別 `rulesetCode` に対応する別 `RulesetOptions` を渡すことで個別トグル。判定・導出のロック種別ごとに `if (ruleset.<lock>)` で分岐する。

### 4.3 `deriveFieldLock`（新規純粋関数）

```ts
export function deriveFieldLock(input: {
  previous: ActiveField | null;      // 更新前の場（LEAD 時は null）
  actionKind: PlayActionKind;        // "LEAD" | "EXTEND" | "REPLACE"
  playedCombination: NumberCombination;   // そのプレイで出した組み合わせ
  resultingCombination: NumberCombination; // 反映後のアクティブセット
  ruleset?: RulesetOptions;
}): FieldLock
```

- `LEAD`: `{ countLocked:false, suitFixed:null, suitUniform: ruleset.suitUniformLock && resulting.kind==="SEQUENCE" && 全カード同一属性 }`
- `EXTEND`: `{ countLocked:false, suitFixed:null, suitUniform: previous!.lock.suitUniform }`（更新前は必ず未 countLock）
- `REPLACE`:
  - `isFirstReplace = !previous!.lock.countLocked`
  - `suitFixed`:
    - `isFirstReplace` でない → `previous!.lock.suitFixed`（変更しない）
    - `isFirstReplace` かつ `!ruleset.suitFixedLock` → `null`
    - `isFirstReplace` かつ `ruleset.suitFixedLock` → `multisetEqual(suitsOf(playedCombination.cards), suitsOf(previous!.combination.cards))` なら `suitsOf(playedCombination.cards)`、不一致なら `null`
  - `countLocked`: `ruleset.countLock`（`true` なら `true`、トグル OFF なら `false`）
  - `suitUniform`: `previous!.lock.suitUniform`（リードで確定、以降保持）

### 4.4 `evaluateNumberPlay` 改修

- 入力に `fieldLock?: FieldLock`（省略時 `UNLOCKED_FIELD`）と `ruleset?: RulesetOptions` を追加。
- 入力から `lockedSuitCode` を削除。
- 判定順:
  1. LEAD（`current` が null）: 従来どおり（parse → INVALID_COMBINATION or LEAD 成立）。
  2. `tryBuildExtension` が成立:
     - `extensionSealed` → `EXTENSION_SEALED`
     - `ruleset.countLock && fieldLock.countLocked` → `COUNT_LOCKED`
     - `ruleset.suitUniformLock && fieldLock.suitUniform && 追加カードにアクティブセットの属性と異なるものがある` → `SUIT_UNIFORM_REQUIRED`
     - それ以外は EXTEND 成立
  3. REPLACE 候補: parse → INVALID_COMBINATION / SHAPE_MISMATCH / NOT_STRONGER は従来どおり。
     - `ruleset.suitFixedLock && fieldLock.suitFixed && !multisetEqual(suitsOf(candidate.cards), fieldLock.suitFixed)` → `SUIT_FIXED_MISMATCH`
     - `ruleset.suitUniformLock && fieldLock.suitUniform && !全カード同一属性(candidate.cards)` → `SUIT_UNIFORM_REQUIRED`
     - それ以外は REPLACE 成立

### 4.5 削除するもの

- `RoundState.lockedSuitCode`（型・`createRoundState`・`buildState`・全構築箇所）
- `detectSuitLock` 関数
- `LegalNumberPlayResult` の `createsSuitLock` / `lockedSuitCode`
- `legalResult` 内の `detectSuitLock` 呼び出し
- `evaluateNumberPlay` の `lockedSuitCode` 引数と `SUIT_LOCKED` チェック
- `IllegalPlayReason` の `"SUIT_LOCKED"`

### 4.6 新規 `IllegalPlayReason`

- `"COUNT_LOCKED"` — 枚数ロック中に追加/拡張を試みた
- `"SUIT_FIXED_MISMATCH"` — 属性固定ロックの属性の組と不一致な更新
- `"SUIT_UNIFORM_REQUIRED"` — 属性統一ロックに反する追加（統一崩れ）または更新（非統一）

### 4.7 補助関数

- `suitsOf(cards: NumberCard[]): SuitCode[]` — ソート済み属性配列
- `multisetEqual(a: SuitCode[], b: SuitCode[]): boolean` — ソート済み配列の要素一致
- `allSameSuit(cards: NumberCard[]): boolean`

## 5. `resolvePlay` 統合

`resolveCardPlay` の新しい場の構築を:

```ts
activeField: createActiveField(
  numberResult.resultingCombination,
  player.playerId,
  deriveFieldLock({
    previous: isJokerClear ? null : state.activeField,
    actionKind: numberResult.actionKind,
    playedCombination: numberResult.combination,
    resultingCombination: numberResult.resultingCombination,
    ruleset: RULESET_INITIAL,
  }),
),
```

- `evaluateNumberPlay` / `evaluateJokerTransformPlay` 呼び出しに `fieldLock: isJokerClear ? UNLOCKED_FIELD : state.activeField?.lock ?? UNLOCKED_FIELD` と `ruleset: RULESET_INITIAL` を渡す。
- Jokerクリア継続リードは `previous: null`（LEAD 扱い）。
- `lockedSuitCode` 関連の分岐をすべて削除。
- `buildState` から `lockedSuitCode` を削除。場流し・Jokerクリアのパスは `activeField: null` のままでロックも自然に消える。

## 6. テスト戦略

### 更新するテスト

- `packages/game-core/src/playRules.test.ts`
  - 「enforces suit lock and detects new lock after reflection」を削除し、新ロックのテスト群へ差し替え（LEAD 由来の属性統一ロック、初回更新の枚数ロック、属性固定ロックの一致/不一致、`COUNT_LOCKED` / `SUIT_FIXED_MISMATCH` / `SUIT_UNIFORM_REQUIRED`）。
  - 既存の EXTEND / REPLACE / SHAPE_MISMATCH / NOT_STRONGER テストは `fieldLock` 省略時（`UNLOCKED_FIELD`）で従来どおり通ること。
- `packages/game-core/src/comparison.test.ts` / `joker.test.ts` / `turnFlow.test.ts` / `resolvePlay.test.ts` / `ruleAcceptance.test.ts` / `stateInvariants.test.ts`
  - `{ combination, lastPlayerId }` を直接構築している箇所を `createActiveField(...)` へ。
  - `lockedSuitCode` を参照/構築している箇所を除去・置換。
  - `resolvePlay.test.ts`「records natural revolution + lock」→ 属性統一ロックまたは属性固定ロックの新アサーションへ。
  - `ruleAcceptance.test.ts` T-RULE-008 を属性統一ロックのシナリオへ書き換え、T-RULE-023 / 024 / 025 を追加。

### 新規テスト

- `packages/game-core/src/fieldLock.test.ts`
  - `deriveFieldLock`: LEAD（同属性連番→suitUniform、混色連番→非、同数セット→非）、EXTEND（suitUniform 継承）、REPLACE（初回で枚数ロック、属性一致で suitFixed、不一致で null、2回目以降は suitFixed 保持・再判定しない）。
  - `RULESET_INITIAL` の各フラグを false にすると対応するロックが導出/判定されないこと（継ぎ目の検証）。

## 7. サンドボックスへの反映（`apps/mobile`）

- `src/features/rule-sandbox/sandboxModel.ts`
  - `setLockedSuit` エディタと `lockedSuitCode` 参照を削除。
  - `setFieldCards` を `createActiveField` 経由に。新規エディタ: `setFieldCountLocked(round, boolean)` / `setFieldSuitUniform(round, boolean)` / `setFieldSuitFixed(round, SuitCode[] | null)`（いずれも `activeField` が存在するときのみ作用）。
- `src/state/rule-sandbox-store.ts`
  - `fieldDraft` に `lock: FieldLock` を追加。`commitFieldDraft` で `createActiveField(combination, lastPlayerId, lock)`。`loadPreset` はプリセットの `activeField.lock` からシード。
- `src/app/sandbox/index.tsx`
  - 「属性ロック（なし/火/水/風/土）」行を削除。場エディタ内に3ロックのコントロール（枚数ロック トグル / 属性統一ロック トグル / 属性固定ロック 属性チップ複数選択）を、場が存在するときに表示。
  - 結果パネルの理由表示は既存の i18n マップ経由（新 3 reason キーを追加）。
- `src/features/rule-sandbox/sandboxPresets.ts`
  - `field()` ヘルパーを `createActiveField` 経由に。
  - `suit-lock` プリセットを「同属性連番リード → 属性統一ロック」へ書き換え。
  - 新規プリセット: `count-locked-add-rejected`（更新後の単体追加が不正）、`suit-fixed-mismatch`（属性固定ロックと不一致な更新が不正）、`suit-uniform-update`（統一連番の属性変更更新が合法）。
- `src/i18n/translate.ts` / `translate.test.ts`
  - `sandbox.lock.*`（旧属性ロック）関連キーを削除。
  - 追加: `sandbox.fieldLock.count` / `sandbox.fieldLock.suitUniform` / `sandbox.fieldLock.suitFixed` / `sandbox.reason.COUNT_LOCKED` / `sandbox.reason.SUIT_FIXED_MISMATCH` / `sandbox.reason.SUIT_UNIFORM_REQUIRED`。
  - `sandbox.reason.SUIT_LOCKED` を削除。
  - `translate.test.ts` の `REASON_CODES` マップ（`satisfies Record<PlayRejectionReason, true>`）を新 `PlayRejectionReason` に合わせて更新。
  - プリセット3件のタイトルキーを追加。

## 8. `docs/qa/M1-QA-03-rule-verification-checklist.md`

- グループ D「属性ロック」を「場のロック（枚数 / 属性固定 / 属性統一）」へ改題し、行を §2 の受入例へ差し替え。対応する自動テスト名（`fieldLock.test.ts` / `playRules.test.ts` / T-RULE-023〜025）を紐付け。

## 9. 影響ファイル一覧

game-core:
- 変更: `packages/game-core/src/index.ts`
- 新規: `packages/game-core/src/fieldLock.test.ts`
- 変更: `packages/game-core/src/playRules.test.ts` / `comparison.test.ts` / `joker.test.ts` / `turnFlow.test.ts` / `resolvePlay.test.ts` / `ruleAcceptance.test.ts` / `stateInvariants.test.ts`

要件・QA:
- 変更: `docs/product/独自カードゲーム_要件定義書_v0.2.md`（→ v0.3。ファイル名は据え置き、版数は本文で更新）
- 変更: `docs/qa/M1-QA-03-rule-verification-checklist.md`

サンドボックス:
- 変更: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts` + `.test.ts`
- 変更: `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts` + `.test.ts`
- 変更: `apps/mobile/src/state/rule-sandbox-store.ts` + `.test.ts`
- 変更: `apps/mobile/src/app/sandbox/index.tsx`
- 変更: `apps/mobile/src/i18n/translate.ts` + `.test.ts`

進捗:
- 新規: `docs/progress/M1-EX-04-fieldlock-revision.md`（完了時）

## 10. スコープ外

- ルールトグルの UI・永続化・`rulesetCode` 別の `RulesetOptions` 解決（将来の別スペック）。本件はコード構造上の継ぎ目のみ用意。
- 追加封印（SEAL-001〜008）はスキル効果として現状維持（枚数ロックとは別。リード直後の追加も封じる点で意味が残る）。
- 変化Joker宣言の履歴保持、対局履歴（M2 以降）。
- 要件定義書のファイル名変更、他ドキュメントの "v0.2" 参照の一括更新（横断マイルストーン等）。
