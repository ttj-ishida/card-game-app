export const RANK_CODES = [
  "RANK_1",
  "RANK_2",
  "RANK_3",
  "RANK_4",
  "RANK_5",
  "RANK_6",
  "RANK_7",
  "RANK_8",
  "RANK_9",
] as const;

export const SUIT_CODES = [
  "SUIT_FIRE",
  "SUIT_WATER",
  "SUIT_WIND",
  "SUIT_EARTH",
] as const;

export const SKILL_EFFECT_CODES = [
  "SKILL_JOKER_HERO",
  "SKILL_JOKER_SAINT",
  "SKILL_EXTENSION_SEAL",
  "SKILL_REVOLUTION",
] as const;

export const INITIAL_RULESET_VERSION = 1;

export type RankCode = (typeof RANK_CODES)[number];
export type SuitCode = (typeof SUIT_CODES)[number];
export type SkillEffectCode = (typeof SKILL_EFFECT_CODES)[number];
export type DayNight = "DAY" | "NIGHT";
export type CombinationKind = "SINGLE" | "RANK_SET" | "SEQUENCE";
export type PlayerStatus = "ACTIVE" | "PASSED" | "OUT";

export type NumberCard = {
  kind: "NUMBER";
  cardId: string;
  rankCode: RankCode;
  suitCode: SuitCode;
  transformedFromSkillId?: string;
};

export type SkillCard = {
  kind: "SKILL";
  skillId: string;
  effectCode: SkillEffectCode;
  used: boolean;
};

export type Card = NumberCard | SkillCard;

export type PlayerState = {
  playerId: string;
  status: PlayerStatus;
  hand: NumberCard[];
  skill: SkillCard | null;
  consecutivePasses: number;
};

export type NumberCombination = {
  kind: CombinationKind;
  cards: NumberCard[];
  ranks: number[];
};

export type ActiveField = {
  combination: NumberCombination;
  lastPlayerId: string;
};

export type RoundState = {
  rulesetCode: "INITIAL";
  rulesetVersion: number;
  dayNight: DayNight;
  players: PlayerState[];
  activePlayerId: string;
  activeField: ActiveField | null;
  lockedSuitCode: SuitCode | null;
  extensionSealed: boolean;
  discardPile: NumberCard[];
};

export function createNumberCard(
  cardId: string,
  rankCode: RankCode,
  suitCode: SuitCode,
): NumberCard {
  return { kind: "NUMBER", cardId, rankCode, suitCode };
}

export function createTransformedJokerCard(
  skillId: string,
  rankCode: RankCode,
  suitCode: SuitCode,
): NumberCard {
  return {
    kind: "NUMBER",
    cardId: `JOKER_AS_${skillId}`,
    rankCode,
    suitCode,
    transformedFromSkillId: skillId,
  };
}

export function isTransformedJokerCard(
  card: NumberCard | null | undefined,
): boolean {
  return Boolean(card?.transformedFromSkillId);
}

export function createSkillCard(
  skillId: string,
  effectCode: SkillEffectCode,
  used = false,
): SkillCard {
  return { kind: "SKILL", skillId, effectCode, used };
}

export function isSkillCard(card: Card | null | undefined): card is SkillCard {
  return card?.kind === "SKILL";
}

export function createPlayerState(
  playerId: string,
  hand: NumberCard[],
  skill: Omit<SkillCard, "kind"> | SkillCard | null = null,
): PlayerState {
  return {
    playerId,
    status: "ACTIVE",
    hand: [...hand],
    skill: skill ? { kind: "SKILL", ...skill } : null,
    consecutivePasses: 0,
  };
}

