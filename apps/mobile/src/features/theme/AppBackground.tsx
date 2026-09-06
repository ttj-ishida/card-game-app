import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

import { backgroundAssets } from './backgroundAssets';
import { resolveBackgroundSource, type BackgroundVariant } from './resolveBackgroundSource';
import { useTheme } from './ThemeProvider';

// [top-layer, bottom-layer] scrim colours. Dark = darkening veil, light = a
// pale lifting veil, so overlaid UI text keeps its contrast either way.
const SCRIM: Record<'light' | 'dark', Record<BackgroundVariant, [string, string]>> = {
  dark: {
    battle: ['rgba(11,14,20,0.42)', 'rgba(11,14,20,0.42)'],
    home: ['rgba(11,14,20,0.28)', 'rgba(11,14,20,0.52)'],
    universal: ['rgba(11,14,20,0.50)', 'rgba(11,14,20,0.50)'],
  },
  light: {
    battle: ['rgba(244,240,230,0.40)', 'rgba(244,240,230,0.40)'],
    home: ['rgba(244,240,230,0.20)', 'rgba(244,240,230,0.45)'],
    universal: ['rgba(244,240,230,0.55)', 'rgba(244,240,230,0.55)'],
  },
};

export function AppBackground({
  variant,
  children,
}: {
  variant: BackgroundVariant;
  children: ReactNode;
}) {
  const { scheme } = useTheme();
  const source = resolveBackgroundSource(backgroundAssets, scheme, variant);
  const [top, bottom] = SCRIM[scheme][variant];
  return (
    <ImageBackground source={source} resizeMode="cover" style={styles.fill}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: top }]} />
      <View pointerEvents="none" style={[styles.bottomHalf, { backgroundColor: bottom }]} />
      <View style={styles.fill}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottomHalf: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
});
