# M3 CPU スキル判断 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** CPU が全スキル（Joker場流し・Joker変化・追加封印・革命）を合法に使用できるようにし（M3-EX-03）、CPU 同士 1000 局で停止・不正手・不変条件違反 0 を確認する（M3-QA-01）。あわせて M2 サブプロジェクト1 の申し送り（`index.ts`→`core.ts` 分割、カード保存則の変化Joker対応）を回収する。

**Architecture:** 判定エンジン（`resolvePlay` ほか）は変更しない。`enumerateLegalPlays` に `{ includeSkills }` オプトインを足してスキル手も `resolvePlay` ドライランで列挙し、`standardPolicy` に最小限の決定的スキルヒューリスティックを足す。

**Tech Stack:** TypeScript（`packages/game-core`、`module: NodeNext`、`allowImportingTsExtensions` を新規有効化）、`node:test` + `tsx`。

**設計書:** `docs/superpowers/specs/2026-09-01-m3-cpu-skill-policy-design.md`（§番号で参照。正本）。

## Global Constraints

- `packages/game-core` は依存を追加しない（zero-dep、`node:test` + `tsx`）。
- game-core は純粋・同期・決定的。乱数は注入 `Rng` 経由。1局は seed から byte 再現。
- `resolvePlay` を含む既存公開 API のシグネチャは変更しない。`enumerateLegalPlays` は**第2引数の追加のみ**（省略時＝現行と完全に同一の出力）。
- 判定ロジックを列挙器・ポリシーに複製しない。スキル手も `resolvePlay(state, input)` ドライランで合法性を確定し、`res.ok` のみ採用、`res.outcome` / `res.state` から `actionKind` / `resultingCombination` / `goesOut` を写す。
- **Task 1 以降、`packages/game-core/src/` 内の import 指定子は `.ts`**（`tsconfig` の `allowImportingTsExtensions: true`。`tsc --noEmit` / `tsx` / Metro すべて解決可を probe 済み）。テストファイルは `from "./index.ts"` のまま。
- 非公開手札・cardId をトレース／ログに出さない。`TurnLogEntry` は枚数と `useSkill` 種別のみ（M2 実装済み、変更不要）。
- 既存テスト：game-core 184 件、mobile 180 件に回帰を出さない。
- コミットは `main` 直、`[TODO-ID]` 付き Conventional Commits、**明示パスのみ `git add`（`git add -A` 禁止）**。末尾 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。
- 各タスク完了時：`npm run game-core:test` + `npm run game-core:typecheck`（+ mobile を触るタスクは `npm run mobile:test` + `:typecheck`）。

## 参照する既存シンボル

```ts
// core.ts（旧 index.ts）
type NumberCard = { kind:"NUMBER"; cardId:string; rankCode:RankCode; suitCode:SuitCode; transformedFromSkillId?:string };
type SkillCard = { kind:"SKILL"; skillId:string; effectCode:SkillEffectCode; used:boolean };
type PlayerState = { playerId:string; status:"ACTIVE"|"PASSED"|"OUT"; hand:NumberCard[]; skill:SkillCard|null; consecutivePasses:number };
type PlayInput = { kind:"PASS"; playerId:string }
  | { kind:"PLAY"; playerId:string; cardIds:string[]; useSkill?:PlaySkillUse; jokerDeclarations?:JokerDeclaration[] };
type PlaySkillUse = "EXTENSION_SEAL"|"REVOLUTION"|"JOKER_TRANSFORM"|"JOKER_CLEAR";
type JokerDeclaration = { skillId:string; rankCode:RankCode; suitCode:SuitCode };
type SkillEffectCode = "SKILL_JOKER_HERO"|"SKILL_JOKER_SAINT"|"SKILL_EXTENSION_SEAL"|"SKILL_REVOLUTION";
function resolvePlay(state, play): { ok:true; state:RoundState; outcome:{ actionKind:"LEAD"|"EXTEND"|"REPLACE"|"PASS"; fieldCleared:boolean; naturalRevolution:boolean; dayNightAfter:DayNight; winnerId:string|null } }
  | { ok:false; reason:PlayRejectionReason; state:RoundState };
function rankNumber(rankCode): number;  // "RANK_5" -> 5
const RANK_CODES: readonly RankCode[];  const SUIT_CODES: readonly SuitCode[];

// legalMoves.ts（現状）
type LegalPlay = { input:PlayInput; actionKind:PlayActionKind|"PASS"; resultingCombination:NumberCombination|null; goesOut:boolean };
function enumerateLegalPlays(state: RoundState): LegalPlay[];   // ← 第2引数を足す
function resultStrength(combination, dayNight): number;
// private: candidateCardIdSets(hand): string[][]  — 単体/同数2..4/連番2..9。Task 3 で再利用のため export 化する

// roundLoop.ts
function playRound(input): RoundResult;  // 内部で enumerateLegalPlays(state) を呼ぶ
```

