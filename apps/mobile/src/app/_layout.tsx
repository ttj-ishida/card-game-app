import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from '../features/theme/ThemeProvider';
import { AppShell } from '../features/theme/AppShell';
import { MenuFab, SideMenu } from '../components';
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
import { configureThemeStore, themeStore } from '../state/themeStore';

// Wire the CPU-game store to its native adapters once, at module load. If the
// public env is unset `getAppConfig()` throws — degrade so the rest of the app
// still loads; the CPU-game screens then surface "store not configured".
try {
  const deps = cpuGameDeps();
  configureCpuGameStore(deps);
  configureCpuGameSettingsStore({ storage: deps.storage });
  configureThemeStore({ storage: deps.storage });
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
    void themeStore.getState().load();
    void cpuGameSettingsStore.getState().load();
    void cpuGameTutorialStore.getState().load();
    void cpuGameStore.getState().flushQueue();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void cpuGameStore.getState().flushQueue();
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider>
      <AppShell>
        <ThemedStack />
      </AppShell>
    </ThemeProvider>
  );
}

function ThemedStack() {
  const { scheme, colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface.table.day },
        }}
      />
      <MenuFab onPress={() => setMenuOpen(true)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
