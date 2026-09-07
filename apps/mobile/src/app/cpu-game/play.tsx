import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { RANK_CODES, SUIT_CODES, rankNumber } from '@ragnarok-millennium/game-core';

import type { PlayRejectionReason } from '@ragnarok-millennium/game-core';

import { CardFace } from '../../features/cpu-game/CardFace';
import { buildBoardViewModel } from '../../features/cpu-game/boardViewModel';
import { cpuGameStore } from '../../state/cpuGameStore';
import { cpuGameSettingsStore } from '../../state/cpuGameSettingsStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useShellSize } from '../../features/theme/AppShell';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import {
  ACCENT,
  Button,
  Chip,
  FieldTrail,
  HandFan,
  Panel,
  type FieldTrailStep,
} from '../../components';
import { translate } from '../../i18n/translate';
import { confirmDialog } from '../../lib/confirmDialog';
import { useStore } from 'zustand';

// Width reserved for each side column of the battle footer (skill panel on the
// left, action buttons on the right); the fan sits centred between them.
const FOOTER_SIDE_W = 220;

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
  const shell = useShellSize();
  const lowMotion = useStore(cpuGameSettingsStore, (s) => s.settings.lowMotion);
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

  // Round over: go straight to the result screen. finishRound() sets the result
  // view synchronously; its network persistence/retry then runs in the
  // background and the result screen reflects `saveStatus` as it lands. (Awaiting
  // the whole save here was adding a 3–4s stall before the result appeared.)
  useEffect(() => {
    if (phase !== 'ROUND_OVER') return;
    void cpuGameStore
      .getState()
      .finishRound()
      .catch(() => {});
    router.replace('/cpu-game/result');
  }, [phase, router]);

  // Confirm, then discard the match. Shared by hardware back and the exit button
  // (web has no hardware back and no header). Uses confirmDialog, not
  // Alert.alert, which is a silent no-op on react-native-web.
  const confirmExit = useCallback(async () => {
    const ok = await confirmDialog({
      title: translate('cpuGame.exit.confirmTitle'),
      confirmText: translate('cpuGame.exit.confirmOk'),
      cancelText: translate('cpuGame.exit.confirmCancel'),
      destructive: true,
    });
    if (!ok) return;
    cpuGameStore.getState().exit();
    router.replace('/');
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

  const fieldTrailSteps: FieldTrailStep[] = (() => {
    if (!vm.field) return [];
    const raw =
      vm.field.trail.length > 0
        ? vm.field.trail
        : [
            {
              index: -1,
              seatNameKey: vm.field.lastPlayerNameKey,
              cards: vm.field.cards,
            },
          ];
    return raw.map((step, i, arr) => ({
      key: String(step.index),
      cards: step.cards,
      label:
        i === arr.length - 1
          ? translate('cpuGame.field.trail.latest')
          : i === 0
            ? translate('cpuGame.field.trail.lead')
            : `${i + 1}${translate('cpuGame.field.trail.nthSuffix')}`,
      seatLabel: step.seatNameKey ? translate(step.seatNameKey) : undefined,
    }));
  })();

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
    <AppBackground variant="battle" inverted={vm.dayNight === 'NIGHT'}>
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

          <View style={styles.opponentRow}>
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
                  <Text
                    style={styles.oppSkillIcon}
                    accessibilityLabel={translate('cpuGame.opponent.hasSkill')}
                  >
                    ✦
                  </Text>
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
          </View>

          <View style={styles.field}>
            {vm.field ? (
              <FieldTrail
                lowMotion={lowMotion}
                maxWidth={Math.min(shell.width - spacing.md * 2, 760)}
                steps={fieldTrailSteps}
              />
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
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerSide}>
              {vm.skillPanel ? (
                <Panel style={styles.skillPanel}>
                  <View style={styles.skillHeader}>
                    <View style={styles.skillBadge}>
                      <Text style={styles.skillBadgeGlyph}>✦</Text>
                    </View>
                    <View style={styles.skillHeaderText}>
                      <Text style={styles.skillOverline}>{translate('cpuGame.skill.held')}</Text>
                      <Text style={styles.skillName}>{translate(vm.skillPanel.heldEffectKey)}</Text>
                    </View>
                  </View>
                  <Text style={styles.skillDesc}>{translate(vm.skillPanel.heldEffectDescKey)}</Text>
                  <View style={styles.skillDivider} />

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
            </View>

            <HandFan
              maxWidth={Math.min(shell.width - FOOTER_SIDE_W * 2 - spacing.md * 4, 620)}
              lowMotion={lowMotion}
              onPressCard={(cardId) => {
                cpuGameStore.getState().selectCard(cardId);
                setInvalidReason(null);
              }}
              cards={vm.hand.map((card) => ({
                key: card.cardId,
                rank: card.rank,
                suitCode: card.suitCode,
                isJoker: card.isJoker,
                selected: card.selected,
                selectable: card.selectable,
                locked: card.selectionLocked ?? false,
              }))}
            />

            <View style={styles.footerSide}>
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
            </View>
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
    footerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    footerSide: { width: FOOTER_SIDE_W },
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
    oppSkillIcon: {
      fontSize: typography.size.body,
      lineHeight: typography.size.body + 2,
      color: ACCENT,
      fontWeight: typography.weight.bold,
    },
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
    skillOverline: {
      fontSize: 10,
      letterSpacing: 1,
      color: c.ink.secondary,
    },
    skillName: {
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
      color: ACCENT,
    },
    skillDesc: {
      fontSize: typography.size.caption,
      lineHeight: 16,
      color: c.ink.secondary,
    },
    skillDivider: { height: 1, backgroundColor: c.state.disabled, marginTop: 2 },
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