---

## Task 1: `core.ts` 分割 + `allowImportingTsExtensions` + metro シム除去

**Files:**
- Rename: `packages/game-core/src/index.ts` → `packages/game-core/src/core.ts`
- Create: `packages/game-core/src/index.ts`（薄いバレル）
- Modify: `packages/game-core/tsconfig.json`
- Modify: `packages/game-core/src/{deal,legalMoves,cpuPolicy,cpuPolicyStandard,roundLoop}.ts`（import 指定子 `.js`→`.ts`、`./index.js`→`./core.ts`）
- Modify: `apps/mobile/metro.config.js`（game-core シム分岐を削除）
- Create: `packages/game-core/src/barrelExports.test.ts`

- [ ] **Step 1: リネームとバレル作成**
  - `git mv packages/game-core/src/index.ts packages/game-core/src/core.ts`
  - `core.ts` 末尾の `// ---- M2: headless CPU engine ----` ブロック（`export * from "./rng.js";` 等 6 行）を削除。
  - 新 `packages/game-core/src/index.ts`:
    ```ts
    export * from "./core.ts";
    export * from "./rng.ts";
    export * from "./deal.ts";
    export * from "./legalMoves.ts";
    export * from "./cpuPolicy.ts";
    export * from "./cpuPolicyStandard.ts";
    export * from "./roundLoop.ts";
    ```

- [ ] **Step 2: tsconfig** — `packages/game-core/tsconfig.json` の `compilerOptions` に `"allowImportingTsExtensions": true` を追加（`noEmit: true` が既にあるので可）。

- [ ] **Step 3: M2 ソースの import を修正** — 各ファイルの先頭 import を書き換え：
  - `deal.ts`: `from "./index.js"` → `from "./core.ts"`、`from "./rng.js"` → `from "./rng.ts"`。
  - `legalMoves.ts`: `from "./index.js"` → `from "./core.ts"`。
  - `cpuPolicy.ts`: `from "./index.js"` → `from "./core.ts"`、`from "./legalMoves.js"` → `.ts`、`from "./rng.js"` → `.ts`、`from "./cpuPolicyStandard.js"` → `.ts`。
  - `cpuPolicyStandard.ts`: `from "./index.js"` → `from "./core.ts"`、`from "./cpuPolicy.js"` → `.ts`、`from "./legalMoves.js"` → `.ts`、`from "./rng.js"` → `.ts`。
  - `roundLoop.ts`: `from "./index.js"` → `from "./core.ts"`、`from "./deal.js"` / `./legalMoves.js` / `./cpuPolicy.js` / `./rng.js` → `.ts`。
  - `rng.ts`: 相対 import 無し（変更不要）。
  - 循環が消えたので、各ファイルのトップコメントにあった「TDZ 回避のため関数本体でのみ使う」注記は残してよい（害なし）が、`deal.ts` の `numberDeck()`/`skillDeck()` を `const` に戻す必要はない。

- [ ] **Step 4: metro シム除去** — `apps/mobile/metro.config.js` から `gameCoreSrc` 定数とそれを使う `resolveRequest` 内の分岐（`moduleName.startsWith("./") && moduleName.endsWith(".js") && ... originModulePath.startsWith(gameCoreSrc)`）を削除。`@card-game-app/ui` → `uiTokensEntry` の分岐と既定リゾルバ委譲は残す。

- [ ] **Step 5: バレルテスト** — `packages/game-core/src/barrelExports.test.ts`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolvePlay, evaluateNumberPlay, createRoundState, dealRound,
  enumerateLegalPlays, resolveCpuPolicy, playRound, createRng,
} from "./index.ts";

