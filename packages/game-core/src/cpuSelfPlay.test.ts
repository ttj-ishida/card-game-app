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
    const failures: Set<string> = new Set();
    const turnCounts: number[] = [];
    for (let seed = 1; seed <= SEEDS_PER_COUNT; seed += 1) {
      const absSeed = n * 10_000 + seed;
      let result;
      try {
        result = playRound({ playerIds: ids, seed: absSeed, seatPolicies: allStandard(ids) });
      } catch (error) {
        failures.add(`${absSeed} (${(error as Error).message})`);
        continue;
      }
      if (result.stopReason !== "WINNER") {
        failures.add(`${absSeed} (stopReason: ${result.stopReason})`);
        continue;
      }
      const winner = result.finalState.players.find((p) => p.playerId === result.winnerId);
      if (!winner || winner.hand.length !== 0) {
        failures.add(`${absSeed} (invalid winner)`);
        continue;
      }
      turnCounts.push(result.turns.length);
    }
    if (turnCounts.length > 0) {
      const min = Math.min(...turnCounts);
      const max = Math.max(...turnCounts);
      const avg = (turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1);
      console.log(`[self-play] ${n}p: ${SEEDS_PER_COUNT} games, turns min ${min} / max ${max} / mean ${avg}`);
    }
    assert.equal(failures.size, 0, `failing seeds for ${n} players: ${Array.from(failures).join(", ")}`);
  });
}

test("self-play traces stay bounded (no runaway loop)", () => {
  const ids = seats(6);
  for (let seed = 1; seed <= 10; seed += 1) {
    const result = playRound({ playerIds: ids, seed, seatPolicies: allStandard(ids) });
    assert.ok(result.turns.length < 500, `turn count ${result.turns.length} for seed ${seed}`);
  }
});

test("self-play results are deterministic (byte-match on replay)", () => {
  const testCases: Array<{ playerIds: string[]; seed: number }> = [
    { playerIds: seats(2), seed: 20001 },
    { playerIds: seats(3), seed: 30005 },
    { playerIds: seats(4), seed: 40012 },
    { playerIds: seats(5), seed: 50003 },
    { playerIds: seats(6), seed: 60008 },
  ];

  for (const { playerIds, seed } of testCases) {
    const seatPolicies = allStandard(playerIds);
    const result1 = playRound({ playerIds, seed, seatPolicies });
    const result2 = playRound({ playerIds, seed, seatPolicies });
    assert.deepEqual(result1, result2, `playRound not deterministic for seed ${seed}`);
  }
});
