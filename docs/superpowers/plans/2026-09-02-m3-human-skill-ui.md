# M3 サブプロジェクト3: 人間のスキル使用UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CPU戦の対局画面で人間プレイヤーが保有スキル（勇者/聖女Joker・追加封印・革命）を合法に使用でき、選択が不成立のとき理由と出せる手数を表示する（M3-EX-01/02/07）。

**Architecture:** `enumerateLegalPlays(round, { includeSkills: true })`（実装済み）を人間の合法手の唯一の真実とし、選択札がどの `LegalPlay` に一致するかで提出ボタンを出す。変化Jokerの宣言（数字1〜9 × 属性1種）だけは列挙できないので専用パネル。純ロジックは新モジュール `skillPlayOptions.ts` と `boardViewModel` 拡張に集約し、`play.tsx` は薄い画面のまま。着手前に `game-core` の `resolveCardPlay` に `jokerDeclarations` 検証を追加する。

**Tech Stack:** TypeScript、`packages/game-core`（ゼロ依存、`node:test` + `tsx`）、`apps/mobile`（Expo、`zustand/vanilla`、`.test.ts` のみ）。

## Global Constraints

- `game-core` はゼロ依存の純 TypeScript。ソース import は `.ts` 指定子。`npm run game-core:test` / `npm run game-core:typecheck`。
- モバイルのテストは `.test.ts` のみ（`tsx --test`、react-test-renderer なし）。`npm run mobile:test` / `npm --prefix apps/mobile run typecheck` / `npm --prefix apps/mobile run lint`。
- 純ロジックモジュール（`apps/mobile/src/features/cpu-game/*.ts`）は `fetch` / `AsyncStorage` / `Date` / `Math.random` を直接 import しない。
- 表示名・日本語文言を内部IDや対局状態へ保存しない。表示は `translate()` 経由の言語リソースキー。
- `apps/mobile/src/app/cpu-game/play.tsx` は薄い画面に保つ。合法性判定・ゲームロジックを画面に書かない。
- スキル使用も含め、すべての人間入力は `humanPlay`（= `resolvePlay`）と `assertCardConservation` を通す。不正時は state を変えず理由を返す。
- 決定論：同じ `DriverState` に対する `legalPlaysForHuman` / `buildBoardViewModel` の出力は決定的。
- 1手番で人間が使えるJokerは1枚（JOKER-003）。各プレイヤーのスキルは最大1枚。
- 参照 spec：`docs/superpowers/specs/2026-09-02-m3-human-skill-ui-design.md`。

---

### Task 1: game-core `resolveCardPlay` の jokerDeclarations 検証

**Files:**
- Modify: `packages/game-core/src/core.ts`（`PlayRejectionReason` 型、`resolveCardPlay` 関数）
- Modify: `packages/game-core/src/resolvePlay.test.ts`（既存テスト1件を書き直し + 新規ケース）
- Modify: `packages/game-core/src/legalMoves.test.ts`（列挙器が検証を通ることの明示アサート追加）
- Modify: `apps/mobile/src/i18n/translate.ts`（新 reason キー）
- Modify: `apps/mobile/src/i18n/translate.test.ts`（`REASON_CODES` に追加）

**Interfaces:**
- Consumes: 既存 `resolveCardPlay(state, player, play)`、`PlayInput`（`jokerDeclarations?: JokerDeclaration[]`、`JokerDeclaration = { skillId; rankCode; suitCode }`）、`player.skill: SkillCard | null`（`SkillCard.skillId`）。
- Produces: 新 `PlayRejectionReason` メンバー `"INVALID_JOKER_DECLARATION"`。`resolveCardPlay` は `useSkill === "JOKER_TRANSFORM"` のとき宣言がちょうど1つで `skillId` が保有スキルと一致することを要求し、それ以外の `useSkill` では宣言非空を拒否する。

- [ ] **Step 1: 失敗するテストを書く（game-core）**

`packages/game-core/src/resolvePlay.test.ts` の既存テスト `"resolvePlay resolves a transform Joker play and records natural revolution + lock"`（現在 `jokerDeclarations` を2つ渡している）を、1宣言・4枚連番・自然革命を検証する形に**書き直す**：

```ts
test("resolvePlay resolves a transform Joker play and records natural revolution + lock", () => {
  const state = round({
    players: [
      skilled(
        "P1",
        [c(3, "FIRE"), c(4, "FIRE"), c(5, "FIRE"), c(9, "WATER")],
        "SKILL_JOKER_HERO",
      ),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE", "N_5_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [{ skillId: "SK_P1", rankCode: "RANK_6", suitCode: "SUIT_FIRE" }],
  });
  assert.ok(result.ok);
  assert.equal(result.state.activeField?.lock.suitUniform, true);
  assert.equal(result.state.dayNight, "NIGHT");
  assert.equal(result.outcome.naturalRevolution, true);
});
```

（`c(9, "WATER")` を1枚残すのは、実カード0枚残り＝変化Joker上がり禁止（`TRANSFORM_JOKER_GO_OUT`）を避けるため。この局面のポイントは「4枚連番による自然革命＋属性統一ロック」の検証。）

Then add new tests at the end of the same file (the `skilled` and `round` helpers already exist there):

```ts
test("resolvePlay rejects JOKER_TRANSFORM with zero declarations", () => {
  const state = round({
    players: [
      skilled("P1", [c(3, "FIRE"), c(4, "FIRE")], "SKILL_JOKER_HERO"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const snapshot = structuredClone(state);
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
  assert.deepEqual(state, snapshot);
});

test("resolvePlay rejects JOKER_TRANSFORM with two declarations", () => {
  const state = round({
    players: [
      skilled("P1", [c(3, "FIRE"), c(4, "FIRE")], "SKILL_JOKER_HERO"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [
      { skillId: "SK_P1", rankCode: "RANK_5", suitCode: "SUIT_FIRE" },
      { skillId: "SK_P1", rankCode: "RANK_6", suitCode: "SUIT_FIRE" },
    ],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
});

test("resolvePlay rejects JOKER_TRANSFORM whose declaration skillId is not the held skill", () => {
  const state = round({
    players: [
      skilled("P1", [c(3, "FIRE"), c(4, "FIRE")], "SKILL_JOKER_HERO"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_3_FIRE", "N_4_FIRE"],
    useSkill: "JOKER_TRANSFORM",
    jokerDeclarations: [{ skillId: "SOMETHING_ELSE", rankCode: "RANK_5", suitCode: "SUIT_FIRE" }],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
});

test("resolvePlay rejects a non-transform skill play that carries jokerDeclarations", () => {
  const state = round({
    players: [
      skilled("P1", [c(6, "WATER"), c(3)], "SKILL_EXTENSION_SEAL"),
      createPlayerState("P2", [c(7)]),
    ],
    activePlayerId: "P1",
    activeField: null,
  });
  const result = resolvePlay(state, {
    kind: "PLAY",
    playerId: "P1",
    cardIds: ["N_6_WATER"],
    useSkill: "EXTENSION_SEAL",
    jokerDeclarations: [{ skillId: "SK_P1", rankCode: "RANK_5", suitCode: "SUIT_FIRE" }],
  });
  assert.equal(result.ok === false && result.reason, "INVALID_JOKER_DECLARATION");
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm run game-core:test`
Expected: 新規テスト4件（`... rejects JOKER_TRANSFORM with zero declarations` 他）が FAIL — 現状 `INVALID_JOKER_DECLARATION` は返らない。書き直した既存テスト（`... records natural revolution + lock`）は 3-4-5-6 の4枚連番リードなので `naturalRevolution` / `suitUniform` / `NIGHT` の assertion は通り、この時点で PASS してよい（回帰確認用）。

- [ ] **Step 3: `PlayRejectionReason` にメンバーを追加する**

`packages/game-core/src/core.ts` の型定義（`export type PlayRejectionReason =` のユニオン）に1行追加：

```ts
export type PlayRejectionReason =
  | IllegalPlayReason
  | "ROUND_FINISHED"
  | "NOT_ACTIVE_PLAYER"
  | "CARD_NOT_IN_HAND"
  | "SKILL_NOT_AVAILABLE"
  | "FIELD_EMPTY"
  | "MUST_LEAD"
  | "NO_FIELD_TO_CLEAR"
  | "TRANSFORM_JOKER_GO_OUT"
  | "INVALID_JOKER_DECLARATION";
```

- [ ] **Step 4: `resolveCardPlay` に検証ブロックを追加する**

`packages/game-core/src/core.ts` の `resolveCardPlay` 内、`if (play.useSkill) { ... skillMatches ... }` ブロックの**直後**（`const isJokerClear = play.useSkill === "JOKER_CLEAR";` の直前）に挿入：

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

- [ ] **Step 5: game-core テストが通ることを確認する**

Run: `npm run game-core:test`
Expected: 全 PASS（新規4件 + 書き直し1件 + 既存すべて）。特に `legalMoves.test.ts` の `"includeSkills: JOKER_TRANSFORM plays are enumerated but never a go-out"` 等（`for (const p of transforms) assert.equal(resolvePlay(state, p.input).ok, true)`）が通ること = 列挙器の出力が検証を通ることの回帰ガード。

Run: `npm run game-core:typecheck`
Expected: PASS