test("core.ts split: all headline symbols resolve through the barrel", () => {
  for (const fn of [
    resolvePlay, evaluateNumberPlay, createRoundState, dealRound,
    enumerateLegalPlays, resolveCpuPolicy, playRound, createRng,
  ]) {
    assert.equal(typeof fn, "function");
  }
});
```

- [ ] **Step 6: 確認**
```
npm run game-core:test          # 184 + 1 新規、回帰なし
npm run game-core:typecheck
npm run mobile:typecheck
npm run mobile:test             # 180、回帰なし
cd apps/mobile && npx expo export --platform android && cd ../..   # metro シム削除後もバンドル成立
git diff --check
```
`expo export` が失敗する場合は metro の解決を診断（`.ts` が `sourceExts` に入っているか）。壊れたバンドルはコミットしない。

- [ ] **Step 7: コミット**
```
git add packages/game-core/src/core.ts packages/game-core/src/index.ts packages/game-core/src/deal.ts packages/game-core/src/legalMoves.ts packages/game-core/src/cpuPolicy.ts packages/game-core/src/cpuPolicyStandard.ts packages/game-core/src/roundLoop.ts packages/game-core/src/barrelExports.test.ts packages/game-core/tsconfig.json apps/mobile/metro.config.js
git commit -m "refactor(game-core): [M3] split index.ts into core.ts + barrel, drop circular-import contract"
```
> `git mv` の名前変更は `git status` で rename として認識される。念のため `git add` に旧新両パスを含める（上のコマンドは新パスのみ；rename 検出のため `git add -u packages/game-core/src/` でも可だが `-A` は使わない）。

---

## Task 2: カード保存則の変化Joker対応

**Files:**
- Modify: `packages/game-core/src/roundLoop.ts`（`assertInvariants`）
- Modify: `packages/game-core/src/roundLoop.test.ts`
- Modify: `apps/mobile/src/state/cpuGameStore.ts`（`assertCardConservation` 相当）
- Modify: `apps/mobile/src/state/cpuGameStore.test.ts`

- [ ] **Step 1: `roundLoop.ts` の `assertInvariants`** — 実カード判定を導入し、保存則と cardId 一意を実カードのみで評価：
```ts
function isRealCard(card: NumberCard): boolean {
  return card.transformedFromSkillId === undefined;
}

function assertInvariants(state: RoundState, turnIndex: number, playerIds: string[]): void {
  const handCards = state.players.flatMap((p) => p.hand).filter(isRealCard);
  const fieldCards = (state.activeField?.combination.cards ?? []).filter(isRealCard);
  const discardCards = state.discardPile.filter(isRealCard);
  const total = handCards.length + discardCards.length + fieldCards.length;
  if (total !== 36) {
    throw new Error(`playRound: real card conservation broken at turn ${turnIndex} (total ${total})`);
  }
  const handIds = handCards.map((c) => c.cardId);
  if (new Set(handIds).size !== handIds.length) {
    throw new Error(`playRound: duplicate real card in hands at turn ${turnIndex}`);
  }
  if (!playerIds.includes(state.activePlayerId)) {
    throw new Error(`playRound: active player "${state.activePlayerId}" not seated at turn ${turnIndex}`);
  }
}
```
（`NumberCard` の import が無ければ型 import を追加。）

- [ ] **Step 2: `roundLoop.test.ts`** — 変化Joker が場に出る局を作って保存則が成立することを検証：
  - `createRoundState` で手番プレイヤーに `skill: createSkillCard("SK1", "SKILL_JOKER_HERO")` を持たせ、`resolvePlay(state, { kind:"PLAY", playerId, cardIds:[<1枚>], useSkill:"JOKER_TRANSFORM", jokerDeclarations:[{skillId:"SK1", rankCode, suitCode}] })` を適用した `res.state` に対し、`isReal` フィルタ後の総数が 36 であることを直接 assert（`assertInvariants` は内部関数なので、公開の `playRound` 経由 or 保存則を直接計算するヘルパで検証）。
  - 既存の全人数完走テストに回帰がないこと。

- [ ] **Step 3: `apps/mobile/src/state/cpuGameStore.ts`** — カード保存則を計算している箇所（M2 レビューで「`assertCardConservation` (`cpuGameStore.ts:~86`)」と特定済み）に同じ `transformedFromSkillId === undefined` フィルタを適用。ヘルパ名は既存に合わせる。

- [ ] **Step 4: `apps/mobile/src/state/cpuGameStore.test.ts`** — 「CPU がスキルを使う対局（`STANDARD` ポリシーがスキル手を返す seed）でも `startMatch → ループ → ROUND_OVER` が完走し保存則違反 throw が無い」ケースを追加。**このテストは Task 5・Task 6 完了後でないと `STANDARD` がスキルを使わない**ため、Task 6 の一部として本ステップを実施してよい（ここでは `roundLoop` 側の Step 1〜2 のみ確定させ、mobile 側は Task 6 で仕上げる）。

- [ ] **Step 5: 確認** — `npm run game-core:test` / `:typecheck`（mobile は Task 6 でまとめて）。

- [ ] **Step 6: コミット**
```
git add packages/game-core/src/roundLoop.ts packages/game-core/src/roundLoop.test.ts apps/mobile/src/state/cpuGameStore.ts
git commit -m "fix(game-core): [M3] count only real cards in the conservation invariant"
```

---

## Task 3: `enumerateLegalPlays({ includeSkills })` — Joker（CLEAR + TRANSFORM）

**Files:**
- Modify: `packages/game-core/src/legalMoves.ts`
- Modify: `packages/game-core/src/legalMoves.test.ts`

**Interfaces:**
- `enumerateLegalPlays(state, options?: { includeSkills?: boolean }): LegalPlay[]`
- `candidateCardIdSets` を `export` に格上げ（Task 3/4 で再利用）。

- [ ] **Step 1: 失敗するテスト** — `legalMoves.test.ts` に追加：
```ts
// 1. options 省略時は現行と同一
test("enumerateLegalPlays without options is unchanged", () => {
  const state = /* 場あり・手番プレイヤーに数字手札 */;
  assert.deepEqual(enumerateLegalPlays(state), enumerateLegalPlays(state, {}));
});

