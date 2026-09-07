/* eslint-disable react-hooks/refs -- gesture state is read/written only inside
   PanResponder callbacks (post-render), which is the intended use of refs. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text } from 'react-native';
import { useStore } from 'zustand/react';

import { useShellSize } from '../features/theme/AppShell';
import { clampFabPosition, defaultFabPosition, FAB_SIZE } from '../features/theme/fabPosition';
import { fabPositionStore } from '../state/fabPositionStore';
import { useTheme } from '../features/theme/ThemeProvider';
import { translate } from '../i18n/translate';
import { ACCENT } from './buttonStyle';

const TAP_SLOP = 6;

export function MenuFab({ onPress, dimmed = false }: { onPress: () => void; dimmed?: boolean }) {
  const { colors } = useTheme();
  const shell = useShellSize();
  const stored = useStore(fabPositionStore, (s) => s.position);

  const target = useMemo(
    () => clampFabPosition(stored ?? defaultFabPosition(shell), shell),
    [stored, shell],
  );

  const [xy] = useState(() => new Animated.ValueXY({ x: target.x, y: target.y }));

  // Everything the gesture callbacks need, kept fresh via an effect.
  const g = useRef({ target, shell, onPress, xy, start: target, moved: 0 });
  useEffect(() => {
    g.current.target = target;
    g.current.shell = shell;
    g.current.onPress = onPress;
  }, [target, shell, onPress]);

  // Follow external changes (load, resize).
  useEffect(() => {
    xy.setValue({ x: target.x, y: target.y });
  }, [target.x, target.y, xy]);

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) => Math.hypot(gs.dx, gs.dy) > TAP_SLOP,
      onPanResponderGrant: () => {
        g.current.start = g.current.target;
        g.current.moved = 0;
      },
      onPanResponderMove: (_e, gs) => {
        g.current.moved = Math.hypot(gs.dx, gs.dy);
        g.current.xy.setValue({
          x: g.current.start.x + gs.dx,
          y: g.current.start.y + gs.dy,
        });
      },
      onPanResponderRelease: (_e, gs) => {
        const { start, xy: value, shell: frame, onPress: press } = g.current;
        if (g.current.moved < TAP_SLOP) {
          value.setValue({ x: start.x, y: start.y });
          press();
          return;
        }
        const next = clampFabPosition({ x: start.x + gs.dx, y: start.y + gs.dy }, frame);
        value.setValue(next);
        void fabPositionStore.getState().setPosition(next);
      },
    }),
  );

  return (
    <Animated.View
      accessibilityRole="button"
      accessibilityLabel={translate('nav.menuTitle')}
      {...responder.panHandlers}
      style={[
        styles.fab,
        {
          backgroundColor: colors.surface.card.back,
          opacity: dimmed ? 0.5 : 1,
          transform: [
            { translateX: Animated.subtract(xy.x, FAB_SIZE / 2) },
            { translateY: Animated.subtract(xy.y, FAB_SIZE / 2) },
          ],
        },
      ]}
    >
      <Text style={[styles.glyph, { color: colors.ink.primary }]}>☰</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 20,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
});
