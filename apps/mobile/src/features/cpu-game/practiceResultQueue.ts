import type { StoragePort } from './anonPlayerId';
import type { PracticeResultPayload } from './resultModel';
import { savePracticeResult, type HttpPort, type SyncDeps } from './practiceResultSync';

export const QUEUE_KEY = 'card-game.practiceResultQueue';

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

/**
 * 保存に失敗した結果をキューへ退避する。
 * 既存キューを JSON 配列として読み、`client_result_id` で重複排除してから追記し、書き戻す。
 */
export async function enqueuePracticeResult(
  storage: StoragePort,
  payload: PracticeResultPayload,
): Promise<void> {
  const queue = await readQueue(storage);
  const deduped = queue.filter((p) => p.client_result_id !== payload.client_result_id);
  deduped.push(payload);
  await writeQueue(storage, deduped);
}

/**
 * キューを順に再送する。`'saved'` / `'duplicate'` は除去、`'failed'` は残す。
 * 生き残った要素を書き戻し、`{ flushed, remaining }` を返す。
 */
export async function flushPracticeResultQueue(
  deps: SyncDeps & { storage: StoragePort },
): Promise<{ flushed: number; remaining: number }> {
  const queue = await readQueue(deps.storage);
  const survivors: PracticeResultPayload[] = [];
  let flushed = 0;
  for (const payload of queue) {
    const outcome = await savePracticeResult(payload, deps);
    if (outcome === 'saved' || outcome === 'duplicate') {
      flushed++;
    } else {
      survivors.push(payload);
    }
  }
  await writeQueue(deps.storage, survivors);
  return { flushed, remaining: survivors.length };
}
