import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAnonPlayerId,
  __resetAnonPlayerIdMemoForTest,
  StoragePort,
  ANON_PLAYER_ID_KEY,
} from './anonPlayerId';

describe('anonPlayerId', () => {
  beforeEach(() => {
    __resetAnonPlayerIdMemoForTest();
  });

  function createFakeStorage(): StoragePort {
    const data = new Map<string, string>();
    return {
      async getItem(key: string) {
        return data.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        data.set(key, value);
      },
    };
  }

  it('first call generates + persists + returns a new id', async () => {
    const storage = createFakeStorage();
    let makeIdCallCount = 0;
    const makeId = () => {
      makeIdCallCount++;
      return 'generated-id-1';
    };

    const result = await getAnonPlayerId({ storage, makeId });

    assert.equal(result, 'generated-id-1');
    assert.equal(makeIdCallCount, 1);
    assert.equal(await storage.getItem(ANON_PLAYER_ID_KEY), 'generated-id-1');
  });

  it('second call returns stored value without calling makeId', async () => {
    const storage = createFakeStorage();
    let makeIdCallCount = 0;
    const makeId = () => {
      makeIdCallCount++;
      return 'generated-id-' + makeIdCallCount;
    };

    const first = await getAnonPlayerId({ storage, makeId });
    const second = await getAnonPlayerId({ storage, makeId });

    assert.equal(first, 'generated-id-1');
    assert.equal(second, 'generated-id-1');
    assert.equal(makeIdCallCount, 1, 'makeId should only be called once');
  });

  it('__resetAnonPlayerIdMemoForTest clears memo and re-reads storage', async () => {
    const storage = createFakeStorage();
    await storage.setItem(ANON_PLAYER_ID_KEY, 'stored-id');

    let makeIdCallCount = 0;
    const makeId = () => {
      makeIdCallCount++;
      return 'new-id';
    };

    __resetAnonPlayerIdMemoForTest();
    const result = await getAnonPlayerId({ storage, makeId });

    assert.equal(result, 'stored-id');
    assert.equal(makeIdCallCount, 0, 'makeId should not be called if item exists in storage');
  });

  it('storage.getItem throws → still returns makeId() value', async () => {
    const storage: StoragePort = {
      async getItem() {
        throw new Error('Storage error');
      },
      async setItem() {
        // successful
      },
    };

    const makeId = () => 'fallback-id';
    const result = await getAnonPlayerId({ storage, makeId });

    assert.equal(result, 'fallback-id');
  });

  it('storage.setItem throws → still returns the id', async () => {
    const storage: StoragePort = {
      async getItem() {
        return null;
      },
      async setItem() {
        throw new Error('Storage error');
      },
    };

    const makeId = () => 'generated-id';
    const result = await getAnonPlayerId({ storage, makeId });

    assert.equal(result, 'generated-id');
  });
});
