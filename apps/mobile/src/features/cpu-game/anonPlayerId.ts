export type StoragePort = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export const ANON_PLAYER_ID_KEY = 'card-game.anonPlayerId';

let memo: string | null = null;

export async function getAnonPlayerId(deps: {
  storage: StoragePort;
  makeId: () => string;
}): Promise<string> {
  if (memo) return memo;
  try {
    const existing = await deps.storage.getItem(ANON_PLAYER_ID_KEY);
    if (existing) {
      memo = existing;
      return existing;
    }
  } catch {
    /* fall through to generate */
  }
  const id = deps.makeId();
  memo = id;
  try {
    await deps.storage.setItem(ANON_PLAYER_ID_KEY, id);
  } catch {
    /* keep in-memory only */
  }
  return id;
}

export function __resetAnonPlayerIdMemoForTest(): void {
  memo = null;
}
