import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { getAppConfig } from '../../config/appEnv';
import type { StoragePort } from './anonPlayerId';
import type { CpuGameDeps } from '../../state/cpuGameStore';
import type { HttpPort } from './practiceResultSync';

/**
 * ネイティブ端の配線。純モジュール（`features/cpu-game/*.ts`）は AsyncStorage / fetch /
 * expo-crypto を直接 import せず、ここで実体を注入ポートへ束ねる（§2 / Task 10 Step 2）。
 */
export const storagePort: StoragePort = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
};

export const httpPort: HttpPort & {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }>;
} = {
  async get(url, headers) {
    const r = await fetch(url, { method: 'GET', headers });
    return { status: r.status, body: await r.text() };
  },

  async post(url, headers, body) {
    const r = await fetch(url, { method: 'POST', headers, body });
    return { status: r.status, body: await r.text() };
  },
};

export const makeId = (): string => Crypto.randomUUID();
export const makeSeed = (): number => Math.floor(Math.random() * 2 ** 31);
export const now = (): number => Date.now();

export function cpuGameDeps(): CpuGameDeps {
  const cfg = getAppConfig();
  return {
    storage: storagePort,
    http: httpPort,
    makeId,
    makeSeed,
    now,
    supabaseUrl: cfg.supabaseUrl,
    anonKey: cfg.supabaseAnonKey,
  };
}
