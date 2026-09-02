import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useStore } from 'zustand/react';

import { colors, radius, spacing, typography } from '@card-game-app/ui';
import { cpuGameHistoryStore } from '../../state/cpuGameHistoryStore';
import { translate } from '../../i18n/translate';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
}

function formatCard(rankKey: string, suitKey: string): string {
  const rank = rankKey.replace('rank.RANK_', '');
  const suit = suitKey.replace('suit.SUIT_', '');
  return `${rank}${suit}`;
}

export default function CpuGameHistoryScreen() {
  const state = useStore(cpuGameHistoryStore, (s) => s);

  useFocusEffect(
    useCallback(() => {
      void cpuGameHistoryStore.getState().load();
    }, []),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{translate('cpuGame.history.title')}</Text>
      {state.status === 'loading' ? (
        <Text style={styles.muted}>{translate('cpuGame.history.loading')}</Text>
      ) : null}
      {state.status === 'failed' ? (
        <Text style={styles.error}>{translate('cpuGame.history.failed')}</Text>
      ) : null}
      {state.status === 'empty' ? (
        <Text style={styles.muted}>{translate('cpuGame.history.empty')}</Text>
      ) : null}

      {state.items.map((round) => (
        <View key={round.roundResultId} style={styles.round}>
          <View style={styles.roundHeader}>
            <Text style={styles.roundTitle}>
              {round.localWon
                ? translate('cpuGame.history.win')
                : translate('cpuGame.history.loss')}
            </Text>
            <Text style={styles.muted}>{formatDate(round.recordedAt)}</Text>
          </View>
          <Text style={styles.line}>
            {translate('cpuGame.history.players')}: {round.playerCount} /{' '}
            {translate('cpuGame.history.turns')}: {round.turnCount}
          </Text>
          {round.eventsMissing ? (
            <Text style={styles.muted}>{translate('cpuGame.history.eventsMissing')}</Text>
          ) : null}
          {round.events.slice(0, 12).map((event) => {
            const cards = event.cardKeys.length
              ? event.cardKeys.map((card) => formatCard(card.rankKey, card.suitKey)).join(' ')
              : translate('cpuGame.history.noCards');
            return (
              <Text key={`${round.roundResultId}-${event.index}`} style={styles.eventLine}>
                {event.index + 1}. {event.seatKind} {event.kind} {cards}
                {event.skillEffectKey ? ` / ${event.skillEffectKey.replace('skillUse.', '')}` : ''}
                {event.fieldCleared ? ` / ${translate('cpuGame.history.fieldCleared')}` : ''}
              </Text>
            );
          })}
        </View>
      ))}

      {state.status === 'ready' && state.items.length === 0 ? (
        <Text style={styles.muted}>{translate('cpuGame.history.empty')}</Text>
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
  round: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    backgroundColor: colors.surface.card.face,
    padding: spacing.md,
  },
  roundHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  roundTitle: {
    color: colors.ink.primary,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  line: { color: colors.ink.primary, fontSize: typography.size.body },
  eventLine: { color: colors.ink.secondary, fontSize: typography.size.caption },
  muted: { color: colors.ink.secondary, fontSize: typography.size.caption },
  error: {
    color: colors.suit.fire,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
});
