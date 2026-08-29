// M1-QA-02: ランダムなプレイ列を流し込み、状態不変条件を検査する。
// カード重複・枚数消失・二重消費・不正時の部分更新が起きないことを保証する。
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INITIAL_RULESET_VERSION,
  createNumberCard,
  createPlayerState,
  createRoundState,
  resolvePlay,
  type NumberCard,
  type PlayInput,
  type RoundState,
  type SkillEffectCode,
} from "./index.ts";

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SUITS = ["FIRE", "WATER", "WIND", "EARTH"] as const;
const SKILLS: SkillEffectCode[] = [
  "SKILL_JOKER_HERO",
  "SKILL_EXTENSION_SEAL",
  "SKILL_REVOLUTION",
];

function buildDeck(): NumberCard[] {
  const deck: NumberCard[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(
        createNumberCard(
          `N_${rank}_${suit}`,
          `RANK_${rank}` as never,
          `SUIT_${suit}` as never,
        ),
      );
    }
  }
  return deck;
}

function dealRound(rng: () => number): {
  state: RoundState;
  deckIds: string[];
} {
  const deck = buildDeck();
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const playerCount = 2 + Math.floor(rng() * 3); // 2..4
  const handSize = 4 + Math.floor(rng() * 3); // 4..6
  const dealt = deck.slice(0, playerCount * handSize);

  const players = [];
  for (let p = 0; p < playerCount; p += 1) {
    const hand = dealt.slice(p * handSize, (p + 1) * handSize);
    const withSkill = rng() < 0.7;
    players.push(
      createPlayerState(
        `P${p + 1}`,
        hand,
        withSkill
          ? {
              skillId: `SK_P${p + 1}`,
              effectCode: SKILLS[Math.floor(rng() * SKILLS.length)],
              used: false,
            }
          : null,
      ),
    );
  }

  return {
    state: createRoundState({
      rulesetCode: "INITIAL",
      rulesetVersion: INITIAL_RULESET_VERSION,
      dayNight: rng() < 0.5 ? "DAY" : "NIGHT",
      players,
      activePlayerId: "P1",
    }),
    deckIds: dealt.map((card) => card.cardId).sort(),
  };
}

function randomPlay(state: RoundState, rng: () => number): PlayInput {
  const player = state.players.find((p) => p.playerId === state.activePlayerId);
  assert.ok(player);

  if (state.activeField && rng() < 0.35) {
    return { kind: "PASS", playerId: player.playerId };
  }

  const shuffled = [...player.hand].sort(() => rng() - 0.5);
  const take = 1 + Math.floor(rng() * Math.min(4, shuffled.length));
  const cardIds = shuffled.slice(0, take).map((card) => card.cardId);

  const play: Extract<PlayInput, { kind: "PLAY" }> = {
    kind: "PLAY",
    playerId: player.playerId,
    cardIds,
  };

  if (player.skill && !player.skill.used && rng() < 0.4) {
    if (
      player.skill.effectCode === "SKILL_JOKER_HERO" ||
      player.skill.effectCode === "SKILL_JOKER_SAINT"
    ) {
      play.useSkill = "JOKER_CLEAR";
    } else if (player.skill.effectCode === "SKILL_EXTENSION_SEAL") {
      play.useSkill = "EXTENSION_SEAL";
    } else {
      play.useSkill = "REVOLUTION";
    }
  }
  return play;
}

function realCardIds(state: RoundState): string[] {
  const ids: string[] = [];
  const collect = (cards: NumberCard[]) => {
    for (const card of cards) {
      if (!card.transformedFromSkillId) ids.push(card.cardId);
    }
  };
  for (const p of state.players) collect(p.hand);
  if (state.activeField) collect(state.activeField.combination.cards);
  collect(state.discardPile);
  return ids.sort();
}

function usedSkillCount(state: RoundState): number {
  return state.players.filter((p) => p.skill?.used).length;
}

function assertInvariants(
  state: RoundState,
  deckIds: string[],
  prevUsedSkills: number,
): void {
  const ids = realCardIds(state);
  assert.deepEqual(ids, deckIds, "every real number card is in exactly one zone");
  assert.equal(new Set(ids).size, ids.length, "no duplicated card id");

  assert.ok(
    state.players.some((p) => p.playerId === state.activePlayerId),
    "active player is a real player",
  );
  assert.ok(state.dayNight === "DAY" || state.dayNight === "NIGHT");
  assert.ok(state.consecutivePasses >= 0);

  const used = usedSkillCount(state);
  assert.ok(used >= prevUsedSkills, "a consumed skill is never un-consumed");
}

for (let seed = 1; seed <= 25; seed += 1) {
  test(`state invariants hold across a random play walk (seed ${seed})`, () => {
    const rng = makeRng(seed);
    let { state, deckIds } = dealRound(rng);
    let prevUsedSkills = usedSkillCount(state);
    assertInvariants(state, deckIds, prevUsedSkills);

    for (let step = 0; step < 60; step += 1) {
      const play = randomPlay(state, rng);
      const before = structuredClone(state);
      const result = resolvePlay(state, play);

      if (result.ok) {
        assertInvariants(result.state, deckIds, prevUsedSkills);
        prevUsedSkills = usedSkillCount(result.state);
        state = result.state;
        if (state.winnerId) {
          assert.equal(
            state.players.find((p) => p.playerId === state.winnerId)?.status,
            "OUT",
          );
        }
      } else {
        assert.equal(result.state, state, "rejection returns the same reference");
        assert.deepEqual(state, before, "rejection leaves the state byte-identical");
      }
    }
  });
}

test("a random walk is fully reproducible from its seed", () => {
  const run = () => {
    const rng = makeRng(4242);
    let { state, deckIds } = dealRound(rng);
    void deckIds;
    const trace: string[] = [];
    for (let step = 0; step < 40; step += 1) {
      const result = resolvePlay(state, randomPlay(state, rng));
      trace.push(result.ok ? `ok:${result.outcome.actionKind}` : `no:${result.reason}`);
      if (result.ok) state = result.state;
    }
    return trace.join("|");
  };
  assert.equal(run(), run());
});
