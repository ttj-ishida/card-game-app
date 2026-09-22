import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';

import type { SuitCode } from '@ragnarok-millennium/game-core';
import { spacing, typography } from '@ragnarok-millennium/ui';

import { CardFace } from '../features/cpu-game/CardFace';
import { resolveFieldStageLayers } from '../features/theme/fieldStageArt';
import { useTheme } from '../features/theme/ThemeProvider';
import { ELLIPSE_SIZE, fieldTrailScale, selfPlayPopScale } from './fieldTrailLayout';
import { SkillMiniCard } from './SkillMiniCard';

export type FieldTrailStep = {
  key: string;
  cards: { rank: number; suitCode: SuitCode; isJoker: boolean }[];
  /** e.g. "リード" / "2番目" / "最終出し手" */
  label: string;
  seatLabel?: string;
  /** このプレイで使われたスキルの表示名（あれば）。数字カードの左に併記する。 */
  skillLabel?: string | null;
  /** 自分（人間プレイヤー）の手かどうか。着地時の拡大演出を出すかを決める。 */
  isSelf?: boolean;
};

const useDriver = Platform.OS !== 'web';
const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CLIP_HEIGHT = 40 + ELLIPSE_SIZE.height + 6;
const STEP_GAP = 14;
/** Entrance duration for a self-played card's pop, vs. the normal 240ms. */
const SELF_POP_DURATION = 450;

/**
 * The stage art (field-stage-dark/light.png) is a disc viewed at an angle: a
 * flat top surface in the upper ~40% and a decorative rim/base band below
 * it. Cards render at the box's vertical centre (fixed, per the "frame never
 * moves" rule), which lands on that rim band unless the art is shifted down
 * so the flat top surface sits under the cards instead. Fraction of
 * ELLIPSE_SIZE.height, tuned by eye against the actual artwork.
 */
const STAGE_ART_OFFSET_FRACTION = 0.32;

/**
 * 現在の場を作った一連のプレイ。最終出し手は画面中央に固定した楕円の枠（ステージ
 * 台座アートの天面）の位置に置かれ、**その位置は絶対に動かさない**。過去の手
 * （捨て場）は楕円の左側に右詰めで並ぶ。スキルカードは各手の数字カードの左。
 */
export function FieldTrail({
  past,
  latest,
  maxWidth,
  lowMotion = false,
  dayNight = 'DAY',
}: {
  past: FieldTrailStep[];
  latest: FieldTrailStep | null;
  maxWidth: number;
  lowMotion?: boolean;
  /** Revolution: cross-fades the stage backdrop to the opposite scheme's art. */
  dayNight?: 'DAY' | 'NIGHT';
}) {
  const { colors, scheme } = useTheme();
  const still = lowMotion || prefersReducedMotion;
  const pastSteps = past ?? [];
  const ell = ELLIPSE_SIZE;
  const stageArtOffsetY = Math.round(ell.height * STAGE_ART_OFFSET_FRACTION);
  const stage = resolveFieldStageLayers(scheme);
  const inverted = dayNight === 'NIGHT';
  const { layoutWidth, scale } = fieldTrailScale(maxWidth);

  const [stageFade] = useState(() => new Animated.Value(inverted ? 1 : 0));
  useEffect(() => {
    Animated.timing(stageFade, {
      toValue: inverted ? 1 : 0,
      duration: 220,
      easing: Easing.linear,
      useNativeDriver: useDriver,
    }).start();
  }, [inverted, stageFade]);

  const signature = latest
    ? `${latest.key}:${latest.cards.map((c) => `${c.rank}${c.suitCode}`).join(',')}:${latest.skillLabel ?? ''}`
    : '';

  const [enter] = useState(() => new Animated.Value(1));
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (prev.current === signature || !latest) {
      prev.current = signature;
      return;
    }
    prev.current = signature;
    const duration = latest.isSelf ? SELF_POP_DURATION : 240;

    if (still) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useDriver,
    }).start();
  }, [signature, still, enter, latest]);

  if (pastSteps.length === 0 && !latest) return null;

  // Self-played cards briefly pop to a legible on-screen size, then settle to
  // the normal field size; other plays keep the original subtle slam-down.
  const popScale = latest?.isSelf ? selfPlayPopScale(scale) : 1.1;
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [popScale, 1] });

  // The stationary ellipse sits dead centre; the past row is pinned so its right
  // edge lands just left of it. Positioning always uses `layoutWidth` (the
  // fixed width this math is authored for), never the real `maxWidth` — the
  // whole thing is scaled down afterwards to actually fit a narrow phone.
  const ellipseLeft = Math.round(layoutWidth / 2 - ell.width / 2);
  const pastRightInset = Math.round(layoutWidth / 2 + ell.width / 2 + STEP_GAP);

  return (
    <View style={[styles.scaleOuter, { width: maxWidth, height: Math.round(CLIP_HEIGHT * scale) }]}>
      <View
        style={[styles.clip, { width: layoutWidth, height: CLIP_HEIGHT, transform: [{ scale }] }]}
      >
        {pastSteps.length > 0 ? (
          <View style={[styles.pastRow, { right: pastRightInset }]}>
            {pastSteps.map((step) => (
              <View key={step.key} style={styles.step}>
                <Text style={[styles.label, { color: colors.ink.secondary }]}>{step.label}</Text>
                {step.seatLabel ? (
                  <Text style={[styles.seat, { color: colors.ink.secondary }]}>
                    {step.seatLabel}
                  </Text>
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
            <View
              style={[
                styles.latestWrap,
                { width: ell.width, height: ell.height, overflow: 'hidden' },
              ]}
            >
              {stage.base ? (
                <Image
                  source={stage.base}
                  resizeMode="cover"
                  style={[
                    styles.stageImage,
                    { width: ell.width, height: ell.height, top: stageArtOffsetY },
                  ]}
                />
              ) : null}
              {stage.flip ? (
                <Animated.View
                  style={[StyleSheet.absoluteFill, styles.noEvents, { opacity: stageFade }]}
                >
                  <Image
                    source={stage.flip}
                    resizeMode="cover"
                    style={[
                      styles.stageImage,
                      { width: ell.width, height: ell.height, top: stageArtOffsetY },
                    ]}
                  />
                </Animated.View>
              ) : null}
              <Animated.View
                style={[
                  styles.cards,
                  { transform: [{ translateY: enterY }, { scale: enterScale }] },
                ]}
              >
                {latest.skillLabel ? (
                  <SkillMiniCard label={latest.skillLabel} size="field" />
                ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  scaleOuter: { overflow: 'hidden', alignSelf: 'center', alignItems: 'center' },
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
  // react-native-web sizes an <Image> to its source's natural pixels and pins
  // it top-left when only StyleSheet.absoluteFill is given (no explicit
  // width/height) — explicit pixel dims are required here, mirroring
  // AppBackground's BackdropImage fix for the same web-only bug.
  stageImage: { position: 'absolute', top: 0, left: 0 },
  noEvents: { pointerEvents: 'none' },
  cards: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs, justifyContent: 'center' },
  past: { opacity: 0.7 },
});
