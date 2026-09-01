import type { StoragePort } from './anonPlayerId';
import type { PracticeResultPayload } from './resultModel';
import { enqueuePracticeResult } from './practiceResultQueue';

/**
 * HTTP ポート。実体は画面側で global `fetch` を配線する。
 * 純モジュールは `fetch` を直接 import しない（設計書 §2）。
 */
export type HttpPort = {
  post(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ status: number; body: string }>;
};

export type SaveOutcome = 'saved' | 'duplicate' | 'failed';

export type SyncDeps = {
  http: HttpPort;
  supabaseUrl: string;
  anonKey: string;
};

const RESULTS_PATH = '/rest/v1/practice_round_results';

function isDuplicate(status: number, body: string): boolean {
  if (status === 409) return true;
  if (body.includes('23505')) return true;
  if (body.toLowerCase().includes('duplicate key')) return true;
  return false;
}

/**
 * `practice_round_results` へ1件 POST する。
 * - 200 / 201 / 204 → `'saved'`
 * - 409、または本文が `'23505'` を含む、または本文（小文字化）が `'duplicate key'` を含む → `'duplicate'`
 *   （`client_result_id` UNIQUE 違反。既に保存済みなので二重登録扱いにしない）
 * - `post` が reject、またはその他のステータス → `'failed'`
 */
export async function savePracticeResult(
  payload: PracticeResultPayload,
  deps: SyncDeps,
): Promise<SaveOutcome> {
  const url = `${deps.supabaseUrl}${RESULTS_PATH}`;
  const headers: Record<string, string> = {
    apikey: deps.anonKey,
    Authorization: `Bearer ${deps.anonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
  let response: { status: number; body: string };
  try {
    response = await deps.http.post(url, headers, JSON.stringify(payload));
  } catch {
    return 'failed';
  }
  if (response.status === 200 || response.status === 201 || response.status === 204) {
    return 'saved';
  }
  if (isDuplicate(response.status, response.body ?? '')) {
    return 'duplicate';
  }
  return 'failed';
}

/**
 * 対局終了時のオーケストレータ。`savePracticeResult` を試み、
 * `'failed'` のときだけキューへ退避する。返り値は最終状態。
 */
export async function recordFinishedRound(
  payload: PracticeResultPayload,
  deps: SyncDeps & { storage: StoragePort },
): Promise<SaveOutcome> {
  const outcome = await savePracticeResult(payload, deps);
  if (outcome === 'failed') {
    await enqueuePracticeResult(deps.storage, payload);
  }
  return outcome;
}
