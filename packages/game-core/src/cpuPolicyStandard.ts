import type { NumberCard, PlayInput } from "./core.ts";
import { rankNumber, rankStrength } from "./core.ts";
import type { CpuDecisionInput, CpuPolicy } from "./cpuPolicy.ts";
import { type LegalPlay, resultStrength } from "./legalMoves.ts";
import type { Rng } from "./rng.ts";

/** 決定的順序済みの候補から rng で1つ選ぶ（同値タイブレーク）。空配列は呼ばない。 */
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

/** 手札から出す枚数（変化Joker はスキル枠由来なので数えない = input.cardIds のみ）。 */
function playHandCount(p: LegalPlay): number {
  return p.input.kind === "PLAY" ? p.input.cardIds.length : 0;
}

/** 手番プレイヤーが未使用スキルを持つならその effectCode、無ければ null。 */
function activeSkillEffect(state: CpuDecisionInput["state"]): string | null {
  const skill = state.players.find((p) => p.playerId === state.activePlayerId)?.skill;
  return skill && !skill.used ? skill.effectCode : null;
}

/** cardId 集合の一致。 */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

export const standardPolicy: CpuPolicy = ({ state, legalPlays, rng }: CpuDecisionInput): PlayInput => {
  const dayNight = state.dayNight;
  const strengthOf = (p: LegalPlay) =>
    p.resultingCombination ? resultStrength(p.resultingCombination, dayNight) : 0;

  // 1. 上がれる手を最優先（変化Joker上がりは列挙器が既に除外）
  const winning = legalPlays.filter((p) => p.goesOut);
  if (winning.length > 0) return pickWeakest(winning, strengthOf, rng).input;

  // 2. 場が空 → 最弱の単体数字（スキル無し）
  if (state.activeField === null) {
    const singles = legalPlays.filter(
      (p) =>
        p.actionKind === "LEAD" &&
        p.input.kind === "PLAY" &&
        p.input.cardIds.length === 1 &&
        p.input.useSkill === undefined,
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

    // 変化Joker が数字だけでは作れない組み合わせを完成させ、より多く手札を減らせる場合
    const jokerDump = legalPlays.filter(
      (p) =>
        p.input.kind === "PLAY" &&
        p.input.useSkill === "JOKER_TRANSFORM" &&
        !p.goesOut &&
        playHandCount(p) > bestCount,
    );
    if (jokerDump.length > 0) return pickWeakest(jokerDump, strengthOf, rng).input;

    // 封印席で EXTEND / REPLACE 応答 → 同じ cardIds の封印併用版があれば使う
    if (
      (best.actionKind === "EXTEND" || best.actionKind === "REPLACE") &&
      activeSkillEffect(state) === "SKILL_EXTENSION_SEAL" &&
      best.input.kind === "PLAY"
    ) {
      const bestIds = best.input.cardIds;
      const sealed = legalPlays.find(
        (p) =>
          p.input.kind === "PLAY" &&
          p.input.useSkill === "EXTENSION_SEAL" &&
          sameSet(p.input.cardIds, bestIds),
      );
      if (sealed) return sealed.input;
    }

    return best.input;
  }

  // 数字応答なし（本来パス）→ スキルで打開 or PASS
  const effect = activeSkillEffect(state);
  if (effect === "SKILL_JOKER_HERO" || effect === "SKILL_JOKER_SAINT") {
    const clears = legalPlays.filter(
      (p) => p.input.kind === "PLAY" && p.input.useSkill === "JOKER_CLEAR",
    );
    if (clears.length > 0) return pickWeakest(clears, strengthOf, rng).input;
  }
  if (effect === "SKILL_REVOLUTION") {
    const revs = legalPlays.filter(
      (p) =>
        p.input.kind === "PLAY" && p.input.useSkill === "REVOLUTION" && p.actionKind !== "PASS",
    );
    if (revs.length > 0) return pickWeakest(revs, strengthOf, rng).input;
  }

  // 4. それ以外 → PASS
  return { kind: "PASS", playerId: state.activePlayerId };
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
