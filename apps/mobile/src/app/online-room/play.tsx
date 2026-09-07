import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';
import { rankNumber, type SuitCode } from '@ragnarok-millennium/game-core';

import { CardFace } from '../../features/cpu-game/CardFace';
import { AppBackground } from '../../features/theme/AppBackground';
import { useShellSize } from '../../features/theme/AppShell';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { ACCENT, Button, FieldTrail, HandFan, Panel } from '../../components';
import {
  canPass,
  canSelectCard,
  canSubmit,
  canSubmitPlain,
} from '../../features/cpu-game/handSelection';
import { submitOptionsForSelection } from '../../features/cpu-game/skillPlayOptions';
import {
  deriveSeatTakeovers,
  type OnlineRoundEventView,
} from '../../features/online-room/onlineRoundViewModel';
import { confirmDialog } from '../../lib/confirmDialog';
import { onlineRoundStore, type OnlinePendingSkill } from '../../state/onlineRoundStore';
import { onlineRoomStore } from '../../state/onlineRoomStore';
import { translate } from '../../i18n/translate';

const POLL_INTERVAL_MS = 1000;

// Width reserved for each side column of the battle footer (held-skill panel on
// the left, action buttons on the right); the fan sits centred between them.
const FOOTER_SIDE_W = 220;

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
  const styles = useThemedStyles(makeStyles);
  const shell = useShellSize();
  const router = useRouter();
  const state = useStore(onlineRoundStore, (s) => s);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // roundId が無い＝退出/終了で片付け済み。ロビーは round がまだ残っていると
    // 対局画面へ引き戻すので、ルーム作成画面まで戻す。
    if (!state.roundId) router.replace('/online-room');
  }, [state.roundId, router]);

  useEffect(() => {
    if (!state.roundId || state.winnerPlayerId || state.connection === 'offline') return;
    const timer = setInterval(() => {
      void onlineRoundStore.getState().poll();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state.roundId, state.winnerPlayerId, state.connection]);

  const confirmLeave = useCallback(async () => {
    const ok = await confirmDialog({
      title: translate('onlineRoom.play.leaveConfirmTitle'),
      message: translate('onlineRoom.play.leaveConfirmMessage'),
      confirmText: translate('onlineRoom.play.leaveConfirmOk'),
      cancelText: translate('onlineRoom.play.leaveConfirmCancel'),
      destructive: true,
    });
    if (!ok) return;
    // CPU引き継ぎを要求（ルーム設定で無効なら自動的に棄権になる）。
    // 引き継ぎ後の手番は残った誰かのポーリングが advance-cpu-turn で進める。
    onlineRoomStore.getState().reset();
    await onlineRoundStore.getState().leaveRound(true);
    router.replace('/online-room');
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

  const takeovers = useMemo(() => deriveSeatTakeovers(state.eventLog), [state.eventLog]);

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
      <AppBackground variant="battle">
        <View style={styles.screen}>
          <Text style={styles.muted}>{translate('onlineRoom.loading')}</Text>
        </View>
      </AppBackground>
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
    <Panel>
      <Text style={styles.winnerText}>
        {winnerPlayerId === view.playerId
          ? translate('cpuGame.result.youWin')
          : translate('cpuGame.result.youLose')}
      </Text>
      <View style={styles.actions}>
        <Button
          label={translate('onlineRoom.play.backToLobby')}
          onPress={() => {
            // サーバー側の再戦は未対応。対局を片付けてルーム作成画面へ戻す
            // （ロビーへ戻すと終了済みの round が残っていて対局画面へ引き戻される）。
            onlineRoundStore.getState().reset();
            onlineRoomStore.getState().reset();
            router.replace('/online-room');
          }}
        />
        <Button
          variant="ghost"
          label={translate('onlineRoom.play.backHome')}
          onPress={() => {
            onlineRoundStore.getState().reset();
            onlineRoomStore.getState().reset();
            router.replace('/');
          }}
        />
      </View>
    </Panel>
  ) : null;

  return (
    <AppBackground variant="battle" inverted={view.dayNight === 'NIGHT'}>
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
            {state.connection === 'offline' ? (
              <Button
                variant="secondary"
                label={`${translate('onlineRoom.play.offline')} · ${translate('onlineRoom.play.retry')}`}
                onPress={() => void onlineRoundStore.getState().reconnect()}
              />
            ) : null}
            <Button
              variant="ghost"
              label={`${translate('cpuGame.history')} ${showHistory ? '▲' : '▾'}`}
              onPress={() => setShowHistory((v) => !v)}
            />
            <Button
              variant="danger"
              label={translate('onlineRoom.play.leave')}
              onPress={confirmLeave}
            />
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
                      {line.eventKind === 'PLAYER_LEFT_CPU_TAKEOVER'
                        ? ` · ${translate('onlineRoom.play.eventTakeover')}`
                        : line.eventKind === 'PLAYER_FORFEITED'
                          ? ` · ${translate('onlineRoom.play.eventForfeit')}`
                          : ''}
                      {line.eventKind !== 'PLAYER_LEFT_CPU_TAKEOVER' &&
                      line.eventKind !== 'PLAYER_FORFEITED' &&
                      line.kind === 'PASS'
                        ? ` · ${translate('cpuGame.turnLog.PASS')}`
                        : ''}
                      {line.eventKind !== 'PLAYER_LEFT_CPU_TAKEOVER' &&
                      line.eventKind !== 'PLAYER_FORFEITED' &&
                      line.kind === 'PLAY'
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

          <View style={styles.opponentRow}>
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
                {takeovers[opp.playerId] === 'CPU' ? (
                  <Text style={styles.oppTakeover}>{translate('onlineRoom.play.opponentCpu')}</Text>
                ) : null}
                {takeovers[opp.playerId] === 'LEFT' ? (
                  <Text style={styles.oppTakeover}>
                    {translate('onlineRoom.play.opponentLeft')}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.field}>
            {view.field ? (
              <FieldTrail
                maxWidth={Math.min(shell.width - spacing.md * 2, 760)}
                steps={[
                  {
                    key: 'current',
                    cards: view.field.cards,
                    label: translate('cpuGame.field.trail.latest'),
                  },
                ]}
              />
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
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerSide}>
              {heldSkill ? (
                <Panel style={styles.skillPanel}>
                  <View style={styles.skillHeader}>
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillBadgeGlyph}>✦</Text>
                    </View>
                    <View style={styles.skillHeaderText}>
                      <Text style={styles.skillOverline}>{translate('cpuGame.skill.held')}</Text>
                      <Text style={styles.skillName}>
                        {translate(`sandbox.skill.${heldSkill.effectCode}`)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.skillDesc}>
                    {translate(`cpuGame.skill.effect.${heldSkill.effectCode}`)}
                  </Text>
                  <View style={styles.skillDivider} />
                  {skillSubmitOptions.map((opt) => (
                    <Button
                      key={opt.useSkill}
                      label={translate(`cpuGame.skill.submit.${opt.useSkill}`)}
                      selected={pendingSkill?.useSkill === opt.useSkill}
                      onPress={() => onDeclareSkill(opt.useSkill)}
                    />
                  ))}
                </Panel>
              ) : null}
            </View>

            <HandFan
              maxWidth={Math.min(shell.width - FOOTER_SIDE_W * 2 - spacing.md * 4, 620)}
              onPressCard={onSelectCard}
              cards={view.hand.map((card) => {
                const selected = selection.includes(card.cardId);
                return {
                  key: card.cardId,
                  rank: card.rank,
                  suitCode: card.suitCode,
                  isJoker: card.isJoker,
                  selected,
                  selectable:
                    view.isMyTurn &&
                    (selected || canSelectCard(selection, card.cardId, skillLegalPlays)),
                  locked: false,
                };
              })}
            />

            <View style={styles.footerSide}>
              <View style={styles.actions}>
                <Button
                  label={translate('cpuGame.action.submit')}
                  disabled={!view.isMyTurn || !canSubmit(selection, skillLegalPlays)}
                  onPress={onSubmit}
                />
                <Button
                  label={translate('cpuGame.action.pass')}
                  disabled={!view.isMyTurn || pendingSkill != null || !canPass(legalPlays)}
                  onPress={onPass}
                />
                <Button
                  variant="ghost"
                  label={translate('cpuGame.action.clear')}
                  onPress={() => onlineRoundStore.getState().clearSelection()}
                />
              </View>
            </View>
          </View>
          {reasonText(state.lastReason) ? (
            <Text style={styles.invalid}>{reasonText(state.lastReason)}</Text>
          ) : null}
          {!canSubmitPlain(selection, legalPlays) && selection.length === 0 && !view.isMyTurn ? (
            <Text style={styles.muted}>{translate('onlineRoom.play.waitingTurn')}</Text>
          ) : null}
        </View>
      </View>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, padding: spacing.xs },
    scrollArea: { flexShrink: 1, flexGrow: 1 },
    scrollContent: { gap: spacing.xs, paddingBottom: spacing.xs },
    footer: { gap: spacing.xs, paddingTop: spacing.xs },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    footerSide: { width: FOOTER_SIDE_W },
    topBar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
    topText: { fontSize: typography.size.caption, color: c.ink.primary },
    reconnecting: {
      fontSize: typography.size.caption,
      color: c.state.warning,
      fontWeight: typography.weight.bold,
    },
    historyPanel: {
      maxHeight: 140,
      borderWidth: 1,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      padding: spacing.xs,
    },
    historyLine: { gap: 2, paddingVertical: 2 },
    historyCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    opponentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-evenly',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    oppPanel: {
      minWidth: 96,
      borderWidth: 1,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      padding: spacing.xs,
      gap: 2,
      backgroundColor: c.surface.card.face,
    },
    oppPanelActive: { borderColor: c.ink.primary, borderWidth: 2 },
    oppName: {
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      color: c.ink.primary,
    },
    oppLine: { fontSize: typography.size.caption, color: c.ink.secondary },
    oppTakeover: {
      fontSize: typography.size.caption,
      color: c.state.warning,
      fontWeight: typography.weight.bold,
    },
    field: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    lockRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
    lockTag: {
      fontSize: typography.size.caption,
      color: c.ink.primary,
      borderWidth: 1,
      borderColor: c.state.warning,
      borderRadius: radius.control,
      paddingHorizontal: spacing.xs,
    },
    muted: { fontSize: typography.size.caption, color: c.ink.secondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
    skillPanel: { gap: spacing.xs },
    skillHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    skillBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: ACCENT,
      backgroundColor: 'rgba(201, 169, 78, 0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    skillBadgeGlyph: {
      fontSize: 13,
      lineHeight: 15,
      color: ACCENT,
      fontWeight: typography.weight.bold,
    },
    skillHeaderText: { flex: 1, gap: 1 },
    skillOverline: { fontSize: 10, letterSpacing: 1, color: c.ink.secondary },
    skillName: {
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
      color: ACCENT,
    },
    skillDesc: { fontSize: typography.size.caption, lineHeight: 16, color: c.ink.secondary },
    skillDivider: { height: 1, backgroundColor: c.state.disabled, marginTop: 2 },
    winnerText: {
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold,
      color: c.ink.primary,
      textAlign: 'center',
    },
    invalid: {
      fontSize: typography.size.caption,
      color: c.suit.fire,
      fontWeight: typography.weight.bold,
    },
  });
