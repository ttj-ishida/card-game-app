import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import type { SuitCode } from '@ragnarok-millennium/game-core';
import { spacing, typography } from '@ragnarok-millennium/ui';

import { CardFace } from '../features/cpu-game/CardFace';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';
import { ELLIPSE_SIZE } from './fieldTrailLayout';
import { SkillMiniCard } from './SkillMiniCard';

export type FieldTrailStep = {
  key: string;
  cards: { rank: number; suitCode: SuitCode; isJoker: boolean }[];
  /** e.g. "リード" / "2番目" / "最終出し手" */
  label: string;
  seatLabel?: string;
  /** このプレイで使われたスキルの表示名（あれば）。数字カードの左に併記する。 */
  skillLabel?: string | null;
};

const useDriver = Platform.OS !== 'web';
const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CLIP_HEIGHT = 40 + ELLIPSE_SIZE.height + 6;
const STEP_GAP = 14;

/**
 * 現在の場を作った一連のプレイ。最終出し手は画面中央に固定した楕円の枠で囲み、
 * **枠は絶対に動かさない**。過去の手（捨て場）は楕円の左側に右詰めで並び、新しい
 * 手が着地すると楕円の枠が金色にパルスする。スキルカードは各手の数字カードの左。
 */
export function FieldTrail({
  past,
  latest,
  maxWidth,
  lowMotion = false,
}: {
  past: FieldTrailStep[];
  latest: FieldTrailStep | null;
  maxWidth: number;
  lowMotion?: boolean;
}) {
  const { colors } = useTheme();
  const still = lowMotion || prefersReducedMotion;
  const pastSteps = past ?? [];
  const ell = ELLIPSE_SIZE;

  const signature = latest
    ? `${latest.key}:${latest.cards.map((c) => `${c.rank}${c.suitCode}`).join(',')}:${latest.skillLabel ?? ''}`
    : '';

  const [enter] = useState(() => new Animated.Value(1));
  const [glow] = useState(() => new Animated.Value(0));
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (prev.current === signature || !latest) {
      prev.current = signature;
      return;
    }
    const first = prev.current === null;
    prev.current = signature;

    if (still) {
      enter.setValue(1);
      if (!first) pulse(glow, 120);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useDriver,
    }).start();
    if (!first) pulse(glow, 240);
  }, [signature, still, enter, glow, latest]);

  if (pastSteps.length === 0 && !latest) return null;

  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [1.1, 1] });

  // The stationary ellipse sits dead centre; the past row is pinned so its right
  // edge lands just left of it.
  const ellipseLeft = Math.round(maxWidth / 2 - ell.width / 2);
  const pastRightInset = Math.round(maxWidth / 2 + ell.width / 2 + STEP_GAP);

  return (
    <View style={[styles.clip, { width: maxWidth, height: CLIP_HEIGHT }]}>
      {pastSteps.length > 0 ? (
        <View style={[styles.pastRow, { right: pastRightInset }]}>
          {pastSteps.map((step) => (
            <View key={step.key} style={styles.step}>
              <Text style={[styles.label, { color: colors.ink.secondary }]}>{step.label}</Text>
              {step.seatLabel ? (
                <Text style={[styles.seat, { color: colors.ink.secondary }]}>{step.seatLabel}</Text>
              ) : null}
              <View style={[styles.cards, styles.past]}>
                {step.skillLabel ? <SkillMiniCard label={step.skillLabel} size="mini" /> : null}
                {step.cards.map((card, ci) => (
                  <CardFace
                    key={ci}
                    rank={card.rank}
                    suitCode={card.suitCode}
                    isJoker={card.isJoker}
                    size="mini"
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {latest ? (
        <View style={[styles.latestBox, { left: ellipseLeft, width: ell.width }]}>
          <Text style={[styles.label, { color: colors.ink.primary }]}>{latest.label}</Text>
          {latest.seatLabel ? (
            <Text style={[styles.seat, { color: colors.ink.secondary }]}>{latest.seatLabel}</Text>
          ) : null}
          <View style={[styles.latestWrap, { width: ell.width, height: ell.height }]}>
            <Svg
              width={ell.width}
              height={ell.height}
              style={[StyleSheet.absoluteFill, styles.noEvents]}
            >
              <Ellipse
                cx={ell.width / 2}
                cy={ell.height / 2}
                rx={ell.width / 2 - 2}
                ry={ell.height / 2 - 2}
                stroke={ACCENT}
                strokeWidth={2}
                fill="none"
              />
            </Svg>
            <Animated.View style={[StyleSheet.absoluteFill, styles.noEvents, { opacity: glow }]}>
              <Svg width={ell.width} height={ell.height}>
                <Ellipse
                  cx={ell.width / 2}
                  cy={ell.height / 2}
                  rx={ell.width / 2 - 2}
                  ry={ell.height / 2 - 2}
                  stroke={ACCENT}
                  strokeWidth={5}
                  fill="none"
                />
              </Svg>
            </Animated.View>
            <Animated.View
              style={[styles.cards, { transform: [{ translateY: enterY }, { scale: enterScale }] }]}
            >
              {latest.skillLabel ? <SkillMiniCard label={latest.skillLabel} size="field" /> : null}
              {latest.cards.map((card, ci) => (
                <CardFace
                  key={ci}
                  rank={card.rank}
                  suitCode={card.suitCode}
                  isJoker={card.isJoker}
                  size="field"
                />
              ))}
            </Animated.View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function pulse(value: Animated.Value, duration: number) {
  Animated.sequence([
    Animated.timing(value, { toValue: 1, duration: duration * 0.4, useNativeDriver: false }),
    Animated.timing(value, { toValue: 0, duration: duration * 0.6, useNativeDriver: false }),
  ]).start();
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', alignSelf: 'center' },
  pastRow: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: STEP_GAP,
  },
  latestBox: { position: 'absolute', bottom: 0, alignItems: 'center', gap: 2 },
  step: { alignItems: 'center', gap: 2 },
  label: { fontSize: typography.size.caption, fontWeight: typography.weight.bold },
  seat: { fontSize: typography.size.caption },
  latestWrap: { alignItems: 'center', justifyContent: 'center' },
  noEvents: { pointerEvents: 'none' },
  cards: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs, justifyContent: 'center' },
  past: { opacity: 0.7 },
});
