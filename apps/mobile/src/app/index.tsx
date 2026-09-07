import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { spacing } from '@ragnarok-millennium/ui';

import { getOptionalAppConfig } from '../config/appEnv';
import { translate } from '../i18n/translate';
import { AppBackground } from '../features/theme/AppBackground';
import { Button, ScreenTitle } from '../components';

export default function HomeScreen() {
  const router = useRouter();
  // Show the sync-diagnostics link in every build except a real production release
  // (also when the public env is missing — that is itself what it diagnoses).
  const showDiagnostics = getOptionalAppConfig()?.appEnv !== 'production';

  return (
    <AppBackground variant="home">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitle title={translate('app.title')} subtitle={translate('home.subtitle')} />
        <View style={styles.buttons}>
          <Button
            label={translate('home.cpuGame')}
            onPress={() => router.push('/cpu-game/setup')}
            minWidth={160}
          />
          <Button
            label={translate('home.onlineRoom')}
            onPress={() => router.push('/online-room')}
            minWidth={160}
          />
          <Button
            label={translate('home.openCatalog')}
            variant="secondary"
            onPress={() => router.push('/catalog')}
            minWidth={160}
          />
          <Button
            label={`${translate('sandbox.title')} (${translate('sandbox.devLabel')})`}
            variant="secondary"
            onPress={() => router.push('/sandbox')}
            minWidth={160}
          />
          {showDiagnostics ? (
            <Button
              label={translate('home.diagnostics')}
              variant="ghost"
              onPress={() => router.push('/diagnostics')}
              minWidth={160}
            />
          ) : null}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
