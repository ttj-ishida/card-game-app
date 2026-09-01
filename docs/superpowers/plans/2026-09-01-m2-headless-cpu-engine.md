# M2 ヘッドレスCPU対局エンジン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `packages/game-core` に、配布・合法手列挙・選択可能なCPUポリシー・ヘッドレス対局ループを純ロジックで積み、CPU同士が配布から勝者まで無停止で1局を完走できるようにする。

**Architecture:** 既存の `resolvePlay`（1手の状態遷移の唯一の正）の上に6つの新ファイルを重ねる層状設計。決定的PRNG を seed から生成して注入し、配布・同点タイブレーク・思考待ち算出をすべて再現可能にする。判定ロジックは列挙器にもポリシーにも複製せず `resolvePlay` に一元化する。

**Tech Stack:** TypeScript（`module: NodeNext`、`strict`）、`node:test` + `tsx`、依存追加なし。

**設計書:** `docs/superpowers/specs/2026-09-01-m2-headless-cpu-engine-design.md`（§番号は本プランから参照する）。

## Global Constraints

- `packages/game-core` に依存を追加しない（zero-dep、`node:test` + `tsx` のみ）。
- `game-core:typecheck`（`tsc --noEmit`、`include: ["src/index.ts"]`）は `src/index.ts` 経由のシンボルだけを型検査する。**新規公開シンボルはすべて `src/index.ts` から re-export する**。テストファイルは型検査対象外 → テスト側の型健全性は実装者が手動監査する。
- `packages/game-core/src/` 内のソース間 import と `index.ts` の re-export は **`.js` 拡張子**で書く（`tsconfig` は `moduleResolution: NodeNext` かつ `allowImportingTsExtensions` 無効。`tsc` は `index.ts` から到達する全ソースを追うため、ソースが `.ts` 指定子を持つと TS5097 で落ちる。例：`export * from "./rng.js";` / `import { shuffle } from "./rng.js";`）。テストファイル（`*.test.ts`）は既存慣習どおり `.ts` 指定子でよい（型検査対象外、`tsx` が解決）。
- game-core は純粋・同期・決定的。時計・タイマー・スレッド・I/O・モジュールスコープの可変状態を持たない。乱数は必ず注入された `Rng` 経由。
- 既存 export の**シグネチャは変更しない**。private 関数を `export` に格上げするのは可（追加的変更）。既存ファイル `index.ts` への変更は「re-export 行の追加」と「`combinationStrength` への `export` 付与」のみ。
- カードID命名：数字 `CARD_NUMBER_RANK_<r>_SUIT_<s>`（例 `CARD_NUMBER_RANK_1_SUIT_FIRE`）、スキル物理カード `SKILL_CARD_JOKER_HERO` / `SKILL_CARD_JOKER_SAINT` / `SKILL_CARD_EXTENSION_SEAL_1` / `SKILL_CARD_EXTENSION_SEAL_2` / `SKILL_CARD_REVOLUTION_1` / `SKILL_CARD_REVOLUTION_2`。
- 表示名・日本語文言・resource key を対局状態や `TurnRecord` に入れない。`TurnRecord` は手札の中身を持たず枚数のみ。
- 各タスク完了時に `npm run game-core:test` と `npm run game-core:typecheck` が通ること。既存 114 テストに回帰を出さない。
- コミットは main 上で行う（このプロジェクトの運用。ブランチ・PR は作らない）。コミットメッセージ末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。

## 参照する既存シンボル（`packages/game-core/src/index.ts` から）

```ts
// 型
type RankCode; // "RANK_1".."RANK_9"
type SuitCode; // "SUIT_FIRE" | "SUIT_WATER" | "SUIT_WIND" | "SUIT_EARTH"
type SkillEffectCode; // "SKILL_JOKER_HERO" | "SKILL_JOKER_SAINT" | "SKILL_EXTENSION_SEAL" | "SKILL_REVOLUTION"
type DayNight; // "DAY" | "NIGHT"
type NumberCard = { kind: "NUMBER"; cardId: string; rankCode: RankCode; suitCode: SuitCode; transformedFromSkillId?: string };
type SkillCard = { kind: "SKILL"; skillId: string; effectCode: SkillEffectCode; used: boolean };
type PlayerState = { playerId: string; status: "ACTIVE" | "PASSED" | "OUT"; hand: NumberCard[]; skill: SkillCard | null; consecutivePasses: number };
type NumberCombination = { kind: "SINGLE" | "RANK_SET" | "SEQUENCE"; cards: NumberCard[]; ranks: number[] };
type ActiveField = { combination: NumberCombination; lastPlayerId: string; lock: FieldLock };
type RoundState = { rulesetCode: "INITIAL"; rulesetVersion: number; dayNight: DayNight; players: PlayerState[]; activePlayerId: string; activeField: ActiveField | null; extensionSealed: boolean; discardPile: NumberCard[]; consecutivePasses: number; winnerId: string | null };
type PlayActionKind = "LEAD" | "EXTEND" | "REPLACE";
type PlayInput = { kind: "PASS"; playerId: string } | { kind: "PLAY"; playerId: string; cardIds: string[]; useSkill?: PlaySkillUse; jokerDeclarations?: JokerDeclaration[] };
type PlayResolution = { ok: true; state: RoundState; outcome: PlayOutcome } | { ok: false; reason: PlayRejectionReason; state: RoundState };
type PlayOutcome = { actionKind: PlayActionKind | "PASS"; fieldCleared: boolean; naturalRevolution: boolean; dayNightAfter: DayNight; winnerId: string | null };

// 定数・関数
const RANK_CODES: readonly RankCode[];
const SUIT_CODES: readonly SuitCode[];
const INITIAL_RULESET_VERSION: number; // 1
function createNumberCard(cardId: string, rankCode: RankCode, suitCode: SuitCode): NumberCard;
function createSkillCard(skillId: string, effectCode: SkillEffectCode, used?: boolean): SkillCard;
function createPlayerState(playerId: string, hand: NumberCard[], skill?: Omit<SkillCard, "kind"> | SkillCard | null): PlayerState;
function createRoundState(input: { rulesetCode: "INITIAL"; rulesetVersion: number; dayNight: DayNight; players: PlayerState[]; activePlayerId: string; activeField?: ActiveField | null; extensionSealed?: boolean; discardPile?: NumberCard[]; consecutivePasses?: number; winnerId?: string | null }): RoundState;
function rankNumber(rankCode: RankCode): number;         // "RANK_5" -> 5
function rankStrength(rank: number, dayNight: DayNight): number; // DAY: rank, NIGHT: 10 - rank
function resolvePlay(state: RoundState, play: PlayInput): PlayResolution; // 入力を変更しない（内部でクローン）
```

`combinationStrength(combination, dayNight): number` は現在 private。Task 3 で `export` を付ける。

---

## Task 1: `rng.ts` — 決定的PRNG

**Files:**
- Create: `packages/game-core/src/rng.ts`
- Create: `packages/game-core/src/rng.test.ts`
- Modify: `packages/game-core/src/index.ts`（末尾に re-export 1行）

**Interfaces:**
- Consumes: なし
- Produces:
  - `type Rng = { nextUint32(): number; nextInt(bound: number): number; nextFloat(): number; fork(): Rng }`
  - `function createRng(seed: number): Rng`
  - `function shuffle<T>(rng: Rng, items: readonly T[]): T[]`

- [ ] **Step 1: 失敗するテストを書く** — `packages/game-core/src/rng.test.ts`

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { createRng, shuffle } from "./index.ts";

test("createRng is deterministic for the same seed", () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const seqA = Array.from({ length: 10 }, () => a.nextUint32());
  const seqB = Array.from({ length: 10 }, () => b.nextUint32());
  assert.deepEqual(seqA, seqB);
});

test("createRng differs for different seeds", () => {
  const a = createRng(1);
  const b = createRng(2);
  assert.notDeepEqual(
    Array.from({ length: 5 }, () => a.nextUint32()),
    Array.from({ length: 5 }, () => b.nextUint32()),
  );
});

test("createRng coerces the seed to uint32", () => {
  const a = createRng(7);
  const b = createRng(7 + 2 ** 32);
  assert.deepEqual(
    Array.from({ length: 5 }, () => a.nextUint32()),
    Array.from({ length: 5 }, () => b.nextUint32()),
  );
});

test("nextUint32 stays within [0, 2^32)", () => {
  const rng = createRng(99);
  for (let i = 0; i < 1000; i += 1) {
    const value = rng.nextUint32();
    assert.ok(Number.isInteger(value) && value >= 0 && value < 2 ** 32);
  }
});

