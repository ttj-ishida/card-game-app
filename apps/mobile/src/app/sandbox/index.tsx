import { useState } from 'react';
import { useStore } from 'zustand';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

import {
  RANK_CODES,
  SUIT_CODES,
  isTransformedJokerCard,
  type NumberCard,
} from '@card-game-app/game-core';

import {
  addCardToHand,
  addDiscard,
  clearField,
  isValidFieldCards,
  makeSandboxCard,
  removeCardFromHand,
  removeDiscard,
  setActivePlayer,
  setConsecutivePasses,
  setDayNight,
  setExtensionSealed,
  setLockedSuit,
  setPlayerCount,
  setPlayerSkill,
  setPlayerSkillUsed,
  setPlayerStatus,
} from '../../features/rule-sandbox/sandboxModel';
import { SANDBOX_PRESETS } from '../../features/rule-sandbox/sandboxPresets';
import { ruleSandboxStore } from '../../state/rule-sandbox-store';
import { translate } from '../../i18n/translate';

const SUIT_LABEL: Record<string, string> = {
  SUIT_FIRE: translate('sandbox.suit.SUIT_FIRE'),
  SUIT_WATER: translate('sandbox.suit.SUIT_WATER'),
  SUIT_WIND: translate('sandbox.suit.SUIT_WIND'),
  SUIT_EARTH: translate('sandbox.suit.SUIT_EARTH'),
};

const SUIT_COLOR: Record<string, string> = {
  SUIT_FIRE: colors.suit.fire,
  SUIT_WATER: colors.suit.water,
  SUIT_WIND: colors.suit.wind,
  SUIT_EARTH: colors.suit.earth,
};

function rankNumber(rankCode: string): string {
  return rankCode.replace('RANK_', '');
}

