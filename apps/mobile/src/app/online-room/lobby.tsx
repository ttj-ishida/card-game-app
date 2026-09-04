import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand/react';

import { colors, radius, spacing, typography } from '@card-game-app/ui';

import { translate, type TranslationKey } from '../../i18n/translate';
import type { OnlineRoomSeat } from '../../features/online-room/onlineRoomClient';
import { onlineRoomStore } from '../../state/onlineRoomStore';

function roleKey(role: OnlineRoomSeat['role']): TranslationKey {
  return ('onlineRoom.role.' + role) as TranslationKey;
}

function statusKey(status: OnlineRoomSeat['status']): TranslationKey {
  return ('onlineRoom.status.' + status) as TranslationKey;
}

export default function OnlineRoomLobbyScreen() {
  const router = useRouter();
  const state = useStore(onlineRoomStore, (s) => s);
  const room = state.room;
  const busy = ['loading', 'starting'].includes(state.status);

  useEffect(() => {
    if (!room) router.replace('/online-room');
  }, [room, router]);

  if (!room) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.muted}>{translate('onlineRoom.lobby.empty')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{translate('onlineRoom.lobby.title')}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{translate('onlineRoom.lobby.invite')}</Text>
        <Text style={styles.inviteCode}>{room.inviteCode}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{translate('onlineRoom.lobby.settings')}</Text>
        <Text style={styles.line}>
          {translate('onlineRoom.players')}: {room.seats.length}/{room.maxPlayers}
        </Text>
        <Text style={styles.line}>
          {translate('onlineRoom.turnSeconds')}: {room.turnSeconds}
        </Text>
        <Text style={styles.line}>
          {translate('onlineRoom.cpuTakeover')}: {room.cpuTakeoverEnabled ? 'ON' : 'OFF'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{translate('onlineRoom.lobby.seats')}</Text>
        {room.seats.map((seat) => (
          <View key={seat.playerId} style={styles.seatRow}>
            <Text style={styles.seatIndex}>{seat.seatIndex + 1}</Text>
            <Text style={styles.line}>{translate(roleKey(seat.role))}</Text>
            <Text style={styles.muted}>{translate(statusKey(seat.status))}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void onlineRoomStore.getState().refreshRoom()}
          style={[styles.secondaryButton, busy && styles.disabled]}
        >
          <Text style={styles.secondaryText}>{translate('onlineRoom.lobby.refresh')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void onlineRoomStore.getState().startRound()}
          style={[styles.primaryButton, busy && styles.disabled]}
        >
          <Text style={styles.primaryText}>{translate('onlineRoom.lobby.start')}</Text>
        </Pressable>
      </View>

      {state.status === 'started' ? (
        <Text style={styles.muted}>
          {translate('onlineRoom.lobby.started')} {state.roundId}
        </Text>
      ) : null}
      {busy ? <Text style={styles.muted}>{translate('onlineRoom.loading')}</Text> : null}
      {state.errorMessageKey ? (
        <Text style={styles.error}>{translate(state.errorMessageKey)}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flexGrow: 1, gap: spacing.md, padding: spacing.xl },
  title: {
    color: colors.ink.primary,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
  },
  section: { gap: spacing.xs },
  label: { color: colors.ink.secondary, fontSize: typography.size.body },
  inviteCode: {
    color: colors.ink.primary,
    fontSize: 28,
    fontWeight: typography.weight.bold,
    letterSpacing: 0,
  },
  line: { color: colors.ink.primary, fontSize: typography.size.body },
  muted: { color: colors.ink.secondary, fontSize: typography.size.caption },
  seatRow: {
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  seatIndex: {
    color: '#f8fafc',
    backgroundColor: '#166534',
    borderRadius: radius.control,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
    minWidth: 28,
    padding: spacing.xs,
    textAlign: 'center',
  },
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
