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

export type FieldLock = {
  countLocked: boolean;
  suitFixed: SuitCode[] | null;
  suitUniform: boolean;
};

export const UNLOCKED_FIELD: FieldLock = Object.freeze({
  countLocked: false,
  suitFixed: null,
  suitUniform: false,
}) as FieldLock;

export type RulesetOptions = {
  countLock: boolean;
  suitFixedLock: boolean;
  suitUniformLock: boolean;
};

export const RULESET_INITIAL: RulesetOptions = Object.freeze({
  countLock: true,
  suitFixedLock: true,
  suitUniformLock: true,
}) as RulesetOptions;

export type ActiveField = {
  combination: NumberCombination;
  lastPlayerId: string;
  lock: FieldLock;
};

export type RoundState = {
  rulesetCode: "INITIAL";
  rulesetVersion: number;
  dayNight: DayNight;
  players: PlayerState[];
  activePlayerId: string;
  activeField: ActiveField | null;
  extensionSealed: boolean;
  discardPile: NumberCard[];
  consecutivePasses: number;
  winnerId: string | null;
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
  extensionSealed?: boolean;
  discardPile?: NumberCard[];
  consecutivePasses?: number;
  winnerId?: string | null;
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
    extensionSealed: input.extensionSealed ?? false,
    discardPile: [...(input.discardPile ?? [])],
    consecutivePasses: input.consecutivePasses ?? 0,
    winnerId: input.winnerId ?? null,
  };
}

export function createActiveField(
  combination: NumberCombination,
  lastPlayerId: string,
  lock: Partial<FieldLock> = {},
): ActiveField {
  const merged = { ...UNLOCKED_FIELD, ...lock };
  return {
    combination,
    lastPlayerId,
    lock: {
      ...merged,
      suitFixed: merged.suitFixed ? [...merged.suitFixed] : null,
    },
  };
}

export function suitsOf(cards: NumberCard[]): SuitCode[] {
  return cards.map((card) => card.suitCode).sort();
}

