import type { CpuPolicyId } from '@card-game-app/game-core';

export type SeatKind = 'HUMAN' | 'CPU';
export type SeatConfig = {
  seatId: string;
  kind: SeatKind;
  policyId?: CpuPolicyId;
  nameKey: string;
};
export type MatchConfig = { seats: SeatConfig[]; packId: string };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DEFAULT_PACK_ID = 'DEFAULT';

export function isValidTotalPlayers(total: number): boolean {
  return Number.isInteger(total) && total >= MIN_PLAYERS && total <= MAX_PLAYERS;
}

export function buildMatchConfig(totalPlayers: number): MatchConfig {
  if (!isValidTotalPlayers(totalPlayers)) {
    throw new RangeError(
      `buildMatchConfig: total must be ${MIN_PLAYERS}..${MAX_PLAYERS}, got ${totalPlayers}`,
    );
  }
  const seats: SeatConfig[] = Array.from({ length: totalPlayers }, (_, i) =>
    i === 0
      ? { seatId: 'seat-0', kind: 'HUMAN', nameKey: 'cpuGame.seat.you' }
      : { seatId: `seat-${i}`, kind: 'CPU', policyId: 'STANDARD', nameKey: `cpuGame.seat.cpu` },
  );
  return { seats, packId: DEFAULT_PACK_ID };
}

export function seatPolicies(config: MatchConfig): Record<string, CpuPolicyId> {
  return Object.fromEntries(
    config.seats.filter((s) => s.kind === 'CPU').map((s) => [s.seatId, s.policyId ?? 'STANDARD']),
  );
}
export function humanSeatIds(config: MatchConfig): string[] {
  return config.seats.filter((s) => s.kind === 'HUMAN').map((s) => s.seatId);
}
export function isHumanSeat(config: MatchConfig, seatId: string): boolean {
  return config.seats.some((s) => s.seatId === seatId && s.kind === 'HUMAN');
}
