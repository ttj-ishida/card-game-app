export type HistoryHttpPort = {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }>;
};

export type HistoryDeps = {
  http: HistoryHttpPort;
  supabaseUrl: string;
  anonKey: string;
};

export type PracticeRoundHistoryRow = {
  id: string;
  recorded_at: string;
  player_count: number;
  local_won: boolean;
  turn_count: number;
  ruleset_id: string | null;
};

export type RoundEventHistoryEntry = {
  index: number;
  seat_id: string;
  seat_kind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS';
  action_kind?: string | null;
  cards: { rank_code: string; suit_code: string }[];
  skill_effect?: string | null;
  field_cleared: boolean;
  day_night_after?: string | null;
  hand_counts_after?: Record<string, number>;
};

export type RoundEventsHistoryRow = {
  round_result_id: string;
  events: RoundEventHistoryEntry[];
};

export type HistoryEventView = {
  index: number;
  seatId: string;
  seatKind: 'HUMAN' | 'CPU';
  kind: 'PLAY' | 'PASS';
  actionKind: string | null;
  cardKeys: { rankKey: string; suitKey: string }[];
  skillEffectKey: string | null;
  fieldCleared: boolean;
  dayNightKey: string | null;
};

export type HistoryRoundView = {
  roundResultId: string;
  recordedAt: string;
  playerCount: number;
  localWon: boolean;
  turnCount: number;
  hasRuleset: boolean;
  eventsMissing: boolean;
  events: HistoryEventView[];
};

export type HistoryLoadResult =
  | { status: 'ready'; items: HistoryRoundView[] }
  | { status: 'empty'; items: [] }
  | { status: 'failed'; items: [] };

function authHeaders(deps: Pick<HistoryDeps, 'anonKey'>): Record<string, string> {
  return {
    apikey: deps.anonKey,
    Authorization: `Bearer ${deps.anonKey}`,
  };
}

export function buildHistoryView(
  resultRows: PracticeRoundHistoryRow[],
  eventsByRoundId: Record<string, RoundEventHistoryEntry[]>,
): HistoryRoundView[] {
  return resultRows.map((row) => {
    const events = eventsByRoundId[row.id] ?? [];
    return {
      roundResultId: row.id,
      recordedAt: row.recorded_at,
      playerCount: row.player_count,
      localWon: row.local_won,
      turnCount: row.turn_count,
      hasRuleset: row.ruleset_id != null,
      eventsMissing: eventsByRoundId[row.id] == null,
      events: events.map((event) => ({
        index: event.index,
        seatId: event.seat_id,
        seatKind: event.seat_kind,
        kind: event.kind,
        actionKind: event.action_kind ?? null,
        cardKeys: event.cards.map((card) => ({
          rankKey: `rank.${card.rank_code}`,
          suitKey: `suit.${card.suit_code}`,
        })),
        skillEffectKey: event.skill_effect ? `skillUse.${event.skill_effect}` : null,
        fieldCleared: event.field_cleared,
        dayNightKey: event.day_night_after ? `dayNight.${event.day_night_after}` : null,
      })),
    };
  });
}

export async function fetchCpuGameHistory(
  anonPlayerId: string,
  deps: HistoryDeps,
): Promise<HistoryLoadResult> {
  const resultUrl =
    `${deps.supabaseUrl}/rest/v1/practice_round_results` +
    `?select=id,recorded_at,player_count,local_won,turn_count,ruleset_id` +
    `&anon_player_id=eq.${encodeURIComponent(anonPlayerId)}` +
    `&mode=eq.CPU_PRACTICE&order=recorded_at.desc&limit=20`;
  const resultResponse = await deps.http.get(resultUrl, authHeaders(deps));
  if (resultResponse.status < 200 || resultResponse.status >= 300) {
    return { status: 'failed', items: [] };
  }
  const results = JSON.parse(resultResponse.body) as PracticeRoundHistoryRow[];
  if (results.length === 0) return { status: 'empty', items: [] };

  const ids = results.map((row) => `"${row.id}"`).join(',');
  const eventsUrl =
    `${deps.supabaseUrl}/rest/v1/round_events` +
    `?select=round_result_id,events&round_result_id=in.(${ids})`;
  const eventsResponse = await deps.http.get(eventsUrl, authHeaders(deps));
  if (eventsResponse.status < 200 || eventsResponse.status >= 300) {
    return { status: 'ready', items: buildHistoryView(results, {}) };
  }
  const eventRows = JSON.parse(eventsResponse.body) as RoundEventsHistoryRow[];
  const eventsByRoundId = Object.fromEntries(
    eventRows.map((row) => [row.round_result_id, row.events]),
  );
  return { status: 'ready', items: buildHistoryView(results, eventsByRoundId) };
}
