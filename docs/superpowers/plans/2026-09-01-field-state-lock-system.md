# 場のロック体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アクティブセットの「更新」「追加/拡張」の可否と更新時の属性制限を、確定ルール（枚数ロック / 属性固定ロック / 属性統一ロック）どおりに判定する。旧 §10.1 属性ロックを置き換える。

**Architecture:** `ActiveField.lock: FieldLock`（3ロックの状態）を必須化し、純粋関数 `deriveFieldLock` が反映結果から新しいロック状態を導出、`evaluateNumberPlay` がプレイ判定時に消費する。将来のルールトグル用に `RulesetOptions`（M1 は全 ON 固定 `RULESET_INITIAL`）を全評価関数へ通す。`RoundState.lockedSuitCode` / `detectSuitLock` / `SUIT_LOCKED` は削除。

**Tech Stack:** TypeScript / `packages/game-core`（依存ゼロ、`node:test`+`tsx`）/ `apps/mobile`（Expo, zustand, `.test.ts` のみ実行）。

## Global Constraints

- 基準ルールは `docs/superpowers/specs/2026-09-01-field-state-lock-system-design.md` の §2。矛盾を見つけたら実装を止めて報告する。
- 判定ロジックは仕様どおり。曖昧なら止める。
- `apps/mobile/package.json` / `package-lock.json` は変更しない。
- ファイル名・ディレクトリ kebab-case、型・コンポーネント PascalCase、関数・変数 camelCase、boolean は `is`/`has`/`can`/`should`。
- Conventional Commits。件名に `[M1-EX-04]`（game-core ルール）または `[M1-EX-10]`（サンドボックス）を含める。`main` で作業しコミット後 `git push origin main`。`.idea/` に触れない。`apps/mobile/dist/` をコミットしない。
- 各タスク完了時、そのタスクが触れたパッケージで: `npm run game-core:test` / `game-core:typecheck`、必要に応じ `npm run mobile:test` / `mobile:typecheck` / `mobile:lint` / `mobile:format:check` / `ui:typecheck` が PASS。`git diff --check` がクリーン。**モノレポなので `main` が常に緑であること**（`mobile:typecheck` が game-core の型変更で壊れないよう、型を壊す変更はそのタスク内で mobile 側も追随させる）。
- 属性の組の比較はソート済み `SuitCode[]` の要素一致（多重集合一致、順序無視）。

---

## File Structure

game-core（すべて `packages/game-core/src/`）:

| ファイル | 変更 |
|---|---|
| `index.ts` | 型 `FieldLock`/`RulesetOptions`、`createActiveField`/`UNLOCKED_FIELD`/`RULESET_INITIAL`、`suitsOf`/`multisetEqual`/`allSameSuit`、`deriveFieldLock`、`evaluateNumberPlay` 改修、`resolveCardPlay` 改修、`RoundState.lockedSuitCode`/`detectSuitLock`/`SUIT_LOCKED`/`createsSuitLock` 削除 |
| `fieldLock.test.ts` | 新規。`deriveFieldLock` の単体テスト |
| `playRules.test.ts` | 旧 suit-lock テスト差し替え、新ロックの `evaluateNumberPlay` テスト追加、`field()` を `createActiveField` へ |
| `resolvePlay.test.ts` | `lockedSuitCode` 参照除去、`field()` を `createActiveField` へ、新ロックの resolvePlay テスト追加 |
| `ruleAcceptance.test.ts` | `lockedSuitCode` 除去、T-RULE-008 差し替え、T-RULE-023/024/025 追加 |
| `joker.test.ts` / `turnFlow.test.ts` / `revolution.test.ts` / `comparison.test.ts` | `ActiveField` インライン構築と `lockedSuitCode` アサーションを `createActiveField` / 新形へ |
| `stateInvariants.test.ts` | `lockedSuitCode` 構築除去（`createRoundState` から消えるため実質不要になる箇所の掃除） |

docs:

| ファイル | 変更 |
|---|---|
| `docs/product/独自カードゲーム_要件定義書_v0.2.md` | v0.3 へ。§0.5 / §8.3 / §9.3 / §9.4 / §10.1 / §31.2 |
| `docs/qa/M1-QA-03-rule-verification-checklist.md` | グループ D 差し替え |
| `docs/progress/M1-EX-04-fieldlock-revision.md` | 新規（完了時） |

apps/mobile（すべて `apps/mobile/src/`）:

| ファイル | 変更 |
|---|---|
| `features/rule-sandbox/sandboxModel.ts` + `.test.ts` | `setLockedSuit`/`lockedSuitCode` 削除、`setFieldCountLocked`/`setFieldSuitUniform`/`setFieldSuitFixed` 追加、`setFieldCards` を `createActiveField` 経由に |
| `features/rule-sandbox/sandboxPresets.ts` + `.test.ts` | `field()` を `createActiveField` 経由に、`suit-lock` 差し替え、新規プリセット3件 |
| `state/rule-sandbox-store.ts` + `.test.ts` | `fieldDraft.lock` 追加、`commitFieldDraft`/`loadPreset` 対応 |
| `app/sandbox/index.tsx` | 属性ロック行を3ロックコントロールへ差し替え |
| `i18n/translate.ts` + `.test.ts` | `sandbox.lock.*` と `SUIT_LOCKED` 削除、`sandbox.fieldLock.*` と新3 reason キーとプリセットキー追加、`REASON_CODES` 更新 |

---

## Task 1: game-core 基盤（型・ヘルパー・`ActiveField.lock` 必須化・全構築箇所の掃除、挙動不変）

**Files:**
- Modify: `packages/game-core/src/index.ts`
- Modify: `packages/game-core/src/*.test.ts`（`ActiveField` を構築している全ファイル）
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`, `sandboxPresets.ts`, `state/rule-sandbox-store.ts`（`ActiveField` 構築箇所）

**Interfaces:**
- Produces（`packages/game-core/src/index.ts` から export）:
  - `type FieldLock = { countLocked: boolean; suitFixed: SuitCode[] | null; suitUniform: boolean }`
  - `const UNLOCKED_FIELD: FieldLock`（`{ countLocked: false, suitFixed: null, suitUniform: false }`）
  - `type RulesetOptions = { countLock: boolean; suitFixedLock: boolean; suitUniformLock: boolean }`
  - `const RULESET_INITIAL: RulesetOptions`（全 `true`）
  - `function createActiveField(combination: NumberCombination, lastPlayerId: string, lock?: Partial<FieldLock>): ActiveField`
  - `function suitsOf(cards: NumberCard[]): SuitCode[]`（ソート済み）
  - `function multisetEqual(a: SuitCode[], b: SuitCode[]): boolean`
  - `function allSameSuit(cards: NumberCard[]): boolean`
  - `ActiveField` 型に `lock: FieldLock` を追加（必須）
- 挙動は一切変えない。`lockedSuitCode` / `detectSuitLock` / `SUIT_LOCKED` はこのタスクでは**残す**。

- [ ] **Step 1: `index.ts` に型とヘルパーを追加**

`ActiveField` 型を変更:

```ts
export type ActiveField = {
  combination: NumberCombination;
  lastPlayerId: string;
  lock: FieldLock;
};
```

`ActiveField` 型定義の直前に:

```ts
export type FieldLock = {
  countLocked: boolean;
  suitFixed: SuitCode[] | null;
  suitUniform: boolean;
};