- [ ] **Step 6: `legalMoves.test.ts` に明示アサートを追加する**

`packages/game-core/src/legalMoves.test.ts` の末尾に追加：

```ts
test("includeSkills: every enumerated JOKER_TRANSFORM play has exactly one declaration matching the held skill", () => {
  const state = skillRound({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_JOKER_HERO" },
    activeSeatHand: [n(3, "FIRE"), n(4, "FIRE"), n(5, "FIRE")],
  });
  const transforms = enumerateLegalPlays(state, { includeSkills: true }).filter(
    (p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_TRANSFORM",
  );
  assert.ok(transforms.length > 0);
  for (const p of transforms) {
    assert.ok(p.input.kind === "PLAY");
    assert.equal(p.input.jokerDeclarations?.length, 1);
    assert.equal(p.input.jokerDeclarations?.[0].skillId, "SK1");
    assert.equal(resolvePlay(state, p.input).ok, true);
  }
});
```

Run: `npm run game-core:test`
Expected: PASS

- [ ] **Step 7: i18n の reason キーを追加する**

`apps/mobile/src/i18n/translate.ts` の `sandbox.reason.TRANSFORM_JOKER_GO_OUT` の行の直後に追加：

```ts
  'sandbox.reason.INVALID_JOKER_DECLARATION': 'Joker宣言が不正です',
```

`apps/mobile/src/i18n/translate.test.ts` の `REASON_CODES` オブジェクトに追加（`TRANSFORM_JOKER_GO_OUT: true,` の直後）：

```ts
  INVALID_JOKER_DECLARATION: true,
```

- [ ] **Step 8: モバイルのテストと型が通ることを確認する**

Run: `npm run mobile:test`
Expected: PASS（`translate.test.ts` の `satisfies Record<PlayRejectionReason, true>` が型的に満たされ、reason キー網羅テストが通る）

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS

- [ ] **Step 9: コミット**

```bash
git add packages/game-core/src/core.ts packages/game-core/src/resolvePlay.test.ts packages/game-core/src/legalMoves.test.ts apps/mobile/src/i18n/translate.ts apps/mobile/src/i18n/translate.test.ts
git commit -m "feat(game-core): [M3-EX-01] validate jokerDeclarations in resolveCardPlay"
```

---

### Task 2: `legalPlaysForHuman` にスキル手を含める

**Files:**
- Modify: `apps/mobile/src/features/cpu-game/turnDriver.ts`（`legalPlaysForHuman` 関数のみ）
- Modify: `apps/mobile/src/features/cpu-game/turnDriver.test.ts`（テスト追加）

**Interfaces:**
- Consumes: `enumerateLegalPlays(state.round, { includeSkills: true })`（実装済み）。
- Produces: `legalPlaysForHuman(state)` が人間手番のとき数字手 + PASS + スキル手をすべて返す（`enumerateLegalPlays({ includeSkills: true })` そのまま）。非人間手番では従来どおり `[]`。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/cpu-game/turnDriver.test.ts` の末尾に追加：

```ts
test('legalPlaysForHuman includes skill plays when the human seat holds an unused skill', () => {
  // seat-0 (human) が未使用スキルを持つ最初の seed を線形探索する。
  let found: DriverState | null = null;
  for (let seed = 0; seed < 200 && !found; seed += 1) {
    for (const n of [2, 3, 4, 5, 6]) {
      const g = start(n, seed);
      const human = g.round.players.find((p) => p.playerId === 'seat-0');
      if (human?.skill && !human.skill.used && g.phase === 'HUMAN_TURN') {
        found = g;
        break;
      }
    }
  }
  assert.ok(found, 'expected a seed where the human seat holds a skill on its own turn');
  const plays = legalPlaysForHuman(found);
  assert.ok(
    plays.some((p) => p.input.kind === 'PLAY' && p.input.useSkill !== undefined),
    'expected at least one skill play in the human legal plays',
  );
});

