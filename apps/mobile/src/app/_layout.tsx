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
    </Stack>
  );
}
