import { useEffect, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import { spacing, typography } from '@ragnarok-millennium/ui';

import { getOptionalAppConfig } from '../config/appEnv';
import { useTheme } from '../features/theme/ThemeProvider';
import { translate } from '../i18n/translate';
import { ACCENT } from './buttonStyle';
import { NAV_ITEMS, visibleNavItems } from './navItems';

const PANEL_WIDTH = 280;

export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [translateX] = useState(() => new Animated.Value(-PANEL_WIDTH));
  const isProduction = getOptionalAppConfig()?.appEnv === 'production';
  const items = visibleNavItems(NAV_ITEMS, isProduction);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -PANEL_WIDTH,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, translateX]);

  const go = (href: string) => {
    onClose();
    router.replace(href as never);
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={translate('nav.close')}
        style={styles.backdrop}
        onPress={onClose}
      />
      <Animated.View
        style={[
          styles.panel,
          { backgroundColor: colors.surface.card.back, transform: [{ translateX }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink.primary }]}>
            {translate('nav.menuTitle')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('nav.close')}
            onPress={onClose}
          >
            <Text style={[styles.close, { color: colors.ink.secondary }]}>✕</Text>
          </Pressable>
        </View>

        {items.map((item) => {
          const active =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => go(item.href)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View
                style={[styles.activeBar, { backgroundColor: active ? ACCENT : 'transparent' }]}
              />
              <Text
                style={[
                  styles.rowText,
                  { color: active ? ACCENT : colors.ink.primary },
                  active && styles.rowTextActive,
                ]}
              >
                {translate(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    borderRightWidth: 2,
    borderRightColor: ACCENT,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: typography.size.title, fontWeight: typography.weight.bold },
  close: { fontSize: 20, fontWeight: '700', padding: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  rowPressed: { opacity: 0.7 },
  activeBar: { width: 3, alignSelf: 'stretch', marginRight: spacing.md },
  rowText: { fontSize: typography.size.body, paddingLeft: 0 },
  rowTextActive: { fontWeight: typography.weight.bold },
});