export function createRoundState(input: {
  rulesetCode: "INITIAL";
  rulesetVersion: number;
  dayNight: DayNight;
  players: PlayerState[];
  activePlayerId: string;
  activeField?: ActiveField | null;
  lockedSuitCode?: SuitCode | null;
  extensionSealed?: boolean;
  discardPile?: NumberCard[];
}): RoundState {
  return {
    rulesetCode: input.rulesetCode,
    rulesetVersion: input.rulesetVersion,
    dayNight: input.dayNight,
    players: input.players.map((player) => ({
      ...player,
      hand: [...player.hand],
      skill: player.skill ? { ...player.skill } : null,
    })),
    activePlayerId: input.activePlayerId,
    activeField: input.activeField ?? null,
    lockedSuitCode: input.lockedSuitCode ?? null,
    extensionSealed: input.extensionSealed ?? false,
    discardPile: [...(input.discardPile ?? [])],
  };
}

export function rankNumber(rankCode: RankCode): number {
  return Number(rankCode.replace("RANK_", ""));
}

export function rankStrength(rank: number, dayNight: DayNight): number {
  return dayNight === "DAY" ? rank : 10 - rank;
}

export function parseNumberCombination(
  cards: NumberCard[],
): NumberCombination | null {
  if (cards.length === 0) return null;

  const ranks = cards.map((card) => rankNumber(card.rankCode));
  const uniqueRanks = [...new Set(ranks)].sort((left, right) => left - right);

  if (cards.length === 1) {
    return { kind: "SINGLE", cards: [...cards], ranks: uniqueRanks };
  }

  if (uniqueRanks.length === 1) {
    if (cards.length > 4) return null;
    return { kind: "RANK_SET", cards: [...cards], ranks: uniqueRanks };
  }

  if (cards.length < 3) return null;
  if (uniqueRanks.length !== cards.length) return null;

  const isContiguous = uniqueRanks.every(
    (rank, index) => index === 0 || rank === uniqueRanks[index - 1] + 1,
  );
  if (!isContiguous) return null;

  return { kind: "SEQUENCE", cards: [...cards], ranks: uniqueRanks };
}

export function compareCombinations(
  candidate: NumberCombination,
  current: NumberCombination,
  dayNight: DayNight,
): -1 | 0 | 1 {
  if (candidate.kind !== current.kind) return -1;
  if (candidate.cards.length !== current.cards.length) return -1;

  const candidateStrength = combinationStrength(candidate, dayNight);
  const currentStrength = combinationStrength(current, dayNight);

  if (candidateStrength > currentStrength) return 1;
  if (candidateStrength < currentStrength) return -1;
  return 0;
}

function combinationStrength(
  combination: NumberCombination,
  dayNight: DayNight,
): number {
  if (combination.kind === "SEQUENCE") {
    const endRank =
      dayNight === "DAY"
        ? Math.max(...combination.ranks)
        : Math.min(...combination.ranks);
    return rankStrength(endRank, dayNight);
  }

  return rankStrength(combination.ranks[0], dayNight);
}

export type PlayActionKind = "LEAD" | "EXTEND" | "REPLACE";
export type IllegalPlayReason =
  | "INVALID_COMBINATION"
  | "SHAPE_MISMATCH"
  | "NOT_STRONGER"
  | "EXTENSION_SEALED"
  | "SUIT_LOCKED"
  | "NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL"
  | "DUPLICATE_JOKER_DECLARATION"
  | "JOKER_TRANSFORM_LAST_NUMBER_WIN";

export type LegalNumberPlayResult = {
  legal: true;
  actionKind: PlayActionKind;
  combination: NumberCombination;
  resultingCombination: NumberCombination;
  createsSuitLock?: boolean;
  lockedSuitCode?: SuitCode;
  naturalRevolution?: boolean;
  dayNightAfter?: DayNight;
};

export type IllegalNumberPlayResult = {
  legal: false;
  reason: IllegalPlayReason;
};

export type NumberPlayResult = LegalNumberPlayResult | IllegalNumberPlayResult;

export type JokerDeclaration = {
  skillId: string;
  rankCode: RankCode;
  suitCode: SuitCode;
};