test("nextInt stays within [0, bound) and covers the range", () => {
  const rng = createRng(5);
  const seen = new Set<number>();
  for (let i = 0; i < 500; i += 1) {
    const value = rng.nextInt(4);
    assert.ok(Number.isInteger(value) && value >= 0 && value < 4);
    seen.add(value);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
});

test("nextInt rejects non-positive or non-integer bounds", () => {
  const rng = createRng(1);
  assert.throws(() => rng.nextInt(0), RangeError);
  assert.throws(() => rng.nextInt(-3), RangeError);
  assert.throws(() => rng.nextInt(2.5), RangeError);
});

test("nextFloat stays within [0, 1)", () => {
  const rng = createRng(3);
  for (let i = 0; i < 1000; i += 1) {
    const value = rng.nextFloat();
    assert.ok(value >= 0 && value < 1);
  }
});

test("createRng rejects a non-finite seed", () => {
  assert.throws(() => createRng(Number.NaN), RangeError);
  assert.throws(() => createRng(Number.POSITIVE_INFINITY), RangeError);
});

test("fork produces an independent stream and advances the parent", () => {
  const parent1 = createRng(42);
  const child1 = parent1.fork();
  const parent2 = createRng(42);
  // parent2 without forking should diverge from parent1 (which advanced on fork)
  assert.notEqual(parent1.nextUint32(), parent2.nextUint32());
  // two forks of equal parents match
  const child2 = createRng(42).fork();
  assert.deepEqual(
    Array.from({ length: 5 }, () => child1.nextUint32()),
    Array.from({ length: 5 }, () => child2.nextUint32()),
  );
});

test("sibling forks are independent", () => {
  const parent = createRng(7);
  const a = parent.fork();
  const b = parent.fork();
  assert.notDeepEqual(
    Array.from({ length: 5 }, () => a.nextUint32()),
    Array.from({ length: 5 }, () => b.nextUint32()),
  );
});

test("shuffle returns a permutation without mutating the input", () => {
  const rng = createRng(2024);
  const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const out = shuffle(rng, input);
  assert.equal(out.length, input.length);
  assert.deepEqual([...out].sort((x, y) => x - y), [...input].sort((x, y) => x - y));
  assert.deepEqual([...input], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("shuffle is deterministic for the same seed and actually reorders", () => {
  const input = Array.from({ length: 20 }, (_, i) => i);
  const a = shuffle(createRng(1), input);
  const b = shuffle(createRng(1), input);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, input);
});
```

- [ ] **Step 2: テストが失敗することを確認** — Run: `npm run game-core:test`。Expected: FAIL（`createRng` / `shuffle` が未定義）。

- [ ] **Step 3: `packages/game-core/src/rng.ts` を実装**

```ts
export type Rng = {
  /** 一様乱数 [0, 2^32) */
  nextUint32(): number;
  /** 一様整数 [0, bound)。bound は正の整数 */
  nextInt(bound: number): number;
  /** 一様小数 [0, 1) */
  nextFloat(): number;
  /** 独立したストリームを返す。呼び出すと自分自身は1歩進む */
  fork(): Rng;
};

/**
 * mulberry32。32bit・依存なし・決定的。
 * seed は Math.trunc して uint32 に丸める。
 */
export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`createRng: seed must be finite, got ${seed}`);
  }
  let state = Math.trunc(seed) >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  const nextFloat = (): number => nextUint32() / 2 ** 32;

  const nextInt = (bound: number): number => {
    if (!Number.isInteger(bound) || bound <= 0) {
      throw new RangeError(`nextInt: bound must be a positive integer, got ${bound}`);
    }
    // rejection sampling で剰余バイアスを避ける
    const limit = 2 ** 32 - (2 ** 32 % bound);
    let value = nextUint32();
    while (value >= limit) value = nextUint32();
    return value % bound;
  };

  const fork = (): Rng => createRng(nextUint32());

  return { nextUint32, nextInt, nextFloat, fork };
}

/** 入力を変更せず、新しい配列に Fisher–Yates シャッフルした結果を返す。 */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 4: `index.ts` に re-export を追加** — `packages/game-core/src/index.ts` の**末尾**に追記：

```ts

// ---- M2: headless CPU engine ----
export * from "./rng.js";
```

- [ ] **Step 5: テストと型検査を実行** — Run: `npm run game-core:test && npm run game-core:typecheck`。Expected: PASS（新規12件 + 既存114件）。

- [ ] **Step 6: コミット**

```bash
git add packages/game-core/src/rng.ts packages/game-core/src/rng.test.ts packages/game-core/src/index.ts
git commit -m "feat(game-core): [M2] add deterministic Rng and shuffle"
```

---

## Task 2: `deal.ts` — 配布・先攻・昼初期化

**Files:**
- Create: `packages/game-core/src/deal.ts`
- Create: `packages/game-core/src/deal.test.ts`
- Modify: `packages/game-core/src/index.ts`（re-export 1行）
- Create: `docs/progress/M2-EX-01.md`

**Interfaces:**
- Consumes: `Rng`, `shuffle`（Task 1）／`NumberCard`, `SkillCard`, `PlayerState`, `RankCode`, `SuitCode`, `SkillEffectCode`, `RANK_CODES`, `SUIT_CODES`, `createNumberCard`, `createSkillCard`, `createPlayerState`, `rankNumber`（既存）
- Produces:
  - `const NUMBER_DECK: readonly NumberCard[]` — 36枚
  - `const SKILL_DECK: readonly SkillCard[]` — 6枚（`used: false`）
  - `type DealInput = { playerIds: readonly string[]; rng: Rng; rematchIndex?: number; baselineFirstPlayerId?: string }`
  - `type DealResult = { players: PlayerState[]; firstPlayerId: string; dayNight: "DAY"; eightCardSeatId: string | null }`
  - `function dealRound(input: DealInput): DealResult`

**設計参照:** §4.2。配布枚数 2→18/3→12/4→9/5→8+7×4/6→6。乱数消費順序は「shuffle(numbers) → shuffle(skills) →（5人初局のみ）8枚席 nextInt(5) →（5人以外初局のみ）先攻 nextInt(n)」で固定。

- [ ] **Step 1: 失敗するテストを書く** — `packages/game-core/src/deal.test.ts`

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NUMBER_DECK,
  SKILL_DECK,
  createRng,
  dealRound,
  rankNumber,
} from "./index.ts";

const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

test("NUMBER_DECK has the 36 unique number cards", () => {
  assert.equal(NUMBER_DECK.length, 36);
  assert.equal(new Set(NUMBER_DECK.map((c) => c.cardId)).size, 36);
  assert.ok(NUMBER_DECK.every((c) => c.cardId.startsWith("CARD_NUMBER_RANK_")));
});

test("SKILL_DECK has the 6 physical skill cards, all unused", () => {
  assert.equal(SKILL_DECK.length, 6);
  assert.deepEqual(
    SKILL_DECK.map((c) => c.skillId).sort(),
    [
      "SKILL_CARD_EXTENSION_SEAL_1",
      "SKILL_CARD_EXTENSION_SEAL_2",
      "SKILL_CARD_JOKER_HERO",
      "SKILL_CARD_JOKER_SAINT",
      "SKILL_CARD_REVOLUTION_1",
      "SKILL_CARD_REVOLUTION_2",
    ],
  );
  assert.ok(SKILL_DECK.every((c) => c.used === false));
});

for (const [n, expected] of [
  [2, [18, 18]],
  [3, [12, 12, 12]],
  [4, [9, 9, 9, 9]],
  [6, [6, 6, 6, 6, 6, 6]],
] as const) {
  test(`dealRound deals the right counts for ${n} players`, () => {
    const result = dealRound({ playerIds: seats(n), rng: createRng(1) });
    assert.deepEqual(
      result.players.map((p) => p.hand.length),
      expected,
    );
  });
}

test("dealRound gives exactly one 8-card seat for 5 players", () => {
  const result = dealRound({ playerIds: seats(5), rng: createRng(1) });
  const counts = result.players.map((p) => p.hand.length).sort();
  assert.deepEqual(counts, [7, 7, 7, 7, 8]);
  assert.equal(
    result.players.find((p) => p.hand.length === 8)?.playerId,
    result.eightCardSeatId,
  );
  assert.equal(result.eightCardSeatId, result.firstPlayerId); // SETUP-003
});

test("dealRound returns null eightCardSeatId for non-5 players", () => {
  assert.equal(dealRound({ playerIds: seats(4), rng: createRng(1) }).eightCardSeatId, null);
});

