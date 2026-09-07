import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand/react';

import { spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { getOptionalAppConfig } from '../../config/appEnv';
import { httpPort, makeId, storagePort } from '../../features/cpu-game/cpuGameAdapters';
import { readQueueCount } from '../../features/cpu-game/practiceResultQueue';
import { getAnonPlayerId } from '../../features/cpu-game/anonPlayerId';
import {
  checkSupabaseConnection,
  type ConnectionCheckResult,
} from '../../features/diagnostics/connectionCheck';
import { buildDiagnosticsView } from '../../features/diagnostics/diagnosticsViewModel';
import { syncDiagnosticsStore } from '../../features/diagnostics/syncDiagnosticsStore';
import { cpuGameStore } from '../../state/cpuGameStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Button, Panel, ScreenTitle } from '../../components';
import { translate } from '../../i18n/translate';

export default function DiagnosticsScreen() {
  const styles = useThemedStyles(makeStyles);
  const diag = useStore(syncDiagnosticsStore, (s) => s);
  const [queueCount, setQueueCount] = useState(0);
  const [anonPlayerId, setAnonPlayerId] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionCheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const config = getOptionalAppConfig();

  useEffect(() => {
    let active = true;
    readQueueCount(storagePort)
      .then((n) => {
        if (active) setQueueCount(n);
      })
      .catch(() => {
        if (active) setQueueCount(0);
      });
    getAnonPlayerId({ storage: storagePort, makeId })
      .then((id) => {
        if (active) setAnonPlayerId(id);
      })
      .catch(() => {
        if (active) setAnonPlayerId(null);
      });
    const timer = setInterval(() => {
      if (active) setNowMs(Date.now());
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const refreshQueueCount = () => {
    readQueueCount(storagePort)
      .then(setQueueCount)
      .catch(() => setQueueCount(0));
  };

  const onFlush = () => {
    setBusy(true);
    cpuGameStore
      .getState()
      .flushQueue()
      .finally(() => {
        refreshQueueCount();
        setNowMs(Date.now());
        setBusy(false);
      });
  };

  const onTestConnection = () => {
    setBusy(true);
    checkSupabaseConnection({
      http: httpPort,
      supabaseUrl: config?.supabaseUrl ?? '',
      anonKey: config?.supabaseAnonKey ?? '',
    })
      .then((result) => {
        setConnection(result);
        setNowMs(Date.now());
      })
      .finally(() => setBusy(false));
  };

  const view = buildDiagnosticsView({
    config: config
      ? {
          appEnv: config.appEnv,
          supabaseUrl: config.supabaseUrl,
          anonKeyConfigured: config.supabaseAnonKey.length > 0,
        }
      : null,
    diag: {
      lastRequest: diag.lastRequest,
      lastError: diag.lastError,
      lastSave: diag.lastSave,
      lastFlush: diag.lastFlush,
    },
    queueCount,
    anonPlayerId,
    connection,
    nowMs,
  });

  return (
    <AppBackground variant="universal">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenTitle
          title={translate('diagnostics.title')}
          subtitle={translate('diagnostics.subtitle')}
        />

        {!view.syncConfigured ? (
          <Text style={styles.warn}>{translate('diagnostics.notConfigured')}</Text>
        ) : null}

        <Panel>
          {view.rows.map((r) => (
            <View key={r.label} style={styles.row}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={styles.value} selectable>
                {r.value}
              </Text>
            </View>
          ))}
        </Panel>

        <View style={styles.actions}>
          <Button
            label={
              busy ? translate('diagnostics.working') : translate('diagnostics.testConnection')
            }
            disabled={busy}
            onPress={onTestConnection}
          />
          <Button
            label={busy ? translate('diagnostics.working') : translate('diagnostics.flushNow')}
            variant="secondary"
            disabled={busy}
            onPress={onFlush}
          />
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { gap: spacing.md, padding: spacing.lg },
    warn: {
      color: c.suit.fire,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
    row: { gap: 2 },
    label: {
      color: c.ink.secondary,
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
    },
    value: { color: c.ink.primary, fontSize: typography.size.body },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  });
