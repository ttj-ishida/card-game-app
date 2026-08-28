import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#f9fafb',
        contentStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Card Game App' }} />
      <Stack.Screen name="catalog/index" options={{ title: 'Card Catalog' }} />
    </Stack>
  );
}
