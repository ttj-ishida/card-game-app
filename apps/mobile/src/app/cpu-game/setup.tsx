import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

import { isValidTotalPlayers, MAX_PLAYERS, MIN_PLAYERS } from '../../features/cpu-game/matchConfig';
import { cpuGameStore } from '../../state/cpuGameStore';
import { translate } from '../../i18n/translate';

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export default function CpuGameSetupScreen() {
  const router = useRouter();
  const [count, setCount] = useState(MIN_PLAYERS);
  const [startError, setStartError] = useState<string | null>(null);
  const canStart = isValidTotalPlayers(count);

  const start = () => {
    if (!canStart) return;
    try {
      cpuGameStore.getState().startMatch(count);
      router.replace('/cpu-game/play');
    } catch {
      // The store is unconfigured (missing EXPO_PUBLIC_* env). Degrade like the
      // play/result screens rather than throwing out of this event handler.
      setStartError(translate('cpuGame.setup.notReady'));
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{translate('cpuGame.setup.title')}</Text>

      <Text style={styles.label}>{translate('cpuGame.setup.players')}</Text>
      <View style={styles.row}>
        {COUNTS.map((value) => {
          const selected = value === count;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCount(value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{value}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('cpuGame.setup.start')}
        accessibilityState={{ disabled: !canStart }}
        disabled={!canStart}
        onPress={start}
        style={[styles.start, !canStart && styles.startDisabled]}
      >
        <Text style={styles.startText}>{translate('cpuGame.setup.start')}</Text>
      </Pressable>

      {startError ? <Text style={styles.error}>{startError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface.table.day,
  },
  title: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  label: { fontSize: typography.size.body, color: colors.ink.secondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    minWidth: 48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { borderColor: colors.ink.primary, backgroundColor: colors.surface.card.face },
  chipText: { fontSize: typography.size.body, color: colors.ink.secondary },
  chipTextSelected: { color: colors.ink.primary, fontWeight: typography.weight.bold },
  start: {
    minWidth: 180,
    alignItems: 'center',
    backgroundColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingVertical: spacing.md,
  },
  startDisabled: { backgroundColor: colors.state.disabled },
  error: { fontSize: typography.size.caption, color: colors.suit.fire, textAlign: 'center' },
  startText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink.inverse,
  },
});
