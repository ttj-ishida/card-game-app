import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useStore } from 'zustand/react';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';
import type { AnimationSpeed } from '../../features/cpu-game/cpuGameSettings';
import { cpuGameSettingsStore } from '../../state/cpuGameSettingsStore';
import { themeStore } from '../../state/themeStore';
import type { ThemePreference } from '../../features/theme/themePreference';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { translate } from '../../i18n/translate';

const SPEEDS: AnimationSpeed[] = ['FAST', 'NORMAL', 'SLOW'];
const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

export default function CpuGameSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const state = useStore(cpuGameSettingsStore, (s) => s);
  const themePreference = useStore(themeStore, (s) => s.preference);

  return (
    <AppBackground variant="universal">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{translate('cpuGame.settings.title')}</Text>
        {state.status === 'loading' ? (
          <Text style={styles.muted}>{translate('cpuGame.settings.loading')}</Text>
        ) : null}
        {state.status === 'failed' ? (
          <Text style={styles.error}>{translate('cpuGame.settings.failed')}</Text>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.label}>{translate('cpuGame.settings.theme')}</Text>
          <View style={styles.row}>
            {THEME_PREFERENCES.map((preference) => {
              const selected = themePreference === preference;
              return (
                <Pressable
                  key={preference}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => void themeStore.getState().setPreference(preference)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {translate(`cpuGame.settings.theme.${preference}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>{translate('cpuGame.settings.animationSpeed')}</Text>
          <View style={styles.row}>
            {SPEEDS.map((speed) => {
              const selected = state.settings.animationSpeed === speed;
              return (
                <Pressable
                  key={speed}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => void cpuGameSettingsStore.getState().setAnimationSpeed(speed)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {translate(`cpuGame.settings.animationSpeed.${speed}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.panelRow}>
          <Text style={styles.label}>{translate('cpuGame.settings.lowMotion')}</Text>
          <Switch
            value={state.settings.lowMotion}
            onValueChange={(value) => void cpuGameSettingsStore.getState().setLowMotion(value)}
          />
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { gap: spacing.md, padding: spacing.lg },
    title: {
      color: c.ink.primary,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold,
    },
    panel: {
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      backgroundColor: c.surface.card.face,
      padding: spacing.md,
    },
    panelRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      backgroundColor: c.surface.card.face,
      padding: spacing.md,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      minWidth: 88,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipSelected: { borderColor: c.ink.primary, backgroundColor: c.surface.table.day },
    chipText: { color: c.ink.secondary, fontSize: typography.size.body },
    chipTextSelected: { color: c.ink.primary, fontWeight: typography.weight.bold },
    label: {
      color: c.ink.primary,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
    muted: { color: c.ink.secondary, fontSize: typography.size.caption },
    error: {
      color: c.suit.fire,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
  });
