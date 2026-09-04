import { createStore } from 'zustand/vanilla';

/**
 * 開発・テスター用の同期診断シンク。純ストア：`fetch` / `AsyncStorage` / `Date` を
 * import せず、時刻は呼び出し側（ネイティブアダプタ）から `at` として受け取る。
 * 秘匿情報（anon key 本文・JWT・非公開手札など）は保持しない。呼び出し側が
 * `bodySnippet()` で切り詰めた本文だけを渡す。
 */

/** 保存の最終状態（`cpuGameStore` の `CpuGameSaveStatus` のうち終端の4値）。 */
export type SaveOutcomeStatus = 'saved' | 'duplicate' | 'queued' | 'failed';

export type HttpRequestRecord = {
  /** URL の path のみ（host・query は含めない）。 */
  path: string;
  status: number;
  at: number;
  bodySnippet: string;
};

export type HttpErrorRecord = {
  path: string;
  /** ネットワーク例外なら null（HTTP まで到達しなかった）。 */
  status: number | null;
  at: number;
  bodySnippet: string;
};

export type SaveRecord = {
  /** 結果画面に出るステータスと同じ（`saved` / `duplicate` / `queued` / `failed`）。 */
  status: SaveOutcomeStatus;
  /** なぜそのステータスになったかの短い説明（英語、内部ID・秘匿情報なし）。 */
  note: string;
  at: number;
};

export type FlushRecord = {
  flushed: number;
  remaining: number;
  at: number;
};

export type SyncDiagnosticsState = {
  lastRequest: HttpRequestRecord | null;
  lastError: HttpErrorRecord | null;
  lastSave: SaveRecord | null;
  lastFlush: FlushRecord | null;

  recordRequest: (record: HttpRequestRecord) => void;
  recordError: (record: HttpErrorRecord) => void;
  recordSave: (status: SaveOutcomeStatus, note: string, at: number) => void;
  recordFlush: (record: FlushRecord) => void;
  reset: () => void;
};

const INITIAL: Pick<SyncDiagnosticsState, 'lastRequest' | 'lastError' | 'lastSave' | 'lastFlush'> =
  {
    lastRequest: null,
    lastError: null,
    lastSave: null,
    lastFlush: null,
  };

export const syncDiagnosticsStore = createStore<SyncDiagnosticsState>((set) => ({
  ...INITIAL,
  recordRequest: (record) => set({ lastRequest: record }),
  recordError: (record) => set({ lastError: record }),
  recordSave: (status, note, at) => set({ lastSave: { status, note, at } }),
  recordFlush: (record) => set({ lastFlush: record }),
  reset: () => set({ ...INITIAL }),
}));

/** URL から path だけを取り出す（host / query / fragment は落とす）。解析不能なら生文字列。 */
export function httpPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    const withoutQuery = url.split('?')[0] ?? url;
    const schemeSplit = withoutQuery.split('://');
    const afterScheme = schemeSplit.length > 1 ? schemeSplit.slice(1).join('://') : withoutQuery;
    const slash = afterScheme.indexOf('/');
    return slash >= 0 ? afterScheme.slice(slash) : afterScheme;
  }
}

/** レスポンス本文を1行・指定長に切り詰める（診断表示用）。 */
export function bodySnippet(text: string, max = 240): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

/** URL から host だけを取り出す（診断表示用。scheme / path / query は落とす）。 */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    const afterScheme = url.split('://').slice(1).join('://') || url;
    return afterScheme.split('/')[0] ?? afterScheme;
  }
}
