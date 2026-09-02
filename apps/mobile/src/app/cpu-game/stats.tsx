import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useStore } from 'zustand/react';

import { colors, radius, spacing, typography } from '@card-game-app/ui';
import { cpuGameStatsStore } from '../../state/cpuGameStatsStore';
import { translate } from '../../i18n/translate';

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
}

export default function CpuGameStatsScreen() {
  const state = useStore(cpuGameStatsStore, (s) => s);

  useFocusEffect(
    useCallback(() => {
      void cpuGameStatsStore.getState().load();
    }, []),
  );

  const view = state.view;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{translate('cpuGame.stats.title')}</Text>
      {state.status === 'loading' ? (
        <Text style={styles.muted}>{translate('cpuGame.stats.loading')}</Text>
      ) : null}
      {state.status === 'failed' ? (
        <Text style={styles.error}>{translate('cpuGame.stats.failed')}</Text>
      ) : null}
      {state.status === 'empty' || view.status === 'empty' ? (
        <Text style={styles.muted}>{translate('cpuGame.stats.empty')}</Text>
      ) : null}
      {view.status === 'ready' ? (
        <View style={styles.panel}>
          <Text style={styles.metric}>
            {translate('cpuGame.stats.roundsPlayed')}: {view.roundsPlayed}
          </Text>
          <Text style={styles.metric}>
            {translate('cpuGame.stats.roundsWon')}: {view.roundsWon}
          </Text>
          <Text style={styles.metric}>
            {translate('cpuGame.stats.winRate')}: {view.winRateLabel}
          </Text>
          <Text style={styles.metric}>
            {translate('cpuGame.stats.lastPlayedAt')}: {formatDate(view.lastPlayedAt)}
          </Text>
        </View>
      ) : null}
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
  metric: { color: colors.ink.primary, fontSize: typography.size.body },
  muted: { color: colors.ink.secondary, fontSize: typography.size.caption },
  error: {
    color: colors.suit.fire,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
});
