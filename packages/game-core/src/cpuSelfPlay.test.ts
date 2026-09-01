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
