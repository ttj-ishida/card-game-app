// M4-EX-02: HTTPS 招待リンクの着地点。
// ネイティブでは +native-intent が先に /online-room?invite= へ飛ばすので、
// このルートが実際に描画されるのは Web（未導入端末・PC）と保険のリダイレクト。

import { Redirect, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@ragnarok-millennium/ui';

import { translate } from '../../i18n/translate';
import { buildInviteAppLink, parseInviteFromLink } from '../../features/online-room/inviteLink';

// 未公開のため仮。公開後に Google Play の URL へ差し替える。
const STORE_URL = 'https://play.google.com/store/apps';

export default function JoinInviteScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = raw ? parseInviteFromLink(`/join/${raw}`) : null;

  if (Platform.OS !== 'web') {
    return <Redirect href={code ? `/online-room?invite=${code}` : '/online-room'} />;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{translate('onlineRoom.join.title')}</Text>
      {code ? (
        <>
          <Text style={styles.codeLabel}>{translate('onlineRoom.join.codeLabel')}</Text>
          <Text style={styles.code}>{code}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(buildInviteAppLink(code))}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>{translate('onlineRoom.join.openApp')}</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.muted}>{translate('onlineRoom.error.inviteRequired')}</Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => void Linking.openURL(STORE_URL)}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>{translate('onlineRoom.join.getApp')}</Text>
      </Pressable>
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
});
