import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';

import { translate } from '../i18n/translate';
import { cpuGameDeps } from '../features/cpu-game/cpuGameAdapters';
import { configureCpuGameStore, cpuGameStore } from '../state/cpuGameStore';
import { configureCpuGameSettingsStore, cpuGameSettingsStore } from '../state/cpuGameSettingsStore';

// Wire the CPU-game store to its native adapters once, at module load. If the
// public env is unset `getAppConfig()` throws — degrade so the rest of the app
// still loads; the CPU-game screens then surface "store not configured".
try {
  const deps = cpuGameDeps();
  configureCpuGameStore(deps);
  configureCpuGameSettingsStore({ storage: deps.storage });
} catch (error) {
  console.warn('configureCpuGameStore skipped:', error);
}

export default function RootLayout() {
  // Retry the offline practice-result queue on launch and whenever the app comes
  // back to the foreground (spec §4.7). `flushQueue` no-ops when unconfigured and
  // swallows its own errors, so this is safe to fire unconditionally.
  useEffect(() => {
    void cpuGameSettingsStore.getState().load();
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
      <Stack.Screen name="cpu-game/setup" options={{ title: translate('cpuGame.setup.title') }} />
      <Stack.Screen
        name="cpu-game/play"
        options={{ title: translate('app.title'), headerBackVisible: false }}
      />
      <Stack.Screen
        name="cpu-game/result"
        options={{ title: translate('cpuGame.result.title'), headerBackVisible: false }}
      />
    </Stack>
  );
}
