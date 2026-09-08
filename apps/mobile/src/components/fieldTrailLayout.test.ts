import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ELLIPSE_SIZE, stepWidth } from './fieldTrailLayout';

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
});
