import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

import type { PlayRejectionReason } from '@card-game-app/game-core';

import { CardFace } from '../../features/cpu-game/CardFace';
import { buildBoardViewModel } from '../../features/cpu-game/boardViewModel';
import { cpuGameStore } from '../../state/cpuGameStore';
import { translate } from '../../i18n/translate';
import { useStore } from 'zustand';

function seatLabel(seatId: string, nameKey: string): string {
  const base = translate(nameKey);
  if (nameKey === 'cpuGame.seat.you') return base;
  return `${base} ${seatId.replace('seat-', '')}`;
}

// Display-only: map a rejection reason to Japanese text, falling back to the
// generic "cannot play this" line. No game logic here.
function reasonText(reason?: PlayRejectionReason): string {
  if (!reason) return translate('cpuGame.invalid');
  try {
    return translate(`sandbox.reason.${reason}`);
  } catch {
    return translate('cpuGame.invalid');
  }
}

export default function CpuGamePlayScreen() {
  const router = useRouter();
  const state = useStore(cpuGameStore, (s) => s);
  const { driver, selection, legalPlays, pendingCpuReveal, cpuThinking } = state;

  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const thinkMillisRef = useRef(0);

  const phase = driver?.phase;
  const hasPending = pendingCpuReveal != null;

  // Redirect if the store has no active match (direct nav / post-exit).
  useEffect(() => {
    if (!driver) router.replace('/cpu-game/setup');
  }, [driver, router]);

  // CPU progression: stage the decision, then reveal it after thinkMillis.
  useEffect(() => {
    if (phase === 'CPU_PENDING' && !hasPending) {
      const { thinkMillis } = cpuGameStore.getState().advanceCpu();
      thinkMillisRef.current = thinkMillis;
      return;
    }
    if (hasPending) {
      const timer = setTimeout(
        () => cpuGameStore.getState().commitCpuReveal(),
        thinkMillisRef.current,
      );
      return () => clearTimeout(timer);
    }
  }, [phase, hasPending]);

  // Round over: persist the result, then move to the result screen.
  useEffect(() => {
    if (phase !== 'ROUND_OVER') return;
    let cancelled = false;
    cpuGameStore
      .getState()
      .finishRound()
      .finally(() => {
        if (!cancelled) router.replace('/cpu-game/result');
      });
    return () => {
      cancelled = true;
    };
  }, [phase, router]);

  // Hardware back = confirm, then discard the match.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        Alert.alert(translate('cpuGame.exit.confirmTitle'), undefined, [
          { text: translate('cpuGame.exit.confirmCancel'), style: 'cancel' },
          {
            text: translate('cpuGame.exit.confirmOk'),
            style: 'destructive',
            onPress: () => {
              cpuGameStore.getState().exit();
              router.replace('/');
            },
          },
        ]);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router]),
  );

  if (!driver) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>{translate('cpuGame.setup.title')}</Text>
      </View>
    );
  }

  const vm = buildBoardViewModel(driver, selection, legalPlays, { cpuThinking });

  const onSubmit = () => {
    const res = cpuGameStore.getState().submitPlay();
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };
  const onPass = () => {
    const res = cpuGameStore.getState().pass();
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };

  const nameKeyOf = (seatId: string) =>
    driver.config.seats.find((s) => s.seatId === seatId)?.nameKey ?? 'cpuGame.seat.cpu';

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Text style={styles.topText}>
          {vm.dayNight === 'DAY'
            ? translate('cpuGame.dayNight.day')
            : translate('cpuGame.dayNight.night')}
        </Text>
        <Text style={styles.topText}>
          {translate('cpuGame.dayNight.strengthOrder')}: {vm.strengthOrder.join('→')}
        </Text>
        <Text style={styles.topText}>
          {translate('cpuGame.turnLabel')}: {seatLabel(vm.activeSeatId, vm.activeSeatNameKey)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showHistory }}
          onPress={() => setShowHistory((v) => !v)}
          style={styles.historyToggle}
        >
          <Text style={styles.topText}>
            {translate('cpuGame.history')} {showHistory ? '▲' : '▾'}
          </Text>
        </Pressable>
      </View>

      {showHistory ? (
        <ScrollView style={styles.historyPanel}>
          {driver.turnLog.length === 0 ? (
            <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
          ) : (
            driver.turnLog.map((entry) => (
              <Text key={entry.index} style={styles.muted}>
                {entry.index + 1}. {seatLabel(entry.seatId, nameKeyOf(entry.seatId))} ·{' '}
                {entry.kind === 'PASS'
                  ? translate('cpuGame.action.pass')
                  : `${translate(`sandbox.action.${entry.actionKind}`)} (${entry.cardCount})`}
              </Text>
            ))
          )}
        </ScrollView>
      ) : null}

      <ScrollView
        horizontal
        style={styles.opponentRow}
        contentContainerStyle={styles.opponentRowContent}
      >
        {vm.opponents.map((opp) => (
          <View key={opp.seatId} style={[styles.oppPanel, opp.isActive && styles.oppPanelActive]}>
            <Text style={styles.oppName}>{seatLabel(opp.seatId, opp.nameKey)}</Text>
            <Text style={styles.oppLine}>
              {opp.numberCardCount}
              {translate('cpuGame.opponent.cardsSuffix')}
            </Text>
            {opp.hasSkill ? (
              <Text style={styles.oppLine}>● {translate('cpuGame.opponent.hasSkill')}</Text>
            ) : null}
            {opp.status === 'PASSED' ? (
              <Text style={styles.oppStatus}>{translate('cpuGame.opponent.status.PASSED')}</Text>
            ) : null}
            {opp.status === 'OUT' ? (
              <Text style={styles.oppStatus}>{translate('cpuGame.opponent.status.OUT')}</Text>
            ) : null}
            {vm.cpuThinking && opp.isActive ? (
              <Text style={styles.oppThinking}>{translate('cpuGame.phase.cpuThinking')}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.field}>
        {vm.field ? (
          <>
            <View style={styles.fieldCards}>
              {vm.field.cards.map((card, index) => (
                <CardFace
                  key={index}
                  rank={card.rank}
                  suitCode={card.suitCode}
                  isJoker={card.isJoker}
                  size="field"
                />
              ))}
            </View>
            {vm.field.lastPlayerNameKey ? (
              <Text style={styles.muted}>
                {translate('cpuGame.field.lastPlayer')}: {translate(vm.field.lastPlayerNameKey)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.muted}>{translate('cpuGame.field.empty')}</Text>
        )}
        <View style={styles.lockRow}>
          {vm.lock.countLocked ? (
            <Text style={styles.lockTag}>{translate('cpuGame.lock.count')}</Text>
          ) : null}
          {vm.lock.suitFixed ? (
            <Text style={styles.lockTag}>
              {translate('cpuGame.lock.suitFixed')}:{' '}
              {vm.lock.suitFixed.map((s) => translate(`sandbox.suit.${s}`)).join('')}
            </Text>
          ) : null}
          {vm.lock.suitUniform ? (
            <Text style={styles.lockTag}>{translate('cpuGame.lock.suitUniform')}</Text>
          ) : null}
          {vm.extensionSealed ? (
            <Text style={styles.lockTag}>{translate('cpuGame.lock.seal')}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal style={styles.handScroll} contentContainerStyle={styles.handRow}>
        {vm.hand.map((card) => (
          <Pressable
            key={card.cardId}
            accessibilityRole="button"
            accessibilityState={{ selected: card.selected, disabled: !card.selectable }}
            disabled={!card.selectable}
            onPress={() => {
              cpuGameStore.getState().selectCard(card.cardId);
              setInvalidReason(null);
            }}
            style={[
              styles.handCard,
              card.selected && styles.handCardSelected,
              !card.selectable && styles.handCardDim,
            ]}
          >
            <CardFace
              rank={card.rank}
              suitCode={card.suitCode}
              isJoker={card.isJoker}
              size="hand"
            />
          </Pressable>
        ))}
      </ScrollView>

      {vm.humanSkillNameKey ? (
        <Text style={styles.muted}>
          {translate(vm.humanSkillNameKey)}（{translate('cpuGame.skill.heldNote')}）
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !vm.canSubmit }}
          disabled={!vm.canSubmit}
          onPress={onSubmit}
          style={[styles.actionBtn, !vm.canSubmit && styles.actionDisabled]}
        >
          <Text style={styles.actionText}>{translate('cpuGame.action.submit')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !vm.canPass }}
          disabled={!vm.canPass}
          onPress={onPass}
          style={[styles.actionBtn, !vm.canPass && styles.actionDisabled]}
        >
          <Text style={styles.actionText}>{translate('cpuGame.action.pass')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            cpuGameStore.getState().clearSelection();
            setInvalidReason(null);
          }}
          style={styles.actionBtnGhost}
        >
          <Text style={styles.actionTextGhost}>{translate('cpuGame.action.clear')}</Text>
        </Pressable>
        {invalidReason ? <Text style={styles.invalid}>{invalidReason}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface.table.day,
  },
  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
  },
  topText: { fontSize: typography.size.caption, color: colors.ink.primary },
  historyToggle: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  historyPanel: {
    maxHeight: 96,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    padding: spacing.xs,
  },
  opponentRow: { flexGrow: 0 },
  opponentRowContent: { gap: spacing.sm, paddingVertical: spacing.xs },
  oppPanel: {
    minWidth: 96,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    padding: spacing.xs,
    gap: 2,
    backgroundColor: colors.surface.card.face,
  },
  oppPanelActive: { borderColor: colors.ink.primary, borderWidth: 2 },
  oppName: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  oppLine: { fontSize: typography.size.caption, color: colors.ink.secondary },
  oppStatus: { fontSize: typography.size.caption, color: colors.state.warning },
  oppThinking: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  field: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  fieldCards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  lockRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  lockTag: {
    fontSize: typography.size.caption,
    color: colors.ink.primary,
    borderWidth: 1,
    borderColor: colors.state.warning,
    borderRadius: radius.control,
    paddingHorizontal: spacing.xs,
  },
  muted: { fontSize: typography.size.caption, color: colors.ink.secondary },
  handScroll: { flexGrow: 0 },
  handRow: { gap: spacing.xs, paddingVertical: spacing.xs, alignItems: 'flex-end' },
  handCard: { borderRadius: radius.control, borderWidth: 2, borderColor: 'transparent' },
  handCardSelected: { borderColor: colors.ink.primary },
  handCardDim: { opacity: 0.4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  actionBtn: {
    backgroundColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionDisabled: { backgroundColor: colors.state.disabled },
  actionText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink.inverse,
  },
  actionBtnGhost: {
    borderWidth: 1,
    borderColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionTextGhost: { fontSize: typography.size.body, color: colors.ink.primary },
  invalid: {
    fontSize: typography.size.caption,
    color: colors.suit.fire,
    fontWeight: typography.weight.bold,
  },
});