export function multisetEqual(left: SuitCode[], right: SuitCode[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((suit, index) => suit === b[index]);
}

export function allSameSuit(cards: NumberCard[]): boolean {
  if (cards.length === 0) return true;
  return cards.every((card) => card.suitCode === cards[0].suitCode);
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

export function combinationStrength(
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
  | "COUNT_LOCKED"
  | "SUIT_FIXED_MISMATCH"
  | "SUIT_UNIFORM_REQUIRED"
  | "NATURAL_REVOLUTION_WITH_REVOLUTION_SKILL"
  | "DUPLICATE_JOKER_DECLARATION"
  | "JOKER_TRANSFORM_LAST_NUMBER_WIN";

export type LegalNumberPlayResult = {
  legal: true;
  actionKind: PlayActionKind;
  combination: NumberCombination;
  resultingCombination: NumberCombination;
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
  fieldLock?: FieldLock;
  ruleset?: RulesetOptions;
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
    fieldLock: input.fieldLock,
    ruleset: input.ruleset,
    extensionSealed: input.extensionSealed,
    usesRevolutionSkill: input.usesRevolutionSkill,
  });
}

export type JokerClearResult =
  | {
      legal: true;
      clearedCards: NumberCard[];
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
  fieldLock?: FieldLock;
  ruleset?: RulesetOptions;
  extensionSealed?: boolean;
  usesRevolutionSkill?: boolean;
}): NumberPlayResult {
  const fieldLock = input.fieldLock ?? UNLOCKED_FIELD;
  const ruleset = input.ruleset ?? RULESET_INITIAL;
  const effectiveDayNight = input.usesRevolutionSkill
    ? nextDayNight(input.dayNight)
    : input.dayNight;

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
  // When the candidate parses as a valid extension but a lock blocks it, the
  // same cards may still form a legal same-kind/same-count stronger REPLACE
  // (spec SEAL-005 / §2.1 / §2.3). Remember the block reason and fall through
  // to the REPLACE evaluation instead of returning immediately.
  let extensionBlockReason: IllegalPlayReason | null = null;
  if (extension) {
    if (input.extensionSealed) {
      extensionBlockReason = "EXTENSION_SEALED";
    } else if (ruleset.countLock && fieldLock.countLocked) {
      extensionBlockReason = "COUNT_LOCKED";
    } else if (
      ruleset.suitUniformLock &&
      fieldLock.suitUniform &&
      input.candidateCards.some(
        (card) => card.suitCode !== input.current!.cards[0].suitCode,
      )
    ) {
      extensionBlockReason = "SUIT_UNIFORM_REQUIRED";
    }
    if (!extensionBlockReason) {
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
  }

  const candidate = parseNumberCombination(input.candidateCards);
  if (!candidate)
    return {
      legal: false,
      reason: extensionBlockReason ?? "INVALID_COMBINATION",
    };
  if (
    candidate.kind !== input.current.kind ||
    candidate.cards.length !== input.current.cards.length
  ) {
    return { legal: false, reason: extensionBlockReason ?? "SHAPE_MISMATCH" };
  }
  if (compareCombinations(candidate, input.current, effectiveDayNight) !== 1) {
    return { legal: false, reason: extensionBlockReason ?? "NOT_STRONGER" };
  }

  if (
    ruleset.suitFixedLock &&
    fieldLock.suitFixed &&
    !multisetEqual(suitsOf(candidate.cards), fieldLock.suitFixed)
  ) {
    return { legal: false, reason: "SUIT_FIXED_MISMATCH" };
  }
  if (
    ruleset.suitUniformLock &&
    fieldLock.suitUniform &&
    !allSameSuit(candidate.cards)
  ) {
    return { legal: false, reason: "SUIT_UNIFORM_REQUIRED" };
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
  return {
    legal: true,
    actionKind,
    combination,
    resultingCombination,
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

export function nextDayNight(dayNight: DayNight): DayNight {
  return dayNight === "DAY" ? "NIGHT" : "DAY";
}

export function deriveFieldLock(input: {
  previous: ActiveField | null;
  actionKind: PlayActionKind;
  playedCombination: NumberCombination;
  resultingCombination: NumberCombination;
  ruleset?: RulesetOptions;
}): FieldLock {
  const ruleset = input.ruleset ?? RULESET_INITIAL;

  if (input.actionKind === "LEAD") {
    return {
      countLocked: false,
      suitFixed: null,
      suitUniform:
        ruleset.suitUniformLock &&
        input.resultingCombination.kind === "SEQUENCE" &&
        allSameSuit(input.resultingCombination.cards),
    };
  }

  const previous = input.previous;
  if (!previous) {
    return { ...UNLOCKED_FIELD };
  }

  if (input.actionKind === "EXTEND") {
    // In M1 a locked field cannot be extended, so these are always false/null
    // here; carrying them keeps the ruleset toggle seam consistent.
    return {
      countLocked: previous.lock.countLocked,
      suitFixed: previous.lock.suitFixed,
      suitUniform: previous.lock.suitUniform,
    };
  }

  // REPLACE
  const isFirstReplace = !previous.lock.countLocked;
  let suitFixed: SuitCode[] | null;
  if (!isFirstReplace) {
    suitFixed = previous.lock.suitFixed;
  } else if (!ruleset.suitFixedLock) {
    suitFixed = null;
  } else {
    suitFixed = multisetEqual(
      suitsOf(input.playedCombination.cards),
      suitsOf(previous.combination.cards),
    )
      ? suitsOf(input.playedCombination.cards)
      : null;
  }

  return {
    countLocked: ruleset.countLock,
    suitFixed,
    suitUniform: previous.lock.suitUniform,
  };
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

export type PlaySkillUse =
  | "EXTENSION_SEAL"
  | "REVOLUTION"
  | "JOKER_TRANSFORM"
  | "JOKER_CLEAR";

export type PlayInput =
  | { kind: "PASS"; playerId: string }
  | {
      kind: "PLAY";
      playerId: string;
      cardIds: string[];
      useSkill?: PlaySkillUse;
      jokerDeclarations?: JokerDeclaration[];
    };

export type PlayRejectionReason =
  | IllegalPlayReason
  | "ROUND_FINISHED"
  | "NOT_ACTIVE_PLAYER"
  | "CARD_NOT_IN_HAND"
  | "SKILL_NOT_AVAILABLE"
  | "FIELD_EMPTY"
  | "MUST_LEAD"
  | "NO_FIELD_TO_CLEAR"
  | "TRANSFORM_JOKER_GO_OUT";

export type PlayOutcome = {
  actionKind: PlayActionKind | "PASS";
  fieldCleared: boolean;
  naturalRevolution: boolean;
  dayNightAfter: DayNight;
  winnerId: string | null;
};

export type PlayResolution =
  | { ok: true; state: RoundState; outcome: PlayOutcome }
  | { ok: false; reason: PlayRejectionReason; state: RoundState };

export function resolvePlay(
  state: RoundState,
  play: PlayInput,
): PlayResolution {
  const reject = (reason: PlayRejectionReason): PlayResolution => ({
    ok: false,
    reason,
    state,
  });

  if (state.winnerId) return reject("ROUND_FINISHED");
  if (play.playerId !== state.activePlayerId) return reject("NOT_ACTIVE_PLAYER");

  const player = state.players.find((p) => p.playerId === play.playerId);
  if (!player) return reject("NOT_ACTIVE_PLAYER");

  return play.kind === "PASS"
    ? resolvePassPlay(state, player)
    : resolveCardPlay(state, player, play);
}

function inRoundPlayerCount(state: RoundState): number {
  return state.players.filter((p) => p.status !== "OUT").length;
}

function nextActivePlayerId(players: PlayerState[], fromId: string): string {
  const count = players.length;
  const start = players.findIndex((p) => p.playerId === fromId);
  for (let step = 1; step <= count; step += 1) {
    const candidate = players[(start + step) % count];
    if (candidate.status === "ACTIVE") return candidate.playerId;
  }
  return fromId;
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    playerId: player.playerId,
    status: player.status,
    hand: player.hand.map((card) => ({ ...card })),
    skill: player.skill ? { ...player.skill } : null,
    consecutivePasses: player.consecutivePasses,
  };
}

function reactivate(player: PlayerState): PlayerState {
  const cloned = clonePlayer(player);
  if (cloned.status === "PASSED") cloned.status = "ACTIVE";
  return cloned;
}

function buildState(
  base: RoundState,
  patch: Partial<RoundState>,
): RoundState {
  return {
    rulesetCode: base.rulesetCode,
    rulesetVersion: base.rulesetVersion,
    dayNight: patch.dayNight ?? base.dayNight,
    players: patch.players ?? base.players.map(clonePlayer),
    activePlayerId: patch.activePlayerId ?? base.activePlayerId,
    activeField:
      patch.activeField !== undefined ? patch.activeField : base.activeField,
    extensionSealed: patch.extensionSealed ?? base.extensionSealed,
    discardPile: patch.discardPile ?? [...base.discardPile],
    consecutivePasses: patch.consecutivePasses ?? base.consecutivePasses,
    winnerId: patch.winnerId !== undefined ? patch.winnerId : base.winnerId,
  };
}

function resolvePassPlay(
  state: RoundState,
  player: PlayerState,
): PlayResolution {
  const pass = evaluatePass({
    activeField: state.activeField,
    consecutivePassesBefore: state.consecutivePasses,
    activePlayerCount: inRoundPlayerCount(state),
    lastPlayerActive: true,
  });
  if (!pass.legal) return { ok: false, reason: pass.reason, state };

  if (pass.clearsField && state.activeField) {
    const clear = resolveFieldClear({
      currentField: state.activeField,
      dayNight: state.dayNight,
      lastPlayerActive: true,
      fallbackLeaderId: state.activeField.lastPlayerId,
    });
    const next = buildState(state, {
      players: state.players.map(reactivate),
      activePlayerId: clear.nextLeaderId,
      activeField: null,
      extensionSealed: false,
      discardPile: [...state.discardPile, ...clear.clearedCards],
      consecutivePasses: 0,
    });
    return {
      ok: true,
      state: next,
      outcome: {
        actionKind: "PASS",
        fieldCleared: true,
        naturalRevolution: false,
        dayNightAfter: clear.dayNightAfter,
        winnerId: null,
      },
    };
  }

  const players = state.players.map((p) => {
    const cloned = clonePlayer(p);
    if (p.playerId === player.playerId) cloned.status = "PASSED";
    return cloned;
  });
  const next = buildState(state, {
    players,
    activePlayerId: nextActivePlayerId(players, player.playerId),
    consecutivePasses: state.consecutivePasses + 1,
  });
  return {
    ok: true,
    state: next,
    outcome: {
      actionKind: "PASS",
      fieldCleared: false,
      naturalRevolution: false,
      dayNightAfter: state.dayNight,
      winnerId: null,
    },
  };
}

function skillMatches(skill: SkillCard, use: PlaySkillUse): boolean {
  if (use === "EXTENSION_SEAL") return skill.effectCode === "SKILL_EXTENSION_SEAL";
  if (use === "REVOLUTION") return skill.effectCode === "SKILL_REVOLUTION";
  return (
    skill.effectCode === "SKILL_JOKER_HERO" ||
    skill.effectCode === "SKILL_JOKER_SAINT"
  );
}

function resolveCardPlay(
  state: RoundState,
  player: PlayerState,
  play: Extract<PlayInput, { kind: "PLAY" }>,
): PlayResolution {
  const reject = (reason: PlayRejectionReason): PlayResolution => ({
    ok: false,
    reason,
    state,
  });

  if (new Set(play.cardIds).size !== play.cardIds.length) {
    return reject("CARD_NOT_IN_HAND");
  }
  const handById = new Map(player.hand.map((card) => [card.cardId, card]));
  const playedCards: NumberCard[] = [];
  for (const cardId of play.cardIds) {
    const card = handById.get(cardId);
    if (!card) return reject("CARD_NOT_IN_HAND");
    playedCards.push(card);
  }

  if (play.useSkill) {
    if (
      !player.skill ||
      player.skill.used ||
      !skillMatches(player.skill, play.useSkill)
    ) {
      return reject("SKILL_NOT_AVAILABLE");
    }
  }

  const isJokerClear = play.useSkill === "JOKER_CLEAR";
  const isJokerTransform = play.useSkill === "JOKER_TRANSFORM";
  const usesRevolutionSkill = play.useSkill === "REVOLUTION";

  if (isJokerClear) {
    const jokerClear = evaluateJokerClear({
      currentField: state.activeField,
      dayNight: state.dayNight,
    });
    if (!jokerClear.legal) return reject(jokerClear.reason);
  }

  const current = isJokerClear
    ? null
    : state.activeField?.combination ?? null;
  const fieldLock = isJokerClear
    ? UNLOCKED_FIELD
    : state.activeField?.lock ?? UNLOCKED_FIELD;
  const extensionSealed = isJokerClear ? false : state.extensionSealed;

  // Forbidden go-out with a transformed Joker is decided below from the real
  // resulting hand via evaluateGoOut, so the combination check stays hand-agnostic.
  const numberResult: NumberPlayResult = isJokerTransform
    ? evaluateJokerTransformPlay({
        current,
        realNumberCards: playedCards,
        jokerDeclarations: play.jokerDeclarations ?? [],
        dayNight: state.dayNight,
        fieldLock,
        ruleset: RULESET_INITIAL,
        extensionSealed,
      })
    : evaluateNumberPlay({
        current,
        candidateCards: playedCards,
        dayNight: state.dayNight,
        fieldLock,
        ruleset: RULESET_INITIAL,
        extensionSealed,
        usesRevolutionSkill,
      });
  if (!numberResult.legal) return reject(numberResult.reason);

  const remainingHand = player.hand.filter(
    (card) => !play.cardIds.includes(card.cardId),
  );
  const goOut = evaluateGoOut({
    numberCardsInHandAfterPlay: remainingHand.length,
    playIncludesTransformedJoker:
      isJokerTransform && (play.jokerDeclarations?.length ?? 0) > 0,
  });
  if ("forbidden" in goOut && goOut.forbidden) {
    return reject("TRANSFORM_JOKER_GO_OUT");
  }
  const goesOut = "goesOut" in goOut && goOut.goesOut;

  const dayNightAfter = numberResult.dayNightAfter ?? state.dayNight;

  const discardPile = [...state.discardPile];
  if (isJokerClear && state.activeField) {
    discardPile.push(...state.activeField.combination.cards);
  }
  if (numberResult.actionKind === "REPLACE" && state.activeField) {
    discardPile.push(...state.activeField.combination.cards);
  }

  const players = state.players.map((p) => {
    if (p.playerId === player.playerId) {
      const cloned = clonePlayer(p);
      cloned.hand = remainingHand.map((card) => ({ ...card }));
      if (play.useSkill && cloned.skill) {
        cloned.skill = { ...cloned.skill, used: true };
      }
      cloned.status = goesOut ? "OUT" : "ACTIVE";
      cloned.consecutivePasses = 0;
      return cloned;
    }
    return reactivate(p);
  });

  const winnerId = goesOut ? player.playerId : null;
  const next = buildState(state, {
    dayNight: dayNightAfter,
    players,
    activePlayerId: goesOut
      ? player.playerId
      : nextActivePlayerId(players, player.playerId),
    activeField: createActiveField(
      numberResult.resultingCombination,
      player.playerId,
      deriveFieldLock({
        previous: isJokerClear ? null : state.activeField,
        actionKind: numberResult.actionKind,
        playedCombination: numberResult.combination,
        resultingCombination: numberResult.resultingCombination,
        ruleset: RULESET_INITIAL,
      }),
    ),
    extensionSealed:
      play.useSkill === "EXTENSION_SEAL" ? true : extensionSealed,
    discardPile,
    consecutivePasses: 0,
    winnerId,
  });

  return {
    ok: true,
    state: next,
    outcome: {
      actionKind: numberResult.actionKind,
      fieldCleared: isJokerClear,
      naturalRevolution: numberResult.naturalRevolution ?? false,
      dayNightAfter,
      winnerId,
    },
  };
}

// ---- M2: headless CPU engine ----
export * from "./rng.js";
export * from "./deal.js";
export * from "./legalMoves.js";
export * from "./cpuPolicy.js";
export * from "./cpuPolicyStandard.js";
export * from "./roundLoop.js";
