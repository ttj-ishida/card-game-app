import assert from "node:assert/strict";
import { test } from "node:test";

import { type CpuPolicyId, type PlaySkillUse, playRound } from "./index.ts";

const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const allStandard = (ids: string[]): Record<string, CpuPolicyId> =>
  Object.fromEntries(ids.map((id) => [id, "STANDARD"]));

/**
 * M3-QA-01 の CPU 同士自動対戦ハーネス。
 * コミットするテストは軽量（各人数 20 seed = 計 100 局）。
 * レポート用のフル実行は `RUN_FULL=1` で各人数 200 seed（計 1000 局）。
 *
 * §7 で `playRound` が `enumerateLegalPlays(state, { includeSkills: true })` を
 * 使うようになったため、CPU 席はスキル手も候補に入れて選ぶ。
 */
const RUN_FULL = process.env.RUN_FULL === "1" ? 1 : 0;
const SEEDS_PER_COUNT = RUN_FULL ? 200 : 20;
const PLAYER_COUNTS = [2, 3, 4, 5, 6];

const REQUIRED_SKILLS: PlaySkillUse[] = [
  "JOKER_CLEAR",
  "JOKER_TRANSFORM",
  "EXTENSION_SEAL",
  "REVOLUTION",
];

// 全人数テストが埋める。末尾の集約テストが 4 スキル全種の出現を検証する。
const skillFireCounts = new Map<string, number>();
const bumpSkill = (skill: string) =>
  skillFireCounts.set(skill, (skillFireCounts.get(skill) ?? 0) + 1);

for (const n of PLAYER_COUNTS) {
  test(`self-play: ${n} players complete cleanly across ${SEEDS_PER_COUNT} seeds`, () => {
    const ids = seats(n);
    const failures: Set<string> = new Set();
    const turnCounts: number[] = [];
    const localSkillCounts = new Map<string, number>();
    let transformedGoOuts = 0;

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

      // スキル発動を記録（全 turns を走査）。
      for (const turn of result.turns) {
        if (turn.input.kind === "PLAY" && turn.input.useSkill) {
          bumpSkill(turn.input.useSkill);
          localSkillCounts.set(
            turn.input.useSkill,
            (localSkillCounts.get(turn.input.useSkill) ?? 0) + 1,
          );
        }
      }

      // 変化Joker上がりが 0 であること：winnerId を出した最後の手が
      // JOKER_TRANSFORM であってはならない（evaluateGoOut が弾く想定の裏取り）。
      const lastTurn = result.turns[result.turns.length - 1];
      if (
        lastTurn &&
        lastTurn.playerId === result.winnerId &&
        lastTurn.input.kind === "PLAY" &&
        lastTurn.input.useSkill === "JOKER_TRANSFORM"
      ) {
        transformedGoOuts += 1;
        failures.add(`${absSeed} (transformed-Joker go-out)`);
      }

      turnCounts.push(result.turns.length);
    }

    if (turnCounts.length > 0) {
      const min = Math.min(...turnCounts);
      const max = Math.max(...turnCounts);
      const avg = (turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1);
      const skillSummary = REQUIRED_SKILLS.map((s) => `${s}:${localSkillCounts.get(s) ?? 0}`).join(
        " ",
      );
      console.log(
        `[self-play] ${n}p: ${SEEDS_PER_COUNT} games, turns min ${min} / max ${max} / mean ${avg} | skills ${skillSummary}`,
      );
    }

    assert.equal(transformedGoOuts, 0, `${n} players: transformed-Joker go-outs must be 0`);
    assert.equal(failures.size, 0, `failing seeds for ${n} players: ${Array.from(failures).join(", ")}`);
  });
}

test(`self-play: all 4 skill types fire across the lightweight sweep`, () => {
  // 全人数テストが先に走り skillFireCounts を埋めている（node:test は定義順で実行）。
  const missing = REQUIRED_SKILLS.filter((s) => (skillFireCounts.get(s) ?? 0) === 0);
  const summary = REQUIRED_SKILLS.map((s) => `${s}:${skillFireCounts.get(s) ?? 0}`).join(", ");
  console.log(`[self-play] skill fire counts across ${SEEDS_PER_COUNT * PLAYER_COUNTS.length} games: ${summary}`);
  assert.deepEqual(
    missing,
    [],
    `skill types never fired in the self-play traces: ${missing.join(", ")} ` +
      `(a missing skill type is a bug in the enumerator or the standard heuristic, not a seed problem)`,
  );
});

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