test("dealRound distributes all 36 number cards with no duplicates or gaps", () => {
  const result = dealRound({ playerIds: seats(6), rng: createRng(9) });
  const ids = result.players.flatMap((p) => p.hand.map((c) => c.cardId));
  assert.equal(ids.length, 36);
  assert.deepEqual(new Set(ids), new Set(NUMBER_DECK.map((c) => c.cardId)));
});

test("dealRound gives each seat one distinct skill card", () => {
  const result = dealRound({ playerIds: seats(4), rng: createRng(9) });
  const skillIds = result.players.map((p) => p.skill?.skillId);
  assert.ok(skillIds.every((s) => typeof s === "string"));
  assert.equal(new Set(skillIds).size, 4);
});

test("dealRound sorts each hand ascending by rank then suit", () => {
  const result = dealRound({ playerIds: seats(3), rng: createRng(77) });
  for (const player of result.players) {
    for (let i = 1; i < player.hand.length; i += 1) {
      const prev = player.hand[i - 1];
      const cur = player.hand[i];
      const prevKey = rankNumber(prev.rankCode) * 10;
      const curKey = rankNumber(cur.rankCode) * 10;
      assert.ok(prevKey <= curKey);
    }
  }
});

test("dealRound always starts in DAY", () => {
  assert.equal(dealRound({ playerIds: seats(2), rng: createRng(1) }).dayNight, "DAY");
});

test("dealRound is fully reproducible for the same seed", () => {
  const a = dealRound({ playerIds: seats(5), rng: createRng(555) });
  const b = dealRound({ playerIds: seats(5), rng: createRng(555) });
  assert.deepEqual(a, b);
});

test("first round first player is random for non-5 players", () => {
  const firsts = new Set<string>();
  for (let seed = 0; seed < 40; seed += 1) {
    firsts.add(dealRound({ playerIds: seats(4), rng: createRng(seed) }).firstPlayerId);
  }
  assert.ok(firsts.size > 1);
});

test("rematch rotates the first player clockwise (non-5)", () => {
  const ids = seats(4);
  const base = dealRound({ playerIds: ids, rng: createRng(1) }).firstPlayerId;
  const baseIdx = ids.indexOf(base);
  for (let k = 1; k <= 6; k += 1) {
    const r = dealRound({
      playerIds: ids,
      rng: createRng(1000 + k),
      rematchIndex: k,
      baselineFirstPlayerId: base,
    });
    assert.equal(r.firstPlayerId, ids[(baseIdx + k) % 4]);
  }
});

test("rematch rotates both the 8-card seat and the first player (5 players)", () => {
  const ids = seats(5);
  const base = dealRound({ playerIds: ids, rng: createRng(1) }).firstPlayerId;
  const baseIdx = ids.indexOf(base);
  const r = dealRound({
    playerIds: ids,
    rng: createRng(2),
    rematchIndex: 2,
    baselineFirstPlayerId: base,
  });
  assert.equal(r.eightCardSeatId, ids[(baseIdx + 2) % 5]);
  assert.equal(r.firstPlayerId, r.eightCardSeatId);
});

test("dealRound rejects invalid player counts and missing rematch baseline", () => {
  assert.throws(() => dealRound({ playerIds: seats(1), rng: createRng(1) }), RangeError);
  assert.throws(() => dealRound({ playerIds: seats(7), rng: createRng(1) }), RangeError);
  assert.throws(
    () => dealRound({ playerIds: ["a", "a", "b"], rng: createRng(1) }),
    RangeError,
  );
  assert.throws(
    () => dealRound({ playerIds: seats(3), rng: createRng(1), rematchIndex: 1 }),
    RangeError,
  );
});
```

- [ ] **Step 2: テストが失敗することを確認** — Run: `npm run game-core:test`。Expected: FAIL。

- [ ] **Step 3: `packages/game-core/src/deal.ts` を実装**

```ts
import type { NumberCard, PlayerState, SkillCard } from "./index.js";
import {
  RANK_CODES,
  SUIT_CODES,
  createNumberCard,
  createPlayerState,
  createSkillCard,
  rankNumber,
} from "./index.js";
import type { Rng } from "./rng.js";
import { shuffle } from "./rng.js";

export const NUMBER_DECK: readonly NumberCard[] = RANK_CODES.flatMap((rankCode) =>
  SUIT_CODES.map((suitCode) =>
    createNumberCard(`CARD_NUMBER_${rankCode}_${suitCode}`, rankCode, suitCode),
  ),
);

export const SKILL_DECK: readonly SkillCard[] = [
  createSkillCard("SKILL_CARD_JOKER_HERO", "SKILL_JOKER_HERO"),
  createSkillCard("SKILL_CARD_JOKER_SAINT", "SKILL_JOKER_SAINT"),
  createSkillCard("SKILL_CARD_EXTENSION_SEAL_1", "SKILL_EXTENSION_SEAL"),
  createSkillCard("SKILL_CARD_EXTENSION_SEAL_2", "SKILL_EXTENSION_SEAL"),
  createSkillCard("SKILL_CARD_REVOLUTION_1", "SKILL_REVOLUTION"),
  createSkillCard("SKILL_CARD_REVOLUTION_2", "SKILL_REVOLUTION"),
];

export type DealInput = {
  playerIds: readonly string[];
  rng: Rng;
  rematchIndex?: number;
  baselineFirstPlayerId?: string;
};

export type DealResult = {
  players: PlayerState[];
  firstPlayerId: string;
  dayNight: "DAY";
  eightCardSeatId: string | null;
};

function handSize(playerCount: number, seatIndex: number, eightSeatIndex: number | null): number {
  if (playerCount === 5) return seatIndex === eightSeatIndex ? 8 : 7;
  return 36 / playerCount;
}

function sortHand(hand: NumberCard[]): NumberCard[] {
  const suitOrder = new Map(SUIT_CODES.map((s, i) => [s, i]));
  return [...hand].sort(
    (a, b) =>
      rankNumber(a.rankCode) - rankNumber(b.rankCode) ||
      (suitOrder.get(a.suitCode) ?? 0) - (suitOrder.get(b.suitCode) ?? 0),
  );
}

