import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand/react';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

import { translate } from '../../i18n/translate';
import { onlineRoomStore } from '../../state/onlineRoomStore';

const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const TURN_SECONDS = [30, 60, 90];

export default function OnlineRoomScreen() {
  const router = useRouter();
  const state = useStore(onlineRoomStore, (s) => s);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnSeconds, setTurnSeconds] = useState(60);
  const [cpuTakeoverEnabled, setCpuTakeoverEnabled] = useState(true);
  const busy = ['creating', 'joining', 'loading'].includes(state.status);

  const goLobby = () => router.push('/online-room/lobby');

  const create = async () => {
    await onlineRoomStore.getState().createRoom({ maxPlayers, turnSeconds, cpuTakeoverEnabled });
    if (onlineRoomStore.getState().room) goLobby();
  };

  const join = async () => {
    await onlineRoomStore.getState().joinRoom();
    if (onlineRoomStore.getState().room) goLobby();
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{translate('onlineRoom.title')}</Text>
      <Text style={styles.muted}>{translate('onlineRoom.subtitle')}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{translate('onlineRoom.inviteCode')}</Text>
        <TextInput
          accessibilityLabel={translate('onlineRoom.inviteCode')}
          autoCapitalize="characters"
          editable={!busy}
          onChangeText={state.setInviteCode}
          placeholder={translate('onlineRoom.invitePlaceholder')}
          style={styles.input}
          value={state.inviteCode}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{translate('onlineRoom.players')}</Text>
        <View style={styles.row}>
          {PLAYER_COUNTS.map((value) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: maxPlayers === value }}
              disabled={busy}
              key={value}
              onPress={() => setMaxPlayers(value)}
              style={[styles.chip, maxPlayers === value && styles.chipSelected]}
            >
              <Text style={[styles.chipText, maxPlayers === value && styles.chipTextSelected]}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{translate('onlineRoom.turnSeconds')}</Text>
        <View style={styles.row}>
          {TURN_SECONDS.map((value) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: turnSeconds === value }}
              disabled={busy}
              key={value}
              onPress={() => setTurnSeconds(value)}
              style={[styles.chip, turnSeconds === value && styles.chipSelected]}
            >
              <Text style={[styles.chipText, turnSeconds === value && styles.chipTextSelected]}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: cpuTakeoverEnabled }}
        disabled={busy}
        onPress={() => setCpuTakeoverEnabled((v) => !v)}
        style={styles.switchRow}
      >
        <View style={[styles.switchTrack, cpuTakeoverEnabled && styles.switchOn]}>
          <View style={[styles.switchThumb, cpuTakeoverEnabled && styles.switchThumbOn]} />
        </View>
        <Text style={styles.label}>{translate('onlineRoom.cpuTakeover')}</Text>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={create}
          style={[styles.primaryButton, busy && styles.disabled]}
        >
          <Text style={styles.primaryText}>{translate('onlineRoom.create')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={join}
          style={[styles.secondaryButton, busy && styles.disabled]}
        >
          <Text style={styles.secondaryText}>{translate('onlineRoom.join')}</Text>
        </Pressable>
      </View>

      {busy ? <Text style={styles.muted}>{translate('onlineRoom.loading')}</Text> : null}
      {state.errorMessageKey ? (
        <Text style={styles.error}>{translate(state.errorMessageKey)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: '#f8fafc',
  },
  title: {
    color: colors.ink.primary,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
  },
  muted: { color: colors.ink.secondary, fontSize: typography.size.caption },
  section: { gap: spacing.xs },
  label: { color: colors.ink.secondary, fontSize: typography.size.body },
  input: {
    borderColor: '#cbd5e1',
    borderRadius: radius.control,
    borderWidth: 1,
    color: colors.ink.primary,
    fontSize: typography.size.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderColor: '#cbd5e1',
    borderRadius: radius.control,
    borderWidth: 1,
    minWidth: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { backgroundColor: '#dcfce7', borderColor: '#166534' },
  chipText: { color: colors.ink.secondary, fontSize: typography.size.body, textAlign: 'center' },
  chipTextSelected: { color: colors.ink.primary, fontWeight: typography.weight.bold },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  switchTrack: {
    backgroundColor: '#cbd5e1',
    borderRadius: radius.control,
    height: 28,
    justifyContent: 'center',
    padding: 3,
    width: 52,
  },
  switchOn: { backgroundColor: '#166534' },
  switchThumb: {
    backgroundColor: '#f8fafc',
    borderRadius: 11,
    height: 22,
    width: 22,
  },
  switchThumbOn: { alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  primaryButton: {
    backgroundColor: '#166534',
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryText: {
    color: '#f8fafc',
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  secondaryButton: {
    borderColor: '#cbd5e1',
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryText: {
    color: colors.ink.primary,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  disabled: { opacity: 0.5 },
  error: { color: colors.suit.fire, fontSize: typography.size.caption },
});
