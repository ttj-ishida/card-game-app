import type { PlayInput, RoundState } from "./core.ts";
import type { LegalPlay } from "./legalMoves.ts";
import type { Rng } from "./rng.ts";
import { standardPolicy } from "./cpuPolicyStandard.ts";

export type CpuPolicyId = "STANDARD";

/** UI のセレクタ用一覧。順序は表示順。 */
export const CPU_POLICY_IDS: readonly CpuPolicyId[] = ["STANDARD"];

export type CpuDecisionInput = {
  state: RoundState;
  legalPlays: LegalPlay[];
  rng: Rng;
};

/**
 * 1手を決める純関数。`input.legalPlays` は必ず非空である（呼び出し側 = `playRound`
 * が空の場合は先に停止するため保証する）。ポリシー実装は空配列を想定しなくてよい。
 */
export type CpuPolicy = (input: CpuDecisionInput) => PlayInput;

const REGISTRY: Record<CpuPolicyId, CpuPolicy> = {
  STANDARD: standardPolicy,
};

export function resolveCpuPolicy(id: CpuPolicyId): CpuPolicy {
  const policy = REGISTRY[id];
  if (!policy) throw new Error(`resolveCpuPolicy: unknown CPU policy id "${id}"`);
  return policy;
}

/** CPU-007 / TBD-009: 手決定後の表示待ち。game-core は待たず数値のみ返す。 */
export function rollThinkDelayMillis(rng: Rng): number {
  return 600 + rng.nextInt(601);
}