export function dealRound(input: DealInput): DealResult {
  const { playerIds, rng } = input;
  const rematchIndex = input.rematchIndex ?? 0;
  const n = playerIds.length;

  if (n < 2 || n > 6) {
    throw new RangeError(`dealRound: player count must be 2..6, got ${n}`);
  }
  if (new Set(playerIds).size !== n) {
    throw new RangeError("dealRound: playerIds must be unique");
  }

  let baselineIndex = -1;
  if (rematchIndex >= 1) {
    if (input.baselineFirstPlayerId === undefined) {
      throw new RangeError("dealRound: baselineFirstPlayerId is required when rematchIndex >= 1");
    }
    baselineIndex = playerIds.indexOf(input.baselineFirstPlayerId);
    if (baselineIndex < 0) {
      throw new RangeError("dealRound: baselineFirstPlayerId is not in playerIds");
    }
  }

  // 乱数消費順序を固定：numbers -> skills -> (8枚席) -> (初局先攻)
  const numbers = shuffle(rng, NUMBER_DECK);
  const skills = shuffle(rng, SKILL_DECK);

  let eightSeatIndex: number | null = null;
  if (n === 5) {
    eightSeatIndex = rematchIndex === 0 ? rng.nextInt(5) : (baselineIndex + rematchIndex) % 5;
  }

  let firstIndex: number;
  if (n === 5) {
    firstIndex = eightSeatIndex as number;
  } else if (rematchIndex === 0) {
    firstIndex = rng.nextInt(n);
  } else {
    firstIndex = (baselineIndex + rematchIndex) % n;
  }

  const players: PlayerState[] = [];
  let cursor = 0;
  for (let seat = 0; seat < n; seat += 1) {
    const size = handSize(n, seat, eightSeatIndex);
    const hand = sortHand(numbers.slice(cursor, cursor + size));
    cursor += size;
    players.push(createPlayerState(playerIds[seat], hand, skills[seat]));
  }

  return {
    players,
    firstPlayerId: playerIds[firstIndex],
    dayNight: "DAY",
    eightCardSeatId: n === 5 ? playerIds[eightSeatIndex as number] : null,
  };
}
```

- [ ] **Step 4: `index.ts` の re-export ブロックに追記**

```ts
export * from "./deal.js";
```

- [ ] **Step 5: テストと型検査** — Run: `npm run game-core:test && npm run game-core:typecheck`。Expected: PASS。

- [ ] **Step 6: 進捗ドキュメント** — `docs/progress/M2-EX-01.md` を作成（既存 `docs/progress/M1-EX-09.md` の書式に合わせ、日本語で）。含める内容：状態=完了 / 日付=2026-09-01 / 概要（`dealRound` + `NUMBER_DECK` / `SKILL_DECK`）/ 成果物の表（`deal.ts`, `deal.test.ts`）/ 確認（`npm run game-core:test` / `:typecheck` PASS 件数）/ メモ（乱数消費順序の固定、再戦ローテーションは `baselineFirstPlayerId` + `rematchIndex` で呼び出し側が駆動）。

- [ ] **Step 7: コミット**

```bash
git add packages/game-core/src/deal.ts packages/game-core/src/deal.test.ts packages/game-core/src/index.ts docs/progress/M2-EX-01.md
git commit -m "feat(game-core): [M2-EX-01] add round dealing, first player, and day init"
```

---

## Task 3: `legalMoves.ts` — 合法手の列挙

**Files:**
- Create: `packages/game-core/src/legalMoves.ts`
- Create: `packages/game-core/src/legalMoves.test.ts`
- Modify: `packages/game-core/src/index.ts`（`combinationStrength` に `export` を付与、re-export 1行）
- Create: `docs/progress/M2-EX-02.md`

**Interfaces:**
- Consumes: `RoundState`, `PlayInput`, `PlayActionKind`, `NumberCombination`, `NumberCard`, `DayNight`, `resolvePlay`, `rankNumber`, `combinationStrength`（Task 3 で export 化）
- Produces:
  - `type LegalPlay = { input: PlayInput; actionKind: PlayActionKind | "PASS"; resultingCombination: NumberCombination | null; goesOut: boolean }`
  - `function enumerateLegalPlays(state: RoundState): LegalPlay[]`
  - `function resultStrength(combination: NumberCombination, dayNight: DayNight): number`（= re-export された `combinationStrength` の薄いエイリアス。ポリシー側と共有）

**設計参照:** §4.3。候補＝単体 / 同数2〜4 / 連番3〜9（属性組合せ、上限512でガード）。各候補を `resolvePlay` ドライランで検証。決定的順序：actionKind（PASS 末尾）→ 枚数昇順 → 結果の強さ昇順 → cardIds 結合文字列の辞書順。

- [ ] **Step 1: 失敗するテストを書く** — `packages/game-core/src/legalMoves.test.ts`

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type RoundState,
  createNumberCard,
  createPlayerState,
  createRoundState,
  enumerateLegalPlays,
  resolvePlay,
} from "./index.ts";

const n = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH") =>
  createNumberCard(`CARD_NUMBER_RANK_${rank}_SUIT_${suit}`, `RANK_${rank}` as never, `SUIT_${suit}` as never);

function round(overrides: Partial<Parameters<typeof createRoundState>[0]> = {}): RoundState {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: 1,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [n(3, "FIRE"), n(3, "WATER"), n(5, "FIRE"), n(6, "FIRE"), n(7, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER"), n(9, "WIND")]),
    ],
    activePlayerId: "P1",
    ...overrides,
  });
}

test("empty field: every legal play is a LEAD and there is no PASS", () => {
  const plays = enumerateLegalPlays(round());
  assert.ok(plays.length > 0);
  assert.ok(plays.every((p) => p.actionKind === "LEAD"));
  assert.ok(plays.every((p) => p.input.kind === "PLAY"));
});

test("empty field: singles, the 33 pair, and the 5-6-7 sequence are all enumerated", () => {
  const plays = enumerateLegalPlays(round());
  const shapes = plays.map((p) =>
    p.input.kind === "PLAY" ? p.input.cardIds.length : 0,
  );
  assert.ok(shapes.includes(1)); // singles
  assert.ok(shapes.includes(2)); // 3-3 pair
  assert.ok(shapes.includes(3)); // 5-6-7 fire sequence
});

test("every enumerated play is accepted by resolvePlay", () => {
  const state = round();
  for (const play of enumerateLegalPlays(state)) {
    assert.equal(resolvePlay(state, play.input).ok, true);
  }
});

test("responding to a single: only stronger singles, plus PASS", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(4, "FIRE"), n(8, "FIRE"), n(8, "WATER")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(6, "WIND")], ranks: [6] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const plays = enumerateLegalPlays(state);
  assert.ok(plays.some((p) => p.actionKind === "PASS"));
  const nonPass = plays.filter((p) => p.actionKind !== "PASS");
  // 4 is weaker than 6 in DAY; only the two 8s qualify as REPLACE singles
  assert.ok(nonPass.every((p) => p.input.kind === "PLAY" && p.input.cardIds.length === 1));
  assert.equal(nonPass.length, 2);
});

test("goesOut is set when the play empties the hand", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(2, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
  });
  const plays = enumerateLegalPlays(state);
  assert.ok(plays.length === 1);
  assert.equal(plays[0].goesOut, true);
});

test("count lock excludes same-count extension candidates", () => {
  // field: 8-8 replaced once (countLocked). single 8 add must not appear as legal.
  const state = round({
    players: [
      createPlayerState("P1", [n(8, "WIND"), n(2, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "RANK_SET", cards: [n(8, "FIRE"), n(8, "WATER")], ranks: [8] },
      lastPlayerId: "P2",
      lock: { countLocked: true, suitFixed: null, suitUniform: false },
    },
  });
  const plays = enumerateLegalPlays(state);
  assert.ok(
    !plays.some(
      (p) => p.input.kind === "PLAY" && p.input.cardIds.length === 1 && p.actionKind === "EXTEND",
    ),
  );
});

test("enumeration is deterministically ordered (PASS last)", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(7, "FIRE"), n(8, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(6, "WIND")], ranks: [6] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const a = enumerateLegalPlays(state).map((p) => JSON.stringify(p.input));
  const b = enumerateLegalPlays(state).map((p) => JSON.stringify(p.input));
  assert.deepEqual(a, b);
  assert.equal(enumerateLegalPlays(state).at(-1)?.actionKind, "PASS");
});

test("a finished round enumerates nothing", () => {
  const state = round({ winnerId: "P1" });
  assert.deepEqual(enumerateLegalPlays(state), []);
});
```

- [ ] **Step 2: テストが失敗することを確認** — Run: `npm run game-core:test`。Expected: FAIL。

- [ ] **Step 3: `index.ts` の `combinationStrength` を export 化** — `packages/game-core/src/index.ts` の `function combinationStrength(` を `export function combinationStrength(` に変更（1語追加のみ、本体不変）。

- [ ] **Step 4: `packages/game-core/src/legalMoves.ts` を実装**

