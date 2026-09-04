import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';

import { translate } from '../i18n/translate';
import {
  cpuGameDeps,
  cpuGameHistoryDeps,
  cpuGameStatsDeps,
  onlineRoomDeps,
  onlineRoundDeps,
} from '../features/cpu-game/cpuGameAdapters';
import { configureCpuGameStore, cpuGameStore } from '../state/cpuGameStore';
import { configureCpuGameSettingsStore, cpuGameSettingsStore } from '../state/cpuGameSettingsStore';
import { configureCpuGameHistoryStore } from '../state/cpuGameHistoryStore';
import { configureCpuGameStatsStore } from '../state/cpuGameStatsStore';
import { configureCpuGameTutorialStore, cpuGameTutorialStore } from '../state/cpuGameTutorialStore';
import { configureOnlineRoomStore } from '../state/onlineRoomStore';
import { configureOnlineRoundStore } from '../state/onlineRoundStore';

// Wire the CPU-game store to its native adapters once, at module load. If the
// public env is unset `getAppConfig()` throws — degrade so the rest of the app
// still loads; the CPU-game screens then surface "store not configured".
try {
  const deps = cpuGameDeps();
  configureCpuGameStore(deps);
  configureCpuGameSettingsStore({ storage: deps.storage });
  configureCpuGameHistoryStore(cpuGameHistoryDeps());
  configureCpuGameStatsStore(cpuGameStatsDeps());
  configureCpuGameTutorialStore({ storage: deps.storage, now: deps.now });
  configureOnlineRoomStore(onlineRoomDeps());
  configureOnlineRoundStore(onlineRoundDeps());
} catch (error) {
  console.warn('configureCpuGameStore skipped:', error);
}

export default function RootLayout() {
  // Retry the offline practice-result queue on launch and whenever the app comes
  // back to the foreground (spec §4.7). `flushQueue` no-ops when unconfigured and
  // swallows its own errors, so this is safe to fire unconditionally.
  useEffect(() => {
    void cpuGameSettingsStore.getState().load();
    void cpuGameTutorialStore.getState().load();
    void cpuGameStore.getState().flushQueue();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void cpuGameStore.getState().flushQueue();
    });
    return () => sub.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#f9fafb',
        contentStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Stack.Screen name="index" options={{ title: translate('app.title') }} />
      <Stack.Screen name="catalog/index" options={{ title: translate('catalog.title') }} />
      <Stack.Screen name="sandbox/index" options={{ title: translate('sandbox.title') }} />
      <Stack.Screen name="diagnostics/index" options={{ title: translate('diagnostics.title') }} />
      <Stack.Screen name="cpu-game/setup" options={{ title: translate('cpuGame.setup.title') }} />
      <Stack.Screen name="online-room/index" options={{ title: translate('onlineRoom.title') }} />
      <Stack.Screen
        name="online-room/lobby"
        options={{ title: translate('onlineRoom.lobby.title') }}
      />
      <Stack.Screen
        name="online-room/play"
        options={{ title: translate('app.title'), headerBackVisible: false }}
      />
      <Stack.Screen
        name="cpu-game/play"
        options={{ title: translate('app.title'), headerBackVisible: false }}
      />
      <Stack.Screen
        name="cpu-game/result"
        options={{ title: translate('cpuGame.result.title'), headerBackVisible: false }}
      />
      <Stack.Screen
        name="cpu-game/history"
        options={{ title: translate('cpuGame.history.title') }}
      />
      <Stack.Screen name="cpu-game/stats" options={{ title: translate('cpuGame.stats.title') }} />
      <Stack.Screen
        name="cpu-game/settings"
        options={{ title: translate('cpuGame.settings.title') }}
      />
      <Stack.Screen
        name="cpu-game/tutorial"
        options={{ title: translate('cpuGame.tutorial.title') }}
      />
    </Stack>
  );
}
