import assert from "node:assert/strict";
import { test } from "node:test";

import {
  numberDeck,
  skillDeck,
  createRng,
  dealRound,
  rankNumber,
} from "./index.ts";

const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

test("numberDeck returns 36 unique number cards", () => {
  const deck = numberDeck();
  assert.equal(deck.length, 36);
  assert.equal(new Set(deck.map((c) => c.cardId)).size, 36);
  assert.ok(deck.every((c) => c.cardId.startsWith("CARD_NUMBER_RANK_")));
});

test("numberDeck returns a fresh array on each call", () => {
  const deck1 = numberDeck();
  const deck2 = numberDeck();
  assert.notEqual(deck1, deck2);
});

test("skillDeck returns 6 physical skill cards, all unused", () => {
  const deck = skillDeck();
  assert.equal(deck.length, 6);
  assert.deepEqual(
    deck.map((c) => c.skillId).sort(),
    [
      "SKILL_CARD_EXTENSION_SEAL_1",
      "SKILL_CARD_EXTENSION_SEAL_2",
      "SKILL_CARD_JOKER_HERO",
      "SKILL_CARD_JOKER_SAINT",
      "SKILL_CARD_REVOLUTION_1",
      "SKILL_CARD_REVOLUTION_2",
    ],
  );
  assert.ok(deck.every((c) => c.used === false));
});

test("skillDeck returns a fresh array on each call", () => {
  const deck1 = skillDeck();
  const deck2 = skillDeck();
  assert.notEqual(deck1, deck2);
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
  assert.deepEqual(new Set(ids), new Set(numberDeck().map((c) => c.cardId)));
});

test("dealRound gives each seat one distinct skill card", () => {
  const result = dealRound({ playerIds: seats(4), rng: createRng(9) });
  const skillIds = result.players.map((p) => p.skill?.skillId);
  assert.ok(skillIds.every((s) => typeof s === "string"));
  assert.equal(new Set(skillIds).size, 4);
});

test("dealRound sorts each hand ascending by rank then suit", () => {
  const result = dealRound({ playerIds: seats(3), rng: createRng(77) });
  const suitIdx = (c: { suitCode: string }) => {
    const suitOrder = ["SUIT_FIRE", "SUIT_WATER", "SUIT_WIND", "SUIT_EARTH"];
    return suitOrder.indexOf(c.suitCode);
  };
  for (const player of result.players) {
    for (let i = 1; i < player.hand.length; i += 1) {
      const prev = player.hand[i - 1];
      const cur = player.hand[i];
      const prevKey = rankNumber(prev.rankCode) * 10 + suitIdx(prev);
      const curKey = rankNumber(cur.rankCode) * 10 + suitIdx(cur);
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