```ts
import type {
  DayNight,
  NumberCard,
  NumberCombination,
  PlayActionKind,
  PlayInput,
  RoundState,
} from "./index.js";
import { combinationStrength, rankNumber, resolvePlay } from "./index.js";

export type LegalPlay = {
  input: PlayInput;
  actionKind: PlayActionKind | "PASS";
  resultingCombination: NumberCombination | null;
  goesOut: boolean;
};

/** ポリシー側と共有する「組み合わせの強さ」。combinationStrength の別名。 */
export function resultStrength(combination: NumberCombination, dayNight: DayNight): number {
  return combinationStrength(combination, dayNight);
}

const SEQUENCE_CANDIDATE_CAP = 512;

/** 手札から重複しない候補 cardId 集合を生成する（単体 / 同数2..4 / 連番3..9）。 */
function candidateCardIdSets(hand: readonly NumberCard[]): string[][] {
  const sets: string[][] = [];

  // 単体
  for (const card of hand) sets.push([card.cardId]);

  // rank ごとにグループ化
  const byRank = new Map<number, NumberCard[]>();
  for (const card of hand) {
    const r = rankNumber(card.rankCode);
    (byRank.get(r) ?? byRank.set(r, []).get(r)!).push(card);
  }

  // 同数セット（サイズ 2..min(4, 枚数)）
  for (const cards of byRank.values()) {
    const max = Math.min(4, cards.length);
    for (let size = 2; size <= max; size += 1) {
      for (const combo of combinations(cards, size)) {
        sets.push(combo.map((c) => c.cardId));
      }
    }
  }

  // 連番セット（連続 rank 窓、長さ 3..9、各 rank から1枚）
  for (let start = 1; start <= 9; start += 1) {
    for (let len = 3; start + len - 1 <= 9; len += 1) {
      const ranks = Array.from({ length: len }, (_, i) => start + i);
      const perRank = ranks.map((r) => byRank.get(r) ?? []);
      if (perRank.some((cards) => cards.length === 0)) continue;
      const product = perRank.reduce((acc, cards) => acc * cards.length, 1);
      if (product > SEQUENCE_CANDIDATE_CAP) continue;
      for (const combo of cartesian(perRank)) {
        sets.push(combo.map((c) => c.cardId));
      }
    }
  }

  return sets;
}

function* combinations<T>(items: readonly T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= items.length - size; i += 1) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      yield [items[i], ...rest];
    }
  }
}

function cartesian<T>(groups: readonly T[][]): T[][] {
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((prefix) => group.map((item) => [...prefix, item])),
    [[]],
  );
}

export function enumerateLegalPlays(state: RoundState): LegalPlay[] {
  if (state.winnerId) return [];
  const playerId = state.activePlayerId;
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return [];

  const seen = new Set<string>();
  const results: LegalPlay[] = [];

  for (const cardIds of candidateCardIdSets(player.hand)) {
    const key = [...cardIds].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    const input: PlayInput = { kind: "PLAY", playerId, cardIds };
    const res = resolvePlay(state, input);
    if (!res.ok) continue;

    const actor = res.state.players.find((p) => p.playerId === playerId);
    results.push({
      input,
      actionKind: res.outcome.actionKind,
      resultingCombination: res.state.activeField?.combination ?? null,
      goesOut: (actor?.hand.length ?? -1) === 0,
    });
  }

  // PASS
  const passInput: PlayInput = { kind: "PASS", playerId };
  if (resolvePlay(state, passInput).ok) {
    results.push({ input: passInput, actionKind: "PASS", resultingCombination: null, goesOut: false });
  }

  return sortLegalPlays(results, state.dayNight);
}

function sortLegalPlays(plays: LegalPlay[], dayNight: DayNight): LegalPlay[] {
  const rank = (p: LegalPlay): [number, number, number, string] => {
    const isPass = p.actionKind === "PASS" ? 1 : 0;
    const count = p.input.kind === "PLAY" ? p.input.cardIds.length : 99;
    const strength = p.resultingCombination
      ? combinationStrength(p.resultingCombination, dayNight)
      : 0;
    const ids = p.input.kind === "PLAY" ? [...p.input.cardIds].sort().join(",") : "~";
    return [isPass, count, strength, ids];
  };
  return [...plays].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return (
      ra[0] - rb[0] ||
      ra[1] - rb[1] ||
      ra[2] - rb[2] ||
      (ra[3] < rb[3] ? -1 : ra[3] > rb[3] ? 1 : 0)
    );
  });
}
```

> 実装者注：`byRank.get(r) ?? byRank.set(r, []).get(r)!` の1行が読みにくければ、素直な `let arr = byRank.get(r); if (!arr) { arr = []; byRank.set(r, arr); } arr.push(card);` に展開してよい。挙動が同じであることを優先する。

- [ ] **Step 5: `index.ts` の re-export ブロックに追記**

```ts
export * from "./legalMoves.js";
```

- [ ] **Step 6: テストと型検査** — Run: `npm run game-core:test && npm run game-core:typecheck`。Expected: PASS。

- [ ] **Step 7: 進捗ドキュメント** — `docs/progress/M2-EX-02.md` を作成（書式は M2-EX-01.md に合わせる）。メモに「判定は `resolvePlay` ドライランに一元化。列挙器は候補生成と決定的ソートのみ」「`combinationStrength` を private→export に格上げ（追加的変更）」。

- [ ] **Step 8: コミット**

```bash
git add packages/game-core/src/legalMoves.ts packages/game-core/src/legalMoves.test.ts packages/game-core/src/index.ts docs/progress/M2-EX-02.md
git commit -m "feat(game-core): [M2-EX-02] add legal move enumerator"
```

---

## Task 4: `cpuPolicy.ts` / `cpuPolicyStandard.ts` — 選択可能なCPUポリシー

**Files:**
- Create: `packages/game-core/src/cpuPolicy.ts`
- Create: `packages/game-core/src/cpuPolicyStandard.ts`
- Create: `packages/game-core/src/cpuPolicy.test.ts`
- Modify: `packages/game-core/src/index.ts`（re-export 2行）
- Create: `docs/progress/M2-EX-03.md`

**Interfaces:**
- Consumes: `Rng`（Task 1）／`LegalPlay`, `resultStrength`（Task 3）／`RoundState`, `PlayInput`, `NumberCombination`, `rankNumber`, `rankStrength`（既存）
- Produces:
  - `type CpuPolicyId = "STANDARD"`
  - `const CPU_POLICY_IDS: readonly CpuPolicyId[]`
  - `type CpuDecisionInput = { state: RoundState; legalPlays: LegalPlay[]; rng: Rng }`
  - `type CpuPolicy = (input: CpuDecisionInput) => PlayInput`
  - `function resolveCpuPolicy(id: CpuPolicyId): CpuPolicy`
  - `function rollThinkDelayMillis(rng: Rng): number`
  - `const standardPolicy: CpuPolicy`

**設計参照:** §4.4。standardPolicy：(1) `goesOut` の手があれば最弱・同値rng、(2) 場が空なら最弱の単体・同値rng、(3) 場があれば PASS 以外で最弱・同値rng、無ければ PASS。同値選択は「決定的順序済み配列に `rng.nextInt(len)`」。

- [ ] **Step 1: 失敗するテストを書く** — `packages/game-core/src/cpuPolicy.test.ts`

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CPU_POLICY_IDS,
  type RoundState,
  createNumberCard,
  createPlayerState,
  createRoundState,
  createRng,
  enumerateLegalPlays,
  resolveCpuPolicy,
  resolvePlay,
  rollThinkDelayMillis,
  standardPolicy,
} from "./index.ts";

const n = (rank: number, suit: "FIRE" | "WATER" | "WIND" | "EARTH") =>
  createNumberCard(`CARD_NUMBER_RANK_${rank}_SUIT_${suit}`, `RANK_${rank}` as never, `SUIT_${suit}` as never);

function round(overrides: Partial<Parameters<typeof createRoundState>[0]> = {}): RoundState {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: 1,
    dayNight: "DAY",
    players: [
      createPlayerState("P1", [n(3, "FIRE"), n(5, "WATER"), n(8, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER"), n(9, "WIND")]),
    ],
    activePlayerId: "P1",
    ...overrides,
  });
}

const decide = (state: RoundState, seed = 1) =>
  standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(seed) });

test("CPU_POLICY_IDS is non-empty and every id resolves", () => {
  assert.ok(CPU_POLICY_IDS.length >= 1);
  for (const id of CPU_POLICY_IDS) assert.equal(typeof resolveCpuPolicy(id), "function");
});

test("resolveCpuPolicy throws on an unknown id", () => {
  assert.throws(() => resolveCpuPolicy("NOPE" as never), Error);
});

test("standard policy leads the weakest single on an empty field", () => {
  const input = decide(round());
  assert.equal(input.kind, "PLAY");
  assert.deepEqual(input.kind === "PLAY" && input.cardIds, ["CARD_NUMBER_RANK_3_SUIT_FIRE"]);
});

test("standard policy never returns a skill play", () => {
  const input = decide(round());
  assert.ok(input.kind === "PLAY" && input.useSkill === undefined);
});

test("standard policy prioritises a winning move", () => {
  // P1 can play its last card (single 3) to go out; must pick it.
  const state = round({
    players: [
      createPlayerState("P1", [n(3, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(2, "WIND")], ranks: [2] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  const input = standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(1) });
  assert.equal(input.kind, "PLAY");
  assert.equal(resolvePlay(state, input).outcome?.winnerId, "P1");
});

test("standard policy passes when it holds no legal play", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(3, "FIRE")]),
      createPlayerState("P2", [n(9, "WATER")]),
    ],
    activePlayerId: "P1",
    activeField: {
      combination: { kind: "SINGLE", cards: [n(7, "WIND")], ranks: [7] },
      lastPlayerId: "P2",
      lock: { countLocked: false, suitFixed: null, suitUniform: false },
    },
  });
  assert.equal(decideState(state).kind, "PASS");

  function decideState(s: RoundState) {
    return standardPolicy({ state: s, legalPlays: enumerateLegalPlays(s), rng: createRng(1) });
  }
});

