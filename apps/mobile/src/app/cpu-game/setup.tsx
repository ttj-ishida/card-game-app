import { useState } from 'react';
import { useStore } from 'zustand/react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { isValidTotalPlayers, MAX_PLAYERS, MIN_PLAYERS } from '../../features/cpu-game/matchConfig';
import { cpuGameStore } from '../../state/cpuGameStore';
import { cpuGameTutorialStore } from '../../state/cpuGameTutorialStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Button, Chip, ScreenTitle } from '../../components';
import { translate } from '../../i18n/translate';

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export default function CpuGameSetupScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [count, setCount] = useState(MIN_PLAYERS);
  const [startError, setStartError] = useState<string | null>(null);
  const canStart = isValidTotalPlayers(count);
  const tutorial = useStore(cpuGameTutorialStore, (s) => s.progress);

  const start = () => {
    if (!canStart) return;
    try {
      cpuGameStore.getState().startMatch(count);
      router.replace('/cpu-game/play');
    } catch {
      // The store is unconfigured (missing EXPO_PUBLIC_* env). Degrade like the
      // play/result screens rather than throwing out of this event handler.
      setStartError(translate('cpuGame.setup.notReady'));
    }
  };

  return (
    <AppBackground variant="universal">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenTitle title={translate('cpuGame.setup.title')} />

        <Text style={styles.label}>{translate('cpuGame.setup.players')}</Text>
        <View style={styles.row}>
          {COUNTS.map((value) => (
            <Chip
              key={value}
              label={String(value)}
              selected={value === count}
              onPress={() => setCount(value)}
            />
          ))}
        </View>

        <Button
          label={translate('cpuGame.setup.start')}
          onPress={start}
          disabled={!canStart}
          minWidth={180}
        />

        {startError ? <Text style={styles.error}>{startError}</Text> : null}

        {!tutorial.completed ? (
          <Button
            label={translate('cpuGame.tutorial.recommended')}
            variant="secondary"
            onPress={() => router.push('/cpu-game/tutorial')}
          />
        ) : null}

        <View style={styles.menuRow}>
          <Button
            label={translate('cpuGame.menu.history')}
            variant="ghost"
            onPress={() => router.push('/cpu-game/history')}
          />
          <Button
            label={translate('cpuGame.menu.stats')}
            variant="ghost"
            onPress={() => router.push('/cpu-game/stats')}
          />
          <Button
            label={translate('cpuGame.menu.tutorial')}
            variant="ghost"
            onPress={() => router.push('/cpu-game/tutorial')}
          />
          <Button
            label={translate('cpuGame.menu.settings')}
            variant="ghost"
            onPress={() => router.push('/cpu-game/settings')}
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
      gap: spacing.lg,
      padding: spacing.xl,
    },
    label: { fontSize: typography.size.body, color: c.ink.secondary },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
    menuRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
    error: { fontSize: typography.size.caption, color: c.suit.fire, textAlign: 'center' },
  });
