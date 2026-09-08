import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import type { SuitCode } from '@ragnarok-millennium/game-core';
import { spacing, typography } from '@ragnarok-millennium/ui';

import { CardFace } from '../features/cpu-game/CardFace';
import { useTheme } from '../features/theme/ThemeProvider';
import { ACCENT } from './buttonStyle';
import { centerLatestOffset, ELLIPSE_SIZE } from './fieldTrailLayout';
import { SkillMiniCard } from './SkillMiniCard';

export type FieldTrailStep = {
  key: string;
  cards: { rank: number; suitCode: SuitCode; isJoker: boolean }[];
  /** e.g. "リード" / "2番目" / "最終出し手" */
  label: string;
  seatLabel?: string;
  /** このプレイで使われたスキルの表示名（あれば）。捨て場にミニカードで併記する。 */
  skillLabel?: string | null;
};

const useDriver = Platform.OS !== 'web';
const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 現在の場を作った一連のプレイを 1 行で表示する。左から古い順に「捨て場」、
 * 右端の最終出し手だけ楕円の枠で囲んで中央に置く。新しい手が着地すると行が
 * 左へスライドし、最終出し手の楕円が金色にパルスする。
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
  const allSteps = latest ? [...pastSteps, latest] : pastSteps;
  const signature = latest
    ? `${latest.key}:${latest.cards.map((c) => `${c.rank}${c.suitCode}`).join(',')}:${latest.skillLabel ?? ''}`
    : '';
  const offset = centerLatestOffset(
    allSteps.map((s) => ({ cardCount: s.cards.length, hasSkill: !!s.skillLabel })),
    maxWidth,
  );
  const ell = ELLIPSE_SIZE;

  const [enter] = useState(() => new Animated.Value(1));
  const [glow] = useState(() => new Animated.Value(0));
  const [slide] = useState(() => new Animated.Value(1));
  const [range, setRange] = useState<[number, number]>([offset, offset]);
  const prev = useRef<string | null>(null);
  const prevOffset = useRef(offset);

  useEffect(() => {
    if (prev.current === signature || !latest) {
      prev.current = signature;
      prevOffset.current = offset;
      return;
    }
    const first = prev.current === null;
    prev.current = signature;

    setRange([prevOffset.current, offset]);
    prevOffset.current = offset;

    if (still) {
      slide.setValue(1);
      enter.setValue(1);
      if (!first) pulse(glow, 120);
      return;
    }
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useDriver,
    }).start();
    if (!first) pulse(glow, 240);
  }, [signature, offset, still, enter, glow, slide, latest]);

  if (allSteps.length === 0) return null;

  const rowTranslateX = slide.interpolate({ inputRange: [0, 1], outputRange: range });
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] });

  return (
    <View style={[styles.clip, { width: maxWidth }]}>
      <Animated.View style={[styles.row, { transform: [{ translateX: rowTranslateX }] }]}>
        {pastSteps.map((step) => (
          <View key={step.key} style={styles.step}>
            <Text style={[styles.label, { color: colors.ink.secondary }]}>{step.label}</Text>
            {step.seatLabel ? (
              <Text style={[styles.seat, { color: colors.ink.secondary }]}>{step.seatLabel}</Text>
            ) : null}
            <View style={[styles.cards, styles.past]}>
              {step.cards.map((card, ci) => (
                <CardFace
                  key={ci}
                  rank={card.rank}
                  suitCode={card.suitCode}
                  isJoker={card.isJoker}
                  size="mini"
                />
              ))}
              {step.skillLabel ? <SkillMiniCard label={step.skillLabel} size="mini" /> : null}
            </View>
          </View>
        ))}

        {latest ? (
          <View style={styles.step}>
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
                style={[
                  styles.cards,
                  { transform: [{ translateY: enterY }, { scale: enterScale }] },
                ]}
              >
                {latest.cards.map((card, ci) => (
                  <CardFace
                    key={ci}
                    rank={card.rank}
                    suitCode={card.suitCode}
                    isJoker={card.isJoker}
                    size="field"
                  />
                ))}
                {latest.skillLabel ? (
                  <SkillMiniCard label={latest.skillLabel} size="field" />
                ) : null}
              </Animated.View>
            </View>
          </View>
        ) : null}
      </Animated.View>
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
  clip: { overflow: 'hidden', alignSelf: 'center', paddingTop: 40, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg },
  step: { alignItems: 'center', gap: 2 },
  label: { fontSize: typography.size.caption, fontWeight: typography.weight.bold },
  seat: { fontSize: typography.size.caption },
  latestWrap: { alignItems: 'center', justifyContent: 'center' },
  noEvents: { pointerEvents: 'none' },
  cards: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs, justifyContent: 'center' },
  past: { opacity: 0.7 },
});
