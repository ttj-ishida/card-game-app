import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand';

import { spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { cpuGameStore } from '../../state/cpuGameStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Button } from '../../components';
import { translate } from '../../i18n/translate';

export default function CpuGameResultScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const state = useStore(cpuGameStore, (s) => s);
  const { result, saveStatus } = state;

  useEffect(() => {
    if (!result) router.replace('/cpu-game/setup');
  }, [result, router]);

  if (!result) {
    return (
      <AppBackground variant="universal">
        <View style={[styles.screen, styles.content]}>
          <Text style={styles.muted}>{translate('cpuGame.result.title')}</Text>
        </View>
      </AppBackground>
    );
  }

  const durationSec = Math.round(result.durationMs / 1000);
  const saveText =
    saveStatus === 'saved' || saveStatus === 'duplicate'
      ? translate('cpuGame.result.saveOk')
      : saveStatus === 'queued'
        ? translate('cpuGame.result.saveQueued')
        : saveStatus === 'failed'
          ? translate('cpuGame.result.saveFailed')
          : null;

  return (
    <AppBackground variant="universal">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>
          {result.localWon
            ? translate('cpuGame.result.youWin')
            : translate('cpuGame.result.youLose')}
        </Text>

        <Text style={styles.line}>
          {translate('cpuGame.result.winnerIs')}: {translate(result.winnerNameKey)}
        </Text>
        <Text style={styles.line}>
          {translate('cpuGame.result.turns')}: {result.turnCount}
        </Text>
        <Text style={styles.line}>
          {translate('cpuGame.result.duration')}: {durationSec}
          {translate('cpuGame.result.durationSuffix')}
        </Text>
        {saveText ? <Text style={styles.muted}>{saveText}</Text> : null}

        <View style={styles.actions}>
          <Button
            label={translate('cpuGame.result.rematch')}
            minWidth={140}
            onPress={() => {
              cpuGameStore.getState().rematch();
              router.replace('/cpu-game/play');
            }}
          />
          <Button
            label={translate('cpuGame.result.home')}
            variant="secondary"
            minWidth={140}
            onPress={() => {
              cpuGameStore.getState().exit();
              router.replace('/');
            }}
          />
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.xl,
    },
    heading: {
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold,
      color: c.ink.primary,
    },
    line: { fontSize: typography.size.body, color: c.ink.primary },
    muted: { fontSize: typography.size.caption, color: c.ink.secondary },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  });
