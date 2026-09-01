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
  if (plays.length === 0) throw new Error("pickWeakest: no candidates");
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
