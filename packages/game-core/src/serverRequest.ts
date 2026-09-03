import {
  INITIAL_RULESET_VERSION,
  type ActiveField,
  type DayNight,
  type FieldLock,
  type JokerDeclaration,
  type NumberCard,
  type PlayInput,
  type PlayOutcome,
  type PlayRejectionReason,
  type PlaySkillUse,
  type PlayerStatus,
  type RoundState,
  type SkillCard,
  createNumberCard,
  createPlayerState,
  createRoundState,
  createSkillCard,
  resolvePlay,
} from "./core.ts";

export type ServerNumberCardSnapshot = {
  cardId: string;
  rankCode: NumberCard["rankCode"];
  suitCode: NumberCard["suitCode"];
};

export type ServerSkillCardSnapshot = {
  skillId: string;
  effectCode: SkillCard["effectCode"];
  used: boolean;
};

export type ServerPlayerSnapshot = {
  playerId: string;
  status: PlayerStatus;
  consecutivePasses: number;
  hand: ServerNumberCardSnapshot[];
  skill: ServerSkillCardSnapshot | null;
};

export type ServerRoundSnapshot = {
  roundId: string;
  stateVersion: number;
  dayNight: DayNight;
  activePlayerId: string;
  activeField: ActiveField | null;
  extensionSealed?: boolean;
  discardPile?: ServerNumberCardSnapshot[];
  players: ServerPlayerSnapshot[];
};

export type ServerPlayRequest = {
  requestId: string;
  expectedStateVersion: number;
  playerId: string;
  play: PlayInput;
};

export type ServerPlayRequestRejectionReason =
  | "INVALID_REQUEST"
  | "STALE_STATE_VERSION"
  | "NOT_ACTIVE_PLAYER"
  | PlayRejectionReason;

export type ServerPlayRequestResolution =
  | {
      ok: true;
      roundId: string;
      requestId: string;
      rulesetVersion: number;
      state: RoundState;
      outcome: PlayOutcome;
    }
  | {
      ok: false;
      roundId: string;
      requestId: string | null;
      reason: ServerPlayRequestRejectionReason;
      currentStateVersion: number;
    };

export function buildServerRoundState(
  snapshot: ServerRoundSnapshot,
): RoundState {
  return createRoundState({
    rulesetCode: "INITIAL",
    rulesetVersion: INITIAL_RULESET_VERSION,
    dayNight: snapshot.dayNight,
    activePlayerId: snapshot.activePlayerId,
    activeField: snapshot.activeField,
    extensionSealed: snapshot.extensionSealed ?? false,
    discardPile: (snapshot.discardPile ?? []).map(toNumberCard),
    players: snapshot.players.map((player) => {
      const state = createPlayerState(
        player.playerId,
        player.hand.map(toNumberCard),
        player.skill ? toSkillCard(player.skill) : null,
      );

      return {
        ...state,
        status: player.status,
        consecutivePasses: player.consecutivePasses,
      };
    }),
  });
}

export function resolveServerPlayRequest(
  snapshot: ServerRoundSnapshot,
  request: ServerPlayRequest,
): ServerPlayRequestResolution {
  const invalid = (
    reason: ServerPlayRequestRejectionReason,
  ): ServerPlayRequestResolution => ({
    ok: false,
    roundId: snapshot.roundId,
    requestId: validRequestId(request.requestId) ? request.requestId : null,
    reason,
    currentStateVersion: snapshot.stateVersion,
  });

  if (!isValidRequestEnvelope(request)) {
    return invalid("INVALID_REQUEST");
  }

  if (request.expectedStateVersion !== snapshot.stateVersion) {
    return invalid("STALE_STATE_VERSION");
  }

  if (
    request.playerId !== snapshot.activePlayerId ||
    request.play.playerId !== request.playerId
  ) {
    return invalid("NOT_ACTIVE_PLAYER");
  }

  const state = buildServerRoundState(snapshot);
  const resolution = resolvePlay(state, request.play);

  if (!resolution.ok) {
    return invalid(resolution.reason);
  }

  return {
    ok: true,
    roundId: snapshot.roundId,
    requestId: request.requestId,
    rulesetVersion: INITIAL_RULESET_VERSION,
    state: resolution.state,
    outcome: resolution.outcome,
  };
}

function toNumberCard(card: ServerNumberCardSnapshot): NumberCard {
  return createNumberCard(card.cardId, card.rankCode, card.suitCode);
}

function toSkillCard(card: ServerSkillCardSnapshot): SkillCard {
  return createSkillCard(card.skillId, card.effectCode, card.used);
}

function isValidRequestEnvelope(request: ServerPlayRequest): boolean {
  if (!validRequestId(request.requestId)) {
    return false;
  }

  if (
    !Number.isInteger(request.expectedStateVersion) ||
    request.expectedStateVersion < 0
  ) {
    return false;
  }

  if (!request.playerId || request.play.playerId !== request.playerId) {
    return false;
  }

  if (request.play.kind === "PASS") {
    return true;
  }

  return (
    Array.isArray(request.play.cardIds) &&
    request.play.cardIds.every(
      (cardId) => typeof cardId === "string" && cardId.length > 0,
    ) &&
    isValidSkillUse(request.play.useSkill) &&
    isValidJokerDeclarations(request.play.jokerDeclarations)
  );
}

function validRequestId(requestId: string): boolean {
  return (
    typeof requestId === "string" &&
    requestId.length > 0 &&
    requestId.length <= 128
  );
}

function isValidSkillUse(skillUse: PlaySkillUse | undefined): boolean {
  return (
    skillUse === undefined ||
    skillUse === "EXTENSION_SEAL" ||
    skillUse === "REVOLUTION" ||
    skillUse === "JOKER_TRANSFORM" ||
    skillUse === "JOKER_CLEAR"
  );
}

function isValidJokerDeclarations(
  declarations: JokerDeclaration[] | undefined,
): boolean {
  return (
    declarations === undefined ||
    declarations.every(
      (declaration) =>
        declaration.skillId.length > 0 &&
        declaration.asCardId.length > 0 &&
        declaration.rankCode.startsWith("RANK_") &&
        declaration.suitCode.startsWith("SUIT_"),
    )
  );
}
