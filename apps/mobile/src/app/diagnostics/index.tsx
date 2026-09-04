import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand/react';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

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
import { translate } from '../../i18n/translate';

export default function DiagnosticsScreen() {
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{translate('diagnostics.title')}</Text>
      <Text style={styles.muted}>{translate('diagnostics.subtitle')}</Text>

      {!view.syncConfigured ? (
        <Text style={styles.warn}>{translate('diagnostics.notConfigured')}</Text>
      ) : null}

      <View style={styles.panel}>
        {view.rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.value} selectable>
              {r.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onTestConnection}
          style={[styles.button, busy && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {busy ? translate('diagnostics.working') : translate('diagnostics.testConnection')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onFlush}
          style={[styles.button, busy && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {busy ? translate('diagnostics.working') : translate('diagnostics.flushNow')}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.table.day },
  content: { gap: spacing.md, padding: spacing.lg },
  title: {
    color: colors.ink.primary,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
  },
  muted: { color: colors.ink.secondary, fontSize: typography.size.caption },
  warn: {
    color: colors.suit.fire,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  panel: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.state.disabled,
    borderRadius: radius.control,
    backgroundColor: colors.surface.card.face,
    padding: spacing.md,
  },
  row: { gap: 2 },
  label: {
    color: colors.ink.secondary,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
  },
  value: { color: colors.ink.primary, fontSize: typography.size.body },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  button: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.ink.primary,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.ink.primary, fontSize: typography.size.body },
});
