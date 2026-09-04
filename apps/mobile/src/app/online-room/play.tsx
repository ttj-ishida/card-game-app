import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { colors, radius, spacing, typography } from '@card-game-app/ui';
import { rankNumber, type SuitCode } from '@card-game-app/game-core';

import { CardFace } from '../../features/cpu-game/CardFace';
import {
  canPass,
  canSelectCard,
  canSubmit,
  canSubmitPlain,
} from '../../features/cpu-game/handSelection';
import { submitOptionsForSelection } from '../../features/cpu-game/skillPlayOptions';
import type { OnlineRoundEventView } from '../../features/online-room/onlineRoundViewModel';
import { onlineRoundStore, type OnlinePendingSkill } from '../../state/onlineRoundStore';
import { translate } from '../../i18n/translate';

const POLL_INTERVAL_MS = 2000;

function reasonText(reason: string | null): string | null {
  if (!reason) return null;
  try {
    return translate(`onlineRoom.reason.${reason}`);
  } catch {
    try {
      return translate(`sandbox.reason.${reason}`);
    } catch {
      return translate('onlineRoom.reason.UNKNOWN');
    }
  }
}

function eventCardViews(event: OnlineRoundEventView) {
  return event.cards.map((c) => ({
    rank: rankNumber(c.rankCode),
    suitCode: c.suitCode,
    isJoker: false,
  }));
}

function skillEffectLabelKey(effect: OnlineRoundEventView['skillEffect']): string | null {
  return effect ? `sandbox.play.useSkill.${effect}` : null;
}

