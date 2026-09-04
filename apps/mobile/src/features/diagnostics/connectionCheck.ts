import type { HttpPort } from '../cpu-game/practiceResultSync';

export type ConnectionCheckDeps = {
  http: HttpPort & {
    get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }>;
  };
  supabaseUrl: string;
  anonKey: string;
};

export type ConnectionCheckResult =
  | { kind: 'ok'; status: number }
  | { kind: 'unauthorized'; status: number }
  | { kind: 'http-error'; status: number }
  | { kind: 'unreachable' }
  | { kind: 'not-configured' };

/**
 * Supabase への到達性と anon キーの受理を1回の GET で確認する（診断用）。
 * `rulesets` は anon SELECT が許可された小さいテーブル。
 * - 2xx → `ok`（到達 + キー受理 + RLS 通過）
 * - 401 / 403 → `unauthorized`（到達したがキーが拒否された）
 * - その他の HTTP ステータス → `http-error`
 * - `fetch` が投げた（DNS 失敗・接続拒否・cleartext ブロックなど）→ `unreachable`
 */
export async function checkSupabaseConnection(
  deps: ConnectionCheckDeps,
): Promise<ConnectionCheckResult> {
  if (deps.supabaseUrl.length === 0 || deps.anonKey.length === 0) {
    return { kind: 'not-configured' };
  }
  const url = `${deps.supabaseUrl}/rest/v1/rulesets?select=id&limit=1`;
  const headers = {
    apikey: deps.anonKey,
    Authorization: `Bearer ${deps.anonKey}`,
  };
  let response: { status: number; body: string };
  try {
    response = await deps.http.get(url, headers);
  } catch {
    return { kind: 'unreachable' };
  }
  if (response.status >= 200 && response.status < 300) {
    return { kind: 'ok', status: response.status };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'unauthorized', status: response.status };
  }
  return { kind: 'http-error', status: response.status };
}
