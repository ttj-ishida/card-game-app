import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand/react';

import { radius, spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { translate } from '../../i18n/translate';
import { parseInviteFromLink } from '../../features/online-room/inviteLink';
import { onlineRoomStore } from '../../state/onlineRoomStore';
import { AppBackground } from '../../features/theme/AppBackground';
import { useThemedStyles } from '../../features/theme/ThemeProvider';

const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const TURN_SECONDS = [30, 60, 90];

export default function OnlineRoomScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const state = useStore(onlineRoomStore, (s) => s);
  const params = useLocalSearchParams<{ invite?: string }>();
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [turnSeconds, setTurnSeconds] = useState(60);
  const [cpuTakeoverEnabled, setCpuTakeoverEnabled] = useState(true);
  const busy = ['creating', 'joining', 'loading'].includes(state.status);

  // 招待リンク（+native-intent 経由）で来たら招待コード欄を埋める。
  const appliedInvite = useRef<string | null>(null);
  useEffect(() => {
    const raw = Array.isArray(params.invite) ? params.invite[0] : params.invite;
    const code = raw ? parseInviteFromLink(`/join/${raw}`) : null;
    if (code && appliedInvite.current !== code) {
      appliedInvite.current = code;
      onlineRoomStore.getState().setInviteCode(code);
    }
  }, [params.invite]);

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
    <AppBackground variant="home">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{translate('onlineRoom.title')}</Text>
        <Text style={styles.muted}>{translate('onlineRoom.subtitle')}</Text>

        <View style={styles.section}>
          <Text style={styles.label}>{translate('onlineRoom.inviteCode')}</Text>
          <TextInput
            accessibilityLabel={translate('onlineRoom.inviteCode')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
            editable={!busy}
            onChangeText={state.setInviteCode}
            placeholder={translate('onlineRoom.invitePlaceholder')}
            placeholderTextColor={styles.placeholder.color}
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
      </ScrollView>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: {
      flexGrow: 1,
      gap: spacing.md,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    title: {
      color: c.ink.primary,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold,
    },
    muted: { color: c.ink.secondary, fontSize: typography.size.caption },
    section: { gap: spacing.xs },
    label: { color: c.ink.secondary, fontSize: typography.size.body },
    placeholder: { color: c.ink.secondary },
    input: {
      backgroundColor: c.surface.card.face,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      borderWidth: 1,
      color: c.ink.primary,
      fontSize: typography.size.body,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      backgroundColor: c.surface.card.face,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      borderWidth: 1,
      minWidth: 48,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipSelected: {
      backgroundColor: c.surface.card.face,
      borderColor: c.suit.wind,
      borderWidth: 2,
    },
    chipText: { color: c.ink.secondary, fontSize: typography.size.body, textAlign: 'center' },
    chipTextSelected: { color: c.ink.primary, fontWeight: typography.weight.bold },
    switchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    switchTrack: {
      backgroundColor: c.state.disabled,
      borderRadius: radius.control,
      height: 28,
      justifyContent: 'center',
      padding: 3,
      width: 52,
    },
    switchOn: { backgroundColor: c.suit.wind },
    switchThumb: {
      backgroundColor: c.ink.inverse,
      borderRadius: 11,
      height: 22,
      width: 22,
    },
    switchThumbOn: { alignSelf: 'flex-end' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    primaryButton: {
      backgroundColor: c.suit.wind,
      borderRadius: radius.control,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    primaryText: {
      color: c.ink.inverse,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
    secondaryButton: {
      backgroundColor: c.surface.card.face,
      borderColor: c.state.disabled,
      borderRadius: radius.control,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    secondaryText: {
      color: c.ink.primary,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
    },
    disabled: { opacity: 0.5 },
    error: { color: c.suit.fire, fontSize: typography.size.caption },
  });
