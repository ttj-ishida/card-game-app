import { Link } from 'expo-router';

import { getOptionalAppConfig } from '../config/appEnv';
import { translate } from '../i18n/translate';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  // Show the sync-diagnostics link in every build except a real production release
  // (also when the public env is missing — that is itself what it diagnoses).
  const showDiagnostics = getOptionalAppConfig()?.appEnv !== 'production';

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{translate('app.title')}</Text>
      <Text style={styles.subtitle}>{translate('home.subtitle')}</Text>
      <Link href="/cpu-game/setup" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>{translate('home.cpuGame')}</Text>
        </Pressable>
      </Link>
      <Link href="/online-room" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>{translate('home.onlineRoom')}</Text>
        </Pressable>
      </Link>
      <Link href="/catalog" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>{translate('home.openCatalog')}</Text>
        </Pressable>
      </Link>
      <Link href="/sandbox" asChild>
        <Pressable accessibilityRole="button" style={styles.button}>
          <Text style={styles.buttonText}>
            {translate('sandbox.title')} ({translate('sandbox.devLabel')})
          </Text>
        </Pressable>
      </Link>
      {showDiagnostics ? (
        <Link href="/diagnostics" asChild>
          <Pressable accessibilityRole="button" style={styles.button}>
            <Text style={styles.buttonText}>{translate('home.diagnostics')}</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    marginTop: 8,
  },
  button: {
    backgroundColor: '#166534',
    borderRadius: 8,
    marginTop: 24,
    minWidth: 180,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