// 2. Joker 席・場あり → JOKER_CLEAR が出る
test("includeSkills: a Joker holder on a non-empty field can clear-and-lead", () => {
  const state = roundWithField({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_JOKER_HERO" },
    activeSeatHand: [n(2,"FIRE"), n(3,"WATER")],
  });
  const plays = enumerateLegalPlays(state, { includeSkills: true });
  assert.ok(plays.some((p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_CLEAR"));
  for (const p of plays) assert.equal(resolvePlay(state, p.input).ok, true);
});

// 3. Joker 席 → JOKER_TRANSFORM が出る、変化Joker上がりは出ない
test("includeSkills: JOKER_TRANSFORM plays are enumerated but never a go-out", () => {
  const state = roundEmptyField({
    activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_JOKER_SAINT" },
    activeSeatHand: [n(5,"FIRE")],   // 1枚 → transform で出すと go-out
  });
  const plays = enumerateLegalPlays(state, { includeSkills: true });
  const transforms = plays.filter((p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_TRANSFORM");
  assert.ok(transforms.length > 0);
  assert.ok(transforms.every((p) => !p.goesOut));   // 変化Joker上がりは列挙されない
  for (const p of transforms) assert.equal(resolvePlay(state, p.input).ok, true);
});

// 4. スキル無し / used のときは includeSkills でも数字手のみ
test("includeSkills is a no-op without an unused skill", () => {
  const state = roundEmptyField({ activeSeatSkill: null, activeSeatHand: [n(4,"FIRE")] });
  assert.deepEqual(
    enumerateLegalPlays(state, { includeSkills: true }).map((p) => p.input),
    enumerateLegalPlays(state).map((p) => p.input),
  );
});
```
（`roundWithField` / `roundEmptyField` / `n` ヘルパはテスト内で `createRoundState` を組む。手番プレイヤーの `skill` を差し込む。）

- [ ] **Step 2: 失敗確認** — `npm run game-core:test`。

- [ ] **Step 3: `candidateCardIdSets` を export** — 定義に `export` を付ける。

- [ ] **Step 4: 実装** — `legalMoves.ts` を改修：
```ts
export function enumerateLegalPlays(
  state: RoundState,
  options?: { includeSkills?: boolean },
): LegalPlay[] {
  if (state.winnerId) return [];
  const playerId = state.activePlayerId;
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return [];

  const seen = new Set<string>();
  const results: LegalPlay[] = [];

  const pushIfLegal = (input: Extract<PlayInput, { kind: "PLAY" }>) => {
    const res = resolvePlay(state, input);
    if (!res.ok) return;
    const actor = res.state.players.find((p) => p.playerId === playerId);
    const realHand = (actor?.hand ?? []).filter((c) => c.transformedFromSkillId === undefined);
    results.push({
      input,
      actionKind: res.outcome.actionKind,
      resultingCombination: res.state.activeField?.combination ?? null,
      goesOut: realHand.length === 0,
    });
  };

  // 数字手（現行）
  for (const cardIds of candidateCardIdSets(player.hand)) {
    const key = "N|" + [...cardIds].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pushIfLegal({ kind: "PLAY", playerId, cardIds });
  }

  // PASS
  if (resolvePlay(state, { kind: "PASS", playerId }).ok) {
    results.push({ input: { kind: "PASS", playerId }, actionKind: "PASS", resultingCombination: null, goesOut: false });
  }

  // スキル手
  if (options?.includeSkills && player.skill && !player.skill.used) {
    enumerateSkillPlays(state, player, seen, pushIfLegal);
  }

  return sortLegalPlays(results, state.dayNight);
}
```
`goesOut` を「実カード手札 0」へ変更（変化Joker由来カードが手札に無くても念のため）。

`enumerateSkillPlays`（新規、`legalMoves.ts` 内 private）:
```ts
const JOKER_TRANSFORM_CANDIDATE_CAP = 2000;

function enumerateSkillPlays(
  state: RoundState,
  player: PlayerState,
  seen: Set<string>,
  pushIfLegal: (input: Extract<PlayInput, { kind: "PLAY" }>) => void,
): void {
  const playerId = player.playerId;
  const skill = player.skill!;
  const effect = skill.effectCode;

  if (effect === "SKILL_JOKER_HERO" || effect === "SKILL_JOKER_SAINT") {
    // JOKER_CLEAR: 場ありのとき、場流し後の全合法リード
    if (state.activeField) {
      for (const cardIds of candidateCardIdSets(player.hand)) {
        const key = "JC|" + [...cardIds].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        pushIfLegal({ kind: "PLAY", playerId, cardIds, useSkill: "JOKER_CLEAR" });
      }
    }
    // JOKER_TRANSFORM: 9 rank × 4 suit 宣言 × 手札部分集合
    let produced = 0;
    for (const rankCode of RANK_CODES) {
      for (const suitCode of SUIT_CODES) {
        const decl = { skillId: skill.skillId, rankCode, suitCode };
        for (const subsetIds of jokerTransformSubsets(player.hand, rankCode)) {
          if (produced >= JOKER_TRANSFORM_CANDIDATE_CAP) return;
          const key = "JT|" + rankCode + suitCode + "|" + [...subsetIds].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          produced += 1;
          pushIfLegal({ kind: "PLAY", playerId, cardIds: subsetIds, useSkill: "JOKER_TRANSFORM", jokerDeclarations: [decl] });
        }
      }
    }
    return;
  }

  if (effect === "SKILL_EXTENSION_SEAL") { /* Task 4 */ return; }
  if (effect === "SKILL_REVOLUTION") { /* Task 4 */ return; }
}

/** 宣言 rank と組んで単体/同数/連番になり得る手札部分集合の cardId 列（宣言カード自体は含めない）。 */
function jokerTransformSubsets(hand: readonly NumberCard[], declRank: RankCode): string[][] {
  const subsets: string[][] = [[]]; // 宣言のみ = 単体
  const dr = rankNumber(declRank);
  const byRank = groupByRank(hand); // Map<number, NumberCard[]>

  // 同数: 宣言 rank と同じ数字の手札 1..3 枚
  const same = byRank.get(dr) ?? [];
  for (let size = 1; size <= Math.min(3, same.length); size += 1) {
    for (const combo of combinations(same, size)) subsets.push(combo.map((c) => c.cardId));
  }

  // 連番: 宣言 rank を含む連続窓 (長さ 3..9)、宣言以外の rank から 1 枚ずつ
  for (let start = 1; start <= 9; start += 1) {
    for (let len = 3; start + len - 1 <= 9; len += 1) {
      const ranks = Array.from({ length: len }, (_, i) => start + i);
      if (!ranks.includes(dr)) continue;
      const perRank = ranks.filter((r) => r !== dr).map((r) => byRank.get(r) ?? []);
      if (perRank.some((cs) => cs.length === 0)) continue;
      const product = perRank.reduce((a, cs) => a * cs.length, 1);
      if (product > SEQUENCE_CANDIDATE_CAP) continue;
      for (const combo of cartesian(perRank)) subsets.push(combo.map((c) => c.cardId));
    }
  }
  return subsets;
}
```
`groupByRank` は `candidateCardIdSets` 内の byRank 構築を関数に切り出して共有（DRY）。`combinations` / `cartesian` は既存 private をそのまま使う。

`sortLegalPlays` に `useSkill` を組み込む（§5.6）：`count` の後に `[useSkill無し=0 / 有り=1, useSkill名, jokerDecl の rank*10+suitIndex]` を挟む。

- [ ] **Step 5: GREEN + typecheck**。

- [ ] **Step 6: コミット**
```
git add packages/game-core/src/legalMoves.ts packages/game-core/src/legalMoves.test.ts
git commit -m "feat(game-core): [M3-EX-03] enumerate Joker clear/transform plays under includeSkills"
```

---

## Task 4: `enumerateLegalPlays` — 追加封印 + 革命

**Files:**
- Modify: `packages/game-core/src/legalMoves.ts`
- Modify: `packages/game-core/src/legalMoves.test.ts`

- [ ] **Step 1: 失敗するテスト**:
```ts
// 封印席: 各合法数字手に EXTENSION_SEAL 併用版が出る
test("includeSkills: an EXTENSION_SEAL holder gets a sealed variant of each number play", () => {
  const state = roundWithField({ activeSeatSkill: { skillId: "SK1", effectCode: "SKILL_EXTENSION_SEAL" }, /* 応答できる手札 */ });
  const bare = enumerateLegalPlays(state).filter((p) => p.input.kind === "PLAY");
  const withSkill = enumerateLegalPlays(state, { includeSkills: true });
  for (const b of bare) {
    assert.ok(withSkill.some((p) =>
      p.input.kind === "PLAY" && p.input.useSkill === "EXTENSION_SEAL" &&
      sameSet(p.input.cardIds, b.input.cardIds)));
  }
});

// 革命席: 反転後に合法な手が出る（現昼夜で不正な手が革命併用で合法になる例）
test("includeSkills: a REVOLUTION holder gets plays that are legal only after the flip", () => {
  const state = /* 昼で NOT_STRONGER になるが夜なら通る候補を持つ状態 */;
  const plays = enumerateLegalPlays(state, { includeSkills: true });
  const rev = plays.filter((p) => p.input.kind === "PLAY" && p.input.useSkill === "REVOLUTION");
  assert.ok(rev.length > 0);
  for (const p of rev) assert.equal(resolvePlay(state, p.input).ok, true);
});
```

- [ ] **Step 2: 失敗確認**。

- [ ] **Step 3: 実装** — `enumerateSkillPlays` の封印・革命分岐：
```ts
if (effect === "SKILL_EXTENSION_SEAL") {
  for (const cardIds of candidateCardIdSets(player.hand)) {
    const key = "ES|" + [...cardIds].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pushIfLegal({ kind: "PLAY", playerId, cardIds, useSkill: "EXTENSION_SEAL" });
  }
  return;
}
if (effect === "SKILL_REVOLUTION") {
  for (const cardIds of candidateCardIdSets(player.hand)) {
    const key = "RV|" + [...cardIds].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pushIfLegal({ kind: "PLAY", playerId, cardIds, useSkill: "REVOLUTION" });
  }
  return;
}
```
（封印は手自体の合法性を変えないが、`pushIfLegal` のドライランで確認。革命は `resolvePlay` が `usesRevolutionSkill` 経由で反転後判定する。）

- [ ] **Step 4: GREEN + typecheck**。

- [ ] **Step 5: コミット**
```
git add packages/game-core/src/legalMoves.ts packages/game-core/src/legalMoves.test.ts
git commit -m "feat(game-core): [M3-EX-03] enumerate seal/revolution plays under includeSkills"
```

---

## Task 5: `standardPolicy` のスキルヒューリスティック

**Files:**
- Modify: `packages/game-core/src/cpuPolicyStandard.ts`
- Modify: `packages/game-core/src/cpuPolicy.test.ts`

**設計参照:** §6。判定順は §6 の 1〜4。

- [ ] **Step 1: 失敗するテスト** — `cpuPolicy.test.ts` に追加。`standardPolicy({ state, legalPlays: enumerateLegalPlays(state, { includeSkills: true }), rng })` を呼ぶ：
  - Joker 席・場あり・数字応答なし → 返り値 `useSkill === "JOKER_CLEAR"`。
  - 封印席・数字応答が REPLACE → 返り値 `useSkill === "EXTENSION_SEAL"`。
  - 革命席・数字応答なし・反転で合法な革命応答あり → 返り値 `useSkill === "REVOLUTION"`。
  - JOKER_TRANSFORM で手札を多く減らせる局面 → 返り値 `useSkill === "JOKER_TRANSFORM"`。
  - スキル無し → M2 と同じ挙動（既存テストに回帰なし）。
  - 同 seed で 2 回呼んで同じ `PlayInput`。

- [ ] **Step 2: 失敗確認**。

- [ ] **Step 3: 実装** — `standardPolicy` を §6 の順で書き換え。`pickWeakest` は既存流用。ヘルパ：
```ts
function playHandCount(p: LegalPlay): number {
  return p.input.kind === "PLAY" ? p.input.cardIds.length : 0;
}
function activeSkillEffect(state: CpuDecisionInput["state"]): string | null {
  const s = state.players.find((p) => p.playerId === state.activePlayerId)?.skill;
  return s && !s.used ? s.effectCode : null;
}
```
判定：
```ts
export const standardPolicy: CpuPolicy = ({ state, legalPlays, rng }) => {
  const dayNight = state.dayNight;
  const strengthOf = (p: LegalPlay) => (p.resultingCombination ? resultStrength(p.resultingCombination, dayNight) : 0);

  // 1. 上がれる手
  const winning = legalPlays.filter((p) => p.goesOut);
  if (winning.length > 0) return pickWeakest(winning, strengthOf, rng).input;

  // 2. 場が空 → 最弱の単体数字（スキル無し）
  if (state.activeField === null) {
    const singles = legalPlays.filter(
      (p) => p.actionKind === "LEAD" && p.input.kind === "PLAY" &&
             p.input.cardIds.length === 1 && p.input.useSkill === undefined,
    );
    return pickWeakest(singles, (p) => singleStrength(state, p), rng).input;
  }

  // 3. 場がある
  const numberResponses = legalPlays.filter(
    (p) => p.actionKind !== "PASS" && p.input.kind === "PLAY" && p.input.useSkill === undefined,
  );
  if (numberResponses.length > 0) {
    const best = pickWeakest(numberResponses, strengthOf, rng);
    const bestCount = playHandCount(best);

    const jokerDump = legalPlays.filter(
      (p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_TRANSFORM" &&
             !p.goesOut && playHandCount(p) > bestCount,
    );
    if (jokerDump.length > 0) return pickWeakest(jokerDump, strengthOf, rng).input;

    if ((best.actionKind === "EXTEND" || best.actionKind === "REPLACE") &&
        activeSkillEffect(state) === "SKILL_EXTENSION_SEAL") {
      const sealed = legalPlays.find(
        (p) => p.input.kind === "PLAY" && p.input.useSkill === "EXTENSION_SEAL" &&
               best.input.kind === "PLAY" && sameSet(p.input.cardIds, best.input.cardIds),
      );
      if (sealed) return sealed.input;
    }
    return best.input;
  }

  // 4. 数字応答なし → スキルで打開 or PASS
  const effect = activeSkillEffect(state);
  if (effect === "SKILL_JOKER_HERO" || effect === "SKILL_JOKER_SAINT") {
    const clears = legalPlays.filter((p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_CLEAR");
    if (clears.length > 0) return pickWeakest(clears, strengthOf, rng).input;
  }
  if (effect === "SKILL_REVOLUTION") {
    const revs = legalPlays.filter(
      (p) => p.input.kind === "PLAY" && p.input.useSkill === "REVOLUTION" && p.actionKind !== "PASS",
    );
    if (revs.length > 0) return pickWeakest(revs, strengthOf, rng).input;
  }
  return { kind: "PASS", playerId: state.activePlayerId };
};
```
`sameSet(a, b)` は cardId 集合の一致（小ヘルパ）。

- [ ] **Step 4: GREEN + typecheck**。

- [ ] **Step 5: コミット**
```
git add packages/game-core/src/cpuPolicyStandard.ts packages/game-core/src/cpuPolicy.test.ts
git commit -m "feat(game-core): [M3-EX-03] add minimal skill heuristic to standardPolicy"
```

---

## Task 6: 配線 + 1000局QA + mobile 保存則テスト

**Files:**
- Modify: `packages/game-core/src/roundLoop.ts`（`enumerateLegalPlays(state, { includeSkills: true })`）
- Modify: `apps/mobile/src/features/cpu-game/turnDriver.ts`（`cpuStep` のみ）
- Modify: `packages/game-core/src/cpuSelfPlay.test.ts`
- Modify: `apps/mobile/src/state/cpuGameStore.test.ts`
- Create: `docs/qa/M3-QA-01-cpu-skill-self-play-report.md`

- [ ] **Step 1: `roundLoop.ts`** — `const legalPlays = enumerateLegalPlays(state);` → `const legalPlays = enumerateLegalPlays(state, { includeSkills: true });`。

- [ ] **Step 2: `turnDriver.ts` `cpuStep`** — `enumerateLegalPlays(state.round)` → `enumerateLegalPlays(state.round, { includeSkills: true })`。`legalPlaysForHuman` は変更しない（人間は M3-EX-01/02 まで数字手のみ）。

- [ ] **Step 3: `cpuSelfPlay.test.ts` 拡張** — §8：
  - `RUN_FULL ? 200 : 20` seed / 人数（フル = 1000 局）。
  - 全局 `stopReason === "WINNER"`、throw なし。
  - **軽量テスト範囲で 4 スキル全種がトレースに出現**：全 `result.turns` を走査し `useSkill` の集合が `{JOKER_CLEAR, JOKER_TRANSFORM, EXTENSION_SEAL, REVOLUTION}` を包含。含まなければ fail（seed 群を調整するのではなくヒューリスティック/列挙のバグとして扱う。どうしても軽量範囲で全種出ないスキルがあれば、そのスキルを保有する席を強制する専用 seed を1つ足す）。
  - 変化Joker上がり 0：`turns` の最後が `winnerId` を出した手で、その `input.useSkill === "JOKER_TRANSFORM"` のケースが 0。

- [ ] **Step 4: `cpuGameStore.test.ts`（mobile）** — Task 2 Step 4 をここで完成：`STANDARD` がスキルを使う seed（`makeSeed` を固定し、スキル手が発生する人数・seed を選ぶ）で `startMatch → submitPlay/advanceCpu ループ → ROUND_OVER` が完走、保存則 throw なし。

- [ ] **Step 5: QA レポート** — `docs/qa/M3-QA-01-cpu-skill-self-play-report.md`（`docs/qa/M2-QA-01-*` 書式）：対象、実行コマンド（`npm run game-core:test` 軽量 / `RUN_FULL=1` で 1000 局）、結果（人数×seed、全局 WINNER、不正手 throw 0、不変条件違反 0、4スキル発動回数、変化Joker上がり 0）、回帰登録、残課題（実機の全スキル境界＝M3-QA-02、ヒューリスティック調整）。

- [ ] **Step 6: 全体確認**
```
npm run game-core:test / :typecheck
npm run mobile:test / :typecheck / :lint / :format:check
cd apps/mobile && npx expo export --platform android && cd ../..
git diff --check
```

- [ ] **Step 7: コミット**
```
git add packages/game-core/src/roundLoop.ts packages/game-core/src/cpuSelfPlay.test.ts apps/mobile/src/features/cpu-game/turnDriver.ts apps/mobile/src/state/cpuGameStore.test.ts docs/qa/M3-QA-01-cpu-skill-self-play-report.md
git commit -m "feat(game-core): [M3-QA-01] wire includeSkills into playRound + cpuStep, 1000-game harness"
```

---

## Task 7: 進捗ドキュメント + スイープ

**Files:**
- Create: `docs/progress/M3-EX-03.md`, `docs/progress/M3-QA-01.md`

- [ ] **Step 1: 進捗ドキュメント** — 既存 `docs/progress/M2-EX-03.md` 書式。
  - `M3-EX-03.md`：概要（`enumerateLegalPlays` の `{ includeSkills }`、`standardPolicy` のスキル層）／成果物（`legalMoves.ts` / `cpuPolicyStandard.ts` / `core.ts` 分割 / `roundLoop.ts` 保存則）／確認（テスト件数）／メモ（ヒューリスティックは最小版、QA-01 で全種発動確認済み、調整は後続。`core.ts` 分割で循環 import 制約と metro シム除去）。
  - `M3-QA-01.md`：状態=完了／概要／成果物（`cpuSelfPlay.test.ts` / QA レポート）／確認。

- [ ] **Step 2: スイープ**
```
npm run game-core:test
npm run game-core:typecheck
npm run mobile:test
npm run mobile:typecheck
npm run mobile:lint
npm run mobile:format:check
npm run ui:test
cd apps/mobile && npx expo export --platform android && cd ../..
git diff --check
```
全 PASS を進捗ドキュメントへ記録。

- [ ] **Step 3: コミット**
```
git add docs/progress/M3-EX-03.md docs/progress/M3-QA-01.md
git commit -m "docs(progress): [M3] record CPU skill policy completion"
```

---

## Self-Review

**1. Spec coverage:**

| 設計書 | タスク |
|---|---|
| §3 core.ts 分割 | Task 1 |
| §4 カード保存則 | Task 2（game-core）+ Task 6 Step 4（mobile テスト） |
| §5.2/5.3 Joker 列挙 | Task 3 |
| §5.4/5.5 封印・革命 列挙 | Task 4 |
| §5.6 決定的順序 | Task 3（`sortLegalPlays` 拡張） |
| §6 standardPolicy | Task 5 |
| §7 配線 | Task 6 Step 1-2 |
| §8 QA-01 | Task 6 Step 3, 5 |
| §9 テスト | 各タスク |
| §10 確認 | Task 7 |

**2. Placeholder scan:** `JOKER_TRANSFORM_CANDIDATE_CAP = 2000`、`SEQUENCE_CANDIDATE_CAP = 1024`（既存）は具体値。テストヘルパ（`roundWithField` 等）は各タスクで `createRoundState` から組む旨を明記。§6 のヒューリスティックは全分岐を疑似コードで記載。

**3. Type consistency:**
- `enumerateLegalPlays` 第2引数は `options?: { includeSkills?: boolean }`（Task 3 で追加、Task 6 で `{ includeSkills: true }` 指定）。省略時は現行と同一 — Task 3 Step 1 のテストで担保。
- `LegalPlay.input` は `PlayInput` union（`useSkill` / `jokerDeclarations` を含む）。スキル手の `input` は `Extract<PlayInput, { kind: "PLAY" }>`。
- `candidateCardIdSets` を `export`（Task 3）→ Task 3/4 の skill enumeration で再利用。`combinations` / `cartesian` は private のまま。
- `standardPolicy` は `state.players[active].skill.effectCode`（`SkillEffectCode`）を読む。`activeSkillEffect` ヘルパ。
- `roundLoop.ts` の `isRealCard` / `assertInvariants` と mobile 側の保存則ヘルパは同じ `transformedFromSkillId === undefined` 判定（Task 2）。

**4. `core.ts` 分割の import 連鎖（Task 1）:** `index.ts`（バレル）→ `core.ts` + 6モジュール。6モジュール → `core.ts` + 兄弟（`.ts`）。`core.ts` → 相対 import 無し。循環なし。`.test.ts` は `from "./index.ts"` のまま（バレル経由で全解決）。metro は `.ts` を `sourceExts` で解決するのでシム不要（probe 済み：`allowImportingTsExtensions` + `.ts` 指定子で `game-core:typecheck` / `tsx` が通ることを確認済み）。
