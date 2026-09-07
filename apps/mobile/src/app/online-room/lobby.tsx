import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useStore } from 'zustand/react';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { translate, type TranslationKey } from '../../i18n/translate';
import { buildInviteWebLink } from '../../features/online-room/inviteLink';
import type { OnlineRoomSeat } from '../../features/online-room/onlineRoomClient';
import { onlineRoomStore } from '../../state/onlineRoomStore';
import { onlineRoundStore } from '../../state/onlineRoundStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';
import { Button, ScreenTitle } from '../../components';

function roleKey(role: OnlineRoomSeat['role']): TranslationKey {
  return ('onlineRoom.role.' + role) as TranslationKey;
}

function statusKey(status: OnlineRoomSeat['status']): TranslationKey {
  return ('onlineRoom.status.' + status) as TranslationKey;
}

export default function OnlineRoomLobbyScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const state = useStore(onlineRoomStore, (s) => s);
  const room = state.room;
  const roomId = room?.roomId;
  const busy = ['loading', 'starting'].includes(state.status);
  const isHost =
    !!state.myPlayerId && room?.seats.find((s) => s.playerId === state.myPlayerId)?.role === 'HOST';

  useEffect(() => {
    if (!room) router.replace('/online-room');
  }, [room, router]);

  // ロビー滞在中は 1 秒間隔でルームを更新する。参加者の増減が自動で反映され、
  // ホストが対局を開始すると status が 'started' になって下の useEffect が
  // ゲスト側も対局画面へ遷移させる。
  useEffect(() => {
    if (!roomId || state.status === 'started') return;
    const timer = setInterval(() => {
      void onlineRoomStore.getState().pollRoom();
    }, 1000);
    return () => clearInterval(timer);
  }, [roomId, state.status]);

  // 対局が成立したら onlineRoundStore を起動して対局画面へ遷移する。
  useEffect(() => {
    if (state.status !== 'started' || !state.roundId) return;
    let cancelled = false;
    onlineRoundStore
      .getState()
      .start(state.roundId)
      .finally(() => {
        if (!cancelled) router.replace('/online-room/play');
      });
    return () => {
      cancelled = true;
    };
  }, [state.status, state.roundId, router]);

  if (!room) {
    return (
      <AppBackground variant="home">
        <View style={[styles.screen, styles.content]}>
          <Text style={styles.muted}>{translate('onlineRoom.lobby.empty')}</Text>
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground variant="home">
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenTitle title={translate('onlineRoom.lobby.title')} />

        <View style={styles.section}>
          <Text style={styles.label}>{translate('onlineRoom.lobby.invite')}</Text>
          <Text style={styles.inviteCode}>{room.inviteCode}</Text>
          <Button
            variant="secondary"
            label={translate('onlineRoom.lobby.share')}
            onPress={() => {
              const link = buildInviteWebLink(room.inviteCode);
              void Share.share({
                message: `${translate('onlineRoom.invite.shareLead')}\n${link}`,
              });
            }}
          />
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
          <Button
            variant="secondary"
            label={translate('onlineRoom.lobby.refresh')}
            disabled={busy}
            onPress={() => void onlineRoomStore.getState().refreshRoom()}
          />
          {isHost ? (
            <Button
              label={translate('onlineRoom.lobby.start')}
              disabled={busy}
              onPress={() => void onlineRoomStore.getState().startRound()}
            />
          ) : (
            <Text style={styles.muted}>{translate('onlineRoom.lobby.waitingHost')}</Text>
          )}
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
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { flexGrow: 1, gap: spacing.md, padding: spacing.xl },
    section: { gap: spacing.xs },
    label: { color: c.ink.secondary, fontSize: typography.size.body },
    inviteCode: {
      color: c.ink.primary,
      fontSize: 28,
      fontWeight: typography.weight.bold,
      letterSpacing: 0,
    },
    line: { color: c.ink.primary, fontSize: typography.size.body },
    muted: { color: c.ink.secondary, fontSize: typography.size.caption },
    seatRow: {
      alignItems: 'center',
      backgroundColor: c.surface.card.face,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    seatIndex: {
      color: c.ink.inverse,
      backgroundColor: c.suit.wind,
      borderRadius: radius.control,
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      minWidth: 28,
      padding: spacing.xs,
      textAlign: 'center',
    },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    error: { color: c.suit.fire, fontSize: typography.size.caption },
  });
