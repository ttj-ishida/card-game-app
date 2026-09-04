import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { getOptionalAppConfig } from '../../config/appEnv';
import { bodySnippet, httpPath, syncDiagnosticsStore } from '../diagnostics/syncDiagnosticsStore';
import type { StoragePort } from './anonPlayerId';
import type { CpuGameDeps } from '../../state/cpuGameStore';
import type { CpuGameHistoryDeps } from '../../state/cpuGameHistoryStore';
import type { CpuGameStatsDeps } from '../../state/cpuGameStatsStore';
import type { OnlineRoomDeps } from '../online-room/onlineRoomClient';
import type { HttpPort } from './practiceResultSync';

/**
 * ネイティブ端の配線。純モジュール（`features/cpu-game/*.ts`）は AsyncStorage / fetch /
 * expo-crypto を直接 import せず、ここで実体を注入ポートへ束ねる（§2 / Task 10 Step 2）。
 */
export const storagePort: StoragePort = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
};

async function trackedFetch(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: string,
): Promise<{ status: number; body: string }> {
  const path = httpPath(url);
  let response: Response;
  try {
    response = await fetch(url, { method, headers, body });
  } catch (error) {
    syncDiagnosticsStore.getState().recordError({
      path,
      status: null,
      at: Date.now(),
      bodySnippet: bodySnippet(
        error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      ),
    });
    throw error;
  }
  const text = await response.text();
  const at = Date.now();
  syncDiagnosticsStore
    .getState()
    .recordRequest({ path, status: response.status, at, bodySnippet: bodySnippet(text) });
  if (response.status >= 400) {
    syncDiagnosticsStore
      .getState()
      .recordError({ path, status: response.status, at, bodySnippet: bodySnippet(text) });
  }
  return { status: response.status, body: text };
}

export const httpPort: HttpPort & {
  get(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }>;
} = {
  get: (url, headers) => trackedFetch('GET', url, headers),
  post: (url, headers, body) => trackedFetch('POST', url, headers, body),
};

export const makeId = (): string => Crypto.randomUUID();
export const makeSeed = (): number => Math.floor(Math.random() * 2 ** 31);
export const now = (): number => Date.now();

function sharedLocalDeps() {
  return {
    storage: storagePort,
    http: httpPort,
    makeId,
    makeSeed,
    now,
  };
}

export function cpuGameDeps(): CpuGameDeps {
  const cfg = getOptionalAppConfig();
  return {
    ...sharedLocalDeps(),
    supabaseUrl: cfg?.supabaseUrl ?? '',
    anonKey: cfg?.supabaseAnonKey ?? '',
  };
}

export function cpuGameHistoryDeps(): CpuGameHistoryDeps | undefined {
  const cfg = getOptionalAppConfig();
  if (!cfg) return undefined;
  return {
    ...sharedLocalDeps(),
    supabaseUrl: cfg.supabaseUrl,
    anonKey: cfg.supabaseAnonKey,
  };
}

export function cpuGameStatsDeps(): CpuGameStatsDeps | undefined {
  const cfg = getOptionalAppConfig();
  if (!cfg) return undefined;
  return {
    ...sharedLocalDeps(),
    supabaseUrl: cfg.supabaseUrl,
    anonKey: cfg.supabaseAnonKey,
  };
}

export function onlineRoomDeps(): OnlineRoomDeps | undefined {
  const cfg = getOptionalAppConfig();
  if (!cfg) return undefined;
  return {
    storage: storagePort,
    http: httpPort,
    supabaseUrl: cfg.supabaseUrl,
    anonKey: cfg.supabaseAnonKey,
    now,
  };
}
