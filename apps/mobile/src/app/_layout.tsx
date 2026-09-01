import { Stack } from 'expo-router';

import { translate } from '../i18n/translate';

export default function RootLayout() {
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
