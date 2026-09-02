import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

import { RANK_CODES, SUIT_CODES, rankNumber } from '@card-game-app/game-core';

import type { PlayRejectionReason } from '@card-game-app/game-core';

import { CardFace } from '../../features/cpu-game/CardFace';
import { buildBoardViewModel } from '../../features/cpu-game/boardViewModel';
import { cpuGameStore } from '../../state/cpuGameStore';
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
      <View style={styles.screen}>
        <Text style={styles.muted}>{translate('cpuGame.setup.title')}</Text>
      </View>
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
          {translate('cpuGame.turnLabel')}: {translate(vm.activeSeatNameKey)}
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
          {vm.turnLog.length === 0 ? (
            <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
          ) : (
            vm.turnLog.map((line) => (
              <Text key={line.index} style={styles.muted}>
                {line.index + 1}. {translate(line.seatNameKey)} ·{' '}
                {translate(`cpuGame.turnLog.${line.actionKind}`)}
                {line.kind === 'PLAY'
                  ? ` ${line.cardCount}${translate('cpuGame.opponent.cardsSuffix')}`
                  : ''}
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
            <Text style={styles.oppName}>{translate(opp.nameKey)}</Text>
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

      {vm.skillPanel ? (
        <View style={styles.skillPanel}>
          <Text style={styles.skillTitle}>
            {translate('cpuGame.skill.held')}: {translate(vm.skillPanel.heldEffectKey)}
          </Text>
          <Text style={styles.muted}>{translate(vm.skillPanel.heldEffectDescKey)}</Text>

          {vm.submitOptions.skills.map((opt) => (
            <Pressable
              key={opt.useSkill}
              accessibilityRole="button"
              accessibilityState={{ selected: pendingSkill?.useSkill === opt.useSkill }}
              onPress={() => onSubmitSkill(opt.useSkill)}
              style={[
                styles.actionBtn,
                pendingSkill?.useSkill === opt.useSkill && styles.actionBtnSelected,
              ]}
            >
              <Text style={styles.actionText}>{translate(opt.labelKey)}</Text>
            </Pressable>
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
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: pendingSkill?.useSkill === 'JOKER_TRANSFORM' }}
              onPress={() => cpuGameStore.getState().openJokerTransform()}
              style={[
                styles.actionBtnGhost,
                pendingSkill?.useSkill === 'JOKER_TRANSFORM' && styles.actionBtnGhostSelected,
              ]}
            >
              <Text style={styles.actionTextGhost}>
                {translate('cpuGame.skill.jokerTransform.open')}
              </Text>
            </Pressable>
          ) : null}

          {vm.jokerTransform.active ? (
            <View style={styles.jokerPanel}>
              <Text style={styles.muted}>
                {translate('cpuGame.skill.jokerTransform.declareRank')}
              </Text>
              <View style={styles.pickerRow}>
                {RANK_CODES.map((rc) => (
                  <Pressable
                    key={rc}
                    accessibilityRole="button"
                    accessibilityState={{ selected: vm.jokerTransform.rankCode === rc }}
                    onPress={() =>
                      cpuGameStore.getState().setJokerDeclaration(rc, vm.jokerTransform.suitCode)
                    }
                    style={[
                      styles.pickerCell,
                      vm.jokerTransform.rankCode === rc && styles.pickerCellOn,
                    ]}
                  >
                    <Text style={styles.pickerText}>{rankNumber(rc)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.muted}>
                {translate('cpuGame.skill.jokerTransform.declareSuit')}
              </Text>
              <View style={styles.pickerRow}>
                {SUIT_CODES.map((sc) => (
                  <Pressable
                    key={sc}
                    accessibilityRole="button"
                    accessibilityState={{ selected: vm.jokerTransform.suitCode === sc }}
                    onPress={() =>
                      cpuGameStore.getState().setJokerDeclaration(vm.jokerTransform.rankCode, sc)
                    }
                    style={[
                      styles.pickerCell,
                      vm.jokerTransform.suitCode === sc && styles.pickerCellOn,
                    ]}
                  >
                    <Text style={styles.pickerText}>{translate(`sandbox.suit.${sc}`)}</Text>
                  </Pressable>
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !vm.jokerTransform.canConfirm }}
                  disabled={!vm.jokerTransform.canConfirm}
                  onPress={onSubmitJoker}
                  style={[styles.actionBtn, !vm.jokerTransform.canConfirm && styles.actionDisabled]}
                >
                  <Text style={styles.actionText}>
                    {translate('cpuGame.skill.jokerTransform.confirm')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => cpuGameStore.getState().closeJokerTransform()}
                  style={styles.actionBtnGhost}
                >
                  <Text style={styles.actionTextGhost}>
                    {translate('cpuGame.skill.jokerTransform.cancel')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

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
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !vm.submitOptions.plain }}
          disabled={!vm.submitOptions.plain}
          onPress={onSubmit}
          style={[styles.actionBtn, !vm.submitOptions.plain && styles.actionDisabled]}
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
  handCardLocked: { borderColor: colors.state.warning, opacity: 1 },
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
  jokerPanel: { gap: spacing.xs },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pickerCell: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pickerCellOn: { borderColor: colors.ink.primary, borderWidth: 2 },
  pickerText: { fontSize: typography.size.caption, color: colors.ink.primary },
  jokerPreview: { alignItems: 'flex-start', gap: 2 },
  hintRow: { gap: 2 },
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
  actionBtnGhostSelected: { borderColor: colors.state.warning, borderWidth: 2 },
  invalid: {
    fontSize: typography.size.caption,
    color: colors.suit.fire,
    fontWeight: typography.weight.bold,
  },
});
