import { hostOf, type SyncDiagnosticsState } from './syncDiagnosticsStore';
import type { ConnectionCheckResult } from './connectionCheck';

export type DiagnosticsRow = { label: string; value: string };

/** 診断画面へ渡す構成情報。anon キー本文は含めず「設定有無」だけ。 */
export type DiagnosticsConfig = {
  appEnv: string;
  supabaseUrl: string;
  anonKeyConfigured: boolean;
};

export type DiagnosticsViewInput = {
  /** 公開 env が揃っていれば構成情報、未設定なら null。 */
  config: DiagnosticsConfig | null;
  diag: Pick<SyncDiagnosticsState, 'lastRequest' | 'lastError' | 'lastSave' | 'lastFlush'>;
  queueCount: number;
  anonPlayerId: string | null;
  connection: ConnectionCheckResult | null;
  /** 相対時刻計算の基準（`Date.now()`）。呼び出し側から渡す。 */
  nowMs: number;
};

export type DiagnosticsView = {
  /** 保存が期待できる構成か（env が揃っているか）。false なら結果は必ずキュー行き。 */
  syncConfigured: boolean;
  rows: DiagnosticsRow[];
};

function agoLabel(at: number | undefined, nowMs: number): string {
  if (at == null) return '—';
  const deltaSec = Math.max(0, Math.round((nowMs - at) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const min = Math.round(deltaSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  return `${hr}h ago`;
}

function connectionLabel(result: ConnectionCheckResult | null): string {
  if (!result) return 'not tested';
  switch (result.kind) {
    case 'ok':
      return `ok (${result.status})`;
    case 'unauthorized':
      return `key rejected (${result.status})`;
    case 'http-error':
      return `http error (${result.status})`;
    case 'unreachable':
      return 'unreachable (network error)';
    case 'not-configured':
      return 'not configured';
  }
}

/**
 * 診断画面の表示モデルを組み立てる純関数。ここで秘匿情報を落とす：
 * URL は host のみ、anon キーは「設定有無」のみ、本文は呼び出し側が既に切り詰め済み。
 */
export function buildDiagnosticsView(input: DiagnosticsViewInput): DiagnosticsView {
  const { config, diag, queueCount, anonPlayerId, connection, nowMs } = input;
  const syncConfigured =
    config != null && config.supabaseUrl.length > 0 && config.anonKeyConfigured;

  const rows: DiagnosticsRow[] = [
    { label: 'App env', value: config?.appEnv ?? '(env not configured)' },
    { label: 'Supabase host', value: config ? hostOf(config.supabaseUrl) : '—' },
    { label: 'Anon key', value: config?.anonKeyConfigured ? 'configured' : 'missing' },
    { label: 'Anon player id', value: anonPlayerId ?? '—' },
    { label: 'Connection test', value: connectionLabel(connection) },
    {
      label: 'Last save',
      value: diag.lastSave
        ? `${diag.lastSave.status} · ${diag.lastSave.note} · ${agoLabel(diag.lastSave.at, nowMs)}`
        : '—',
    },
    {
      label: 'Last HTTP',
      value: diag.lastRequest
        ? `${diag.lastRequest.status} ${diag.lastRequest.path} · ${agoLabel(
            diag.lastRequest.at,
            nowMs,
          )}`
        : '—',
    },
    {
      label: 'Last HTTP error',
      value: diag.lastError
        ? `${diag.lastError.status ?? 'network'} ${diag.lastError.path} · ${agoLabel(
            diag.lastError.at,
            nowMs,
          )}`
        : '—',
    },
    {
      label: 'Last error body',
      value:
        diag.lastError && diag.lastError.bodySnippet.length > 0 ? diag.lastError.bodySnippet : '—',
    },
    { label: 'Pending queue', value: `${queueCount}` },
    {
      label: 'Last retry (flush)',
      value: diag.lastFlush
        ? `flushed ${diag.lastFlush.flushed}, remaining ${diag.lastFlush.remaining} · ${agoLabel(
            diag.lastFlush.at,
            nowMs,
          )}`
        : '—',
    },
  ];

  return { syncConfigured, rows };
}