test("tie-break among equal weakest singles is reproducible by seed", () => {
  const state = round({
    players: [
      createPlayerState("P1", [n(3, "FIRE"), n(3, "WATER"), n(3, "WIND")]),
      createPlayerState("P2", [n(9, "EARTH")]),
    ],
    activePlayerId: "P1",
  });
  const a = standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(123) });
  const b = standardPolicy({ state, legalPlays: enumerateLegalPlays(state), rng: createRng(123) });
  assert.deepEqual(a, b);
});

test("rollThinkDelayMillis stays within [600, 1200] and is reproducible", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const v = rollThinkDelayMillis(createRng(seed));
    assert.ok(Number.isInteger(v) && v >= 600 && v <= 1200);
  }
  assert.equal(rollThinkDelayMillis(createRng(7)), rollThinkDelayMillis(createRng(7)));
});
```

- [ ] **Step 2: テストが失敗することを確認** — Run: `npm run game-core:test`。Expected: FAIL。

- [ ] **Step 3: `packages/game-core/src/cpuPolicy.ts` を実装**

```ts
import type { PlayInput, RoundState } from "./index.js";
import type { LegalPlay } from "./legalMoves.js";
import type { Rng } from "./rng.js";
import { standardPolicy } from "./cpuPolicyStandard.js";

export type CpuPolicyId = "STANDARD";

/** UI のセレクタ用一覧。順序は表示順。 */
export const CPU_POLICY_IDS: readonly CpuPolicyId[] = ["STANDARD"];

export type CpuDecisionInput = {
  state: RoundState;
  legalPlays: LegalPlay[];
  rng: Rng;
};

export type CpuPolicy = (input: CpuDecisionInput) => PlayInput;

const REGISTRY: Record<CpuPolicyId, CpuPolicy> = {
  STANDARD: standardPolicy,
};

export function resolveCpuPolicy(id: CpuPolicyId): CpuPolicy {
  const policy = REGISTRY[id];
  if (!policy) throw new Error(`resolveCpuPolicy: unknown CPU policy id "${id}"`);
  return policy;
}

/** CPU-007 / TBD-009: 手決定後の表示待ち。game-core は待たず数値のみ返す。 */
export function rollThinkDelayMillis(rng: Rng): number {
  return 600 + rng.nextInt(601);
}
```

- [ ] **Step 4: `packages/game-core/src/cpuPolicyStandard.ts` を実装**

```ts
import type { NumberCard, PlayInput } from "./index.js";
import { rankNumber, rankStrength } from "./index.js";
import type { CpuDecisionInput, CpuPolicy } from "./cpuPolicy.js";
import { type LegalPlay, resultStrength } from "./legalMoves.js";
import type { Rng } from "./rng.js";

/** 決定的順序済みの候補から rng で1つ選ぶ（同値タイブレーク）。 */
function pickWeakest(
  plays: LegalPlay[],
  weight: (play: LegalPlay) => number,
  rng: Rng,
): LegalPlay {
  let best = Number.POSITIVE_INFINITY;
  for (const play of plays) best = Math.min(best, weight(play));
  const tied = plays.filter((play) => weight(play) === best);
  return tied[rng.nextInt(tied.length)];
}

export const standardPolicy: CpuPolicy = ({ state, legalPlays, rng }: CpuDecisionInput): PlayInput => {
  const dayNight = state.dayNight;

  // 1. 上がれる手を最優先
  const winning = legalPlays.filter((p) => p.goesOut);
  if (winning.length > 0) {
    return pickWeakest(
      winning,
      (p) => (p.resultingCombination ? resultStrength(p.resultingCombination, dayNight) : 0),
      rng,
    ).input;
  }

  // 2. 場が空 → 最弱の単体1枚
  if (state.activeField === null) {
    const singles = legalPlays.filter(
      (p) => p.actionKind === "LEAD" && p.input.kind === "PLAY" && p.input.cardIds.length === 1,
    );
    return pickWeakest(singles, (p) => singleStrength(state, p), rng).input;
  }

  // 3. 場がある → PASS 以外で最弱、無ければ PASS
  const nonPass = legalPlays.filter((p) => p.actionKind !== "PASS");
  if (nonPass.length === 0) {
    return { kind: "PASS", playerId: state.activePlayerId };
  }
  return pickWeakest(
    nonPass,
    (p) => (p.resultingCombination ? resultStrength(p.resultingCombination, dayNight) : 0),
    rng,
  ).input;
};

function singleStrength(state: CpuDecisionInput["state"], play: LegalPlay): number {
  if (play.input.kind !== "PLAY") return Number.POSITIVE_INFINITY;
  const cardId = play.input.cardIds[0];
  const card = findCard(state, cardId);
  return card ? rankStrength(rankNumber(card.rankCode), state.dayNight) : Number.POSITIVE_INFINITY;
}

function findCard(state: CpuDecisionInput["state"], cardId: string): NumberCard | undefined {
  const player = state.players.find((p) => p.playerId === state.activePlayerId);
  return player?.hand.find((c) => c.cardId === cardId);
}
```

- [ ] **Step 5: `index.ts` の re-export ブロックに追記**

```ts
export * from "./cpuPolicy.js";
export * from "./cpuPolicyStandard.js";
```

- [ ] **Step 6: テストと型検査** — Run: `npm run game-core:test && npm run game-core:typecheck`。Expected: PASS。

- [ ] **Step 7: 進捗ドキュメント** — `docs/progress/M2-EX-03.md` を作成。メモに「M2 出荷は `STANDARD` 1種類。`CpuPolicyId` ユニオン・`CPU_POLICY_IDS`・`resolveCpuPolicy` の per-seat 指定は最初から用意（横断 CPU-006 準拠、M3-EX-03 で高度なタイプを追加）」「スキルは返さない（M3 送り）」「思考待ちは数値のみ、実 `sleep` はサブプロジェクト2」。

- [ ] **Step 8: コミット**

```bash
git add packages/game-core/src/cpuPolicy.ts packages/game-core/src/cpuPolicyStandard.ts packages/game-core/src/cpuPolicy.test.ts packages/game-core/src/index.ts docs/progress/M2-EX-03.md
git commit -m "feat(game-core): [M2-EX-03] add selectable CPU policy registry and standard policy"
```

---

## Task 5: `roundLoop.ts` — ヘッドレス対局ループ

**Files:**
- Create: `packages/game-core/src/roundLoop.ts`
- Create: `packages/game-core/src/roundLoop.test.ts`
- Modify: `packages/game-core/src/index.ts`（re-export 1行）
- Create: `docs/progress/M2-EX-07.md`

**Interfaces:**
- Consumes: `createRng`, `Rng`（Task 1）／`dealRound`, `DealResult`（Task 2）／`enumerateLegalPlays`（Task 3）／`CpuPolicyId`, `resolveCpuPolicy`, `rollThinkDelayMillis`（Task 4）／`RoundState`, `PlayInput`, `PlayActionKind`, `DayNight`, `createRoundState`, `resolvePlay`, `INITIAL_RULESET_VERSION`（既存）
- Produces:
  - `type PlayRoundInput`, `type TurnRecord`, `type RoundStopReason`, `type RoundResult`
  - `function playRound(input: PlayRoundInput): RoundResult`

**設計参照:** §4.5・§5・§6。`rng.fork()` を「配布1回 + 手番ごと1回」で消費。各手番の `resolvePlay` 後に不変条件（カード保存則36枚 / cardId 一意 / 手番席が playerIds 内）を検査。policy が非合法手を返したら throw。

- [ ] **Step 1: 失敗するテストを書く** — `packages/game-core/src/roundLoop.test.ts`

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { type CpuPolicyId, NUMBER_DECK, playRound } from "./index.ts";

const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const allStandard = (ids: string[]): Record<string, CpuPolicyId> =>
  Object.fromEntries(ids.map((id) => [id, "STANDARD"]));

for (const n of [2, 3, 4, 5, 6]) {
  test(`playRound reaches a winner for ${n} players`, () => {
    const ids = seats(n);
    const result = playRound({ playerIds: ids, seed: n * 100 + 7, seatPolicies: allStandard(ids) });
    assert.equal(result.stopReason, "WINNER");
    assert.ok(result.winnerId && ids.includes(result.winnerId));
    const winnerHand = result.finalState.players.find((p) => p.playerId === result.winnerId);
    assert.equal(winnerHand?.hand.length, 0);
  });
}

test("card conservation holds on every turn", () => {
  const ids = seats(4);
  const result = playRound({ playerIds: ids, seed: 4242, seatPolicies: allStandard(ids) });
  for (const turn of result.turns) {
    const inHands = Object.values(turn.handCountsAfter).reduce((a, b) => a + b, 0);
    assert.ok(inHands <= NUMBER_DECK.length);
  }
  const finalInHands = result.finalState.players.reduce((a, p) => a + p.hand.length, 0);
  const field = result.finalState.activeField?.combination.cards.length ?? 0;
  assert.equal(finalInHands + result.finalState.discardPile.length + field, 36);
});

test("playRound is fully reproducible for the same seed", () => {
  const ids = seats(5);
  const a = playRound({ playerIds: ids, seed: 999, seatPolicies: allStandard(ids) });
  const b = playRound({ playerIds: ids, seed: 999, seatPolicies: allStandard(ids) });
  assert.deepEqual(a, b);
});

test("TurnRecord carries a think delay and legal-play count but no card contents", () => {
  const ids = seats(3);
  const result = playRound({ playerIds: ids, seed: 5, seatPolicies: allStandard(ids) });
  assert.ok(result.turns.length > 0);
  for (const turn of result.turns) {
    assert.ok(turn.thinkMillis >= 600 && turn.thinkMillis <= 1200);
    assert.ok(turn.legalPlayCount >= 1);
    assert.ok(!JSON.stringify(turn).includes("CARD_NUMBER_")); // no card ids leak
  }
});

test("playRound throws when a seat has no policy", () => {
  const ids = seats(3);
  assert.throws(
    () => playRound({ playerIds: ids, seed: 1, seatPolicies: { p1: "STANDARD", p2: "STANDARD" } }),
    Error,
  );
});

test("maxTurns stops the loop with MAX_TURNS", () => {
  const ids = seats(4);
  const result = playRound({
    playerIds: ids,
    seed: 1,
    seatPolicies: allStandard(ids),
    maxTurns: 3,
  });
  assert.equal(result.stopReason, "MAX_TURNS");
  assert.equal(result.turns.length, 3);
});

test("rematchIndex rotates the first player", () => {
  const ids = seats(4);
  const base = playRound({ playerIds: ids, seed: 1, seatPolicies: allStandard(ids) });
  const first0 = base.deal.firstPlayerId;
  const rematch = playRound({
    playerIds: ids,
    seed: 2,
    seatPolicies: allStandard(ids),
    rematchIndex: 1,
    baselineFirstPlayerId: first0,
  });
  assert.equal(rematch.deal.firstPlayerId, ids[(ids.indexOf(first0) + 1) % 4]);
});
```

