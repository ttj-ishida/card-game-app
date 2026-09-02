import type { StoragePort } from './anonPlayerId';
import type { PracticeResultPayload } from './resultModel';
import type { RoundEventsPayload } from './roundEventsPayload';
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

export type SaveOutcome = 'saved' | 'duplicate' | 'failed' | 'rejected';

export type SyncDeps = {
  http: HttpPort;
  supabaseUrl: string;
  anonKey: string;
};

const RESULTS_PATH = '/rest/v1/practice_round_results';
const ROUND_EVENTS_PATH = '/rest/v1/round_events';
const ACTIVE_RULESET_RPC_PATH = '/rest/v1/rpc/get_active_ruleset';

function authHeaders(deps: SyncDeps, prefer: string): Record<string, string> {
  return {
    apikey: deps.anonKey,
    Authorization: `Bearer ${deps.anonKey}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

function outcomeFromResponse(response: { status: number; body: string }): SaveOutcome {
  if (response.status === 200 || response.status === 201 || response.status === 204) {
    return 'saved';
  }
  if (isDuplicate(response.status, response.body ?? '')) {
    return 'duplicate';
  }
  if (response.status >= 400 && response.status < 500) {
    return 'rejected';
  }
  return 'failed';
}

function parseReturnedId(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!Array.isArray(parsed)) return null;
    const first = parsed[0] as { id?: unknown } | undefined;
    return typeof first?.id === 'string' ? first.id : null;
  } catch {
    return null;
  }
}

export async function savePracticeResultReturningId(
  payload: PracticeResultPayload,
  deps: SyncDeps,
): Promise<{ outcome: SaveOutcome; roundResultId: string | null }> {
  const url = `${deps.supabaseUrl}${RESULTS_PATH}?select=id`;
  let response: { status: number; body: string };
  try {
    response = await deps.http.post(
      url,
      authHeaders(deps, 'return=representation'),
      JSON.stringify(payload),
    );
  } catch {
    return { outcome: 'failed', roundResultId: null };
  }
  const outcome = outcomeFromResponse(response);
  return {
    outcome,
    roundResultId: outcome === 'saved' ? parseReturnedId(response.body ?? '') : null,
  };
}

export async function saveRoundEvents(
  payload: RoundEventsPayload,
  deps: SyncDeps,
): Promise<SaveOutcome> {
  const url = `${deps.supabaseUrl}${ROUND_EVENTS_PATH}`;
  let response: { status: number; body: string };
  try {
    response = await deps.http.post(
      url,
      authHeaders(deps, 'return=minimal'),
      JSON.stringify(payload),
    );
  } catch {
    return 'failed';
  }
  return outcomeFromResponse(response);
}

export async function fetchActiveRulesetId(deps: SyncDeps): Promise<string | null> {
  const url = `${deps.supabaseUrl}${ACTIVE_RULESET_RPC_PATH}`;
  let response: { status: number; body: string };
  try {
    response = await deps.http.post(url, authHeaders(deps, 'return=minimal'), '{}');
  } catch {
    return null;
  }
  if (response.status < 200 || response.status >= 300) return null;
  try {
    const parsed = JSON.parse(response.body) as unknown;
    if (!Array.isArray(parsed)) return null;
    const first = parsed[0] as { ruleset_id?: unknown } | undefined;
    return typeof first?.ruleset_id === 'string' ? first.ruleset_id : null;
  } catch {
    return null;
  }
}
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
 * - その他の 4xx（不正ペイロード / 失効した anon キー / CHECK 違反など）→ `'rejected'`
 *   （恒久的な失敗。再送しても直らないのでキューに積まない）
 * - 5xx、または `post` が reject → `'failed'`（一時的。再送で回復しうる）
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
  return outcomeFromResponse(response);
}

/**
 * 対局終了時のオーケストレータ。`savePracticeResult` を試み、
 * `'failed'`（一時的失敗）のときだけキューへ退避する。
 * `'rejected'`（恒久的失敗）は再送しても直らないので退避しない。返り値は最終状態。
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
