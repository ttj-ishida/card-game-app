// M4-EX-02: HTTPS 招待リンクの着地点（`/join?code=CODE`）。
//
// - ネイティブアプリ内 / デスクトップ Web  → そのまま参加画面へ
//   （ネイティブは通常 +native-intent が先に処理する）
// - スマホのブラウザ（＝アプリ未導入の可能性大）→ Store 案内・アプリで開く・
//   ブラウザで参加 を提示

import { useMemo } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@ragnarok-millennium/ui';

import { translate } from '../i18n/translate';
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  buildInviteAppLink,
  parseInviteFromLink,
  resolveJoinTarget,
} from '../features/online-room/inviteLink';

export default function JoinInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = raw ? parseInviteFromLink(`/join?code=${raw}`) : null;

  const target = useMemo(
    () =>
      resolveJoinTarget({
        platformOS: Platform.OS,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        code,
      }),
    [code],
  );

  if (target.kind === 'app') {
    return <Redirect href={target.href} />;
  }

  const storeUrl = target.store === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{translate('onlineRoom.join.title')}</Text>

      {code ? (
        <>
          <Text style={styles.codeLabel}>{translate('onlineRoom.join.codeLabel')}</Text>
          <Text style={styles.code}>{code}</Text>
        </>
      ) : (
        <Text style={styles.muted}>{translate('onlineRoom.error.inviteRequired')}</Text>
      )}

      {storeUrl ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(storeUrl)}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            {target.store === 'ios'
              ? translate('onlineRoom.join.getAppIos')
              : translate('onlineRoom.join.getAppAndroid')}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.muted}>{translate('onlineRoom.join.iosComingSoon')}</Text>
      )}

      {code ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(buildInviteAppLink(code))}
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>{translate('onlineRoom.join.openApp')}</Text>
        </Pressable>
      ) : null}

      {code ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace(`/online-room?invite=${code}`)}
          style={styles.link}
        >
          <Text style={styles.linkText}>{translate('onlineRoom.join.playOnWeb')}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.muted}>{translate('onlineRoom.join.hint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: '#f8fafc',
  },
  title: {
    color: colors.ink.primary,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
  },
  codeLabel: { color: colors.ink.secondary, fontSize: typography.size.body },
  code: {
    color: colors.ink.primary,
    fontSize: 32,
    fontWeight: typography.weight.bold,
    letterSpacing: 2,
  },
  muted: { color: colors.ink.secondary, fontSize: typography.size.caption, textAlign: 'center' },
  primary: {
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
  secondary: {
    borderColor: '#166534',
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryText: {
    color: '#166534',
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
  link: { paddingVertical: spacing.xs },
  linkText: {
    color: colors.ink.secondary,
    fontSize: typography.size.caption,
    textDecorationLine: 'underline',
  },
});
