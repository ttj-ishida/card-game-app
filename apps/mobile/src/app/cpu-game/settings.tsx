import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useStore } from 'zustand/react';

import { spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';
import type { AnimationSpeed } from '../../features/cpu-game/cpuGameSettings';
import { cpuGameSettingsStore } from '../../state/cpuGameSettingsStore';
import { themeStore } from '../../state/themeStore';
import type { ThemePreference } from '../../features/theme/themePreference';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Chip, Panel, ScreenTitle } from '../../components';
import { translate } from '../../i18n/translate';

const SPEEDS: AnimationSpeed[] = ['FAST', 'NORMAL', 'SLOW'];
const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

export default function CpuGameSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const state = useStore(cpuGameSettingsStore, (s) => s);
  const themePreference = useStore(themeStore, (s) => s.preference);

  return (
    <AppBackground variant="universal">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenTitle title={translate('cpuGame.settings.title')} />
        {state.status === 'loading' ? (
          <Text style={styles.muted}>{translate('cpuGame.settings.loading')}</Text>
        ) : null}
        {state.status === 'failed' ? (
          <Text style={styles.error}>{translate('cpuGame.settings.failed')}</Text>
        ) : null}

        <Panel>
          <Text style={styles.label}>{translate('cpuGame.settings.theme')}</Text>
          <View style={styles.row}>
            {THEME_PREFERENCES.map((preference) => (
              <Chip
                key={preference}
                label={translate(`cpuGame.settings.theme.${preference}`)}
                selected={themePreference === preference}
                onPress={() => void themeStore.getState().setPreference(preference)}
              />
            ))}
          </View>
        </Panel>

        <Panel>
          <Text style={styles.label}>{translate('cpuGame.settings.animationSpeed')}</Text>
          <View style={styles.row}>
            {SPEEDS.map((speed) => (
              <Chip
                key={speed}
                label={translate(`cpuGame.settings.animationSpeed.${speed}`)}
                selected={state.settings.animationSpeed === speed}
                onPress={() => void cpuGameSettingsStore.getState().setAnimationSpeed(speed)}
              />
            ))}
          </View>
        </Panel>

        <Panel style={styles.panelRow}>
          <Text style={styles.label}>{translate('cpuGame.settings.lowMotion')}</Text>
          <Switch
            value={state.settings.lowMotion}
            onValueChange={(value) => void cpuGameSettingsStore.getState().setLowMotion(value)}
          />
        </Panel>
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { gap: spacing.md, padding: spacing.lg },
    panelRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    label: {
      color: c.ink.primary,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
    muted: { color: c.ink.secondary, fontSize: typography.size.caption },
    error: {
      color: c.suit.fire,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
  });
