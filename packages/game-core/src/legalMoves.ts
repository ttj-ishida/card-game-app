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
    let arr = byRank.get(r);
    if (!arr) {
      arr = [];
      byRank.set(r, arr);
    }
    arr.push(card);
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