export default function OnlineRoomPlayScreen() {
  const router = useRouter();
  const state = useStore(onlineRoundStore, (s) => s);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!state.roundId) router.replace('/online-room/lobby');
  }, [state.roundId, router]);

  useEffect(() => {
    if (!state.roundId || state.winnerPlayerId) return;
    const timer = setInterval(() => {
      void onlineRoundStore.getState().poll();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state.roundId, state.winnerPlayerId]);

  const confirmLeave = useCallback(() => {
    Alert.alert(
      translate('onlineRoom.play.leaveConfirmTitle'),
      translate('onlineRoom.play.leaveConfirmMessage'),
      [
        { text: translate('onlineRoom.play.leaveConfirmCancel'), style: 'cancel' },
        {
          text: translate('onlineRoom.play.leaveConfirmOk'),
          style: 'destructive',
          onPress: () => {
            onlineRoundStore
              .getState()
              .leaveRound(true)
              .finally(() => router.replace('/online-room'));
          },
        },
      ],
    );
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        confirmLeave();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [confirmLeave]),
  );

  const { view, legalPlays, selection, pendingSkill, winnerPlayerId } = state;

  const opponentIndexById = useMemo(
    () => new Map((view?.opponents ?? []).map((o, i) => [o.playerId, i])),
    [view?.opponents],
  );

  const actorLabel = useCallback(
    (seatId: string) => {
      if (!view) return '';
      if (seatId === view.playerId) return translate('onlineRoom.play.you');
      const index = opponentIndexById.get(seatId);
      return index == null
        ? translate('onlineRoom.play.opponentPrefix')
        : `${translate('onlineRoom.play.opponentPrefix')}${index + 1}`;
    },
    [view, opponentIndexById],
  );

  const skillLegalPlays = useMemo(
    () =>
      pendingSkill
        ? legalPlays.filter(
            (p) => p.input.kind === 'PLAY' && p.input.useSkill === pendingSkill.useSkill,
          )
        : legalPlays,
    [legalPlays, pendingSkill],
  );

  if (!view) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>{translate('onlineRoom.loading')}</Text>
      </View>
    );
  }

  const skillSubmitOptions = submitOptionsForSelection(legalPlays, selection);
  const heldSkill = view.skills.find((s) => !s.used) ?? null;

  const onSelectCard = (cardId: string) => {
    onlineRoundStore.getState().selectCard(cardId);
  };

  const onDeclareSkill = (useSkill: OnlinePendingSkill['useSkill']) => {
    onlineRoundStore.getState().declareSkill(useSkill);
  };

  const onSubmit = () => {
    void onlineRoundStore.getState().submitPlay();
  };

  const onPass = () => {
    void onlineRoundStore.getState().pass();
  };

  const winnerBanner = winnerPlayerId ? (
    <View style={styles.winnerPanel}>
      <Text style={styles.winnerText}>
        {winnerPlayerId === view.playerId
          ? translate('cpuGame.result.youWin')
          : translate('cpuGame.result.youLose')}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/online-room/lobby')}
          style={styles.actionBtn}
        >
          <Text style={styles.actionText}>{translate('onlineRoom.play.backToLobby')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onlineRoundStore.getState().reset();
            router.replace('/');
          }}
          style={styles.actionBtnGhost}
        >
          <Text style={styles.actionTextGhost}>{translate('onlineRoom.play.backHome')}</Text>
        </Pressable>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Text style={styles.topText}>
            {view.dayNight === 'DAY'
              ? translate('cpuGame.dayNight.day')
              : translate('cpuGame.dayNight.night')}
          </Text>
          <Text style={styles.topText}>
            {view.isMyTurn
              ? translate('onlineRoom.play.myTurn')
              : translate('onlineRoom.play.waitingTurn')}
          </Text>
          {state.connection === 'reconnecting' ? (
            <Text style={styles.reconnecting}>{translate('onlineRoom.play.reconnecting')}</Text>
          ) : null}
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
          <Pressable accessibilityRole="button" onPress={confirmLeave} style={styles.leaveBtn}>
            <Text style={styles.leaveText}>{translate('onlineRoom.play.leave')}</Text>
          </Pressable>
        </View>

        {winnerBanner}

        {showHistory ? (
          <ScrollView style={styles.historyPanel}>
            {state.eventLog.length === 0 ? (
              <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
            ) : (
              state.eventLog.map((line) => (
                <View key={line.eventSeq} style={styles.historyLine}>
                  <Text style={styles.muted}>
                    {line.index + 1}. {actorLabel(line.seatId)}
                    {line.kind === 'PASS' ? ` · ${translate('cpuGame.turnLog.PASS')}` : ''}
                    {line.kind === 'PLAY'
                      ? ` · ${translate(`cpuGame.turnLog.${line.actionKind}`)}`
                      : ''}
                    {skillEffectLabelKey(line.skillEffect)
                      ? ` [${translate(skillEffectLabelKey(line.skillEffect)!)}]`
                      : ''}
                  </Text>
                  {line.cards.length > 0 ? (
                    <View style={styles.historyCards}>
                      {eventCardViews(line).map((card, ci) => (
                        <CardFace
                          key={ci}
                          rank={card.rank}
                          suitCode={card.suitCode as SuitCode}
                          isJoker={card.isJoker}
                          size="mini"
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        ) : null}

        <ScrollView
          horizontal
          style={styles.opponentRow}
          contentContainerStyle={styles.opponentRowContent}
        >
          {view.opponents.map((opp, index) => (
            <View
              key={opp.playerId}
              style={[styles.oppPanel, opp.isActive && styles.oppPanelActive]}
            >
              <Text style={styles.oppName}>
                {translate('onlineRoom.play.opponentPrefix')}
                {index + 1}
              </Text>
              <Text style={styles.oppLine}>
                {opp.numberCardCount}
                {translate('cpuGame.opponent.cardsSuffix')}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.field}>
          {view.field ? (
            <View style={styles.fieldCards}>
              {view.field.cards.map((card, index) => (
                <CardFace
                  key={index}
                  rank={card.rank}
                  suitCode={card.suitCode}
                  isJoker={card.isJoker}
                  size="field"
                />
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>{translate('cpuGame.field.empty')}</Text>
          )}
          <View style={styles.lockRow}>
            {view.lock.countLocked ? (
              <Text style={styles.lockTag}>{translate('cpuGame.lock.count')}</Text>
            ) : null}
            {view.lock.suitFixed ? (
              <Text style={styles.lockTag}>
                {translate('cpuGame.lock.suitFixed')}:{' '}
                {view.lock.suitFixed.map((s) => translate(`sandbox.suit.${s}`)).join('')}
              </Text>
            ) : null}
            {view.lock.suitUniform ? (
              <Text style={styles.lockTag}>{translate('cpuGame.lock.suitUniform')}</Text>
            ) : null}
          </View>
        </View>

        {heldSkill ? (
          <View style={styles.skillPanel}>
            <Text style={styles.skillTitle}>
              {translate('cpuGame.skill.held')}:{' '}
              {translate(`cpuGame.skill.effect.${heldSkill.effectCode}`)}
            </Text>
            {skillSubmitOptions.map((opt) => (
              <Pressable
                key={opt.useSkill}
                accessibilityRole="button"
                accessibilityState={{ selected: pendingSkill?.useSkill === opt.useSkill }}
                onPress={() => onDeclareSkill(opt.useSkill)}
                style={[
                  styles.actionBtn,
                  pendingSkill?.useSkill === opt.useSkill && styles.actionBtnSelected,
                ]}
              >
                <Text style={styles.actionText}>
                  {translate(`cpuGame.skill.submit.${opt.useSkill}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <ScrollView horizontal style={styles.handScroll} contentContainerStyle={styles.handRow}>
          {view.hand.map((card) => {
            const selected = selection.includes(card.cardId);
            const selectable =
              view.isMyTurn && (selected || canSelectCard(selection, card.cardId, skillLegalPlays));
            return (
              <Pressable
                key={card.cardId}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !selectable }}
                disabled={!selectable}
                onPress={() => onSelectCard(card.cardId)}
                style={[
                  styles.handCard,
                  selected && styles.handCardSelected,
                  !selectable && styles.handCardDim,
                ]}
              >
                <CardFace
                  rank={card.rank}
                  suitCode={card.suitCode}
                  isJoker={card.isJoker}
                  size="hand"
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: !view.isMyTurn || !canSubmit(selection, skillLegalPlays),
            }}
            disabled={!view.isMyTurn || !canSubmit(selection, skillLegalPlays)}
            onPress={onSubmit}
            style={[
              styles.actionBtn,
              (!view.isMyTurn || !canSubmit(selection, skillLegalPlays)) && styles.actionDisabled,
            ]}
          >
            <Text style={styles.actionText}>{translate('cpuGame.action.submit')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: !view.isMyTurn || pendingSkill != null || !canPass(legalPlays),
            }}
            disabled={!view.isMyTurn || pendingSkill != null || !canPass(legalPlays)}
            onPress={onPass}
            style={[
              styles.actionBtn,
              (!view.isMyTurn || pendingSkill != null || !canPass(legalPlays)) &&
                styles.actionDisabled,
            ]}
          >
            <Text style={styles.actionText}>{translate('cpuGame.action.pass')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onlineRoundStore.getState().clearSelection()}
            style={styles.actionBtnGhost}
          >
            <Text style={styles.actionTextGhost}>{translate('cpuGame.action.clear')}</Text>
          </Pressable>
        </View>
        {reasonText(state.lastReason) ? (
          <Text style={styles.invalid}>{reasonText(state.lastReason)}</Text>
        ) : null}
        {!canSubmitPlain(selection, legalPlays) && selection.length === 0 && !view.isMyTurn ? (
          <Text style={styles.muted}>{translate('onlineRoom.play.waitingTurn')}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.xs, backgroundColor: colors.surface.table.day },
  scrollArea: { flexShrink: 1, flexGrow: 1 },
  scrollContent: { gap: spacing.xs, paddingBottom: spacing.xs },
  footer: { gap: spacing.xs, paddingTop: spacing.xs },
  topBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  topText: { fontSize: typography.size.caption, color: colors.ink.primary },
  reconnecting: {
    fontSize: typography.size.caption,
    color: colors.state.warning,
    fontWeight: typography.weight.bold,
  },
  historyToggle: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  leaveBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.suit.fire,
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  leaveText: { fontSize: typography.size.caption, color: colors.suit.fire },
  historyPanel: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    padding: spacing.xs,
  },
  historyLine: { gap: 2, paddingVertical: 2 },
  historyCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
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
  field: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
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
  skillPanel: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  skillTitle: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  winnerPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.ink.primary,
    borderRadius: radius.control,
    padding: spacing.sm,
  },
  winnerText: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  actionBtn: {
    backgroundColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  actionDisabled: { backgroundColor: colors.state.disabled },
  actionBtnSelected: { backgroundColor: colors.state.warning },
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
