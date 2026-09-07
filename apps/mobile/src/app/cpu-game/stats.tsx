import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useStore } from 'zustand/react';

import { spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';
import { cpuGameStatsStore } from '../../state/cpuGameStatsStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Panel, ScreenTitle } from '../../components';
import { translate } from '../../i18n/translate';

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
}

export default function CpuGameStatsScreen() {
  const styles = useThemedStyles(makeStyles);
  const state = useStore(cpuGameStatsStore, (s) => s);

  useFocusEffect(
    useCallback(() => {
      void cpuGameStatsStore.getState().load();
    }, []),
  );

  const view = state.view;

  return (
    <AppBackground variant="universal">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenTitle title={translate('cpuGame.stats.title')} />
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
          <Panel>
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
          </Panel>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { gap: spacing.md, padding: spacing.lg },
    metric: { color: c.ink.primary, fontSize: typography.size.body },
    muted: { color: c.ink.secondary, fontSize: typography.size.caption },
    error: {
      color: c.suit.fire,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
  });
