import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { centerLatestOffset, ellipseSize, stepWidth } from './fieldTrailLayout';

describe('fieldTrailLayout', () => {
  it('stepWidth grows with card count, is wider for the latest step, and adds a skill card', () => {
    assert.equal(stepWidth(0, false), 0);
    assert.ok(stepWidth(3, true) > stepWidth(3, false));
    assert.ok(stepWidth(2, false) > stepWidth(1, false));
    assert.ok(stepWidth(2, false, true) > stepWidth(2, false, false));
    assert.ok(stepWidth(0, false, true) > 0); // skill-only step still has width
  });

  it('ellipseSize grows with the number of latest cards and with a skill card', () => {
    const one = ellipseSize(1);
    const three = ellipseSize(3);
    assert.ok(three.width > one.width);
    assert.equal(three.height, one.height); // height is card-height driven, not count
    assert.equal(ellipseSize(0).width, one.width); // clamped to at least one card
    assert.ok(ellipseSize(1, true).width > one.width); // skill card widens it
  });

  it('centerLatestOffset centres the last step and pushes earlier steps left', () => {
    const single = centerLatestOffset([{ cardCount: 2, hasSkill: false }], 600);
    assert.ok(single > 0 && single < 300);

    const withPast = centerLatestOffset(
      [
        { cardCount: 1, hasSkill: false },
        { cardCount: 1, hasSkill: false },
        { cardCount: 2, hasSkill: false },
      ],
      600,
    );
    assert.ok(withPast < single);
  });

  it('centerLatestOffset returns 0 for an empty trail', () => {
    assert.equal(centerLatestOffset([], 600), 0);
  });
});
