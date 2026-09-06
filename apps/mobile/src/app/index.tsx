import { Link } from 'expo-router';

import { getOptionalAppConfig } from '../config/appEnv';
import { translate } from '../i18n/translate';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type ThemeColors } from '@ragnarok-millennium/ui';

import { AppBackground } from '../features/theme/AppBackground';
import { useThemedStyles } from '../features/theme/ThemeProvider';

export default function HomeScreen() {
  const styles = useThemedStyles(makeStyles);
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
        <Text style={styles.title}>{translate('app.title')}</Text>
        <Text style={styles.subtitle}>{translate('home.subtitle')}</Text>
        <View style={styles.buttons}>
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
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 20,
    },
    title: {
      color: c.ink.primary,
      fontSize: 28,
      fontWeight: '700',
    },
    subtitle: {
      color: c.ink.secondary,
      fontSize: 14,
      marginBottom: 8,
    },
    buttons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
    },
    button: {
      backgroundColor: c.suit.wind,
      borderRadius: 8,
      minWidth: 160,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    buttonText: {
      color: c.ink.inverse,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
    },
  });
