import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';

import { ACCENT } from '../../components';
import { useShellSize } from './AppShell';
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

/**
 * Explicit pixel size for the background image layers. react-native-web sizes an
 * `ImageBackground`/`Image` with `flex:1` or `absoluteFill` to the source's
 * *natural* pixels and pins it top-left — the "background not centred on web"
 * bug. Feeding the shell size as concrete width/height avoids that entirely
 * (on native the shell size is just the window).
 */
function useBackdropSize(): { width: number; height: number } {
  const shell = useShellSize();
  return {
    width: shell.width > 0 ? shell.width : 0,
    height: shell.height > 0 ? shell.height : 0,
  };
}

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
      <View style={styles.fill}>
        <BackdropImage source={source} />
        <Scrims top={top} bottom={bottom} />
        <View style={styles.fill}>{children}</View>
      </View>
    );
  }

  return (
    <BattleBackground scheme={scheme} inverted={inverted} top={top} bottom={bottom}>
      {children}
    </BattleBackground>
  );
}

/** A single full-bleed, centre-cropped background image. */
function BackdropImage({ source }: { source: number }) {
  const { width, height } = useBackdropSize();
  return (
    <Image
      source={source}
      resizeMode="cover"
      style={[styles.backdrop, width > 0 ? { width, height } : styles.fillAbsolute]}
    />
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
      <BackdropImage source={base} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.noEvents, { opacity: fade }]}>
        <BackdropImage source={flip} />
      </Animated.View>
      <Scrims top={top} bottom={bottom} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.noEvents,
          { backgroundColor: ACCENT, opacity: flash },
        ]}
      />
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

function Scrims({ top, bottom }: { top: string; bottom: string }) {
  return (
    <>
      <View style={[StyleSheet.absoluteFill, styles.noEvents, { backgroundColor: top }]} />
      <View style={[styles.bottomHalf, styles.noEvents, { backgroundColor: bottom }]} />
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  noEvents: { pointerEvents: 'none' },
  backdrop: { position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
  fillAbsolute: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bottomHalf: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%' },
});