export const UNLOCKED_FIELD: FieldLock = {
  countLocked: false,
  suitFixed: null,
  suitUniform: false,
};

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

`createRoundState` の直後あたりに:

```ts
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

export function suitsOf(cards: NumberCard[]): SuitCode[] {
  return cards.map((card) => card.suitCode).sort();
}

export function multisetEqual(left: SuitCode[], right: SuitCode[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((suit, index) => suit === b[index]);
}

export function allSameSuit(cards: NumberCard[]): boolean {
  if (cards.length === 0) return true;
  return cards.every((card) => card.suitCode === cards[0].suitCode);
}
```

- [ ] **Step 2: `resolveCardPlay` の `activeField` 構築を `createActiveField` へ**

`index.ts` の `resolveCardPlay` 内、`buildState(state, { ... activeField: { combination: numberResult.resultingCombination, lastPlayerId: player.playerId }, ... })` を:

```ts
      activeField: createActiveField(
        numberResult.resultingCombination,
        player.playerId,
      ),
```

（ロック導出は Task 3 で追加。ここでは既定 unlocked。）

- [ ] **Step 3: typecheck を回して壊れた構築箇所を洗い出す**

Run: `npm run game-core:typecheck`
Expected: `ActiveField` の `lock` 欠落エラーが複数。各エラー箇所を修正:
- game-core テストの `field()` ローカルヘルパー（`resolvePlay.test.ts` の `field`、`turnFlow.test.ts` の `field`）を `createActiveField(combination, lastPlayerId)` を返すよう変更（`import` に `createActiveField` を追加）。
- インライン `{ combination: combo([...]), lastPlayerId: "..." }`（`playRules.test.ts` L33/L56、`revolution.test.ts` L74、`joker.test.ts` L136）を `createActiveField(combo([...]), "...")` へ。
- `evaluateJokerClear` / `resolveFieldClear` に渡す `currentField` も `ActiveField` なので同様。

Run: `npm run game-core:typecheck` を緑になるまで繰り返す。

- [ ] **Step 4: mobile 側の `ActiveField` 構築を `createActiveField` へ**

- `apps/mobile/src/features/rule-sandbox/sandboxModel.ts` の `setFieldCards`（`{ combination, lastPlayerId }` を作っている箇所）→ `createActiveField(combination, lastPlayerId)`。`@card-game-app/game-core` の import に `createActiveField` を追加。
- `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts` の `field()` ヘルパー → `createActiveField(combination, lastPlayerId)`。
- `apps/mobile/src/state/rule-sandbox-store.ts` の `commitFieldDraft` が `setFieldCards` 経由なら追加変更不要。直接 `{ combination, lastPlayerId }` を作っていれば `createActiveField` へ。

Run: `npm run mobile:typecheck` → PASS

- [ ] **Step 5: 全テスト・lint・format**

Run: `npm run game-core:test` → PASS（93、挙動不変）
Run: `npm run game-core:typecheck` → PASS
Run: `npm run mobile:test` → PASS（58）
Run: `npm run mobile:typecheck` / `npm run mobile:lint` / `npm run mobile:format:check` → PASS（format 崩れたら `npm run mobile:format` 後に再確認）

- [ ] **Step 6: Commit**

```bash
git add packages/game-core/src apps/mobile/src
git commit -m "refactor(game-core): [M1-EX-04] add FieldLock scaffold and createActiveField"
git push origin main
```

---

## Task 2: `deriveFieldLock`（純粋関数、未配線）

**Files:**
- Modify: `packages/game-core/src/index.ts`
- Test: `packages/game-core/src/fieldLock.test.ts`（新規）

**Interfaces:**
- Consumes: Task 1 の `FieldLock`, `RulesetOptions`, `RULESET_INITIAL`, `UNLOCKED_FIELD`, `suitsOf`, `multisetEqual`, `allSameSuit`, `createActiveField`; 既存 `ActiveField`, `NumberCombination`, `PlayActionKind`, `parseNumberCombination`, `createNumberCard`。
- Produces:
  - `function deriveFieldLock(input: { previous: ActiveField | null; actionKind: PlayActionKind; playedCombination: NumberCombination; resultingCombination: NumberCombination; ruleset?: RulesetOptions }): FieldLock`

- [ ] **Step 1: 失敗するテスト `packages/game-core/src/fieldLock.test.ts`**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  RULESET_INITIAL,
  createActiveField,
  createNumberCard,
  deriveFieldLock,
  parseNumberCombination,
  type NumberCard,
} from "./index.ts";

const c = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH" = "FIRE") =>
  createNumberCard(
    `C_${rank}_${suit}`,
    `RANK_${rank}` as never,
    `SUIT_${suit}` as never,
  );

const combo = (cards: NumberCard[]) => {
  const parsed = parseNumberCombination(cards);
  assert.ok(parsed);
  return parsed;
};

test("LEAD of a uniform-suit sequence sets suitUniform", () => {
  const resulting = combo([c(3), c(4), c(5)]);
  assert.deepEqual(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: resulting,
      resultingCombination: resulting,
    }),
    { countLocked: false, suitFixed: null, suitUniform: true },
  );
});

test("LEAD of a mixed sequence or a rank set does not set suitUniform", () => {
  const mixed = combo([c(3), c(4, "WATER"), c(5, "WIND")]);
  assert.equal(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: mixed,
      resultingCombination: mixed,
    }).suitUniform,
    false,
  );
  const rankSet = combo([c(6), c(6, "WATER")]);
  assert.equal(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: rankSet,
      resultingCombination: rankSet,
    }).suitUniform,
    false,
  );
});

test("EXTEND preserves suitUniform and never locks count or suitFixed", () => {
  const previous = createActiveField(combo([c(3), c(4), c(5)]), "P1", {
    suitUniform: true,
  });
  const added = combo([c(6), c(7), c(8)]);
  const resulting = combo([c(3), c(4), c(5), c(6)]);
  assert.deepEqual(
    deriveFieldLock({
      previous,
      actionKind: "EXTEND",
      playedCombination: combo([c(6)]),
      resultingCombination: resulting,
    }),
    { countLocked: false, suitFixed: null, suitUniform: true },
  );
  void added;
});

test("first REPLACE always locks count; locks suitFixed only when suits match", () => {
  const previous = createActiveField(combo([c(7), c(7, "WATER")]), "P2");

  const matching = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(8), c(8, "WATER")]),
    resultingCombination: combo([c(8), c(8, "WATER")]),
  });
  assert.equal(matching.countLocked, true);
  assert.deepEqual(matching.suitFixed, ["SUIT_FIRE", "SUIT_WATER"]);

  const mismatching = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(8), c(8, "WIND")]),
    resultingCombination: combo([c(8), c(8, "WIND")]),
  });
  assert.equal(mismatching.countLocked, true);
  assert.equal(mismatching.suitFixed, null);
});

