import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ELLIPSE_SIZE,
  MIN_LAYOUT_WIDTH,
  fieldTrailScale,
  selfPlayPopScale,
  stepWidth,
} from './fieldTrailLayout';

describe('fieldTrailLayout', () => {
  it('stepWidth grows with card count and adds a skill card', () => {
    assert.equal(stepWidth(0, false), 0);
    assert.ok(stepWidth(2, false) > stepWidth(1, false));
    assert.ok(stepWidth(2, false, true) > stepWidth(2, false, false));
    assert.ok(stepWidth(0, false, true) > 0); // skill-only step still has width
  });

  it('ELLIPSE_SIZE is a fixed frame that fits four cards plus a skill card', () => {
    assert.ok(ELLIPSE_SIZE.width > stepWidth(4, true, true));
    assert.ok(ELLIPSE_SIZE.height > 60);
  });

  it('fieldTrailScale is a no-op once maxWidth already fits the layout', () => {
    assert.deepEqual(fieldTrailScale(760), { layoutWidth: 760, scale: 1 });
    assert.deepEqual(fieldTrailScale(MIN_LAYOUT_WIDTH), {
      layoutWidth: MIN_LAYOUT_WIDTH,
      scale: 1,
    });
  });

  it('fieldTrailScale shrinks the fixed layout down to fit a narrow phone width', () => {
    const { layoutWidth, scale } = fieldTrailScale(360);
    assert.equal(layoutWidth, MIN_LAYOUT_WIDTH);
    assert.ok(scale > 0 && scale < 1);
    assert.ok(Math.abs(layoutWidth * scale - 360) < 0.001);
  });

  it('fieldTrailScale guards against a zero/negative width', () => {
    assert.deepEqual(fieldTrailScale(0), { layoutWidth: MIN_LAYOUT_WIDTH, scale: 1 });
  });

  it('selfPlayPopScale targets a fixed on-screen size regardless of outer scale', () => {
    const full = selfPlayPopScale(1);
    const shrunk = selfPlayPopScale(0.5);
    assert.ok(full > 1);
    assert.ok(shrunk > full); // more outer shrink needs a bigger pop to compensate
  });

  it('selfPlayPopScale never shrinks a card below its normal size', () => {
    assert.equal(selfPlayPopScale(2), 1);
    assert.equal(selfPlayPopScale(0), 1);
  });
});
