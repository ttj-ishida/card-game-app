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

// index.ts が末尾で deal.ts を re-export するため、index.ts の値はモジュール
// トップレベルで使えない（TDZ）。デッキは毎回組み立てる関数にする。
export function numberDeck(): NumberCard[] {
  return RANK_CODES.flatMap((rankCode) =>
    SUIT_CODES.map((suitCode) =>
      createNumberCard(`CARD_NUMBER_${rankCode}_${suitCode}`, rankCode, suitCode),
    ),
  );
}

export function skillDeck(): SkillCard[] {
  return [
    createSkillCard("SKILL_CARD_JOKER_HERO", "SKILL_JOKER_HERO"),
    createSkillCard("SKILL_CARD_JOKER_SAINT", "SKILL_JOKER_SAINT"),
    createSkillCard("SKILL_CARD_EXTENSION_SEAL_1", "SKILL_EXTENSION_SEAL"),
    createSkillCard("SKILL_CARD_EXTENSION_SEAL_2", "SKILL_EXTENSION_SEAL"),
    createSkillCard("SKILL_CARD_REVOLUTION_1", "SKILL_REVOLUTION"),
    createSkillCard("SKILL_CARD_REVOLUTION_2", "SKILL_REVOLUTION"),
  ];
}

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
  const numbers = shuffle(rng, numberDeck());
  const skills = shuffle(rng, skillDeck());

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
