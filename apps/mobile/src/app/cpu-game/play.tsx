import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { RANK_CODES, SUIT_CODES, rankNumber } from '@ragnarok-millennium/game-core';

import type { PlayRejectionReason } from '@ragnarok-millennium/game-core';

import { CardFace } from '../../features/cpu-game/CardFace';
import { buildBoardViewModel } from '../../features/cpu-game/boardViewModel';
import { cpuGameStore } from '../../state/cpuGameStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Button, Chip, Panel } from '../../components';
import { translate } from '../../i18n/translate';
import { useStore } from 'zustand';

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
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const state = useStore(cpuGameStore, (s) => s);
  const { driver, selection, legalPlays, cpuThinking } = state;
  const pending = useStore(cpuGameStore, (s) => s.pendingCpuReveal);
  const jokerTransform = useStore(cpuGameStore, (s) => s.jokerTransform);
  const pendingSkill = useStore(cpuGameStore, (s) => s.pendingSkill);

  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const phase = driver?.phase;

  // Redirect if the store has no active match (direct nav / post-exit).
  useEffect(() => {
    if (!driver) router.replace('/cpu-game/setup');
  }, [driver, router]);

  // CPU progression: stage the decision, then reveal it after its thinkMillis.
  // The staged move (and its delay) lives in the store as `pendingCpuReveal`, so
  // a double-invoked effect stays correct — `advanceCpu()` is a no-op once staged.
  useEffect(() => {
    if (phase === 'CPU_PENDING' && !pending) {
      cpuGameStore.getState().advanceCpu();
      return;
    }
    if (pending) {
      const timer = setTimeout(
        () => cpuGameStore.getState().commitCpuReveal(),
        pending.decided.thinkMillis,
      );
      return () => clearTimeout(timer);
    }
  }, [phase, pending]);

  // Round over: persist the result, then move to the result screen.
  useEffect(() => {
    if (phase !== 'ROUND_OVER') return;
    let cancelled = false;
    cpuGameStore
      .getState()
      .finishRound()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) router.replace('/cpu-game/result');
      });
    return () => {
      cancelled = true;
    };
  }, [phase, router]);

  // Confirm, then discard the match. Shared by hardware back and the exit button
  // (web has no hardware back and no header).
  const confirmExit = useCallback(() => {
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
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        confirmExit();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [confirmExit]),
  );

  const vm = useMemo(
    () =>
      driver
        ? buildBoardViewModel(driver, selection, legalPlays, {
            cpuThinking,
            jokerTransform,
            pendingSkill,
          })
        : null,
    [driver, selection, legalPlays, cpuThinking, jokerTransform, pendingSkill],
  );

  if (!driver || !vm) {
    return (
      <AppBackground variant="battle">
        <View style={styles.screen}>
          <Text style={styles.muted}>{translate('cpuGame.setup.title')}</Text>
        </View>
      </AppBackground>
    );
  }

  const onSubmit = () => {
    const res = cpuGameStore.getState().submitPlay();
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };
  const onSubmitSkill = (useSkill: 'JOKER_CLEAR' | 'EXTENSION_SEAL' | 'REVOLUTION') => {
    const res = cpuGameStore.getState().submitSkillPlay(useSkill);
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };
  const onSubmitJoker = () => {
    const res = cpuGameStore.getState().submitJokerTransform();
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };
  const onPass = () => {
    const res = cpuGameStore.getState().pass();
    setInvalidReason(res.ok ? null : reasonText(res.reason));
  };

  return (
    <AppBackground variant="battle">
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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
              {translate('cpuGame.turnLabel')}: {translate(vm.activeSeatNameKey)}
            </Text>
            <Button
              variant="ghost"
              label={`${translate('cpuGame.history')} ${showHistory ? '▲' : '▾'}`}
              onPress={() => setShowHistory((v) => !v)}
            />
            <Button
              variant="danger"
              label={translate('cpuGame.exit.button')}
              onPress={confirmExit}
            />
          </View>

          {showHistory ? (
            <ScrollView style={styles.historyPanel}>
              {vm.turnLog.length === 0 ? (
                <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
              ) : (
                vm.turnLog.map((line) => (
                  <View key={line.index} style={styles.historyLine}>
                    <Text style={styles.muted}>
                      {line.index + 1}. {translate(line.seatNameKey)} ·{' '}
                      {translate(`cpuGame.turnLog.${line.actionKind}`)}
                      {line.skillEffectKey ? ` [${translate(line.skillEffectKey)}]` : ''}
                      {line.kind === 'PASS'
                        ? ''
                        : line.cards.length === 0
                          ? ` ${line.cardCount}${translate('cpuGame.opponent.cardsSuffix')}`
                          : ''}
                    </Text>
                    {line.cards.length > 0 ? (
                      <View style={styles.historyCards}>
                        {line.cards.map((card, ci) => (
                          <CardFace
                            key={ci}
                            rank={card.rank}
                            suitCode={card.suitCode}
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
            {vm.opponents.map((opp) => (
              <View
                key={opp.seatId}
                style={[styles.oppPanel, opp.isActive && styles.oppPanelActive]}
              >
                <Text style={styles.oppName}>{translate(opp.nameKey)}</Text>
                <Text style={styles.oppLine}>
                  {opp.numberCardCount}
                  {translate('cpuGame.opponent.cardsSuffix')}
                </Text>
                {opp.hasSkill ? (
                  <Text style={styles.oppLine}>● {translate('cpuGame.opponent.hasSkill')}</Text>
                ) : null}
                {opp.status === 'PASSED' ? (
                  <Text style={styles.oppStatus}>
                    {translate('cpuGame.opponent.status.PASSED')}
                  </Text>
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
                {vm.field.trail.length > 1 ? (
                  <View style={styles.trailPanel}>
                    <Text style={styles.muted}>{translate('cpuGame.field.trail')}</Text>
                    {vm.field.trail.map((step) => (
                      <View key={step.index} style={styles.trailLine}>
                        <Text style={styles.muted}>
                          {translate(step.seatNameKey)} ·{' '}
                          {translate(`cpuGame.turnLog.${step.actionKind}`)}
                          {step.skillEffectKey ? ` [${translate(step.skillEffectKey)}]` : ''}
                        </Text>
                        <View style={styles.historyCards}>
                          {step.cards.map((card, ci) => (
                            <CardFace
                              key={ci}
                              rank={card.rank}
                              suitCode={card.suitCode}
                              isJoker={card.isJoker}
                              size="mini"
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
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

          {vm.skillPanel ? (
            <Panel>
              <Text style={styles.skillTitle}>
                {translate('cpuGame.skill.held')}: {translate(vm.skillPanel.heldEffectKey)}
              </Text>
              <Text style={styles.muted}>{translate(vm.skillPanel.heldEffectDescKey)}</Text>

              {vm.submitOptions.skills.map((opt) => (
                <Button
                  key={opt.useSkill}
                  label={translate(opt.labelKey)}
                  selected={pendingSkill?.useSkill === opt.useSkill}
                  onPress={() => onSubmitSkill(opt.useSkill)}
                />
              ))}

              {vm.skillPanel.revolutionPreview ? (
                <Text style={styles.muted}>
                  {translate('cpuGame.skill.revolutionPreviewLabel')}:{' '}
                  {vm.skillPanel.revolutionPreview.dayNightAfter === 'DAY'
                    ? translate('cpuGame.dayNight.day')
                    : translate('cpuGame.dayNight.night')}{' '}
                  / {vm.skillPanel.revolutionPreview.strengthOrderAfter.join('→')}
                </Text>
              ) : null}

              {vm.skillPanel.jokerTransformAvailable && !vm.jokerTransform.active ? (
                <Button
                  variant="ghost"
                  label={translate('cpuGame.skill.jokerTransform.open')}
                  selected={pendingSkill?.useSkill === 'JOKER_TRANSFORM'}
                  onPress={() => cpuGameStore.getState().openJokerTransform()}
                />
              ) : null}

              {vm.jokerTransform.active ? (
                <View style={styles.jokerPanel}>
                  <Text style={styles.muted}>
                    {translate('cpuGame.skill.jokerTransform.declareRank')}
                  </Text>
                  <View style={styles.pickerRow}>
                    {RANK_CODES.map((rc) => (
                      <Chip
                        key={rc}
                        label={String(rankNumber(rc))}
                        selected={vm.jokerTransform.rankCode === rc}
                        onPress={() =>
                          cpuGameStore
                            .getState()
                            .setJokerDeclaration(rc, vm.jokerTransform.suitCode)
                        }
                      />
                    ))}
                  </View>
                  <Text style={styles.muted}>
                    {translate('cpuGame.skill.jokerTransform.declareSuit')}
                  </Text>
                  <View style={styles.pickerRow}>
                    {SUIT_CODES.map((sc) => (
                      <Chip
                        key={sc}
                        label={translate(`sandbox.suit.${sc}`)}
                        selected={vm.jokerTransform.suitCode === sc}
                        onPress={() =>
                          cpuGameStore
                            .getState()
                            .setJokerDeclaration(vm.jokerTransform.rankCode, sc)
                        }
                      />
                    ))}
                  </View>

                  {vm.jokerTransform.previewCard ? (
                    <View style={styles.jokerPreview}>
                      <Text style={styles.muted}>
                        {translate('cpuGame.skill.jokerTransform.preview')}
                      </Text>
                      <CardFace
                        rank={vm.jokerTransform.previewCard.rank}
                        suitCode={vm.jokerTransform.previewCard.suitCode}
                        isJoker
                        size="hand"
                      />
                    </View>
                  ) : null}

                  {vm.jokerTransform.forbiddenGoOut ? (
                    <Text style={styles.invalid}>
                      {translate('cpuGame.skill.jokerTransform.forbiddenGoOut')}
                    </Text>
                  ) : null}
                  {vm.jokerTransform.rejectionReasonKey ? (
                    <Text style={styles.invalid}>
                      {translate(vm.jokerTransform.rejectionReasonKey)}
                    </Text>
                  ) : null}

                  <View style={styles.actions}>
                    <Button
                      label={translate('cpuGame.skill.jokerTransform.confirm')}
                      disabled={!vm.jokerTransform.canConfirm}
                      onPress={onSubmitJoker}
                    />
                    <Button
                      variant="ghost"
                      label={translate('cpuGame.skill.jokerTransform.cancel')}
                      onPress={() => cpuGameStore.getState().closeJokerTransform()}
                    />
                  </View>
                </View>
              ) : null}
            </Panel>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
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
                  card.selectionLocked && styles.handCardLocked,
                  !card.selectable && !card.selectionLocked && styles.handCardDim,
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

          <View style={styles.actions}>
            <Button
              label={translate('cpuGame.action.submit')}
              disabled={!vm.submitOptions.plain}
              onPress={onSubmit}
            />
            <Button
              label={translate('cpuGame.action.pass')}
              disabled={!vm.canPass}
              onPress={onPass}
            />
            <Button
              variant="ghost"
              label={translate('cpuGame.action.clear')}
              onPress={() => {
                cpuGameStore.getState().clearSelection();
                setInvalidReason(null);
              }}
            />
            {invalidReason ? <Text style={styles.invalid}>{invalidReason}</Text> : null}
          </View>
          {vm.phase === 'HUMAN_TURN' ? (
            <View style={styles.hintRow}>
              {vm.selectionHint.rejectionReasonKey ? (
                <Text style={styles.invalid}>{translate(vm.selectionHint.rejectionReasonKey)}</Text>
              ) : null}
              <Text style={styles.muted}>
                {vm.selectionHint.legalMoveCount > 0
                  ? `${translate('cpuGame.hint.legalMoveCountPrefix')}: ${vm.selectionHint.legalMoveCount}${translate('cpuGame.hint.legalMoveCountSuffix')}`
                  : translate('cpuGame.hint.noMoves')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      padding: spacing.xs,
    },
    scrollArea: { flexShrink: 1, flexGrow: 1 },
    scrollContent: { gap: spacing.xs, paddingBottom: spacing.xs },
    footer: { gap: spacing.xs, paddingTop: spacing.xs },
    topBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
    },
    topText: { fontSize: typography.size.caption, color: c.ink.primary },
    historyPanel: {
      maxHeight: 140,
      borderWidth: 1,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      padding: spacing.xs,
    },
    historyLine: { gap: 2, paddingVertical: 2 },
    historyCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    trailPanel: {
      alignSelf: 'stretch',
      gap: 3,
      borderTopWidth: 1,
      borderTopColor: c.state.disabled,
      paddingTop: spacing.xs,
      marginTop: spacing.xs,
    },
    trailLine: { gap: 2 },
    opponentRow: { flexGrow: 0 },
    opponentRowContent: { gap: spacing.sm, paddingVertical: spacing.xs },
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
    oppStatus: { fontSize: typography.size.caption, color: c.state.warning },
    oppThinking: {
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      color: c.ink.primary,
    },
    field: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    fieldCards: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      justifyContent: 'center',
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
    handScroll: { flexGrow: 0 },
    handRow: { gap: spacing.xs, paddingVertical: spacing.xs, alignItems: 'flex-end' },
    handCard: { borderRadius: radius.control, borderWidth: 2, borderColor: 'transparent' },
    handCardSelected: { borderColor: c.ink.primary },
    handCardLocked: { borderColor: c.state.warning, opacity: 1 },
    handCardDim: { opacity: 0.4 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
    skillTitle: {
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      color: c.ink.primary,
    },
    jokerPanel: { gap: spacing.xs },
    pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    jokerPreview: { alignItems: 'flex-start', gap: 2 },
    hintRow: { gap: 2 },
    invalid: {
      fontSize: typography.size.caption,
      color: c.suit.fire,
      fontWeight: typography.weight.bold,
    },
  });