export function evaluateJokerTransformPlay(input: {
  current: NumberCombination | null;
  realNumberCards: NumberCard[];
  jokerDeclarations: JokerDeclaration[];
  dayNight: DayNight;
  lockedSuitCode?: SuitCode | null;
  extensionSealed?: boolean;
  usesRevolutionSkill?: boolean;
  remainingNumberCardCount?: number;
}): NumberPlayResult {
  if (
    input.jokerDeclarations.length > 0 &&
    input.remainingNumberCardCount !== undefined &&
    input.realNumberCards.length >= input.remainingNumberCardCount
  ) {
    return { legal: false, reason: "JOKER_TRANSFORM_LAST_NUMBER_WIN" };
  }

  const transformedJokers = input.jokerDeclarations.map((declaration) =>
    createTransformedJokerCard(
      declaration.skillId,
      declaration.rankCode,
      declaration.suitCode,
    ),
  );
  const candidateCards = [...input.realNumberCards, ...transformedJokers];

  if (hasDuplicateNumberIdentity(candidateCards)) {
    return { legal: false, reason: "DUPLICATE_JOKER_DECLARATION" };
  }

  return evaluateNumberPlay({
    current: input.current,
    candidateCards,
    dayNight: input.dayNight,
    lockedSuitCode: input.lockedSuitCode,
    extensionSealed: input.extensionSealed,
    usesRevolutionSkill: input.usesRevolutionSkill,
  });
}

export type JokerClearResult =
  | {
      legal: true;
      clearedCards: NumberCard[];
      lockedSuitCode: null;
      extensionSealed: false;
      dayNightAfter: DayNight;
      mustLead: true;
      canPass: false;
      canUseSecondSkill: false;
    }
  | { legal: false; reason: "NO_FIELD_TO_CLEAR" };

export function evaluateJokerClear(input: {
  currentField: ActiveField | null;
  dayNight: DayNight;
}): JokerClearResult {
  if (!input.currentField) return { legal: false, reason: "NO_FIELD_TO_CLEAR" };

  return {
    legal: true,
    clearedCards: [...input.currentField.combination.cards],
    lockedSuitCode: null,
    extensionSealed: false,
    dayNightAfter: input.dayNight,
    mustLead: true,
    canPass: false,
    canUseSecondSkill: false,
  };
}

function hasDuplicateNumberIdentity(cards: NumberCard[]): boolean {
  const seen = new Set<string>();
  for (const card of cards) {
    const identity = `${card.rankCode}:${card.suitCode}`;
    if (seen.has(identity)) return true;
    seen.add(identity);
  }
  return false;
}
export function evaluateNumberPlay(input: {
  current: NumberCombination | null;
  candidateCards: NumberCard[];
  dayNight: DayNight;
  lockedSuitCode?: SuitCode | null;
  extensionSealed?: boolean;
  usesRevolutionSkill?: boolean;
}): NumberPlayResult {
  const effectiveDayNight = input.usesRevolutionSkill
    ? nextDayNight(input.dayNight)
    : input.dayNight;

  if (
    input.lockedSuitCode &&
    input.candidateCards.some((card) => card.suitCode !== input.lockedSuitCode)
  ) {
    return { legal: false, reason: "SUIT_LOCKED" };
  }

  if (!input.current) {
    const candidate = parseNumberCombination(input.candidateCards);
    if (!candidate) return { legal: false, reason: "INVALID_COMBINATION" };
    return completeLegalResult(
      input.current,
      "LEAD",
      candidate,
      candidate,
      input.dayNight,
      effectiveDayNight,
      input.usesRevolutionSkill ?? false,
    );
  }

  const extension = tryBuildExtension(
    input.current,
    input.candidateCards,
    effectiveDayNight,
  );
  if (extension) {
    if (input.extensionSealed)
      return { legal: false, reason: "EXTENSION_SEALED" };
    return completeLegalResult(
      input.current,
      "EXTEND",
      extension.playedCombination,
      extension.resultingCombination,
      input.dayNight,
      effectiveDayNight,
      input.usesRevolutionSkill ?? false,
    );
  }

  const candidate = parseNumberCombination(input.candidateCards);
  if (!candidate) return { legal: false, reason: "INVALID_COMBINATION" };
  if (
    candidate.kind !== input.current.kind ||
    candidate.cards.length !== input.current.cards.length
  ) {
    return { legal: false, reason: "SHAPE_MISMATCH" };
  }
  if (compareCombinations(candidate, input.current, effectiveDayNight) !== 1) {
    return { legal: false, reason: "NOT_STRONGER" };
  }

  return completeLegalResult(
    input.current,
    "REPLACE",
    candidate,
    candidate,
    input.dayNight,
    effectiveDayNight,
    input.usesRevolutionSkill ?? false,
  );
}

