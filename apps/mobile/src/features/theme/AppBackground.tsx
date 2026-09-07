import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, ImageBackground, Platform, StyleSheet, View } from 'react-native';

import { ACCENT } from '../../components';
import { backgroundAssets } from './backgroundAssets';
import { resolveBattleLayers } from './battleLayers';
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

const useDriver = Platform.OS !== 'web';

export function AppBackground({
  variant,
  children,
  /** Revolution: the game's day/night has inverted — cross-fade to the other art. */
  inverted = false,
}: {
  variant: BackgroundVariant;
  children: ReactNode;
  inverted?: boolean;
}) {
  const { scheme } = useTheme();
  const [top, bottom] = SCRIM[scheme][variant];

  if (variant !== 'battle') {
    const source = resolveBackgroundSource(backgroundAssets, scheme, variant);
    return (
      <ImageBackground source={source} resizeMode="cover" style={styles.fill}>
        <Scrims top={top} bottom={bottom} />
        <View style={styles.fill}>{children}</View>
      </ImageBackground>
    );
  }

  return (
    <BattleBackground scheme={scheme} inverted={inverted} top={top} bottom={bottom}>
      {children}
    </BattleBackground>
  );
}

function BattleBackground({
  scheme,
  inverted,
  top,
  bottom,
  children,
}: {
  scheme: 'light' | 'dark';
  inverted: boolean;
  top: string;
  bottom: string;
  children: ReactNode;
}) {
  const { base, flip } = resolveBattleLayers(backgroundAssets, scheme);
  const [fade] = useState(() => new Animated.Value(inverted ? 1 : 0));
  const [flash] = useState(() => new Animated.Value(0));
  const prevInverted = useRef(inverted);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: inverted ? 1 : 0,
      duration: 220,
      useNativeDriver: useDriver,
    }).start();
    if (prevInverted.current !== inverted) {
      prevInverted.current = inverted;
      Animated.sequence([
        Animated.timing(flash, { toValue: 0.32, duration: 80, useNativeDriver: useDriver }),
        Animated.timing(flash, { toValue: 0, duration: 140, useNativeDriver: useDriver }),
      ]).start();
    }
  }, [inverted, fade, flash]);

  return (
    <View style={styles.fill}>
      <ImageBackground source={base} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <Animated.Image
          source={flip}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { opacity: fade }]}
        />
      </ImageBackground>
      <Scrims top={top} bottom={bottom} />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: ACCENT, opacity: flash }]}
      />
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

function Scrims({ top, bottom }: { top: string; bottom: string }) {
  return (
    <>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: top }]} />
      <View pointerEvents="none" style={[styles.bottomHalf, { backgroundColor: bottom }]} />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottomHalf: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
});