- [ ] **Step 2: テストが失敗することを確認** — Run: `npm run game-core:test`。Expected: FAIL。

- [ ] **Step 3: `packages/game-core/src/roundLoop.ts` を実装**

```ts
import type { DayNight, PlayActionKind, PlayInput, RoundState } from "./index.js";
import { INITIAL_RULESET_VERSION, createRoundState, resolvePlay } from "./index.js";
import { type DealResult, dealRound } from "./deal.js";
import { enumerateLegalPlays } from "./legalMoves.js";
import { type CpuPolicyId, resolveCpuPolicy, rollThinkDelayMillis } from "./cpuPolicy.js";
import { createRng } from "./rng.js";

export type PlayRoundInput = {
  playerIds: readonly string[];
  seed: number;
  seatPolicies: Record<string, CpuPolicyId>;
  rematchIndex?: number;
  baselineFirstPlayerId?: string;
  maxTurns?: number;
};

export type TurnRecord = {
  index: number;
  playerId: string;
  policyId: CpuPolicyId;
  legalPlayCount: number;
  input: PlayInput;
  actionKind: PlayActionKind | "PASS";
  fieldCleared: boolean;
  naturalRevolution: boolean;
  dayNightAfter: DayNight;
  handCountsAfter: Record<string, number>;
  thinkMillis: number;
};

export type RoundStopReason = "WINNER" | "MAX_TURNS" | "NO_PROGRESS";

export type RoundResult = {
  seed: number;
  rematchIndex: number;
  config: { playerIds: string[]; seatPolicies: Record<string, CpuPolicyId> };
  deal: DealResult;
  turns: TurnRecord[];
  winnerId: string | null;
  finalState: RoundState;
  stopReason: RoundStopReason;
};

const DEFAULT_MAX_TURNS = 1000;

export function playRound(input: PlayRoundInput): RoundResult {
  const rematchIndex = input.rematchIndex ?? 0;
  const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;
  const playerIds = [...input.playerIds];

  const rng = createRng(input.seed);

  const deal = dealRound({
    playerIds,
    rng: rng.fork(),
    rematchIndex,
    baselineFirstPlayerId: input.baselineFirstPlayerId,
  });

  for (const id of playerIds) {
    if (!(id in input.seatPolicies)) {
      throw new Error(`playRound: no CPU policy for seat "${id}"`);
    }
  }

  let state = createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: deal.dayNight,
    players: deal.players,
    activePlayerId: deal.firstPlayerId,
  });

  const turns: TurnRecord[] = [];
  let stopReason: RoundStopReason = "WINNER";

  while (state.winnerId === null && turns.length < maxTurns) {
    const turnIndex = turns.length;
    const active = state.activePlayerId;
    const policyId = input.seatPolicies[active];
    const turnRng = rng.fork();

    const legalPlays = enumerateLegalPlays(state);
    if (legalPlays.length === 0) {
      stopReason = "NO_PROGRESS";
      break;
    }

    const play = resolveCpuPolicy(policyId)({ state, legalPlays, rng: turnRng });
    const thinkMillis = rollThinkDelayMillis(turnRng);

    const res = resolvePlay(state, play);
    if (!res.ok) {
      throw new Error(
        `playRound: policy "${policyId}" produced an illegal move at turn ${turnIndex} ` +
          `(reason ${res.reason}): ${JSON.stringify(play)}`,
      );
    }

    state = res.state;
    assertInvariants(state, turnIndex, playerIds);

    turns.push({
      index: turnIndex,
      playerId: active,
      policyId,
      legalPlayCount: legalPlays.length,
      input: play,
      actionKind: res.outcome.actionKind,
      fieldCleared: res.outcome.fieldCleared,
      naturalRevolution: res.outcome.naturalRevolution,
      dayNightAfter: res.outcome.dayNightAfter,
      handCountsAfter: Object.fromEntries(
        state.players.map((p) => [p.playerId, p.hand.length]),
      ),
      thinkMillis,
    });
  }

  if (state.winnerId === null && stopReason === "WINNER") {
    stopReason = "MAX_TURNS";
  }

  return {
    seed: input.seed,
    rematchIndex,
    config: { playerIds, seatPolicies: { ...input.seatPolicies } },
    deal,
    turns,
    winnerId: state.winnerId,
    finalState: state,
    stopReason,
  };
}

function assertInvariants(state: RoundState, turnIndex: number, playerIds: string[]): void {
  const handCards = state.players.flatMap((p) => p.hand);
  const fieldCards = state.activeField?.combination.cards ?? [];
  const total = handCards.length + state.discardPile.length + fieldCards.length;
  if (total !== 36) {
    throw new Error(`playRound: card conservation broken at turn ${turnIndex} (total ${total})`);
  }
  const handIds = handCards.map((c) => c.cardId);
  if (new Set(handIds).size !== handIds.length) {
    throw new Error(`playRound: duplicate card in hands at turn ${turnIndex}`);
  }
  if (!playerIds.includes(state.activePlayerId)) {
    throw new Error(`playRound: active player "${state.activePlayerId}" not seated at turn ${turnIndex}`);
  }
}
```

- [ ] **Step 4: `index.ts` の re-export ブロックに追記**

```ts
export * from "./roundLoop.js";
```

- [ ] **Step 5: テストと型検査** — Run: `npm run game-core:test && npm run game-core:typecheck`。Expected: PASS。

- [ ] **Step 6: 進捗ドキュメント** — `docs/progress/M2-EX-07.md` を作成。冒頭に「本ファイルは M2-EX-07 のうち **エンジン部（ヘッドレスループ）** のみを対象とする。UI 手番ドライバ・思考待ちの実 `sleep`・対局画面連携はサブプロジェクト2」と明記。メモに「不変条件（カード保存則36・cardId一意・手番席）を毎手検査」「`NO_PROGRESS` / `MAX_TURNS` は例外ではなく `stopReason`」「policy 非合法手は throw（seed で再現）」。

- [ ] **Step 7: コミット**

```bash
git add packages/game-core/src/roundLoop.ts packages/game-core/src/roundLoop.test.ts packages/game-core/src/index.ts docs/progress/M2-EX-07.md
git commit -m "feat(game-core): [M2-EX-07] add headless round loop with per-turn trace"
```