function legalResult(
  actionKind: PlayActionKind,
  combination: NumberCombination,
  resultingCombination: NumberCombination,
  extras: Partial<
    Pick<LegalNumberPlayResult, "naturalRevolution" | "dayNightAfter">
  > = {},
): LegalNumberPlayResult {
  const lockSuit = detectSuitLock(resultingCombination);
  return {
    legal: true,
    actionKind,
    combination,
    resultingCombination,
    ...(lockSuit ? { createsSuitLock: true, lockedSuitCode: lockSuit } : {}),
    ...extras,
  };
}

function tryBuildExtension(
  current: NumberCombination,
  candidateCards: NumberCard[],
  dayNight: DayNight,
): {
  playedCombination: NumberCombination;
  resultingCombination: NumberCombination;
} | null {
  if (candidateCards.length === 0) return null;
  const candidateRanks = candidateCards.map((card) =>
    rankNumber(card.rankCode),
  );

  if (current.kind === "SINGLE" || current.kind === "RANK_SET") {
    const currentRank = current.ranks[0];
    if (!candidateRanks.every((rank) => rank === currentRank)) return null;
    if (current.cards.length + candidateCards.length > 4) return null;
    const resultingCards = [...current.cards, ...candidateCards];
    return {
      playedCombination: {
        kind: "RANK_SET",
        cards: [...candidateCards],
        ranks: [currentRank],
      },
      resultingCombination: {
        kind: resultingCards.length === 1 ? "SINGLE" : "RANK_SET",
        cards: resultingCards,
        ranks: [currentRank],
      },
    };
  }

  if (current.kind !== "SEQUENCE") return null;

  const sortedCandidateRanks = [...candidateRanks].sort(
    (left, right) => left - right,
  );
  if (new Set(sortedCandidateRanks).size !== sortedCandidateRanks.length)
    return null;
  const isCandidateContiguous = sortedCandidateRanks.every(
    (rank, index) =>
      index === 0 || rank === sortedCandidateRanks[index - 1] + 1,
  );
  if (!isCandidateContiguous) return null;

  const currentMin = Math.min(...current.ranks);
  const currentMax = Math.max(...current.ranks);
  const expectedEdge = dayNight === "DAY" ? currentMax + 1 : currentMin - 1;
  const candidateEdge =
    dayNight === "DAY" ? sortedCandidateRanks[0] : sortedCandidateRanks.at(-1);
  if (candidateEdge !== expectedEdge) return null;

  const resultingRanks = [...current.ranks, ...sortedCandidateRanks].sort(
    (left, right) => left - right,
  );
  if (resultingRanks[0] < 1 || resultingRanks.at(-1)! > 9) return null;

  return {
    playedCombination: {
      kind: "SEQUENCE",
      cards: [...candidateCards],
      ranks: sortedCandidateRanks,
    },
    resultingCombination: {
      kind: "SEQUENCE",
      cards: [...current.cards, ...candidateCards],
      ranks: resultingRanks,
    },
  };
}

function detectSuitLock(combination: NumberCombination): SuitCode | null {
  if (combination.cards.length < 3) return null;
  const [firstSuit] = combination.cards.map((card) => card.suitCode);
  return combination.cards.every((card) => card.suitCode === firstSuit)
    ? firstSuit
    : null;
}