function CardChip({ card }: { card: NumberCard }) {
  const joker = isTransformedJokerCard(card);
  const suitLabel = SUIT_LABEL[card.suitCode];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${rankNumber(card.rankCode)} ${suitLabel}${
        joker ? ` ${translate('sandbox.card.joker')}` : ''
      }`}
      style={[styles.chip, { borderColor: SUIT_COLOR[card.suitCode] }]}
    >
      {joker ? <Text style={styles.chipJoker}>J</Text> : null}
      <Text style={styles.chipRank}>{rankNumber(card.rankCode)}</Text>
      <Text style={styles.chipSuit}>{suitLabel}</Text>
    </View>
  );
}

export default function SandboxScreen() {
  const state = useStore(ruleSandboxStore, (store) => store);
  const { draft, playDraft, fieldDraft, lastResult, history } = state;
  const activePlayer = draft.players.find((player) => player.playerId === draft.activePlayerId);

  const [addTargetPlayer, setAddTargetPlayer] = useState('P1');
  const addTarget = draft.players.some((player) => player.playerId === addTargetPlayer)
    ? addTargetPlayer
    : draft.activePlayerId;
  const fieldDraftValid = isValidFieldCards(fieldDraft.cards);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>
          {translate('sandbox.title')}
          <Text style={styles.devLabel}> {translate('sandbox.devLabel')}</Text>
        </Text>
        <View style={styles.toolbarButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('sandbox.button.undo')}
            accessibilityState={{ disabled: history.length === 0 }}
            disabled={history.length === 0}
            onPress={() => state.undo()}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>{translate('sandbox.button.undo')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('sandbox.button.reset')}
            onPress={() => state.reset()}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>{translate('sandbox.button.reset')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.presetRow}>
        <Text style={styles.label}>{translate('sandbox.preset.label')}</Text>
        {SANDBOX_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityLabel={translate(preset.titleKey)}
            onPress={() => state.loadPreset(preset.id)}
            style={styles.presetButton}
          >
            <Text style={styles.presetText}>{translate(preset.titleKey)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.columns}>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{translate('sandbox.section.board')}</Text>

          <View style={styles.row}>
            <Text style={styles.label}>
              {translate('sandbox.dayNight.day')} / {translate('sandbox.dayNight.night')}
            </Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.dayNight === 'NIGHT' }}
              onPress={() =>
                state.editRound((round) =>
                  setDayNight(round, round.dayNight === 'DAY' ? 'NIGHT' : 'DAY'),
                )
              }
              style={styles.pill}
            >
              <Text style={styles.pillText}>
                {draft.dayNight === 'DAY'
                  ? translate('sandbox.dayNight.day')
                  : translate('sandbox.dayNight.night')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.playerCount')}</Text>
            {[2, 3, 4, 5, 6].map((count) => (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.players.length === count }}
                onPress={() => state.editRound((round) => setPlayerCount(round, count))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{count}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.activePlayer')}</Text>
            {draft.players.map((player) => (
              <Pressable
                key={player.playerId}
                accessibilityRole="button"
                accessibilityState={{ selected: player.playerId === draft.activePlayerId }}
                onPress={() => state.editRound((round) => setActivePlayer(round, player.playerId))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{player.playerId}</Text>
              </Pressable>
            ))}
          </View>

          {draft.players.map((player) => {
            const skill = player.skill;
            return (
              <View key={player.playerId} style={styles.playerRow}>
                <Text style={styles.playerId}>{player.playerId}</Text>
                <View style={styles.handWrap}>
                  {player.hand.map((cardEntry) => (
                    <Pressable
                      key={cardEntry.cardId}
                      accessibilityRole="button"
                      accessibilityLabel={`${translate('sandbox.hand')} ${rankNumber(cardEntry.rankCode)} ${SUIT_LABEL[cardEntry.suitCode]}`}
                      onPress={() =>
                        state.editRound((round) =>
                          removeCardFromHand(round, player.playerId, cardEntry.cardId),
                        )
                      }
                    >
                      <CardChip card={cardEntry} />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.statusWrap}>
                  {(['ACTIVE', 'PASSED', 'OUT'] as const).map((status) => (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      accessibilityState={{ selected: player.status === status }}
                      onPress={() =>
                        state.editRound((round) => setPlayerStatus(round, player.playerId, status))
                      }
                      style={styles.miniButton}
                    >
                      <Text style={styles.miniButtonText}>
                        {translate(`sandbox.status.${status}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.skillWrap}>
                  {(
                    [
                      null,
                      'SKILL_JOKER_HERO',
                      'SKILL_JOKER_SAINT',
                      'SKILL_EXTENSION_SEAL',
                      'SKILL_REVOLUTION',
                    ] as const
                  ).map((effect) => (
                    <Pressable
                      key={effect ?? 'none'}
                      accessibilityRole="button"
                      accessibilityState={{ selected: (skill?.effectCode ?? null) === effect }}
                      onPress={() =>
                        state.editRound((round) => setPlayerSkill(round, player.playerId, effect))
                      }
                      style={styles.miniButton}
                    >
                      <Text style={styles.miniButtonText}>
                        {effect
                          ? translate(`sandbox.skill.${effect}`)
                          : translate('sandbox.skill.none')}
                      </Text>
                    </Pressable>
                  ))}
                  {skill ? (
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityLabel={translate('sandbox.skill.used')}
                      accessibilityState={{ checked: skill.used }}
                      onPress={() =>
                        state.editRound((round) =>
                          setPlayerSkillUsed(round, player.playerId, !skill.used),
                        )
                      }
                      style={skill.used ? styles.pill : styles.miniButton}
                    >
                      <Text style={styles.miniButtonText}>
                        {translate('sandbox.skill.used')}
                        {skill.used ? ' ✓' : ''}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.field.label')}</Text>
            {draft.activeField ? (
              <>
                {draft.activeField.combination.cards.map((cardEntry) => (
                  <CardChip key={cardEntry.cardId} card={cardEntry} />
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={translate('sandbox.field.empty')}
                  onPress={() => state.editRound((round) => clearField(round))}
                  style={styles.miniButton}
                >
                  <Text style={styles.miniButtonText}>{translate('sandbox.field.empty')}</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.muted}>{translate('sandbox.field.empty')}</Text>
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.field.edit')}</Text>
            {fieldDraft.cards.map((cardEntry) => (
              <Pressable
                key={cardEntry.cardId}
                accessibilityRole="button"
                accessibilityLabel={`${translate('sandbox.field.edit')} ${rankNumber(cardEntry.rankCode)} ${SUIT_LABEL[cardEntry.suitCode]}`}
                onPress={() =>
                  state.setFieldDraftCards(
                    fieldDraft.cards.filter((entry) => entry.cardId !== cardEntry.cardId),
                  )
                }
              >
                <CardChip card={cardEntry} />
              </Pressable>
            ))}
            {fieldDraft.cards.length === 0 ? (
              <Text style={styles.muted}>{translate('sandbox.field.empty')}</Text>
            ) : null}
          </View>

          {fieldDraft.cards.length > 0 && !fieldDraftValid ? (
            <Text style={styles.illegal}>{translate('sandbox.field.invalid')}</Text>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.field.lastPlayer')}</Text>
            {draft.players.map((player) => (
              <Pressable
                key={player.playerId}
                accessibilityRole="button"
                accessibilityState={{ selected: fieldDraft.lastPlayerId === player.playerId }}
                onPress={() => state.setFieldDraftLastPlayer(player.playerId)}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{player.playerId}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.field.addCard')}</Text>
            {RANK_CODES.map((rankCode) =>
              SUIT_CODES.map((suitCode) => (
                <Pressable
                  key={`field_${rankCode}_${suitCode}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${translate('sandbox.field.addCard')} ${rankNumber(rankCode)} ${SUIT_LABEL[suitCode]}`}
                  onPress={() => {
                    const nextCard = makeSandboxCard(rankCode, suitCode);
                    state.setFieldDraftCards(
                      fieldDraft.cards.some((entry) => entry.cardId === nextCard.cardId)
                        ? fieldDraft.cards
                        : [...fieldDraft.cards, nextCard],
                    );
                  }}
                >
                  <CardChip card={makeSandboxCard(rankCode, suitCode)} />
                </Pressable>
              )),
            )}
          </View>

          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate('sandbox.field.commit')}
              accessibilityState={{ disabled: !fieldDraftValid }}
              disabled={!fieldDraftValid}
              onPress={() => state.commitFieldDraft()}
              style={fieldDraftValid ? styles.pill : styles.miniButton}
            >
              <Text style={styles.miniButtonText}>{translate('sandbox.field.commit')}</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.lock.label')}</Text>
            {[null, ...SUIT_CODES].map((suit) => (
              <Pressable
                key={suit ?? 'none'}
                accessibilityRole="button"
                accessibilityState={{ selected: (draft.lockedSuitCode ?? null) === suit }}
                onPress={() => state.editRound((round) => setLockedSuit(round, suit))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>
                  {suit ? SUIT_LABEL[suit] : translate('sandbox.lock.none')}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.seal.label')}</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.extensionSealed }}
              onPress={() =>
                state.editRound((round) => setExtensionSealed(round, !round.extensionSealed))
              }
              style={styles.pill}
            >
              <Text style={styles.pillText}>
                {draft.extensionSealed
                  ? translate('sandbox.seal.on')
                  : translate('sandbox.seal.off')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.consecutivePasses')}</Text>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityState={{ selected: draft.consecutivePasses === n }}
                onPress={() => state.editRound((round) => setConsecutivePasses(round, n))}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.addCard')}</Text>
            {draft.players.map((player) => (
              <Pressable
                key={player.playerId}
                accessibilityRole="button"
                accessibilityState={{ selected: addTarget === player.playerId }}
                onPress={() => setAddTargetPlayer(player.playerId)}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>{player.playerId}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>
              {translate('sandbox.addCard')} ({addTarget})
            </Text>
            {RANK_CODES.map((rankCode) =>
              SUIT_CODES.map((suitCode) => (
                <Pressable
                  key={`${rankCode}_${suitCode}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${translate('sandbox.addCard')} ${addTarget} ${rankNumber(rankCode)} ${SUIT_LABEL[suitCode]}`}
                  onPress={() =>
                    state.editRound((round) => addCardToHand(round, addTarget, rankCode, suitCode))
                  }
                >
                  <CardChip card={makeSandboxCard(rankCode, suitCode)} />
                </Pressable>
              )),
            )}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>{translate('sandbox.discard')}</Text>
            {draft.discardPile.map((cardEntry) => (
              <Pressable
                key={cardEntry.cardId}
                accessibilityRole="button"
                accessibilityLabel={`${translate('sandbox.discard')} ${rankNumber(cardEntry.rankCode)} ${SUIT_LABEL[cardEntry.suitCode]}`}
                onPress={() => state.editRound((round) => removeDiscard(round, cardEntry.cardId))}
              >
                <CardChip card={cardEntry} />
              </Pressable>
            ))}
            {draft.discardPile.length === 0 ? (
              <Text style={styles.muted}>{translate('sandbox.field.empty')}</Text>
            ) : null}
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>
              {translate('sandbox.discard')} {translate('sandbox.addCard')}
            </Text>
            {RANK_CODES.map((rankCode) =>
              SUIT_CODES.map((suitCode) => (
                <Pressable
                  key={`discard_${rankCode}_${suitCode}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${translate('sandbox.discard')} ${translate('sandbox.addCard')} ${rankNumber(rankCode)} ${SUIT_LABEL[suitCode]}`}
                  onPress={() =>
                    state.editRound((round) =>
                      addDiscard(round, makeSandboxCard(rankCode, suitCode)),
                    )
                  }
                >
                  <CardChip card={makeSandboxCard(rankCode, suitCode)} />
                </Pressable>
              )),
            )}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>
            {translate('sandbox.section.play')} ({draft.activePlayerId})
          </Text>

          <View style={styles.row}>
            {(['PLAY', 'PASS'] as const).map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected: playDraft.kind === kind }}
                onPress={() => state.setPlayDraft({ kind })}
                style={styles.miniButton}
              >
                <Text style={styles.miniButtonText}>
                  {kind === 'PLAY'
                    ? translate('sandbox.play.kind.play')
                    : translate('sandbox.play.kind.pass')}
                </Text>
              </Pressable>
            ))}
          </View>

          {playDraft.kind === 'PLAY' ? (
            <>
              <Text style={styles.label}>{translate('sandbox.play.selectCards')}</Text>
              <View style={styles.handWrap}>
                {activePlayer?.hand.map((cardEntry) => {
                  const selected = playDraft.cardIds.includes(cardEntry.cardId);
                  return (
                    <Pressable
                      key={cardEntry.cardId}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        state.setPlayDraft({
                          cardIds: selected
                            ? playDraft.cardIds.filter((id) => id !== cardEntry.cardId)
                            : [...playDraft.cardIds, cardEntry.cardId],
                        })
                      }
                      style={selected ? styles.selectedChipWrap : undefined}
                    >
                      <CardChip card={cardEntry} />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>{translate('sandbox.play.useSkill')}</Text>
              <View style={styles.row}>
                {(
                  [
                    undefined,
                    'EXTENSION_SEAL',
                    'REVOLUTION',
                    'JOKER_TRANSFORM',
                    'JOKER_CLEAR',
                  ] as const
                ).map((useSkill) => (
                  <Pressable
                    key={useSkill ?? 'none'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: playDraft.useSkill === useSkill }}
                    onPress={() => state.setPlayDraft({ useSkill })}
                    style={styles.miniButton}
                  >
                    <Text style={styles.miniButtonText}>
                      {useSkill
                        ? translate(`sandbox.play.useSkill.${useSkill}`)
                        : translate('sandbox.skill.none')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {playDraft.useSkill === 'JOKER_TRANSFORM' ? (
                <>
                  <Text style={styles.label}>{translate('sandbox.play.jokerDeclare')}</Text>
                  <View style={styles.row}>
                    {RANK_CODES.map((rankCode) => (
                      <Pressable
                        key={rankCode}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: playDraft.jokerDeclaration?.rankCode === rankCode,
                        }}
                        onPress={() =>
                          state.setPlayDraft({
                            jokerDeclaration: {
                              rankCode,
                              suitCode: playDraft.jokerDeclaration?.suitCode ?? 'SUIT_FIRE',
                            },
                          })
                        }
                        style={styles.miniButton}
                      >
                        <Text style={styles.miniButtonText}>{rankNumber(rankCode)}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.row}>
                    {SUIT_CODES.map((suitCode) => (
                      <Pressable
                        key={suitCode}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: playDraft.jokerDeclaration?.suitCode === suitCode,
                        }}
                        onPress={() =>
                          state.setPlayDraft({
                            jokerDeclaration: {
                              rankCode: playDraft.jokerDeclaration?.rankCode ?? 'RANK_1',
                              suitCode,
                            },
                          })
                        }
                        style={styles.miniButton}
                      >
                        <Text style={styles.miniButtonText}>{SUIT_LABEL[suitCode]}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('sandbox.play.run')}
            onPress={() => state.applyPlay()}
            style={styles.runButton}
          >
            <Text style={styles.runButtonText}>{translate('sandbox.play.run')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>{translate('sandbox.section.result')}</Text>
        {lastResult ? (
          <View style={styles.row}>
            <Text style={lastResult.ok ? styles.legal : styles.illegal}>
              {lastResult.ok
                ? translate('sandbox.result.legal')
                : translate('sandbox.result.illegal')}
            </Text>
            {lastResult.reasonKey ? (
              <Text style={styles.muted}>{translate(lastResult.reasonKey)}</Text>
            ) : null}
            {lastResult.actionKey ? (
              <Text style={styles.muted}>{translate(lastResult.actionKey)}</Text>
            ) : null}
            {lastResult.badges.map((badge) => (
              <Text key={badge} style={styles.badge}>
                {translate(`sandbox.badge.${badge}`)}
                {badge === 'winner' && lastResult.winnerId ? ` ${lastResult.winnerId}` : ''}
              </Text>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
        )}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>{translate('sandbox.section.history')}</Text>
        {history.length === 0 ? (
          <Text style={styles.muted}>{translate('sandbox.history.empty')}</Text>
        ) : (
          history.map((entry, index) => (
            <Text key={index} style={styles.muted}>
              {index + 1}.{' '}
              {entry.playDraft.kind === 'PASS'
                ? translate('sandbox.play.kind.pass')
                : translate('sandbox.play.kind.play')}
              {entry.view.actionKey ? ` · ${translate(entry.view.actionKey)}` : ''}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.table.day },
  content: { padding: spacing.lg, gap: spacing.md },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarButtons: { flexDirection: 'row', gap: spacing.sm },
  title: {
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  devLabel: { fontSize: typography.size.caption, color: colors.state.disabled },
  smallButton: {
    borderWidth: 1,
    borderColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  smallButtonText: { fontSize: typography.size.caption, color: colors.ink.primary },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  presetButton: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  presetText: { fontSize: typography.size.caption, color: colors.ink.secondary },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  panel: {
    flexGrow: 1,
    flexBasis: 320,
    backgroundColor: colors.surface.card.face,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  label: { fontSize: typography.size.caption, color: colors.ink.secondary },
  muted: { fontSize: typography.size.caption, color: colors.ink.secondary },
  playerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface.table.day,
    paddingTop: spacing.xs,
  },
  playerId: {
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
    width: 24,
  },
  handWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  statusWrap: { flexDirection: 'row', gap: spacing.xs },
  skillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    minWidth: 34,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.control,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.surface.card.face,
  },
  chipJoker: {
    position: 'absolute',
    top: -6,
    right: -6,
    fontSize: 9,
    fontWeight: typography.weight.bold,
    color: colors.ink.inverse,
    backgroundColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
  chipRank: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink.primary,
  },
  chipSuit: { fontSize: 10, color: colors.ink.secondary },
  selectedChipWrap: {
    borderWidth: 2,
    borderColor: colors.ink.primary,
    borderRadius: radius.control,
  },
  miniButton: {
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  miniButtonText: { fontSize: typography.size.caption, color: colors.ink.primary },
  pill: {
    borderWidth: 1,
    borderColor: colors.ink.primary,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillText: { fontSize: typography.size.caption, color: colors.ink.primary },
  runButton: {
    marginTop: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingVertical: spacing.sm,
  },
  runButtonText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink.inverse,
  },
  legal: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.suit.wind,
  },
  illegal: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.suit.fire,
  },
  badge: {
    fontSize: typography.size.caption,
    color: colors.ink.primary,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    paddingHorizontal: spacing.xs,
  },
});