test("a later REPLACE keeps the suitFixed established by the first REPLACE", () => {
  const previous = createActiveField(combo([c(8), c(8, "WATER")]), "P2", {
    countLocked: true,
    suitFixed: ["SUIT_FIRE", "SUIT_WATER"],
  });
  const next = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(9), c(9, "WATER")]),
    resultingCombination: combo([c(9), c(9, "WATER")]),
  });
  assert.deepEqual(next.suitFixed, ["SUIT_FIRE", "SUIT_WATER"]);
});

test("ruleset toggles gate each lock independently", () => {
  const seq = combo([c(3), c(4), c(5)]);
  assert.equal(
    deriveFieldLock({
      previous: null,
      actionKind: "LEAD",
      playedCombination: seq,
      resultingCombination: seq,
      ruleset: { ...RULESET_INITIAL, suitUniformLock: false },
    }).suitUniform,
    false,
  );
  const previous = createActiveField(combo([c(7), c(7, "WATER")]), "P2");
  const r = deriveFieldLock({
    previous,
    actionKind: "REPLACE",
    playedCombination: combo([c(8), c(8, "WATER")]),
    resultingCombination: combo([c(8), c(8, "WATER")]),
    ruleset: { countLock: false, suitFixedLock: false, suitUniformLock: false },
  });
  assert.deepEqual(r, { countLocked: false, suitFixed: null, suitUniform: false });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run game-core:test`
Expected: FAIL — `deriveFieldLock` 未 export。

- [ ] **Step 3: `deriveFieldLock` を `index.ts` に実装**

`nextDayNight` の近くに:

```ts
export function deriveFieldLock(input: {
  previous: ActiveField | null;
  actionKind: PlayActionKind;
  playedCombination: NumberCombination;
  resultingCombination: NumberCombination;
  ruleset?: RulesetOptions;
}): FieldLock {
  const ruleset = input.ruleset ?? RULESET_INITIAL;

  if (input.actionKind === "LEAD") {
    return {
      countLocked: false,
      suitFixed: null,
      suitUniform:
        ruleset.suitUniformLock &&
        input.resultingCombination.kind === "SEQUENCE" &&
        allSameSuit(input.resultingCombination.cards),
    };
  }

  const previous = input.previous;
  if (!previous) {
    return { ...UNLOCKED_FIELD };
  }

  if (input.actionKind === "EXTEND") {
    return {
      countLocked: false,
      suitFixed: null,
      suitUniform: previous.lock.suitUniform,
    };
  }

  // REPLACE
  const isFirstReplace = !previous.lock.countLocked;
  let suitFixed: SuitCode[] | null;
  if (!isFirstReplace) {
    suitFixed = previous.lock.suitFixed;
  } else if (!ruleset.suitFixedLock) {
    suitFixed = null;
  } else {
    suitFixed = multisetEqual(
      suitsOf(input.playedCombination.cards),
      suitsOf(previous.combination.cards),
    )
      ? suitsOf(input.playedCombination.cards)
      : null;
  }

  return {
    countLocked: ruleset.countLock,
    suitFixed,
    suitUniform: previous.lock.suitUniform,
  };
}
```

- [ ] **Step 4: 緑を確認**

Run: `npm run game-core:test` → PASS
Run: `npm run game-core:typecheck` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/game-core/src/index.ts packages/game-core/src/fieldLock.test.ts
git commit -m "feat(game-core): [M1-EX-04] add deriveFieldLock"
git push origin main
```

---

## Task 3: 機構の入れ替え（旧 suit-lock 削除、`deriveFieldLock` 配線、`evaluateNumberPlay` にロック判定、mobile 追随）

**Files:**
- Modify: `packages/game-core/src/index.ts`
- Modify: `packages/game-core/src/playRules.test.ts`, `resolvePlay.test.ts`, `joker.test.ts`, `turnFlow.test.ts`, `ruleAcceptance.test.ts`, `stateInvariants.test.ts`
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts` + `.test.ts`, `apps/mobile/src/app/sandbox/index.tsx`, `apps/mobile/src/i18n/translate.ts` + `.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 2 のすべて。
- Produces:
  - `IllegalPlayReason` に `"COUNT_LOCKED"` / `"SUIT_FIXED_MISMATCH"` / `"SUIT_UNIFORM_REQUIRED"` を追加、`"SUIT_LOCKED"` を削除。
  - `evaluateNumberPlay` 入力: `lockedSuitCode` を削除、`fieldLock?: FieldLock`（省略時 `UNLOCKED_FIELD`）と `ruleset?: RulesetOptions`（省略時 `RULESET_INITIAL`）を追加。
  - `evaluateJokerTransformPlay` 入力: `lockedSuitCode` を削除、`fieldLock?`/`ruleset?` を追加し `evaluateNumberPlay` へ委譲。
  - `LegalNumberPlayResult` から `createsSuitLock` / `lockedSuitCode` を削除。
  - `RoundState` から `lockedSuitCode` を削除。`JokerClearResult` / `FieldClearResult` からも `lockedSuitCode` を削除。
  - `resolvePlay` 成功時の `activeField` は `createActiveField(resultingCombination, playerId, deriveFieldLock({...}))`。

- [ ] **Step 1: game-core `index.ts` — 旧 suit-lock の削除**

- `IllegalPlayReason` から `"SUIT_LOCKED"` を削除、`"COUNT_LOCKED" | "SUIT_FIXED_MISMATCH" | "SUIT_UNIFORM_REQUIRED"` を追加。
- `RoundState` から `lockedSuitCode: SuitCode | null;` を削除。
- `createRoundState` の入力型と本体から `lockedSuitCode` を削除。
- `LegalNumberPlayResult` から `createsSuitLock?` / `lockedSuitCode?` を削除。
- `legalResult` から `detectSuitLock` 呼び出しと `createsSuitLock`/`lockedSuitCode` の spread を削除（`legalResult` は `actionKind`/`combination`/`resultingCombination`/`extras` だけ返す）。
- `detectSuitLock` 関数を削除。
- `evaluateJokerTransformPlay` 入力型から `lockedSuitCode?` を削除、`evaluateNumberPlay` 呼び出しから `lockedSuitCode` を外す。
- `JokerClearResult` の legal 分岐から `lockedSuitCode: null;` を削除、`evaluateJokerClear` の戻り値から `lockedSuitCode: null,` を削除。
- `FieldClearResult` から `lockedSuitCode: null;` を削除、`resolveFieldClear` の戻り値から削除。
- `buildState` から `lockedSuitCode` の項を削除。
- `resolvePassPlay` の場流し分岐の `buildState(..., { ... lockedSuitCode: null, ... })` から `lockedSuitCode: null` を削除。

- [ ] **Step 2: `evaluateNumberPlay` にロック判定を追加**

入力型: `lockedSuitCode?: SuitCode | null;` を削除し `fieldLock?: FieldLock;` と `ruleset?: RulesetOptions;` を追加。関数冒頭で `const fieldLock = input.fieldLock ?? UNLOCKED_FIELD; const ruleset = input.ruleset ?? RULESET_INITIAL;`。冒頭の `if (input.lockedSuitCode && ...) return SUIT_LOCKED` ブロックを削除。

EXTEND 成立ブロックを:

```ts
  if (extension) {
    if (input.extensionSealed)
      return { legal: false, reason: "EXTENSION_SEALED" };
    if (ruleset.countLock && fieldLock.countLocked)
      return { legal: false, reason: "COUNT_LOCKED" };
    if (
      ruleset.suitUniformLock &&
      fieldLock.suitUniform &&
      input.candidateCards.some(
        (card) => card.suitCode !== input.current!.cards[0].suitCode,
      )
    )
      return { legal: false, reason: "SUIT_UNIFORM_REQUIRED" };
    return completeLegalResult( /* ...unchanged... */ );
  }
```

REPLACE 成立直前（`compareCombinations(...) !== 1` チェックの後、`completeLegalResult` の前）に:

```ts
  if (
    ruleset.suitFixedLock &&
    fieldLock.suitFixed &&
    !multisetEqual(suitsOf(candidate.cards), fieldLock.suitFixed)
  ) {
    return { legal: false, reason: "SUIT_FIXED_MISMATCH" };
  }
  if (
    ruleset.suitUniformLock &&
    fieldLock.suitUniform &&
    !allSameSuit(candidate.cards)
  ) {
    return { legal: false, reason: "SUIT_UNIFORM_REQUIRED" };
  }
```

`evaluateJokerTransformPlay`: 入力に `fieldLock?`/`ruleset?` を追加し、`evaluateNumberPlay` 呼び出しへ `fieldLock: input.fieldLock, ruleset: input.ruleset` を渡す。

- [ ] **Step 3: `resolveCardPlay` を配線**

`const lockedSuitCode = isJokerClear ? null : state.lockedSuitCode;` の行を削除。

`evaluateNumberPlay` / `evaluateJokerTransformPlay` の呼び出しから `lockedSuitCode,` を削除、代わりに `fieldLock: isJokerClear ? UNLOCKED_FIELD : state.activeField?.lock ?? UNLOCKED_FIELD,` と `ruleset: RULESET_INITIAL,` を追加。

`activeField` 構築（Task 1 で `createActiveField(numberResult.resultingCombination, player.playerId)` にした箇所）を:

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

`buildState(state, { ... })` から `lockedSuitCode: numberResult.createsSuitLock ? ... : lockedSuitCode,` の行を削除。

- [ ] **Step 4: game-core `index.ts` を typecheck**

Run: `npm run game-core:typecheck`
Expected: `SUIT_LOCKED` / `lockedSuitCode` / `createsSuitLock` の残参照エラー。すべて削除。緑まで繰り返す。

- [ ] **Step 5: game-core テストの掃除**

- `playRules.test.ts`: 「evaluateNumberPlay enforces suit lock and detects new lock after reflection」テストを削除し、次の新テストへ差し替え:

```ts
test("evaluateNumberPlay rejects an extension while the field's count is locked", () => {
  assert.deepEqual(
    evaluateNumberPlay({
      current: combo([c(6), c(6, "WATER")]),
      candidateCards: [c(6, "WIND")],
      dayNight: "DAY",
      fieldLock: { countLocked: true, suitFixed: null, suitUniform: false },
    }),
    { legal: false, reason: "COUNT_LOCKED" },
  );
});

test("evaluateNumberPlay rejects a replace whose suit multiset misses the fixed lock", () => {
  assert.deepEqual(
    evaluateNumberPlay({
      current: combo([c(6), c(6, "WATER")]),
      candidateCards: [c(7), c(7, "WIND")],
      dayNight: "DAY",
      fieldLock: {
        countLocked: true,
        suitFixed: ["SUIT_FIRE", "SUIT_WATER"],
        suitUniform: false,
      },
    }),
    { legal: false, reason: "SUIT_FIXED_MISMATCH" },
  );
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(6), c(6, "WATER")]),
      candidateCards: [c(7), c(7, "WATER")],
      dayNight: "DAY",
      fieldLock: {
        countLocked: true,
        suitFixed: ["SUIT_FIRE", "SUIT_WATER"],
        suitUniform: false,
      },
    }).legal,
    true,
  );
});

test("evaluateNumberPlay enforces suit-uniform on both extension and replace", () => {
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(3), c(4), c(5)]),
      candidateCards: [c(6, "WATER")],
      dayNight: "DAY",
      fieldLock: { countLocked: false, suitFixed: null, suitUniform: true },
    }).legal === false,
    true,
  );
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(3), c(4), c(5)]),
      candidateCards: [c(4, "WATER"), c(5, "WATER"), c(6, "WATER")],
      dayNight: "DAY",
      fieldLock: { countLocked: true, suitFixed: null, suitUniform: true },
    }).legal,
    true,
  );
  assert.equal(
    evaluateNumberPlay({
      current: combo([c(3), c(4), c(5)]),
      candidateCards: [c(4, "WATER"), c(5, "WIND"), c(6, "EARTH")],
      dayNight: "DAY",
      fieldLock: { countLocked: true, suitFixed: null, suitUniform: true },
    }),
    { legal: false, reason: "SUIT_UNIFORM_REQUIRED" },
  );
});
```

- `resolvePlay.test.ts`: `round()` ヘルパー / テストから `lockedSuitCode` を除去。「rejects an illegal replacement...」等の既存テストは `fieldLock` を渡さない＝unlocked で従来どおり。`lockedSuitCode` を assert している箇所（L100, L250, L297）を削除または新形へ。「resolves a transform Joker play and records natural revolution + lock」の `assert.equal(result.state.lockedSuitCode, "SUIT_FIRE")` を `assert.equal(result.state.activeField?.lock.suitUniform, true)` へ（このシナリオはリードが `🔥3🔥4` ＋ Joker `🔥5` の同属性連番 → 属性統一ロック）。「clears the field once every responder passed」の `lockedSuitCode` セットアップ／アサートを除去。
  - 追加テスト:

```ts
test("resolvePlay locks the count on the first replace and then rejects an add", () => {
  const state = round({
    players: [
      createPlayerState("P1", [c(9, "FIRE"), c(9, "WATER")]),
      createPlayerState("P2", [c(1, "EARTH")]),
    ],
    activePlayerId: "P1",
    activeField: field([c(8, "FIRE"), c(8, "WATER")], "P2"),
  });
  const replaced = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_9_FIRE", "N_9_WATER"],
  });
  assert.ok(replaced.ok);
  assert.equal(replaced.state.activeField?.lock.countLocked, true);
});
```

（`field`/`c`/`round`/`N_` の綴りは既存 `resolvePlay.test.ts` の書式に合わせる。）

- `joker.test.ts`: `assert.equal(result.lockedSuitCode, "SUIT_FIRE")`（L61）を削除（`evaluateJokerTransformPlay` はもう `lockedSuitCode` を返さない）。`evaluateJokerClear` の `assert.deepEqual` から `lockedSuitCode: null,` を削除。`{ combination: ..., lastPlayerId: ... }` は Task 1 で `createActiveField` 済み。
- `turnFlow.test.ts`: `resolveFieldClear` の `assert.deepEqual` から `lockedSuitCode: null,` を削除。
- `ruleAcceptance.test.ts`: `makeRound` の `lockedSuitCode` オプションと `createRoundState` 呼び出しの `lockedSuitCode` を削除。T-RULE-008 の本体を Task 4 で差し替えるのでここでは `assert.equal(result.state.lockedSuitCode, "SUIT_FIRE")` を一旦 `assert.ok(result.ok)` に退避（Task 4 で正式化）。
- `stateInvariants.test.ts`: `createRoundState` 呼び出しに `lockedSuitCode` があれば削除。

Run: `npm run game-core:test` → PASS
Run: `npm run game-core:typecheck` → PASS

- [ ] **Step 6: mobile 追随（旧 suit-lock UI の削除）**

- `apps/mobile/src/features/rule-sandbox/sandboxModel.ts`: `setLockedSuit` 関数と、`RoundState` の `lockedSuitCode` を参照/設定する箇所をすべて削除（`@card-game-app/game-core` の `RoundState` から消えたためコンパイルエラーになる箇所）。`sandboxModel.test.ts` の `setLockedSuit` テストを削除。
- `apps/mobile/src/app/sandbox/index.tsx`: 「属性ロック」行（`sandbox.lock.label` / `setLockedSuit` / `SUIT_CODES` を使ったチップ行）を削除。`import` の不要になったものを整理。
- `apps/mobile/src/i18n/translate.ts`: `sandbox.lock.label` / `sandbox.lock.none` および `sandbox.reason.SUIT_LOCKED` を削除。`sandbox.reason.COUNT_LOCKED` / `sandbox.reason.SUIT_FIXED_MISMATCH` / `sandbox.reason.SUIT_UNIFORM_REQUIRED` を追加（値は §2 の日本語。例「更新後は追加・拡張できません」「属性の組が一致しません」「属性統一が崩れます」）。
- `apps/mobile/src/i18n/translate.test.ts`: `REASON_CODES` マップ（`satisfies Record<PlayRejectionReason, true>`）から `SUIT_LOCKED` を削除し3新コードを追加。`sandbox.reason.SUIT_LOCKED` を参照している箇所を除去。

Run: `npm run mobile:test` → PASS
Run: `npm run mobile:typecheck` / `mobile:lint` / `mobile:format:check` → PASS
Run: `npm run ui:typecheck` → PASS

- [ ] **Step 7: Commit**

```bash
git add packages/game-core/src apps/mobile/src
git commit -m "feat(game-core): [M1-EX-04] replace suit lock with count/suit-fixed/suit-uniform field locks"
git push origin main
```

---

## Task 4: 受入テストと QA チェックリスト

**Files:**
- Modify: `packages/game-core/src/ruleAcceptance.test.ts`
- Modify: `docs/qa/M1-QA-03-rule-verification-checklist.md`

**Interfaces:**
- Consumes: Task 1–3。`makeRound` / `field` / `c` は `ruleAcceptance.test.ts` の既存ヘルパー。

- [ ] **Step 1: T-RULE-008 を差し替え、T-RULE-023/024/025 を追加**

`ruleAcceptance.test.ts` の `T-RULE-008` テストを次へ差し替え（局面: 場空 → P1 が同属性3枚連番をリード → 場の `lock.suitUniform` が true）:

```ts
test("T-RULE-008: a uniform-suit sequence lead raises the suit-uniform lock", () => {
  const result = play(
    makeRound({ p1: [c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE"), c(9, "WATER")] }),
    { kind: "PLAY", playerId: "P1", cardIds: ["N_3_FIRE", "N_4_FIRE", "N_5_FIRE"] },
  );
  assert.ok(result.ok);
  assert.equal(result.state.activeField?.lock.suitUniform, true);
});
```

末尾に追加:

```ts
test("T-RULE-023: adding after the first replace is illegal (count lock)", () => {
  const state = makeRound({
    p1: [c(8), c(8, "WATER"), c(9)],
    p2: [c(1, "EARTH")],
    field: { cards: [c(7), c(7, "WATER")], by: "P2" },
  });
  const replaced = play(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_8_FIRE", "N_8_WATER"],
  });
  assert.ok(replaced.ok);
  const added = play(
    { ...replaced.state, activePlayerId: replaced.state.activeField!.lastPlayerId },
    { kind: "PLAY", playerId: replaced.state.activeField!.lastPlayerId, cardIds: ["N_9_FIRE"] },
  );
  assert.equal(added.ok === false && added.reason, "COUNT_LOCKED");
});

test("T-RULE-024: a replace that misses the fixed suit multiset is illegal", () => {
  const state = makeRound({
    p1: [c(9, "WATER")],
    p2: [c(1, "EARTH")],
    field: { cards: [c(8, "FIRE")], by: "P2" },
    fieldLock: { countLocked: true, suitFixed: ["SUIT_FIRE"], suitUniform: false },
  });
  const result = play(state, { kind: "PLAY", playerId: "P1", cardIds: ["N_9_WATER"] });
  assert.equal(result.ok === false && result.reason, "SUIT_FIXED_MISMATCH");
});

test("T-RULE-025: a uniform sequence may be updated with a different uniform suit", () => {
  const state = makeRound({
    p1: [c(4, "WATER"), c(5, "WATER"), c(6, "WATER"), c(9, "EARTH")],
    p2: [c(1, "EARTH")],
    field: { cards: [c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE")], by: "P2" },
    fieldLock: { countLocked: false, suitFixed: null, suitUniform: true },
  });
  const result = play(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_4_WATER", "N_5_WATER", "N_6_WATER"],
  });
  assert.ok(result.ok);
  assert.equal(result.outcome.actionKind, "REPLACE");
});
```

`makeRound` に `fieldLock?: FieldLock` オプションを追加し、`field` 構築を `createActiveField(cards..., by, opts.fieldLock)` にする（`ruleAcceptance.test.ts` の `makeRound` / `fieldOf` を編集。`FieldLock` を import）。

- [ ] **Step 2: 緑を確認**

Run: `npm run game-core:test` → PASS
Run: `npm run game-core:typecheck` → PASS

- [ ] **Step 3: `docs/qa/M1-QA-03-rule-verification-checklist.md` グループ D を差し替え**

「## D. 属性ロック（§10.1、LOCK-001〜005）」の節を「## D. 場のロック（枚数 / 属性固定 / 属性統一）」へ改題し、表を §2 受入例ベースの行へ。各行の「自動テスト」列に対応テスト名（`deriveFieldLock ...` / `evaluateNumberPlay rejects an extension while the field's count is locked` / `T-RULE-008` / `T-RULE-023` / `T-RULE-024` / `T-RULE-025` / `resolvePlay locks the count on the first replace ...`）。実行レポート表の件数を更新。

- [ ] **Step 4: Commit**

```bash
git add packages/game-core/src/ruleAcceptance.test.ts docs/qa/M1-QA-03-rule-verification-checklist.md
git commit -m "test(game-core): [M1-EX-04] acceptance tests for the field lock rules"
git push origin main
```

---

## Task 5: 要件定義書 v0.3

**Files:**
- Modify: `docs/product/独自カードゲーム_要件定義書_v0.2.md`

**Interfaces:** Consumes: spec §3。

- [ ] **Step 1: §0.5 と版数**

ヘッダの「- 版数：0.2」を「- 版数：0.3」。§0.5 変更履歴表の末尾に:
`| 0.3 | 2026-09-01 | 場のロック体系を再定義（枚数ロック新設、属性固定ロック新設、§10.1 属性ロックを属性統一ロックへ再定義）。§8.3 / §9.3 / §9.4 / §10.1 / §31.2 を改訂。M1-EX-10 のQAで発覚。 |`

- [ ] **Step 2: §8.3**

FIELD-005 の要件文を「更新後は更新後の組み合わせだけを次の比較対象とすること。」に変更。FIELD-005 行の下に FIELD-006 行を追加: `| FIELD-006 | アクティブセットが一度でも更新された場合、そのアクティブセットが場から流れるまで追加・拡張を認めず、更新直前と同じ枚数・同じ種別のより強い組み合わせによる更新だけを認めること（枚数ロック）。 | 確定 |`

- [ ] **Step 3: §9.3**

RANKSET-001 の要件文を「現在のアクティブセットが更新されていない場合に限り、現在と同じ数字のカードを1枚以上まとめて追加できること。」に変更。RANKSET-006 行の下に RANKSET-007 / RANKSET-008 を追加（spec §3 §9.3 の文言）。受入例の表に spec §2.1 / §2.2 の該当行を追記。

- [ ] **Step 4: §9.4**

SEQ-004 / SEQ-005 の各要件文の先頭に「現在のアクティブセットが更新されていない場合に限り、」を付す。SEQ-008 の下に SEQ-009 / SEQ-010 を追加（spec §3 §9.4）。受入例に spec §2.2 / §2.3 の該当行を追記。

- [ ] **Step 5: §10.1**

節タイトルを「### 10.1 属性ロック（属性統一ロック / 属性固定ロック）」に。LOCK-001〜005 を spec §3 §10.1 の文言へ書き換え、LOCK-006 を追加。受入例ブロックを spec §2.2 / §2.3 の内容へ差し替え。

- [ ] **Step 6: §31.2**

T-RULE-008 の行を「昼、同一属性の連番`炎3炎4炎5`をリード | 属性統一ロック発生」に。T-RULE-022 の下に T-RULE-023 / 024 / 025 を追加（spec §3 §31.2）。

- [ ] **Step 7: 確認**

`docs/product/独自カードゲーム_要件定義書_v0.2.md` を通読し、§8.3 / §9.3 / §9.4 / §10.1 / §31.2 / §0.5 が spec と一致し、他節（§13.1 効果処理順、付録B など）と矛盾しないことを確認。付録B「効果処理順」に「属性ロック判定」の語があれば「場のロック判定」に更新。

- [ ] **Step 8: Commit**

```bash
git add "docs/product/独自カードゲーム_要件定義書_v0.2.md"
git commit -m "docs(req): [M1-EX-04] revise field lock rules to v0.3"
git push origin main
```

---

## Task 6: サンドボックス モデルのロックエディタ

**Files:**
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxModel.ts` + `.test.ts`

**Interfaces:**
- Consumes: `@card-game-app/game-core` の `createActiveField`, `type FieldLock`, `type SuitCode`, `type RoundState`, `parseNumberCombination`。既存 `sandboxModel` の `cloneRound` / `mapPlayer` 等。
- Produces:
  - `setFieldCountLocked(round: RoundState, locked: boolean): RoundState` — `activeField` が null なら round。`activeField.lock.countLocked` を設定。
  - `setFieldSuitUniform(round: RoundState, uniform: boolean): RoundState` — 同上。
  - `setFieldSuitFixed(round: RoundState, suits: SuitCode[] | null): RoundState` — `suits` は与えられた順でソートして格納、空配列は `null` 扱い。

- [ ] **Step 1: 失敗テスト（`sandboxModel.test.ts` に追記）**

```ts
import {
  setFieldCountLocked,
  setFieldSuitFixed,
  setFieldSuitUniform,
} from "./sandboxModel";

test("field lock editors set the lock on an existing field only", () => {
  const noField = createInitialRound();
  assert.equal(setFieldCountLocked(noField, true), noField);

  let round = setFieldCards(
    createInitialRound(),
    [makeSandboxCard("RANK_6", "SUIT_FIRE")],
    "P2",
  );
  round = setFieldCountLocked(round, true);
  assert.equal(round.activeField?.lock.countLocked, true);
  round = setFieldSuitUniform(round, true);
  assert.equal(round.activeField?.lock.suitUniform, true);
  round = setFieldSuitFixed(round, ["SUIT_WATER", "SUIT_FIRE"]);
  assert.deepEqual(round.activeField?.lock.suitFixed, ["SUIT_FIRE", "SUIT_WATER"]);
  round = setFieldSuitFixed(round, []);
  assert.equal(round.activeField?.lock.suitFixed, null);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run mobile:test` → FAIL（未 export）

- [ ] **Step 3: 実装（`sandboxModel.ts` 末尾に追記）**

```ts
import { type FieldLock, type SuitCode } from "@card-game-app/game-core";

function mapFieldLock(
  round: RoundState,
  fn: (lock: FieldLock) => FieldLock,
): RoundState {
  if (!round.activeField) return round;
  const next = cloneRound(round);
  next.activeField = {
    combination: round.activeField.combination,
    lastPlayerId: round.activeField.lastPlayerId,
    lock: fn(round.activeField.lock),
  };
  return next;
}

export function setFieldCountLocked(
  round: RoundState,
  locked: boolean,
): RoundState {
  return mapFieldLock(round, (lock) => ({ ...lock, countLocked: locked }));
}

export function setFieldSuitUniform(
  round: RoundState,
  uniform: boolean,
): RoundState {
  return mapFieldLock(round, (lock) => ({ ...lock, suitUniform: uniform }));
}

export function setFieldSuitFixed(
  round: RoundState,
  suits: SuitCode[] | null,
): RoundState {
  const normalized = suits && suits.length > 0 ? [...suits].sort() : null;
  return mapFieldLock(round, (lock) => ({ ...lock, suitFixed: normalized }));
}
```

（`cloneRound` が `activeField` をどう複製しているか確認。`lock` も含めて複製されるよう必要なら `cloneRound` を調整。）

- [ ] **Step 4: 緑・型・lint・format**

Run: `npm run mobile:test` / `mobile:typecheck` / `mobile:lint` / `mobile:format:check` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/rule-sandbox/sandboxModel.ts apps/mobile/src/features/rule-sandbox/sandboxModel.test.ts
git commit -m "feat(mobile): [M1-EX-10] add field lock editors to the sandbox model"
git push origin main
```

---

## Task 7: サンドボックス ストア・プリセット・i18n

**Files:**
- Modify: `apps/mobile/src/state/rule-sandbox-store.ts` + `.test.ts`
- Modify: `apps/mobile/src/features/rule-sandbox/sandboxPresets.ts` + `.test.ts`
- Modify: `apps/mobile/src/i18n/translate.ts` + `.test.ts`

**Interfaces:**
- Consumes: Task 1/3 の `createActiveField`, `type FieldLock`, `UNLOCKED_FIELD`; Task 6 のエディタ; 既存 `buildPlayInput` 等。
- Produces:
  - `rule-sandbox-store.ts`: `FieldDraft` に `lock: FieldLock` を追加。`commitFieldDraft` は `createActiveField(combination, lastPlayerId, fieldDraft.lock)`。新アクション `setFieldDraftLock(patch: Partial<FieldLock>): void`。`loadPreset` は `preset.round.activeField?.lock ?? UNLOCKED_FIELD` からシード。
  - `sandboxPresets.ts`: `SANDBOX_PRESETS` に `count-locked-add-rejected` / `suit-fixed-mismatch` / `suit-uniform-update` を追加、`suit-lock` を差し替え。

- [ ] **Step 1: i18n キー追加（`translate.ts`）**

`sandbox.fieldLock.count`（例「枚数ロック」）、`sandbox.fieldLock.suitUniform`（「属性統一ロック」）、`sandbox.fieldLock.suitFixed`（「属性固定ロック」）を追加。プリセットキー `sandbox.preset.count-locked-add-rejected`（「更新後の単体追加は不正（枚数ロック）」）、`sandbox.preset.suit-fixed-mismatch`（「属性固定ロックと不一致な更新は不正」）、`sandbox.preset.suit-uniform-update`（「統一連番は別属性の統一連番で更新可」）を追加。`suit-lock` プリセットキー値を「同属性連番リードで属性統一ロック」へ更新。

`translate.test.ts` の必須キー配列に `sandbox.fieldLock.count` / `sandbox.preset.count-locked-add-rejected` / `sandbox.preset.suit-uniform-update` を追加。

- [ ] **Step 2: ストア（`rule-sandbox-store.ts`）**

`FieldDraft` 型に `lock: FieldLock` を追加。`initialFieldDraft` に `lock: { ...UNLOCKED_FIELD }`。`setFieldDraftLock(patch)` アクションを追加（`fieldDraft.lock` をマージ）。`commitFieldDraft` の `setFieldCards` 呼び出し後に、コミット成功時 `state.editRound((r) => setFieldSuitFixed(setFieldSuitUniform(setFieldCountLocked(r, fieldDraft.lock.countLocked), fieldDraft.lock.suitUniform), fieldDraft.lock.suitFixed))` 相当でロックも反映（または `createActiveField` に直接 `lock` を渡す形へ `setFieldCards` を拡張—Task 6 の `setFieldCards` シグネチャに `lock?: Partial<FieldLock>` を足すのが簡潔）。`loadPreset` は `preset.round.activeField?.lock` を `fieldDraft.lock` へシード。`reset` は `initialFieldDraft`。

`rule-sandbox-store.test.ts`: `loadPreset` 後に `fieldDraft.lock` がプリセットのロックを反映すること、`setFieldDraftLock` → `commitFieldDraft` で `draft.activeField.lock` に載ること、をテスト。

- [ ] **Step 3: プリセット（`sandboxPresets.ts`）**

`field()` ヘルパーを `createActiveField(combination, lastPlayerId, lock)`（第3引数 `Partial<FieldLock>` 省略可）に。`suit-lock` を「P2 が `炎3炎4炎5` を過去にリード（`activeField` = 炎連番、`lock.suitUniform = true`）→ P1 が `水3水4水5` で更新 → 合法」へ書き換え、`play` を水連番更新に。新規3プリセット:
- `count-locked-add-rejected`: `activeField` = `炎8水8`（`lock.countLocked = true`）、`play` = 単体 `炎9` 追加 → 期待 `ok:false, reason "COUNT_LOCKED"`。
- `suit-fixed-mismatch`: `activeField` = `炎8`（`lock = { countLocked:true, suitFixed:["SUIT_FIRE"], suitUniform:false }`）、`play` = `水9` 更新 → 期待 `ok:false, reason "SUIT_FIXED_MISMATCH"`。
- `suit-uniform-update`: `activeField` = `炎3炎4炎5`（`lock.suitUniform = true`）、`play` = `水4水5水6` 更新 → 期待 `ok:true, actionKind "REPLACE"`。

`sandboxPresets.test.ts`: プリセット総数の assert を更新（10 → 13）。新規3件の名前引き当てテストで `resolvePlay` 結果が期待どおりであることを assert。既存の「every preset resolves to the outcome encoded in its id」ループに3件分の期待を追加。

- [ ] **Step 4: 緑・型・lint・format**

Run: `npm run mobile:test` / `mobile:typecheck` / `mobile:lint` / `mobile:format:check` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/state apps/mobile/src/features/rule-sandbox apps/mobile/src/i18n
git commit -m "feat(mobile): [M1-EX-10] field lock in the sandbox store, presets, and i18n"
git push origin main
```

---

## Task 8: サンドボックス画面 と 最終検証・進捗ドキュメント

**Files:**
- Modify: `apps/mobile/src/app/sandbox/index.tsx`
- Create: `docs/progress/M1-EX-04-fieldlock-revision.md`

**Interfaces:**
- Consumes: Task 6/7 のエディタ・ストア。`@card-game-app/game-core` の `SUIT_CODES`。

- [ ] **Step 1: 画面に3ロックコントロールを追加**

`sandbox/index.tsx` の場エディタ領域（`draft.activeField` が存在するブロック）に、Task 3 で削除した「属性ロック」行の代わりに:
- 「枚数ロック」トグル（`Pressable` `accessibilityRole="switch"` `accessibilityState={{ checked: draft.activeField.lock.countLocked }}`）→ `state.editRound((r) => setFieldCountLocked(r, !r.activeField!.lock.countLocked))`
- 「属性統一ロック」トグル → `setFieldSuitUniform`
- 「属性固定ロック」: 火/水/風/土 の複数選択チップ（選択中 = `draft.activeField.lock.suitFixed?.includes(suit)`）→ タップで `setFieldSuitFixed` に追加/除去した配列を渡す。空なら `null`。
すべて `translate('sandbox.fieldLock.*')` と `translate('sandbox.suit.*')` を使用。ハードコード日本語なし。

結果パネルの理由表示は既存の `translate(lastResult.reasonKey)` 経由で新 reason キーが自動的に表示される（追加変更不要）。

- [ ] **Step 2: 全検証**

Run: `npm run mobile:test` → PASS
Run: `npm run mobile:typecheck` / `mobile:lint` / `mobile:format:check` → PASS
Run: `npm run game-core:test` / `game-core:typecheck` → PASS（回帰なし）
Run: `npm run ui:typecheck` → PASS
Run: `cd apps/mobile && npx expo export --platform android --output-dir dist` → 成功（`dist/` はコミットしない）
Run: `git diff --check` → クリーン

- [ ] **Step 3: 進捗ドキュメント `docs/progress/M1-EX-04-fieldlock-revision.md`**

```markdown
# M1-EX-04 場のロック体系 改訂 進捗

- 関連TODO: M1-EX-04（ルール訂正）/ M1-EX-10（サンドボックス反映）
- 状態: 完了
- 日付: 2026-09-01
- 仕様: docs/superpowers/specs/2026-09-01-field-state-lock-system-design.md

## 概要

M1-EX-10 実機確認で発覚したルール食い違いを受け、アクティブセットの更新・追加可否と属性制限を、枚数ロック / 属性固定ロック / 属性統一ロックの3種へ再定義。旧 §10.1 属性ロック（`RoundState.lockedSuitCode` / `detectSuitLock` / `SUIT_LOCKED`）を廃止し、`ActiveField.lock: FieldLock` ＋ `deriveFieldLock` ＋ `evaluateNumberPlay` のロック判定に置き換え。将来のルールトグル用に `RulesetOptions`（M1 は `RULESET_INITIAL` 固定）の継ぎ目を用意。

## 成果物

| 種別 | パス |
| --- | --- |
| ルール実装 | `packages/game-core/src/index.ts` |
| ロック導出テスト | `packages/game-core/src/fieldLock.test.ts` |
| 受入テスト | `packages/game-core/src/ruleAcceptance.test.ts`（T-RULE-008 改訂、023/024/025 追加） |
| 要件 | `docs/product/独自カードゲーム_要件定義書_v0.2.md`（v0.3） |
| チェックリスト | `docs/qa/M1-QA-03-rule-verification-checklist.md`（グループ D 差し替え） |
| サンドボックス | `apps/mobile/src/features/rule-sandbox/*`, `apps/mobile/src/state/rule-sandbox-store.ts`, `apps/mobile/src/app/sandbox/index.tsx` |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run game-core:test` / `:typecheck` | PASS |
| `npm run mobile:test` / `:typecheck` / `:lint` / `:format:check` | PASS |
| `npm run ui:typecheck` | PASS |
| `npx expo export --platform android` | PASS |
| `git diff --check` | 問題なし |

## メモ

- 自然革命 REV-002 は初回更新後は追加不可のため発生し得ない（初回更新前は従来どおり）。ルール変更ではなく帰結。
- 追加封印（SEAL-*）はスキル効果として現状維持。
- ルールトグルの UI・永続化は将来の別スペック。
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/sandbox/index.tsx docs/progress/M1-EX-04-fieldlock-revision.md
git commit -m "feat(mobile): [M1-EX-10] show the three field locks in the sandbox screen"
git push origin main
```

---

## Self-Review

**1. Spec coverage:**

| spec 節 | 対応タスク |
|---|---|
| §2.1 枚数ロック | Task 2（deriveFieldLock REPLACE→countLocked）、Task 3（evaluateNumberPlay COUNT_LOCKED）、Task 4（T-RULE-023） |
| §2.2 属性固定ロック | Task 2（REPLACE→suitFixed 一致/不一致/保持）、Task 3（SUIT_FIXED_MISMATCH）、Task 4（T-RULE-024） |
| §2.3 属性統一ロック | Task 2（LEAD→suitUniform）、Task 3（SUIT_UNIFORM_REQUIRED、extend/replace 両方）、Task 4（T-RULE-008/025） |
| §2.4 相互関係 | Task 2 のテスト（3ロック同時）、Task 3 のテスト |
| §2.5 帰結（REV-002） | Task 8 progress doc に明記。コード変更不要（追加不可の自然な帰結） |
| §3 要件定義書改訂 | Task 5 |
| §4.1 型 | Task 1 |
| §4.2 RulesetOptions 継ぎ目 | Task 1（型）、Task 2（deriveFieldLock で消費）、Task 3（evaluateNumberPlay で消費） |
| §4.3 deriveFieldLock | Task 2 |
| §4.4 evaluateNumberPlay 改修 | Task 3 |
| §4.5 削除 | Task 3 Step 1 |
| §4.6 新 IllegalPlayReason | Task 3 Step 1 |
| §4.7 補助関数 | Task 1 |
| §5 resolvePlay 統合 | Task 3 Step 3 |
| §6 テスト戦略 | Task 2/3/4 |
| §7 サンドボックス | Task 1 Step 4、Task 3 Step 6、Task 6、Task 7、Task 8 |
| §8 QA-03 | Task 4 Step 3 |
| §9 影響ファイル | 本プラン File Structure |
| §10 スコープ外 | 対応不要（明記のみ） |

ギャップなし。

**2. Placeholder scan:** コード手順は実コードを含む。Task 5（要件定義書編集）と Task 1 Step 3/4（typecheck 駆動の掃除）は「エラー箇所を全部直す」という機械的指示で、対象ファイルと変換パターンを明示済み。「similar to Task N」なし。`<実施日>` は Task 8 progress doc に日付直書き済み（2026-09-01）。

**3. Type consistency:**
- `FieldLock` の3フィールド名（`countLocked` / `suitFixed` / `suitUniform`）は Task 1 定義、Task 2/3/6/7/8 で一致。
- `deriveFieldLock` の入力キー（`previous` / `actionKind` / `playedCombination` / `resultingCombination` / `ruleset`）は Task 2 定義、Task 3 Step 3 の呼び出しと一致。
- `evaluateNumberPlay` の新入力キー（`fieldLock` / `ruleset`）は Task 3 定義、テストの呼び出しと一致。
- `createActiveField(combination, lastPlayerId, lock?)` の引数順は Task 1 定義、Task 3/6/7 で一致。
- `RULESET_INITIAL` / `UNLOCKED_FIELD` の名前は Task 1 定義、以降一致。
- `IllegalPlayReason` の新3コード（`COUNT_LOCKED` / `SUIT_FIXED_MISMATCH` / `SUIT_UNIFORM_REQUIRED`）は Task 3 定義、Task 3 Step 6 の i18n / `REASON_CODES` と一致。
- サンドボックスエディタ名（`setFieldCountLocked` / `setFieldSuitUniform` / `setFieldSuitFixed`）は Task 6 定義、Task 7/8 で一致。

---

## Execution Handoff

（writing-plans スキルのハンドオフはプラン提示後）