export function nextDayNight(dayNight: DayNight): DayNight {
  return dayNight === "DAY" ? "NIGHT" : "DAY";
}

export function detectNaturalRevolution(
  current: NumberCombination | null,
  resultingCombination: NumberCombination,
  actionKind: PlayActionKind,
): boolean {
  if (resultingCombination.cards.length < 4) return false;
  if (actionKind === "LEAD" || actionKind === "REPLACE") return true;
  return actionKind === "EXTEND" && (current?.cards.length ?? 0) < 4;
}

export type PassEvaluation =
  | { legal: true; consecutivePasses: number; clearsField: boolean }
  | { legal: false; reason: "FIELD_EMPTY" | "MUST_LEAD" };

export function evaluatePass(input: {
  activeField: ActiveField | null;
  consecutivePassesBefore: number;
  activePlayerCount: number;
  lastPlayerActive: boolean;
  mustLead?: boolean;
}): PassEvaluation {
  if (input.mustLead) return { legal: false, reason: "MUST_LEAD" };
  if (!input.activeField) return { legal: false, reason: "FIELD_EMPTY" };

  const consecutivePasses = input.consecutivePassesBefore + 1;
  const responderCount = input.lastPlayerActive
    ? input.activePlayerCount - 1
    : input.activePlayerCount;

  return {
    legal: true,
    consecutivePasses,
    clearsField: responderCount > 0 && consecutivePasses >= responderCount,
  };
}

export type FieldClearResult = {
  clearedCards: NumberCard[];
  lockedSuitCode: null;
  extensionSealed: false;
  dayNightAfter: DayNight;
  nextLeaderId: string;
};

export function resolveFieldClear(input: {
  currentField: ActiveField;
  dayNight: DayNight;
  lastPlayerActive: boolean;
  fallbackLeaderId: string;
}): FieldClearResult {
  return {
    clearedCards: [...input.currentField.combination.cards],
    lockedSuitCode: null,
    extensionSealed: false,
    dayNightAfter: input.dayNight,
    nextLeaderId: input.lastPlayerActive
      ? input.currentField.lastPlayerId
      : input.fallbackLeaderId,
  };
}

export type GoOutResult =
  | { goesOut: true }
  | { goesOut: false }
  | { goesOut: false; forbidden: true; reason: "TRANSFORM_JOKER_GO_OUT" };

export function evaluateGoOut(input: {
  numberCardsInHandAfterPlay: number;
  playIncludesTransformedJoker: boolean;
}): GoOutResult {
  if (input.numberCardsInHandAfterPlay > 0) return { goesOut: false };
  if (input.playIncludesTransformedJoker) {
    return { goesOut: false, forbidden: true, reason: "TRANSFORM_JOKER_GO_OUT" };
  }
  return { goesOut: true };
}

export function determineRoundWinner(
  players: { playerId: string; numberCardCount: number }[],
): string | null {
  return players.find((player) => player.numberCardCount === 0)?.playerId ?? null;
}

function completeLegalResult(
  current: NumberCombination | null,
  actionKind: PlayActionKind,
  combination: NumberCombination,
  resultingCombination: NumberCombination,
  originalDayNight: DayNight,
  effectiveDayNight: DayNight,
  usesRevolutionSkill: boolean,
): NumberPlayResult {
  const naturalRevolution = detectNaturalRevolution(
    current,
    resultingCombination,
    actionKind,
  );
  if (usesRevolutionSkill && naturalRevolution) {
    return { legal: false, reason: "NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL" };
  }

  const extras: Partial<
    Pick<LegalNumberPlayResult, "naturalRevolution" | "dayNightAfter">
  > = {};
  if (usesRevolutionSkill) extras.dayNightAfter = effectiveDayNight;
  if (naturalRevolution) {
    extras.naturalRevolution = true;
    extras.dayNightAfter = nextDayNight(originalDayNight);
  }
  return legalResult(actionKind, combination, resultingCombination, extras);
}
