// M4-EX-02: HTTPS 招待リンクの着地点（`/join?code=CODE`）。
//
// - ネイティブアプリ内 / デスクトップ Web  → そのまま参加画面へ
//   （ネイティブは通常 +native-intent が先に処理する）
// - スマホのブラウザ（＝アプリ未導入の可能性大）→ Store 案内・アプリで開く・
//   ブラウザで参加 を提示

import { useMemo } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { spacing, typography, type ThemeColors } from '@ragnarok-millennium/ui';

import { translate } from '../i18n/translate';
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  buildInviteAppLink,
  parseInviteFromLink,
  resolveJoinTarget,
} from '../features/online-room/inviteLink';
import { AppBackground } from '../features/theme/AppBackground';
import { useThemedStyles } from '../features/theme/ThemeProvider';
import { Button, ScreenTitle } from '../components';

export default function JoinInviteScreen() {
  const styles = useThemedStyles(makeStyles);
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
    <AppBackground variant="universal">
      <View style={styles.screen}>
        <ScreenTitle title={translate('onlineRoom.join.title')} />

        {code ? (
          <>
            <Text style={styles.codeLabel}>{translate('onlineRoom.join.codeLabel')}</Text>
            <Text style={styles.code}>{code}</Text>
          </>
        ) : (
          <Text style={styles.muted}>{translate('onlineRoom.error.inviteRequired')}</Text>
        )}

        {storeUrl ? (
          <Button
            label={
              target.store === 'ios'
                ? translate('onlineRoom.join.getAppIos')
                : translate('onlineRoom.join.getAppAndroid')
            }
            onPress={() => void Linking.openURL(storeUrl)}
          />
        ) : (
          <Text style={styles.muted}>{translate('onlineRoom.join.iosComingSoon')}</Text>
        )}

        {code ? (
          <Button
            variant="secondary"
            label={translate('onlineRoom.join.openApp')}
            onPress={() => void Linking.openURL(buildInviteAppLink(code))}
          />
        ) : null}

        {code ? (
          <Button
            variant="ghost"
            label={translate('onlineRoom.join.playOnWeb')}
            onPress={() => router.replace(`/online-room?invite=${code}`)}
          />
        ) : null}

        <Text style={styles.muted}>{translate('onlineRoom.join.hint')}</Text>
      </View>
    </AppBackground>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.xl,
    },
    codeLabel: { color: c.ink.secondary, fontSize: typography.size.body },
    code: {
      color: c.ink.primary,
      fontSize: 32,
      fontWeight: typography.weight.bold,
      letterSpacing: 2,
    },
    muted: { color: c.ink.secondary, fontSize: typography.size.caption, textAlign: 'center' },
  });