test('legalPlaysForHuman is empty on a non-human turn even with includeSkills', () => {
  let s = start(3, 99);
  while (isHumanTurn(s)) {
    const res = humanPlay(s, legalPlaysForHuman(s)[0].input);
    if (!res.ok) throw new Error(res.reason);
    s = res.next;
  }
  assert.equal(s.phase, 'CPU_PENDING');
  assert.deepEqual(legalPlaysForHuman(s), []);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/turnDriver.test.ts`
Expected: `legalPlaysForHuman includes skill plays ...` が FAIL（現状は数字手のみ）

- [ ] **Step 3: `legalPlaysForHuman` を変更する**

`apps/mobile/src/features/cpu-game/turnDriver.ts` の `legalPlaysForHuman`：

```ts
export function legalPlaysForHuman(state: DriverState): LegalPlay[] {
  return state.phase === 'HUMAN_TURN'
    ? enumerateLegalPlays(state.round, { includeSkills: true })
    : [];
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/turnDriver.test.ts`
Expected: PASS（新規2件 + 既存すべて）

- [ ] **Step 5: モバイル全テストに回帰がないことを確認する**

Run: `npm run mobile:test`
Expected: PASS（`handSelection.test.ts` / `boardViewModel.test.ts` / `cpuGameStore.test.ts` は subset 判定なのでスキル手が増えても成立。もし FAIL したら、そのテストが「最初の合法手」に依存していて順序が変わった場合 — sortLegalPlays はスキル手を同キーの素の手の後ろに置くので単体・少枚数の素の手が先頭を保つ。FAIL 時は当該テストを調査し、スキル手混在に対応した固定に直す）

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add apps/mobile/src/features/cpu-game/turnDriver.ts apps/mobile/src/features/cpu-game/turnDriver.test.ts
git commit -m "feat(mobile): [M3-EX-01] legalPlaysForHuman includes skill plays"
```

---

### Task 3: `handSelection.canSubmitPlain`

**Files:**
- Modify: `apps/mobile/src/features/cpu-game/handSelection.ts`（関数追加のみ）
- Modify: `apps/mobile/src/features/cpu-game/handSelection.test.ts`（テスト追加）

**Interfaces:**
- Consumes: `LegalPlay[]`（`enumerateLegalPlays({ includeSkills: true })` 由来、`input.useSkill?: PlaySkillUse` を持つ）、`HandSelection = string[]`。
- Produces: `canSubmitPlain(selection: HandSelection, legalPlays: LegalPlay[]): boolean` — 選択が `useSkill === undefined` の PLAY 手の cardIds と集合一致するとき true。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/cpu-game/handSelection.test.ts` の import に `canSubmitPlain` を追加し、末尾に追加：

```ts
test('canSubmitPlain: true only for an exact match against a non-skill play', () => {
  const noSkill: LegalPlay[] = [
    {
      input: { kind: 'PLAY', playerId: 'seat-0', cardIds: ['a', 'b'] },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
  ];
  assert.equal(canSubmitPlain(['a', 'b'], noSkill), true);
  assert.equal(canSubmitPlain(['a'], noSkill), false);
  assert.equal(canSubmitPlain([], noSkill), false);
});

test('canSubmitPlain: ignores skill plays even on an exact cardIds match', () => {
  const skillOnly: LegalPlay[] = [
    {
      input: { kind: 'PLAY', playerId: 'seat-0', cardIds: ['a'], useSkill: 'EXTENSION_SEAL' },
      actionKind: 'LEAD',
      resultingCombination: null,
      goesOut: false,
    },
  ];
  assert.equal(canSubmitPlain(['a'], skillOnly), false);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/handSelection.test.ts`
Expected: FAIL（`canSubmitPlain` 未定義）

- [ ] **Step 3: `canSubmitPlain` を実装する**

`apps/mobile/src/features/cpu-game/handSelection.ts` の `canSubmit` の直後に追加：

```ts
export function canSubmitPlain(selection: HandSelection, legalPlays: LegalPlay[]): boolean {
  if (selection.length === 0) return false;
  const sel = new Set(selection);
  return legalPlays.some((p) => {
    if (p.input.kind !== 'PLAY' || p.input.useSkill !== undefined) return false;
    const ids = p.input.cardIds;
    return ids.length === sel.size && ids.every((id) => sel.has(id));
  });
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/handSelection.test.ts`
Expected: PASS（新規2件 + 既存すべて）

- [ ] **Step 5: コミット**

```bash
git add apps/mobile/src/features/cpu-game/handSelection.ts apps/mobile/src/features/cpu-game/handSelection.test.ts
git commit -m "feat(mobile): [M3-EX-02] add canSubmitPlain helper"
```

---

### Task 4: `skillPlayOptions.ts`（新規・純関数）

**Files:**
- Create: `apps/mobile/src/features/cpu-game/skillPlayOptions.ts`
- Create: `apps/mobile/src/features/cpu-game/skillPlayOptions.test.ts`

**Interfaces:**
- Consumes: `@card-game-app/game-core` の `resolvePlay` / `rankStrength` / 型 `DayNight` / `LegalPlay` / `PlayInput` / `RankCode` / `SuitCode` / `SkillEffectCode`。`./turnDriver` の `DriverState`。`./handSelection` の `HandSelection`。
- Produces:
  - `heldSkillEffect(state: DriverState): SkillEffectCode | null`
  - `submitOptionsForSelection(legalPlays: LegalPlay[], selection: HandSelection): SkillSubmitOption[]`（`SkillSubmitOption = { useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION'; input: PlayInput }`）
  - `resolveJokerTransform(state, selection, draft: JokerDeclarationDraft): JokerTransformResolution`（`JokerDeclarationDraft = { rankCode: RankCode | null; suitCode: SuitCode | null }`、`JokerTransformResolution` は下記4状態）
  - `revolutionPreview(state: DriverState): { dayNightAfter: DayNight; strengthOrderAfter: number[] }`
  - `legalMoveCount(legalPlays: LegalPlay[]): number`（distinct な素の数字手の数）
  - `selectionRejectionReasonKey(state, selection, legalPlays): string | null`

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/cpu-game/skillPlayOptions.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchConfig } from './matchConfig';
import { initGame, isHumanTurn, cpuStep, type DriverState } from './turnDriver';
import {
  heldSkillEffect,
  submitOptionsForSelection,
  resolveJokerTransform,
  revolutionPreview,
  legalMoveCount,
  selectionRejectionReasonKey,
} from './skillPlayOptions';
import { enumerateLegalPlays, type LegalPlay } from '@card-game-app/game-core';

/** seat-0 (human) が指定 effectCode を未使用で持ち、かつ人間手番の局面を線形探索する。
 *  requireField: true なら場あり、false なら場なしの人間手番のみ採用。 */
function findHumanSkillState(
  effectCode: string,
  requireField = false,
): DriverState {
  for (let seed = 0; seed < 400; seed += 1) {
    for (const n of [2, 3, 4, 5, 6]) {
      let g = initGame({ config: buildMatchConfig(n), seed });
      const human = g.round.players.find((p) => p.playerId === 'seat-0');
      if (!(human?.skill && !human.skill.used && human.skill.effectCode === effectCode)) continue;
      let guard = 0;
      while (g.phase === 'CPU_PENDING' && guard < 200) {
        g = cpuStep(g).next;
        guard += 1;
      }
      if (g.phase !== 'HUMAN_TURN') continue;
      const hasField = g.round.activeField != null;
      if (requireField !== hasField) continue;
      return g;
    }
  }
  throw new Error(`no state found for human skill ${effectCode} (requireField=${requireField})`);
}

test('heldSkillEffect returns the human seat unused skill effect or null', () => {
  const g = findHumanSkillState('SKILL_REVOLUTION');
  assert.equal(heldSkillEffect(g), 'SKILL_REVOLUTION');
});

test('revolutionPreview flips day/night and reverses the strength order', () => {
  const g = findHumanSkillState('SKILL_REVOLUTION');
  const pv = revolutionPreview(g);
  assert.equal(pv.dayNightAfter, g.round.dayNight === 'DAY' ? 'NIGHT' : 'DAY');
  const expected =
    pv.dayNightAfter === 'DAY' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [9, 8, 7, 6, 5, 4, 3, 2, 1];
  assert.deepEqual(pv.strengthOrderAfter, expected);
});

test('legalMoveCount counts distinct plain number plays only', () => {
  const legal: LegalPlay[] = [
    { input: { kind: 'PLAY', playerId: 's', cardIds: ['a'] }, actionKind: 'LEAD', resultingCombination: null, goesOut: false },
    { input: { kind: 'PLAY', playerId: 's', cardIds: ['a'], useSkill: 'REVOLUTION' }, actionKind: 'LEAD', resultingCombination: null, goesOut: false },
    { input: { kind: 'PLAY', playerId: 's', cardIds: ['b', 'c'] }, actionKind: 'LEAD', resultingCombination: null, goesOut: false },
    { input: { kind: 'PASS', playerId: 's' }, actionKind: 'PASS', resultingCombination: null, goesOut: false },
  ];
  assert.equal(legalMoveCount(legal), 2);
});

test('submitOptionsForSelection returns one option per matching skill variant', () => {
  const g = findHumanSkillState('SKILL_EXTENSION_SEAL');
  const legal = enumerateLegalPlays(g.round, { includeSkills: true });
  // 封印手が存在する最初の選択札を採用
  const sealPlay = legal.find(
    (p) => p.input.kind === 'PLAY' && p.input.useSkill === 'EXTENSION_SEAL',
  );
  assert.ok(sealPlay && sealPlay.input.kind === 'PLAY');
  const opts = submitOptionsForSelection(legal, sealPlay.input.cardIds);
  assert.ok(opts.some((o) => o.useSkill === 'EXTENSION_SEAL'));
  for (const o of opts) {
    assert.ok(['JOKER_CLEAR', 'EXTENSION_SEAL', 'REVOLUTION'].includes(o.useSkill));
    assert.equal(o.input.kind, 'PLAY');
  }
});

test('resolveJokerTransform: incomplete when the declaration is missing', () => {
  const g = findHumanSkillState('SKILL_JOKER_HERO');
  const r = resolveJokerTransform(g, [], { rankCode: null, suitCode: null });
  assert.equal(r.status, 'incomplete');
});

test('resolveJokerTransform: ok for a legal single transform lead on an empty field', () => {
  const g = findHumanSkillState('SKILL_JOKER_HERO');
  assert.equal(g.round.activeField, null);
  // 手札に無い rank/suit を宣言して単体リード（重複回避のため手札の最初のカードと違う識別子を選ぶ）
  const human = g.round.players.find((p) => p.playerId === 'seat-0')!;
  const used = new Set(human.hand.map((c) => `${c.rankCode}:${c.suitCode}`));
  let decl: { rankCode: string; suitCode: string } | null = null;
  for (const r of ['RANK_1', 'RANK_2', 'RANK_3', 'RANK_4', 'RANK_5', 'RANK_6', 'RANK_7', 'RANK_8', 'RANK_9']) {
    for (const s of ['SUIT_FIRE', 'SUIT_WATER', 'SUIT_WIND', 'SUIT_EARTH']) {
      if (!used.has(`${r}:${s}`)) { decl = { rankCode: r, suitCode: s }; break; }
    }
    if (decl) break;
  }
  assert.ok(decl);
  const r = resolveJokerTransform(g, [], decl as never);
  assert.equal(r.status, 'ok');
  assert.equal(r.status === 'ok' && r.input.kind, 'PLAY');
  assert.equal(
    r.status === 'ok' && r.input.kind === 'PLAY' && r.input.useSkill,
    'JOKER_TRANSFORM',
  );
});

test('resolveJokerTransform: forbidden-go-out when the transform would empty the hand', () => {
  // 手札1枚 + 変化Joker宣言 → 上がりになる seed を探す
  let done = false;
  for (let seed = 0; seed < 400 && !done; seed += 1) {
    for (const n of [2, 3, 4, 5, 6]) {
      let g = initGame({ config: buildMatchConfig(n), seed });
      const human = g.round.players.find((p) => p.playerId === 'seat-0');
      if (!(human?.skill && !human.skill.used && (human.skill.effectCode === 'SKILL_JOKER_HERO' || human.skill.effectCode === 'SKILL_JOKER_SAINT'))) continue;
      let guard = 0;
      while (g.phase === 'CPU_PENDING' && guard < 200) { g = cpuStep(g).next; guard += 1; }
      if (g.phase !== 'HUMAN_TURN') continue;
      const h = g.round.players.find((p) => p.playerId === 'seat-0')!;
      if (h.hand.length !== 1) continue;
      const only = h.hand[0];
      // 宣言で only と重複しない別 rank を選び、単体 lead を試みる → go-out になる
      const declRank = only.rankCode === 'RANK_1' ? 'RANK_2' : 'RANK_1';
      const r = resolveJokerTransform(g, [only.cardId], {
        rankCode: declRank as never,
        suitCode: only.suitCode as never,
      });
      // 場が空で単体2枚(実+宣言)のリード → 実カード0枚残り = go-out 禁止
      if (r.status === 'forbidden-go-out') { done = true; break; }
    }
  }
  assert.ok(done, 'expected to construct a forbidden transform go-out');
});

test('selectionRejectionReasonKey: null for an empty selection and for a legal selection', () => {
  const g = findHumanSkillState('SKILL_REVOLUTION');
  const legal = enumerateLegalPlays(g.round, { includeSkills: true });
  assert.equal(selectionRejectionReasonKey(g, [], legal), null);
  const somePlain = legal.find((p) => p.input.kind === 'PLAY' && p.input.useSkill === undefined);
  assert.ok(somePlain && somePlain.input.kind === 'PLAY');
  assert.equal(selectionRejectionReasonKey(g, somePlain.input.cardIds, legal), null);
});

test('selectionRejectionReasonKey: a sandbox.reason.* key for an illegal selection', () => {
  // 場ありの局面で、場より弱い/形の違う2枚を選んで理由を得る
  const g = findHumanSkillState('SKILL_REVOLUTION', true);
  const human = g.round.players.find((p) => p.playerId === 'seat-0')!;
  // 適当に2枚（形が場と一致しない可能性が高い）
  if (human.hand.length >= 2) {
    const sel = [human.hand[0].cardId, human.hand[1].cardId];
    const legal = enumerateLegalPlays(g.round, { includeSkills: true });
    const key = selectionRejectionReasonKey(g, sel, legal);
    // 合法なら null、非合法なら sandbox.reason.* 文字列
    if (key !== null) {
      assert.match(key, /^sandbox\.reason\./);
    }
  }
});
```

（注：`resolveJokerTransform: forbidden-go-out` のテストは局面探索が難しい場合、実装者は `createRoundState` で直接 `skilled('seat-0', [1枚], 'SKILL_JOKER_HERO')` の `DriverState` 形を組んでよい。`DriverState` は `{ config, seed, rematchIndex, baselineFirstSeatId, round, phase, turnLog, publicEvents, winnerSeatId }`。`buildMatchConfig(2)` の config を使い `round` を差し替え、`phase: 'HUMAN_TURN'` にする。）

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/skillPlayOptions.test.ts`
Expected: FAIL（`./skillPlayOptions` 未作成）

- [ ] **Step 3: `skillPlayOptions.ts` を実装する**

```ts
import {
  rankNumber,
  rankStrength,
  resolvePlay,
  type DayNight,
  type LegalPlay,
  type PlayInput,
  type RankCode,
  type SkillEffectCode,
  type SuitCode,
} from '@card-game-app/game-core';
import type { HandSelection } from './handSelection';
import type { DriverState } from './turnDriver';

export type SkillSubmitOption = {
  useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION';
  input: PlayInput;
};

export type JokerDeclarationDraft = { rankCode: RankCode | null; suitCode: SuitCode | null };

export type JokerTransformResolution =
  | { status: 'ok'; input: PlayInput }
  | { status: 'forbidden-go-out' }
  | { status: 'illegal'; rejectionReasonKey: string }
  | { status: 'incomplete' };

const RANKS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function humanSeatId(state: DriverState): string {
  return (
    state.config.seats.find((s) => s.kind === 'HUMAN')?.seatId ?? state.round.activePlayerId
  );
}

/** 手番の人間が未使用で保有するスキルの effectCode。無ければ null。 */
export function heldSkillEffect(state: DriverState): SkillEffectCode | null {
  const human = state.round.players.find((p) => p.playerId === humanSeatId(state));
  return human?.skill && !human.skill.used ? human.skill.effectCode : null;
}

function exactMatch(cardIds: readonly string[], sel: Set<string>): boolean {
  return cardIds.length === sel.size && cardIds.every((id) => sel.has(id));
}

/** 選択札 == cardIds の合法スキル手（JOKER_TRANSFORM を除く）を種別ごとに1件。 */
export function submitOptionsForSelection(
  legalPlays: LegalPlay[],
  selection: HandSelection,
): SkillSubmitOption[] {
  const sel = new Set(selection);
  const out: SkillSubmitOption[] = [];
  for (const p of legalPlays) {
    if (p.input.kind !== 'PLAY') continue;
    const use = p.input.useSkill;
    if (use !== 'JOKER_CLEAR' && use !== 'EXTENSION_SEAL' && use !== 'REVOLUTION') continue;
    if (!exactMatch(p.input.cardIds, sel)) continue;
    if (out.some((o) => o.useSkill === use)) continue;
    out.push({ useSkill: use, input: p.input });
  }
  return out;
}

/** 変化Joker：選択実カード + 宣言 draft から JOKER_TRANSFORM 手を組み resolvePlay で判定。 */
export function resolveJokerTransform(
  state: DriverState,
  selection: HandSelection,
  draft: JokerDeclarationDraft,
): JokerTransformResolution {
  if (draft.rankCode == null || draft.suitCode == null) return { status: 'incomplete' };
  const seatId = humanSeatId(state);
  const human = state.round.players.find((p) => p.playerId === seatId);
  if (!human?.skill || human.skill.used) {
    return { status: 'illegal', rejectionReasonKey: 'sandbox.reason.SKILL_NOT_AVAILABLE' };
  }
  const input: PlayInput = {
    kind: 'PLAY',
    playerId: seatId,
    cardIds: [...selection],
    useSkill: 'JOKER_TRANSFORM',
    jokerDeclarations: [
      { skillId: human.skill.skillId, rankCode: draft.rankCode, suitCode: draft.suitCode },
    ],
  };
  const res = resolvePlay(state.round, input);
  if (res.ok) return { status: 'ok', input };
  if (res.reason === 'TRANSFORM_JOKER_GO_OUT') return { status: 'forbidden-go-out' };
  return { status: 'illegal', rejectionReasonKey: `sandbox.reason.${res.reason}` };
}

/** 革命併用時のプレビュー（表示のみ）。 */
export function revolutionPreview(state: DriverState): {
  dayNightAfter: DayNight;
  strengthOrderAfter: number[];
} {
  const dayNightAfter: DayNight = state.round.dayNight === 'DAY' ? 'NIGHT' : 'DAY';
  const strengthOrderAfter = [...RANKS].sort(
    (a, b) => rankStrength(a, dayNightAfter) - rankStrength(b, dayNightAfter),
  );
  return { dayNightAfter, strengthOrderAfter };
}

/** 素の数字手（useSkill なし）の distinct cardId 集合の数。 */
export function legalMoveCount(legalPlays: LegalPlay[]): number {
  const sets = new Set<string>();
  for (const p of legalPlays) {
    if (p.input.kind === 'PLAY' && p.input.useSkill === undefined) {
      sets.add([...p.input.cardIds].sort().join(','));
    }
  }
  return sets.size;
}

/** 選択が素でもスキルでも提出できないときの理由キー（M3-EX-07）。 */
export function selectionRejectionReasonKey(
  state: DriverState,
  selection: HandSelection,
  legalPlays: LegalPlay[],
): string | null {
  if (selection.length === 0) return null;
  const sel = new Set(selection);
  const matchesAny = legalPlays.some(
    (p) => p.input.kind === 'PLAY' && exactMatch(p.input.cardIds, sel),
  );
  if (matchesAny) return null;
  const res = resolvePlay(state.round, {
    kind: 'PLAY',
    playerId: humanSeatId(state),
    cardIds: [...selection],
  });
  if (res.ok) return null;
  return `sandbox.reason.${res.reason}`;
}

/** 宣言 draft からプレビュー用の { rank, suitCode }。未完なら null。 */
export function jokerPreviewCard(
  draft: JokerDeclarationDraft,
): { rank: number; suitCode: SuitCode } | null {
  if (draft.rankCode == null || draft.suitCode == null) return null;
  return { rank: rankNumber(draft.rankCode), suitCode: draft.suitCode };
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/skillPlayOptions.test.ts`
Expected: PASS

Run: `npm --prefix apps/mobile run typecheck` / `npm --prefix apps/mobile run lint`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/mobile/src/features/cpu-game/skillPlayOptions.ts apps/mobile/src/features/cpu-game/skillPlayOptions.test.ts
git commit -m "feat(mobile): [M3-EX-01][M3-EX-02][M3-EX-07] add skillPlayOptions pure module"
```

---

### Task 5: `boardViewModel.ts` にスキル関連フィールドを追加

**Files:**
- Modify: `apps/mobile/src/features/cpu-game/boardViewModel.ts`
- Modify: `apps/mobile/src/features/cpu-game/boardViewModel.test.ts`

**Interfaces:**
- Consumes: Task 4 の `heldSkillEffect` / `submitOptionsForSelection` / `resolveJokerTransform` / `revolutionPreview` / `legalMoveCount` / `selectionRejectionReasonKey` / `jokerPreviewCard` / 型 `JokerDeclarationDraft`。Task 3 の `canSubmitPlain`。
- Produces: `BoardViewModel` に `skillPanel` / `submitOptions` / `jokerTransform` / `selectionHint` フィールド。`buildBoardViewModel` の `opts` に `jokerTransform?: { active: boolean } & JokerDeclarationDraft`。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/features/cpu-game/boardViewModel.test.ts` の先頭 import に `cpuStep` を追加（`import { activeSeatId, cpuStep, humanPlay, initGame, ... }`）。ファイル末尾に追加：

```ts
function humanSkillState(effectCode: string): DriverState {
  for (let seed = 0; seed < 400; seed += 1) {
    for (const n of [2, 3, 4, 5, 6]) {
      let g = initGame({ config: buildMatchConfig(n), seed });
      const human = g.round.players.find((p) => p.playerId === 'seat-0');
      if (!(human?.skill && !human.skill.used && human.skill.effectCode === effectCode)) continue;
      let guard = 0;
      while (g.phase === 'CPU_PENDING' && guard < 200) { g = cpuStep(g).next; guard += 1; }
      if (g.phase === 'HUMAN_TURN') return g;
    }
  }
  throw new Error(`no human ${effectCode} state`);
}

test('skillPanel is null when the human holds no skill or it is not the human turn', () => {
  // seat-0 がスキル無しの seed
  let noSkill: DriverState | null = null;
  for (let seed = 0; seed < 200 && !noSkill; seed += 1) {
    const g = start(6, seed);
    const h = g.round.players.find((p) => p.playerId === 'seat-0');
    if (!h?.skill && g.phase === 'HUMAN_TURN') noSkill = g;
  }
  assert.ok(noSkill);
  assert.equal(buildBoardViewModel(noSkill, [], legalPlaysForHuman(noSkill)).skillPanel, null);
});

test('skillPanel reports the held revolution skill with a preview', () => {
  const g = humanSkillState('SKILL_REVOLUTION');
  const vm = buildBoardViewModel(g, [], legalPlaysForHuman(g));
  assert.ok(vm.skillPanel);
  assert.equal(vm.skillPanel!.heldEffectKey, 'sandbox.skill.SKILL_REVOLUTION');
  assert.equal(vm.skillPanel!.heldEffectDescKey, 'cpuGame.skill.effect.SKILL_REVOLUTION');
  assert.equal(vm.skillPanel!.revolutionAvailable, true);
  assert.ok(vm.skillPanel!.revolutionPreview);
  assert.equal(vm.skillPanel!.sealAvailable, false);
  assert.equal(vm.skillPanel!.jokerTransformAvailable, false);
});

test('skillPanel jokerClearAvailable follows field presence for a Joker holder', () => {
  const g = humanSkillState('SKILL_JOKER_HERO');
  const vm = buildBoardViewModel(g, [], legalPlaysForHuman(g));
  assert.ok(vm.skillPanel);
  assert.equal(vm.skillPanel!.jokerTransformAvailable, true);
  assert.equal(vm.skillPanel!.jokerClearAvailable, g.round.activeField != null);
});

test('submitOptions.plain mirrors canSubmitPlain and skills mirrors submitOptionsForSelection', () => {
  const g = humanSkillState('SKILL_EXTENSION_SEAL');
  const legal = legalPlaysForHuman(g);
  const plainPlay = legal.find((p) => p.input.kind === 'PLAY' && p.input.useSkill === undefined);
  assert.ok(plainPlay && plainPlay.input.kind === 'PLAY');
  const vm = buildBoardViewModel(g, plainPlay.input.cardIds, legal);
  assert.equal(vm.submitOptions.plain, true);
  for (const s of vm.submitOptions.skills) {
    assert.match(s.labelKey, /^cpuGame\.skill\.submit\.(JOKER_CLEAR|EXTENSION_SEAL|REVOLUTION)$/);
  }
});

test('jokerTransform reflects the draft and resolution status', () => {
  const g = humanSkillState('SKILL_JOKER_HERO');
  const legal = legalPlaysForHuman(g);
  const inactive = buildBoardViewModel(g, [], legal);
  assert.equal(inactive.jokerTransform.active, false);
  assert.equal(inactive.jokerTransform.canConfirm, false);
  const active = buildBoardViewModel(g, [], legal, {
    jokerTransform: { active: true, rankCode: null, suitCode: null },
  });
  assert.equal(active.jokerTransform.active, true);
  assert.equal(active.jokerTransform.previewCard, null);
});

test('selectionHint carries a legal-move count and a null reason on an empty selection', () => {
  const g = humanSkillState('SKILL_REVOLUTION');
  const legal = legalPlaysForHuman(g);
  const vm = buildBoardViewModel(g, [], legal);
  assert.equal(vm.selectionHint.rejectionReasonKey, null);
  assert.equal(typeof vm.selectionHint.legalMoveCount, 'number');
  assert.ok(vm.selectionHint.legalMoveCount >= 0);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/boardViewModel.test.ts`
Expected: FAIL（新フィールド未定義）

- [ ] **Step 3: `boardViewModel.ts` を変更する**

import を変更/追加：

```ts
// 既存の handSelection import に canSubmitPlain を追加
import { canPass, canSelectCard, canSubmit, canSubmitPlain, type HandSelection } from './handSelection';

// 新規 import
import {
  heldSkillEffect,
  jokerPreviewCard,
  legalMoveCount,
  resolveJokerTransform,
  revolutionPreview,
  selectionRejectionReasonKey,
  submitOptionsForSelection,
  type JokerDeclarationDraft,
} from './skillPlayOptions';
```

既存の `@card-game-app/game-core` からの import（`isTransformedJokerCard`, `rankNumber`, `SUIT_CODES`, `type DayNight`, `type LegalPlay`, `type NumberCard`, `type SuitCode`）に `type RankCode` を追加する。

`BoardViewModel` 型に追加（`winnerNameKey` の前あたり）：

```ts
  skillPanel: {
    heldEffectKey: string;
    heldEffectDescKey: string;
    jokerClearAvailable: boolean;
    jokerTransformAvailable: boolean;
    sealAvailable: boolean;
    revolutionAvailable: boolean;
    revolutionPreview: { dayNightAfter: DayNight; strengthOrderAfter: number[] } | null;
  } | null;
  submitOptions: {
    plain: boolean;
    skills: { useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION'; labelKey: string }[];
  };
  jokerTransform: {
    active: boolean;
    rankCode: RankCode | null;
    suitCode: SuitCode | null;
    canConfirm: boolean;
    forbiddenGoOut: boolean;
    rejectionReasonKey: string | null;
    previewCard: { rank: number; suitCode: SuitCode } | null;
  };
  selectionHint: {
    rejectionReasonKey: string | null;
    legalMoveCount: number;
  };
```

`buildBoardViewModel` シグネチャの `opts` を拡張：

```ts
export function buildBoardViewModel(
  state: DriverState,
  selection: HandSelection,
  legalPlays: LegalPlay[],
  opts?: {
    cpuThinking?: boolean;
    jokerTransform?: { active: boolean } & JokerDeclarationDraft;
  },
): BoardViewModel {
```

関数本体の `return { ... }` の直前に計算を追加：

```ts
  const isHumanTurn = state.phase === 'HUMAN_TURN';
  const heldEffect = heldSkillEffect(state);
  const jtDraft = opts?.jokerTransform ?? { active: false, rankCode: null, suitCode: null };

  const isJoker = heldEffect === 'SKILL_JOKER_HERO' || heldEffect === 'SKILL_JOKER_SAINT';
  const skillPanel =
    isHumanTurn && heldEffect != null
      ? {
          heldEffectKey: `sandbox.skill.${heldEffect}`,
          heldEffectDescKey: `cpuGame.skill.effect.${heldEffect}`,
          jokerClearAvailable: isJoker && round.activeField != null,
          jokerTransformAvailable: isJoker,
          sealAvailable: heldEffect === 'SKILL_EXTENSION_SEAL',
          revolutionAvailable: heldEffect === 'SKILL_REVOLUTION',
          revolutionPreview: heldEffect === 'SKILL_REVOLUTION' ? revolutionPreview(state) : null,
        }
      : null;

  const skillSubmit = submitOptionsForSelection(legalPlays, selection);
  const submitOptions = {
    plain: canSubmitPlain(selection, legalPlays),
    skills: skillSubmit.map((s) => ({
      useSkill: s.useSkill,
      labelKey: `cpuGame.skill.submit.${s.useSkill}`,
    })),
  };

  const jtRes = jtDraft.active
    ? resolveJokerTransform(state, selection, {
        rankCode: jtDraft.rankCode,
        suitCode: jtDraft.suitCode,
      })
    : null;
  const jokerTransform = {
    active: jtDraft.active,
    rankCode: jtDraft.rankCode,
    suitCode: jtDraft.suitCode,
    canConfirm: jtRes?.status === 'ok',
    forbiddenGoOut: jtRes?.status === 'forbidden-go-out',
    rejectionReasonKey: jtRes?.status === 'illegal' ? jtRes.rejectionReasonKey : null,
    previewCard: jokerPreviewCard({ rankCode: jtDraft.rankCode, suitCode: jtDraft.suitCode }),
  };

  const selectionHint = {
    rejectionReasonKey: isHumanTurn
      ? selectionRejectionReasonKey(state, selection, legalPlays)
      : null,
    legalMoveCount: isHumanTurn ? legalMoveCount(legalPlays) : 0,
  };
```

そして `return { ... }` に `skillPanel, submitOptions, jokerTransform, selectionHint` を追加。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/features/cpu-game/boardViewModel.test.ts`
Expected: PASS（新規 + 既存すべて。既存 `does not mutate its inputs` も新計算が pure なので通る）

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS

- [ ] **Step 5: モバイル全テストに回帰がないことを確認する**

Run: `npm run mobile:test`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add apps/mobile/src/features/cpu-game/boardViewModel.ts apps/mobile/src/features/cpu-game/boardViewModel.test.ts
git commit -m "feat(mobile): [M3-EX-01][M3-EX-02][M3-EX-07] skill fields in boardViewModel"
```

---

### Task 6: `cpuGameStore.ts` にスキルアクションを追加

**Files:**
- Modify: `apps/mobile/src/state/cpuGameStore.ts`
- Modify: `apps/mobile/src/state/cpuGameStore.test.ts`

**Interfaces:**
- Consumes: `humanPlay` / `activeSeatId`（既存）、`PlayInput`（`useSkill` / `jokerDeclarations`）、`RankCode` / `SuitCode`。
- Produces: `CpuGameState` に `jokerTransform: { active: boolean; rankCode: RankCode | null; suitCode: SuitCode | null }`。アクション `openJokerTransform()` / `closeJokerTransform()` / `setJokerDeclaration(rankCode: RankCode | null, suitCode: SuitCode | null)` / `submitSkillPlay(useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION'): CpuGamePlayResult` / `submitJokerTransform(): CpuGamePlayResult`。提出成功で `jokerTransform` は初期値へリセット。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/state/cpuGameStore.test.ts` に新しい `describe` ブロックを追加（既存の `describe`/`it` スタイルに合わせる。`configureCpuGameStore` + `makeFakeDeps` は既存ヘルパー）：

```ts
describe('skill actions', () => {
  beforeEach(() => {
    __resetCpuGameStoreForTest();
    __resetAnonPlayerIdMemoForTest();
  });

  it('openJokerTransform / setJokerDeclaration / closeJokerTransform manage the draft', () => {
    configureCpuGameStore(makeFakeDeps());
    cpuGameStore.getState().startMatch(2, 42);
    cpuGameStore.getState().openJokerTransform();
    assert.deepEqual(cpuGameStore.getState().jokerTransform, {
      active: true,
      rankCode: null,
      suitCode: null,
    });
    cpuGameStore.getState().setJokerDeclaration('RANK_5', 'SUIT_FIRE');
    assert.deepEqual(cpuGameStore.getState().jokerTransform, {
      active: true,
      rankCode: 'RANK_5',
      suitCode: 'SUIT_FIRE',
    });
    cpuGameStore.getState().closeJokerTransform();
    assert.deepEqual(cpuGameStore.getState().jokerTransform, {
      active: false,
      rankCode: null,
      suitCode: null,
    });
  });

  it('startMatch resets the jokerTransform draft', () => {
    configureCpuGameStore(makeFakeDeps());
    cpuGameStore.getState().startMatch(2, 42);
    cpuGameStore.getState().openJokerTransform();
    cpuGameStore.getState().startMatch(2, 43);
    assert.equal(cpuGameStore.getState().jokerTransform.active, false);
  });

  it('submitSkillPlay applies a legal skill play and keeps card conservation', () => {
    configureCpuGameStore(makeFakeDeps());
    // seat-0 が革命 or 封印を持ち、素の選択 + スキル併用が合法な局面を探す
    let seed = -1;
    for (let s = 0; s < 400 && seed < 0; s += 1) {
      cpuGameStore.getState().startMatch(2, s);
      const st = cpuGameStore.getState();
      if (!st.driver || st.driver.phase !== 'HUMAN_TURN') continue;
      const human = st.driver.round.players.find((p) => p.playerId === 'seat-0');
      if (!human?.skill || human.skill.used) continue;
      if (human.skill.effectCode !== 'SKILL_EXTENSION_SEAL' && human.skill.effectCode !== 'SKILL_REVOLUTION') continue;
      const opt = st.legalPlays.find(
        (p) => p.input.kind === 'PLAY' && (p.input.useSkill === 'EXTENSION_SEAL' || p.input.useSkill === 'REVOLUTION'),
      );
      if (!opt || opt.input.kind !== 'PLAY') continue;
      cpuGameStore.setState({ selection: [...opt.input.cardIds] });
      const res = cpuGameStore.getState().submitSkillPlay(opt.input.useSkill as never);
      assert.equal(res.ok, true);
      seed = s;
    }
    assert.ok(seed >= 0, 'expected a seed with a legal human skill play');
  });

  it('submitJokerTransform requires a complete declaration', () => {
    configureCpuGameStore(makeFakeDeps());
    cpuGameStore.getState().startMatch(2, 42);
    cpuGameStore.getState().openJokerTransform();
    const res = cpuGameStore.getState().submitJokerTransform();
    assert.equal(res.ok, false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/state/cpuGameStore.test.ts`
Expected: FAIL（新アクション未定義）

- [ ] **Step 3: `cpuGameStore.ts` を変更する**

import に型を追加：

```ts
import type { LegalPlay, PlayRejectionReason, RankCode, RoundState, SuitCode } from '@card-game-app/game-core';
```

`CpuGameState` 型に state とアクションを追加：

```ts
  jokerTransform: { active: boolean; rankCode: RankCode | null; suitCode: SuitCode | null };
  // ...
  openJokerTransform: () => void;
  closeJokerTransform: () => void;
  setJokerDeclaration: (rankCode: RankCode | null, suitCode: SuitCode | null) => void;
  submitSkillPlay: (useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION') => CpuGamePlayResult;
  submitJokerTransform: () => CpuGamePlayResult;
```

`INITIAL` の `Omit<CpuGameState, ...>` のユニオンに新アクション名5つを追加し、オブジェクトに：

```ts
  jokerTransform: { active: false, rankCode: null, suitCode: null },
```

`applyHumanInput` の成功時 `set({ ... })` に追加：

```ts
    set({
      driver: res.next,
      selection: [],
      legalPlays: legalPlaysForHuman(res.next),
      jokerTransform: { active: false, rankCode: null, suitCode: null },
    });
```

`return { ...INITIAL, ... }` のアクション群に追加：

```ts
    openJokerTransform: () =>
      set({ jokerTransform: { active: true, rankCode: null, suitCode: null } }),

    closeJokerTransform: () =>
      set({ jokerTransform: { active: false, rankCode: null, suitCode: null } }),

    setJokerDeclaration: (rankCode, suitCode) =>
      set((s) => ({ jokerTransform: { ...s.jokerTransform, rankCode, suitCode } })),

    submitSkillPlay: (useSkill) => {
      const { driver, selection } = get();
      if (!driver) return { ok: false };
      return applyHumanInput({
        kind: 'PLAY',
        playerId: activeSeatId(driver),
        cardIds: [...selection],
        useSkill,
      });
    },

    submitJokerTransform: () => {
      const { driver, selection, jokerTransform } = get();
      if (!driver) return { ok: false };
      if (jokerTransform.rankCode == null || jokerTransform.suitCode == null) {
        return { ok: false };
      }
      const humanSeatId = driver.config.seats.find((s) => s.kind === 'HUMAN')?.seatId;
      const human = driver.round.players.find((p) => p.playerId === humanSeatId);
      if (!human?.skill) return { ok: false };
      return applyHumanInput({
        kind: 'PLAY',
        playerId: activeSeatId(driver),
        cardIds: [...selection],
        useSkill: 'JOKER_TRANSFORM',
        jokerDeclarations: [
          {
            skillId: human.skill.skillId,
            rankCode: jokerTransform.rankCode,
            suitCode: jokerTransform.suitCode,
          },
        ],
      });
    },
```

注：`applyHumanInput` の引数型 `ReturnType<typeof toPlayInput> | { kind: 'PASS'; playerId: string }` を、フル `PlayInput` を受けられるよう `PlayInput` に緩める（`import type { PlayInput }` を追加）。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/state/cpuGameStore.test.ts`
Expected: PASS（新規 + 既存すべて。既存の `PAYLOAD_COLUMNS` テスト等は無関係）

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS

- [ ] **Step 5: モバイル全テストに回帰がないことを確認する**

Run: `npm run mobile:test`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add apps/mobile/src/state/cpuGameStore.ts apps/mobile/src/state/cpuGameStore.test.ts
git commit -m "feat(mobile): [M3-EX-01][M3-EX-02] skill actions in cpuGameStore"
```

---

### Task 7: i18n キーの追加

**Files:**
- Modify: `apps/mobile/src/i18n/translate.ts`
- Modify: `apps/mobile/src/i18n/translate.test.ts`

**Interfaces:**
- Consumes: なし。
- Produces: `jaDictionary` に §11 のキー。`translate.test.ts` の cpu-game 必須キー一覧に新キー。

- [ ] **Step 1: 失敗するテストを書く**

`apps/mobile/src/i18n/translate.test.ts` の `"jaDictionary includes every cpu-game screen key required by the M2 flow"` テストの `requiredKeys` 配列に追加：

```ts
    'cpuGame.skill.effect.SKILL_JOKER_HERO',
    'cpuGame.skill.effect.SKILL_JOKER_SAINT',
    'cpuGame.skill.effect.SKILL_EXTENSION_SEAL',
    'cpuGame.skill.effect.SKILL_REVOLUTION',
    'cpuGame.skill.submit.JOKER_CLEAR',
    'cpuGame.skill.submit.EXTENSION_SEAL',
    'cpuGame.skill.submit.REVOLUTION',
    'cpuGame.skill.jokerTransform.open',
    'cpuGame.skill.jokerTransform.declareRank',
    'cpuGame.skill.jokerTransform.declareSuit',
    'cpuGame.skill.jokerTransform.confirm',
    'cpuGame.skill.jokerTransform.cancel',
    'cpuGame.skill.jokerTransform.forbiddenGoOut',
    'cpuGame.skill.jokerTransform.preview',
    'cpuGame.skill.revolutionPreviewLabel',
    'cpuGame.skill.held',
    'cpuGame.hint.legalMoveCountPrefix',
    'cpuGame.hint.noMoves',
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/i18n/translate.test.ts`
Expected: FAIL（キー未定義で `typeof jaDictionary[key]` が `undefined`）

- [ ] **Step 3: `translate.ts` にキーを追加する**

`apps/mobile/src/i18n/translate.ts` の `jaDictionary` の `cpuGame.turnLog.PASS` の直前に追加：

```ts
  'cpuGame.skill.held': '保有スキル',
  'cpuGame.skill.effect.SKILL_JOKER_HERO': '場を流す、または数字と属性を宣言して変化させる',
  'cpuGame.skill.effect.SKILL_JOKER_SAINT': '場を流す、または数字と属性を宣言して変化させる',
  'cpuGame.skill.effect.SKILL_EXTENSION_SEAL': '数字カードと同時に使用。以後、同数字追加と連番拡張を禁止',
  'cpuGame.skill.effect.SKILL_REVOLUTION': '数字カードと同時に使用。先に昼夜を反転してから判定',
  'cpuGame.skill.submit.JOKER_CLEAR': 'Jokerで場を流して出す',
  'cpuGame.skill.submit.EXTENSION_SEAL': '追加封印して出す',
  'cpuGame.skill.submit.REVOLUTION': '革命して出す',
  'cpuGame.skill.jokerTransform.open': '変化Jokerを使う',
  'cpuGame.skill.jokerTransform.declareRank': '数字を宣言',
  'cpuGame.skill.jokerTransform.declareSuit': '属性を宣言',
  'cpuGame.skill.jokerTransform.confirm': 'この宣言で出す',
  'cpuGame.skill.jokerTransform.cancel': 'やめる',
  'cpuGame.skill.jokerTransform.forbiddenGoOut': '最後の数字カードと変化Jokerでは上がれません',
  'cpuGame.skill.jokerTransform.preview': '宣言後のカード',
  'cpuGame.skill.revolutionPreviewLabel': '革命後',
  'cpuGame.hint.legalMoveCountPrefix': '出せる手',
  'cpuGame.hint.noMoves': '出せる手がありません',
```

既存の `'cpuGame.skill.heldNote': 'M3で使用可能',` を `'cpuGame.skill.heldNote': '保有中',` に変更する。

- [ ] **Step 4: テストが通ることを確認する**

Run: `npm --prefix apps/mobile exec -- tsx --test src/i18n/translate.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/mobile/src/i18n/translate.ts apps/mobile/src/i18n/translate.test.ts
git commit -m "feat(mobile): [M3-EX-01][M3-EX-02][M3-EX-07] i18n keys for skill UI"
```

---

### Task 8: `play.tsx` にスキルパネルと支援表示を配線

**Files:**
- Modify: `apps/mobile/src/app/cpu-game/play.tsx`

**Interfaces:**
- Consumes: `vm.skillPanel` / `vm.submitOptions` / `vm.jokerTransform` / `vm.selectionHint`（Task 5）。ストアの `jokerTransform` state と `openJokerTransform` / `closeJokerTransform` / `setJokerDeclaration` / `submitSkillPlay` / `submitJokerTransform`（Task 6）。i18n キー（Task 7）。`RANK_CODES` / `SUIT_CODES` from `@card-game-app/game-core`。
- Produces: 画面のみ。テストなし。`typecheck` / `lint` / `expo export` が通ること。

- [ ] **Step 1: ストアから jokerTransform を購読し、`buildBoardViewModel` に渡す**

`play.tsx` の `const pending = useStore(...)` の下に追加：

```tsx
  const jokerTransform = useStore(cpuGameStore, (s) => s.jokerTransform);
```

`vm` の `useMemo` を更新：

```tsx
  const vm = useMemo(
    () =>
      driver
        ? buildBoardViewModel(driver, selection, legalPlays, { cpuThinking, jokerTransform })
        : null,
    [driver, selection, legalPlays, cpuThinking, jokerTransform],
  );
```

import に追加：

```tsx
import { RANK_CODES, SUIT_CODES } from '@card-game-app/game-core';
```

- [ ] **Step 2: 素の「出す」を `submitOptions.plain` 判定に変更する**

`onSubmit` を変更：

```tsx
  const onSubmit = () => {
    const res = cpuGameStore.getState().submitPlay();
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };
  const onSubmitSkill = (useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION') => {
    const res = cpuGameStore.getState().submitSkillPlay(useSkill);
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };
  const onSubmitJoker = () => {
    const res = cpuGameStore.getState().submitJokerTransform();
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };
```

「出す」ボタンの `disabled` / スタイル判定を `!vm.canSubmit` → `!vm.submitOptions.plain` に変更。

- [ ] **Step 3: スキルパネル・提出ボタン群・変化Jokerパネル・支援表示を追加する**

`vm.humanSkillNameKey ? (...) : null` のブロックを、次のスキルパネルに置き換える（既存の保有スキル表示を包含）：

```tsx
      {vm.skillPanel ? (
        <View style={styles.skillPanel}>
          <Text style={styles.skillTitle}>
            {translate('cpuGame.skill.held')}: {translate(vm.skillPanel.heldEffectKey)}
          </Text>
          <Text style={styles.muted}>{translate(vm.skillPanel.heldEffectDescKey)}</Text>

          {vm.submitOptions.skills.map((opt) => (
            <Pressable
              key={opt.useSkill}
              accessibilityRole="button"
              onPress={() => onSubmitSkill(opt.useSkill)}
              style={styles.actionBtn}
            >
              <Text style={styles.actionText}>{translate(opt.labelKey)}</Text>
            </Pressable>
          ))}

          {vm.skillPanel.revolutionPreview ? (
            <Text style={styles.muted}>
              {translate('cpuGame.skill.revolutionPreviewLabel')}:{' '}
              {vm.skillPanel.revolutionPreview.dayNightAfter === 'DAY'
                ? translate('cpuGame.dayNight.day')
                : translate('cpuGame.dayNight.night')}{' '}
              / {vm.skillPanel.revolutionPreview.strengthOrderAfter.join('→')}
            </Text>
          ) : null}

          {vm.skillPanel.jokerTransformAvailable && !vm.jokerTransform.active ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => cpuGameStore.getState().openJokerTransform()}
              style={styles.actionBtnGhost}
            >
              <Text style={styles.actionTextGhost}>
                {translate('cpuGame.skill.jokerTransform.open')}
              </Text>
            </Pressable>
          ) : null}

          {vm.jokerTransform.active ? (
            <View style={styles.jokerPanel}>
              <Text style={styles.muted}>{translate('cpuGame.skill.jokerTransform.declareRank')}</Text>
              <View style={styles.pickerRow}>
                {RANK_CODES.map((rc, i) => (
                  <Pressable
                    key={rc}
                    accessibilityRole="button"
                    accessibilityState={{ selected: vm.jokerTransform.rankCode === rc }}
                    onPress={() =>
                      cpuGameStore.getState().setJokerDeclaration(rc, vm.jokerTransform.suitCode)
                    }
                    style={[styles.pickerCell, vm.jokerTransform.rankCode === rc && styles.pickerCellOn]}
                  >
                    <Text style={styles.pickerText}>{i + 1}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.muted}>{translate('cpuGame.skill.jokerTransform.declareSuit')}</Text>
              <View style={styles.pickerRow}>
                {SUIT_CODES.map((sc) => (
                  <Pressable
                    key={sc}
                    accessibilityRole="button"
                    accessibilityState={{ selected: vm.jokerTransform.suitCode === sc }}
                    onPress={() =>
                      cpuGameStore.getState().setJokerDeclaration(vm.jokerTransform.rankCode, sc)
                    }
                    style={[styles.pickerCell, vm.jokerTransform.suitCode === sc && styles.pickerCellOn]}
                  >
                    <Text style={styles.pickerText}>{translate(`sandbox.suit.${sc}`)}</Text>
                  </Pressable>
                ))}
              </View>

              {vm.jokerTransform.previewCard ? (
                <View style={styles.jokerPreview}>
                  <Text style={styles.muted}>{translate('cpuGame.skill.jokerTransform.preview')}</Text>
                  <CardFace
                    rank={vm.jokerTransform.previewCard.rank}
                    suitCode={vm.jokerTransform.previewCard.suitCode}
                    isJoker
                    size="hand"
                  />
                </View>
              ) : null}

              {vm.jokerTransform.forbiddenGoOut ? (
                <Text style={styles.invalid}>
                  {translate('cpuGame.skill.jokerTransform.forbiddenGoOut')}
                </Text>
              ) : null}
              {vm.jokerTransform.rejectionReasonKey ? (
                <Text style={styles.invalid}>{translate(vm.jokerTransform.rejectionReasonKey)}</Text>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !vm.jokerTransform.canConfirm }}
                  disabled={!vm.jokerTransform.canConfirm}
                  onPress={onSubmitJoker}
                  style={[styles.actionBtn, !vm.jokerTransform.canConfirm && styles.actionDisabled]}
                >
                  <Text style={styles.actionText}>
                    {translate('cpuGame.skill.jokerTransform.confirm')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => cpuGameStore.getState().closeJokerTransform()}
                  style={styles.actionBtnGhost}
                >
                  <Text style={styles.actionTextGhost}>
                    {translate('cpuGame.skill.jokerTransform.cancel')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
```

`{invalidReason ? ... : null}` の直後（`actions` View の中か下）に支援表示を追加：

```tsx
      <View style={styles.hintRow}>
        {vm.selectionHint.rejectionReasonKey ? (
          <Text style={styles.invalid}>{translate(vm.selectionHint.rejectionReasonKey)}</Text>
        ) : null}
        <Text style={styles.muted}>
          {vm.selectionHint.legalMoveCount > 0
            ? `${translate('cpuGame.hint.legalMoveCountPrefix')}: ${vm.selectionHint.legalMoveCount}`
            : translate('cpuGame.hint.noMoves')}
        </Text>
      </View>
```

- [ ] **Step 4: スタイルを追加する**

`StyleSheet.create({ ... })` に追加：

```tsx
  skillPanel: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  skillTitle: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  jokerPanel: { gap: spacing.xs },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pickerCell: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pickerCellOn: { borderColor: colors.ink.primary, borderWidth: 2 },
  pickerText: { fontSize: typography.size.caption, color: colors.ink.primary },
  jokerPreview: { alignItems: 'flex-start', gap: 2 },
  hintRow: { gap: 2 },
```

- [ ] **Step 5: 型・lint・エクスポートを確認する**

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS

Run: `npm --prefix apps/mobile run lint`
Expected: PASS

Run: `npm --prefix apps/mobile exec -- expo export --platform android`
Expected: バンドル成功（`dist/` 生成、エラーなし）。環境要因（Metro/expo CLI が起動しない等、コードのバグではない）で失敗する場合は typecheck / lint / test が緑なら次へ進み、報告にその旨を記載する。

Run: `npm run mobile:test`
Expected: PASS（画面変更はテストに影響しない）

- [ ] **Step 6: コミット**

```bash
git add apps/mobile/src/app/cpu-game/play.tsx
git commit -m "feat(mobile): [M3-EX-01][M3-EX-02][M3-EX-07] wire skill panels into play screen"
```

---

### Task 9: 進捗記録とフル確認

**Files:**
- Create: `docs/progress/M3-EX-01.md`
- Create: `docs/progress/M3-EX-02.md`
- Create: `docs/progress/M3-EX-07.md`

**Interfaces:**
- Consumes: Task 1〜8 の全成果物。
- Produces: 進捗ドキュメント（既存 `docs/progress/M3-EX-03.md` の書式：見出し・TODO・状態・日付・概要・成果物・確認・メモ）。

- [ ] **Step 1: フルスイートを実行する**

Run: `npm run game-core:test` → 全 PASS
Run: `npm run game-core:typecheck` → PASS
Run: `npm run mobile:test` → 全 PASS
Run: `npm --prefix apps/mobile run typecheck` → PASS
Run: `npm --prefix apps/mobile run lint` → PASS
Run: `npm --prefix apps/mobile exec -- expo export --platform android` → バンドル成功（環境要因の失敗は §Task 8 Step 5 と同じ扱い）
Run: `git diff --check` → 出力なし

test / typecheck / lint のいずれかが失敗したら STOP して報告する（進捗ドキュメントを「完了」で書かない）。

- [ ] **Step 2: `docs/progress/M3-EX-01.md` を書く**

```markdown
# M3-EX-01 進捗

- TODO: M3-EX-01（Jokerの場流し／変化選択UI）
- 状態: 完了（機能プレースホルダ。実機確認は M3-QA-02＝ユーザー作業）
- 日付: 2026-09-02

## 概要

CPU戦の対局画面で、人間が保有する勇者/聖女Jokerを「場流し」または「変化」で使用できるようにした。場流し（JOKER_CLEAR）はリード札を選んで1操作で場を流して出す（engine のアトミック処理に合わせる。場ありのときのみ）。変化（JOKER_TRANSFORM）は数字1〜9と属性1種をインラインパネルで宣言し、宣言後のカードをプレビューして確定する。禁止上がり（最後の数字カード＋変化Joker）は `resolvePlay` が弾き、確定ボタンを無効化して理由を表示する。設計書 `docs/superpowers/specs/2026-09-02-m3-human-skill-ui-design.md`。

着手前に game-core の `resolveCardPlay` へ `jokerDeclarations` 検証（`skillId` 一致・ちょうど1宣言・非変化Jokerでの宣言禁止、新 reason `INVALID_JOKER_DECLARATION`）を追加した。

## 成果物

| 種別 | パス |
| --- | --- |
| game-core | `packages/game-core/src/core.ts`（`resolveCardPlay` 検証、`PlayRejectionReason`） |
| 純関数 | `apps/mobile/src/features/cpu-game/skillPlayOptions.ts`（`resolveJokerTransform` 他） |
| ViewModel | `apps/mobile/src/features/cpu-game/boardViewModel.ts`（`skillPanel` / `jokerTransform`） |
| ストア | `apps/mobile/src/state/cpuGameStore.ts`（`openJokerTransform` / `setJokerDeclaration` / `submitJokerTransform` / `submitSkillPlay`） |
| 画面 | `apps/mobile/src/app/cpu-game/play.tsx`（スキルパネル・宣言ピッカー） |
| i18n | `apps/mobile/src/i18n/translate.ts` |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run game-core:test` | 全 PASS |
| `npm run mobile:test` | 全 PASS |
| `npm --prefix apps/mobile run typecheck` / `lint` | PASS |
| `npm --prefix apps/mobile exec -- expo export --platform android` | バンドル成功 |

## メモ

- 要件 JOKER-002 / JCLR-001/002 / JTR-001 / UI-JOKER-001〜004 / UI-BATTLE-011 に対応。
- Joker宣言の独立画面（§22.1）とデザイン版 `play.tsx` へ差し替え時、`boardViewModel` の `skillPanel` / `jokerTransform` 契約は維持する。
```

- [ ] **Step 3: `docs/progress/M3-EX-02.md` を書く**

```markdown
# M3-EX-02 進捗

- TODO: M3-EX-02（追加封印・革命カードの使用UI）
- 状態: 完了（機能プレースホルダ。実機確認は M3-QA-02＝ユーザー作業）
- 日付: 2026-09-02

## 概要

人間が保有する追加封印・革命カードを、数字カードと同時に使用できるようにした。選択札が「追加封印して出す」「革命して出す」の合法手（`enumerateLegalPlays({includeSkills:true})`）と一致するとき、専用の提出ボタンを表示する。革命は先に昼夜を反転してから判定するため、反転後の昼夜と強弱順をプレビュー表示する。設計書 `docs/superpowers/specs/2026-09-02-m3-human-skill-ui-design.md`。

## 成果物

| 種別 | パス |
| --- | --- |
| 純関数 | `apps/mobile/src/features/cpu-game/skillPlayOptions.ts`（`submitOptionsForSelection` / `revolutionPreview`） |
| 純関数 | `apps/mobile/src/features/cpu-game/handSelection.ts`（`canSubmitPlain`） |
| ViewModel | `apps/mobile/src/features/cpu-game/boardViewModel.ts`（`submitOptions` / `skillPanel.revolutionPreview`） |
| ストア | `apps/mobile/src/state/cpuGameStore.ts`（`submitSkillPlay`） |
| 画面 | `apps/mobile/src/app/cpu-game/play.tsx` |
| i18n | `apps/mobile/src/i18n/translate.ts` |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run mobile:test` | 全 PASS |
| `npm --prefix apps/mobile run typecheck` / `lint` | PASS |
| `npm --prefix apps/mobile exec -- expo export --platform android` | バンドル成功 |

## メモ

- 要件 SKILL-006 / SEAL-001/002/006 / REVSKILL-001/002 / CARD-104 / EFFECT-003 に対応。
- `legalPlaysForHuman` を `{ includeSkills: true }` に解禁（M3 サブプロジェクト1 で人間UI待ちだった箇所）。
```

- [ ] **Step 4: `docs/progress/M3-EX-07.md` を書く**

```markdown
# M3-EX-07 進捗

- TODO: M3-EX-07（不正選択理由と出せるカード支援表示）
- 状態: 完了（最小実装。実機確認は M3-QA-02＝ユーザー作業）
- 日付: 2026-09-02

## 概要

対局画面で、選択した手札が素でもスキルでも提出できないとき、`resolvePlay` ドライランで得た拒否理由を `sandbox.reason.*` 文言で常時表示する。あわせて、その手番に出せる素の数字手の数（distinct なカード集合の数）を「出せる手：N通り」として表示し、0 のときは「出せる手がありません」と示す。手札カードの `selectable` ハイライトは既存のまま。設計書 `docs/superpowers/specs/2026-09-02-m3-human-skill-ui-design.md` §6。

## 成果物

| 種別 | パス |
| --- | --- |
| 純関数 | `apps/mobile/src/features/cpu-game/skillPlayOptions.ts`（`selectionRejectionReasonKey` / `legalMoveCount`） |
| ViewModel | `apps/mobile/src/features/cpu-game/boardViewModel.ts`（`selectionHint`） |
| 画面 | `apps/mobile/src/app/cpu-game/play.tsx`（支援表示行） |
| i18n | `apps/mobile/src/i18n/translate.ts` |

## 確認

| コマンド | 結果 |
| --- | --- |
| `npm run mobile:test` | 全 PASS |
| `npm --prefix apps/mobile run typecheck` / `lint` | PASS |

## メモ

- 要件 UI-BATTLE-010 / M1-EX-09（`resolvePlay` を不変データから計算）に対応。
- 最小実装（理由文＋手数）。推奨手のゴースト表示等は実機フィードバック（M3-QA-02）次第で検討（§14）。
```

- [ ] **Step 5: `git diff --check` を確認してコミット**

Run: `git diff --check`
Expected: 出力なし

```bash
git add docs/progress/M3-EX-01.md docs/progress/M3-EX-02.md docs/progress/M3-EX-07.md
git commit -m "docs(progress): [M3-EX-01][M3-EX-02][M3-EX-07] record human skill UI completion"
```