---

## Task 6: `cpuSelfPlay.test.ts` — CPU自動対戦ハーネス（M2-QA-01 の土台）

**Files:**
- Create: `packages/game-core/src/cpuSelfPlay.test.ts`
- Create: `docs/progress/M2-QA-01.md`
- Create: `docs/qa/M2-QA-01-cpu-self-play-report.md`

**Interfaces:**
- Consumes: `playRound`, `CpuPolicyId`（Task 5）
- Produces: なし（テストのみ）

**設計参照:** §8 の `cpuSelfPlay.test.ts` 行。固定 seed 群で `playRound` を回し、全局 `stopReason === "WINNER"`・throw なし・不変条件違反なしを検査。

- [ ] **Step 1: ハーネステストを書く** — `packages/game-core/src/cpuSelfPlay.test.ts`

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { type CpuPolicyId, playRound } from "./index.ts";

const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const allStandard = (ids: string[]): Record<string, CpuPolicyId> =>
  Object.fromEntries(ids.map((id) => [id, "STANDARD"]));

/**
 * M2-QA-01 の土台。テストでは各人数 24 seed（計120局）を回す。
 * レポート用の 100 seed 実行は下の RUN_FULL を 1 にして手動実行する。
 */
const RUN_FULL = 0;
const SEEDS_PER_COUNT = RUN_FULL ? 100 : 24;

for (const n of [2, 3, 4, 5, 6]) {
  test(`self-play: ${n} players complete cleanly across ${SEEDS_PER_COUNT} seeds`, () => {
    const ids = seats(n);
    const failures: number[] = [];
    for (let seed = 1; seed <= SEEDS_PER_COUNT; seed += 1) {
      let result;
      try {
        result = playRound({ playerIds: ids, seed: n * 10_000 + seed, seatPolicies: allStandard(ids) });
      } catch (error) {
        failures.push(seed);
        continue;
      }
      if (result.stopReason !== "WINNER") failures.push(seed);
      const winner = result.finalState.players.find((p) => p.playerId === result.winnerId);
      if (!winner || winner.hand.length !== 0) failures.push(seed);
    }
    assert.deepEqual(failures, [], `failing seeds for ${n} players: ${failures.join(", ")}`);
  });
}

test("self-play traces stay bounded (no runaway loop)", () => {
  const ids = seats(6);
  for (let seed = 1; seed <= 10; seed += 1) {
    const result = playRound({ playerIds: ids, seed, seatPolicies: allStandard(ids) });
    assert.ok(result.turns.length < 500, `turn count ${result.turns.length} for seed ${seed}`);
  }
});
```

- [ ] **Step 2: 実行** — Run: `npm run game-core:test`。Expected: PASS（全 seed WINNER 到達）。落ちた seed があれば `playRound` / `standardPolicy` / `legalMoves` のバグ。エラーメッセージの seed で単体再現して修正（このタスク内で対応。修正が他タスクのファイルに及ぶ場合はコントローラーへ報告）。

- [ ] **Step 3: QA レポートと進捗ドキュメント**
  - `docs/qa/M2-QA-01-cpu-self-play-report.md`：`docs/qa/M1-QA-01-*` の書式に合わせ、日本語で。実施日 2026-09-01 / 対象 `packages/game-core/src/cpuSelfPlay.test.ts` / 実行結果（人数×seed 数、全局 WINNER 到達、不正手 throw 0、カード消失 0）/ 不具合 高0中0低0 / 回帰登録（このテストファイル）/ 残課題（`RUN_FULL=1` の 100 seed 実行と結果貼り付けはサブプロジェクト2完了後、UI 側の M2-QA-01 本実施でまとめて行う旨）。
  - `docs/progress/M2-QA-01.md`：状態=土台完了（本実施はサブプロジェクト2後）/ 日付 2026-09-01 / 概要 / 成果物 / 確認。

- [ ] **Step 4: コミット**

```bash
git add packages/game-core/src/cpuSelfPlay.test.ts docs/qa/M2-QA-01-cpu-self-play-report.md docs/progress/M2-QA-01.md
git commit -m "test(game-core): [M2-QA-01] add CPU self-play harness"
```

---

## Task 7: 仕上げ — index.ts 監査・全体スイープ

**Files:**
- Modify: `packages/game-core/src/index.ts`（必要なら re-export の並び整理のみ）
- Create: `docs/progress/M2-EX-02.md` 等が未作成なら補完（通常は各タスクで作成済み）

- [ ] **Step 1: 公開シンボル監査** — `packages/game-core/src/index.ts` を読み、Task 1〜5 の全公開シンボル（`Rng`, `createRng`, `shuffle`, `NUMBER_DECK`, `SKILL_DECK`, `dealRound`, `DealInput`, `DealResult`, `LegalPlay`, `enumerateLegalPlays`, `resultStrength`, `CpuPolicyId`, `CPU_POLICY_IDS`, `CpuDecisionInput`, `CpuPolicy`, `resolveCpuPolicy`, `rollThinkDelayMillis`, `standardPolicy`, `PlayRoundInput`, `TurnRecord`, `RoundStopReason`, `RoundResult`, `playRound`, `combinationStrength`）が re-export されていることを確認。漏れがあれば追加。

- [ ] **Step 2: テストファイルの型健全性を手動監査** — 6つの新規 `.test.ts` を読み、`as never` の乱用や `any` 漏れ、`createRoundState` の引数型との齟齬がないか確認。`tsc` 対象外なので目視。問題があれば修正。

- [ ] **Step 3: 全体スイープ**

Run:
```bash
npm run game-core:test
npm run game-core:typecheck
git -C . diff --check
```
Expected: game-core テスト全 PASS（既存114 + 新規約70）、typecheck PASS、whitespace エラーなし。

- [ ] **Step 4: mobile への影響確認** — `apps/mobile` は game-core の新規シンボルをまだ使わない（サブプロジェクト2で使う）。ただし re-export 追加で既存 import が壊れないことを確認：
Run: `npm run mobile:typecheck && npm run mobile:test`
Expected: PASS（回帰なし）。

- [ ] **Step 5: コミット（差分があれば）**

```bash
git add -A
git commit -m "chore(game-core): [M2] finalize headless CPU engine re-exports"
```

---

## Self-Review

**1. Spec coverage:**

| 設計書セクション | 対応タスク |
|---|---|
| §4.1 `rng.ts` | Task 1 |
| §4.2 `deal.ts`（配布・先攻・再戦） | Task 2 |
| §4.3 `legalMoves.ts` | Task 3 |
| §4.4 `cpuPolicy.ts` / `cpuPolicyStandard.ts` | Task 4 |
| §4.5 `roundLoop.ts` | Task 5 |
| §5 不変条件 | Task 5（`assertInvariants`） |
| §6 エラー一覧 | Task 1/2/4/5 の throw + テスト |
| §7 将来拡張（M4） | 設計書に記載済み。コード変更なし |
| §8 テスト方針 | Task 1〜6 の `.test.ts` |
| §9 完了条件マッピング | Task 2/3/4/5/6 の進捗ドキュメント |

**2. Placeholder scan:** コードは全ステップに実物を記載。`SEQUENCE_CANDIDATE_CAP = 512` など定数は具体値。TODO/TBD なし。

**3. Type consistency:**
- `LegalPlay.input` は `PlayInput`（union）。`enumerateLegalPlays` は `PLAY`（`cardIds` のみ）と `PASS` のみ生成。`standardPolicy` は `.input` をそのまま返す。
- `CpuPolicy = (input: CpuDecisionInput) => PlayInput`。`resolveCpuPolicy(id)(...)` の戻りを `playRound` が `resolvePlay` に渡す。整合。
- `dealRound` の戻り `DealResult` を `playRound` が `deal` に格納し `RoundResult.deal` として返す。テスト（Task 5）は `result.deal.firstPlayerId` を参照。整合。
- `combinationStrength` / `resultStrength`：Task 3 で前者を export 化、後者は薄いエイリアス。`sortLegalPlays` は `combinationStrength` を直接使用、`standardPolicy` は `resultStrength` を使用。どちらも同一関数。
- `rankStrength(rank, dayNight)`：既存シグネチャ。`singleStrength` で使用。

**4. 循環 import 注意:** `cpuPolicy.ts` は `cpuPolicyStandard.ts` を import し、`cpuPolicyStandard.ts` は `cpuPolicy.ts` から**型のみ**（`import type`）import する。値の循環はない。`index.ts` は両方を re-export。実装者は `import type` を厳守すること。
