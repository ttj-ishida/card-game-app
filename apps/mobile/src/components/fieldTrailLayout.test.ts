import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { centerLatestOffset, ELLIPSE_SIZE, stepWidth } from './fieldTrailLayout';

describe('fieldTrailLayout', () => {
  it('stepWidth grows with card count and adds a skill card', () => {
    assert.equal(stepWidth(0, false), 0);
    assert.ok(stepWidth(2, false) > stepWidth(1, false));
    assert.ok(stepWidth(2, false, true) > stepWidth(2, false, false));
    assert.ok(stepWidth(0, false, true) > 0); // skill-only step still has width
  });

  it('ELLIPSE_SIZE is a fixed frame that fits four cards plus a skill card', () => {
    // wide enough for the biggest combination (4 same-rank) + a skill mini-card
    assert.ok(ELLIPSE_SIZE.width > stepWidth(4, true, true));
    assert.ok(ELLIPSE_SIZE.height > 60);
  });

  it('centerLatestOffset centres the fixed ellipse and pushes earlier steps left', () => {
    const single = centerLatestOffset([{ cardCount: 1, hasSkill: false }], 800);
    const four = centerLatestOffset([{ cardCount: 4, hasSkill: false }], 800);
    // the latest step is the fixed ellipse regardless of its card count
    assert.equal(single, four);

    const withPast = centerLatestOffset(
      [
        { cardCount: 1, hasSkill: false },
        { cardCount: 1, hasSkill: false },
        { cardCount: 2, hasSkill: false },
      ],
      800,
    );
    assert.ok(withPast < single);
  });

  it('centerLatestOffset returns 0 for an empty trail', () => {
    assert.equal(centerLatestOffset([], 600), 0);
  });
});
