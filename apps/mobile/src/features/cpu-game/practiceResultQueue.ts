import type { StoragePort } from './anonPlayerId';
import type { PracticeResultPayload } from './resultModel';
import { savePracticeResult, type HttpPort, type SyncDeps } from './practiceResultSync';

export const QUEUE_KEY = 'card-game.practiceResultQueue';

/** キュー上限。超える分は古い方から捨てる（無限成長を防ぐ）。 */
const MAX_QUEUE = 100;

export type { HttpPort };

/**
 * キューの生値を安全に読む。未設定・不正 JSON・配列でない → `[]`。
 * 要素の形は検証しない（自前で書き込んだ配列のみを想定）。
 */
async function readQueue(storage: StoragePort): Promise<PracticeResultPayload[]> {
  let raw: string | null;
  try {
    raw = await storage.getItem(QUEUE_KEY);
  } catch {
    return [];
  }
  if (raw == null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PracticeResultPayload[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(storage: StoragePort, queue: PracticeResultPayload[]): Promise<void> {
  await storage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** 再送待ちキューの件数（診断用）。読み取り失敗・不正 JSON は 0。 */
export async function readQueueCount(storage: StoragePort): Promise<number> {
  return (await readQueue(storage)).length;
}

/**
 * 保存に失敗した結果をキューへ退避する。
 * 既存キューを JSON 配列として読み、`client_result_id` で重複排除してから追記し、書き戻す。
 * 追記後に `MAX_QUEUE` を超える場合は先頭（最も古い）から捨てて末尾 100 件だけ残す。
 */
export async function enqueuePracticeResult(
  storage: StoragePort,
  payload: PracticeResultPayload,
): Promise<void> {
  const queue = await readQueue(storage);
  const deduped = queue.filter((p) => p.client_result_id !== payload.client_result_id);
  deduped.push(payload);
  const capped = deduped.length > MAX_QUEUE ? deduped.slice(deduped.length - MAX_QUEUE) : deduped;
  await writeQueue(storage, capped);
}

/**
 * キューを順に再送する。`'saved'` / `'duplicate'` / `'rejected'` は除去（`rejected` は
 * 恒久的失敗なので再送しても直らない）、`'failed'`（一時的失敗）だけ残す。
 * 生き残った要素を書き戻し、`{ flushed, remaining }` を返す。`flushed` は除去件数の合計。
 */
export async function flushPracticeResultQueue(
  deps: SyncDeps & { storage: StoragePort },
): Promise<{ flushed: number; remaining: number }> {
  const queue = await readQueue(deps.storage);
  if (queue.length === 0) return { flushed: 0, remaining: 0 };
  const survivors: PracticeResultPayload[] = [];
  let flushed = 0;
  for (const payload of queue) {
    const outcome = await savePracticeResult(payload, deps);
    if (outcome === 'failed') {
      survivors.push(payload);
    } else {
      flushed++;
    }
  }
  await writeQueue(deps.storage, survivors);
  return { flushed, remaining: survivors.length };
}
