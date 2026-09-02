import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useStore } from 'zustand/react';

import { colors, radius, spacing, typography } from '@card-game-app/ui';
import type { AnimationSpeed } from '../../features/cpu-game/cpuGameSettings';
import { cpuGameSettingsStore } from '../../state/cpuGameSettingsStore';
import { translate } from '../../i18n/translate';

const SPEEDS: AnimationSpeed[] = ['FAST', 'NORMAL', 'SLOW'];

export default function CpuGameSettingsScreen() {
  const state = useStore(cpuGameSettingsStore, (s) => s);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{translate('cpuGame.settings.title')}</Text>
      {state.status === 'loading' ? (
        <Text style={styles.muted}>{translate('cpuGame.settings.loading')}</Text>
      ) : null}
      {state.status === 'failed' ? (
        <Text style={styles.error}>{translate('cpuGame.settings.failed')}</Text>
      ) : null}

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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.table.day },
  content: { gap: spacing.md, padding: spacing.lg },
  title: {
    color: colors.ink.primary,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
  },
  panel: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    backgroundColor: colors.surface.card.face,
    padding: spacing.md,
  },
  panelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    backgroundColor: colors.surface.card.face,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minWidth: 88,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderColor: colors.ink.primary, backgroundColor: colors.surface.table.day },
  chipText: { color: colors.ink.secondary, fontSize: typography.size.body },
  chipTextSelected: { color: colors.ink.primary, fontWeight: typography.weight.bold },
  label: {
    color: colors.ink.primary,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  muted: { color: colors.ink.secondary, fontSize: typography.size.caption },
  error: {
    color: colors.suit.fire,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
});
