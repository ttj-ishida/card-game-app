import type { SyncDeps } from './practiceResultSync';

export type PlayerModeStatsRow = {
  rounds_played: number;
  rounds_won: number;
  win_rate: number | null;
  last_played_at: string | null;
};

export type StatsView =
  | { status: 'empty' }
  | {
      status: 'ready';
      roundsPlayed: number;
      roundsWon: number;
      winRateLabel: string;
      lastPlayedAt: string | null;
    };

function authHeaders(deps: Pick<SyncDeps, 'anonKey'>): Record<string, string> {
  return {
    apikey: deps.anonKey,
    Authorization: `Bearer ${deps.anonKey}`,
    'Content-Type': 'application/json',
  };
}

export function buildStatsView(rows: PlayerModeStatsRow[]): StatsView {
  const row = rows[0];
  if (!row || row.win_rate == null || row.rounds_played === 0) return { status: 'empty' };
  return {
    status: 'ready',
    roundsPlayed: row.rounds_played,
    roundsWon: row.rounds_won,
    winRateLabel: `${(row.win_rate * 100).toFixed(1)}%`,
    lastPlayedAt: row.last_played_at,
  };
}

export async function fetchCpuGameStats(
  anonPlayerId: string,
  deps: SyncDeps,
): Promise<StatsView | { status: 'failed' }> {
  const response = await deps.http.post(
    `${deps.supabaseUrl}/rest/v1/rpc/get_player_mode_stats`,
    authHeaders(deps),
    JSON.stringify({ p_anon_player_id: anonPlayerId, p_mode: 'CPU_PRACTICE' }),
  );
  if (response.status < 200 || response.status >= 300) return { status: 'failed' };
  return buildStatsView(JSON.parse(response.body) as PlayerModeStatsRow[]);
}
