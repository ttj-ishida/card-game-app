import assert from 'node:assert/strict';
import { test } from 'node:test';
import { translate } from '../../i18n/translate.ts';

test('every number-card name key 1..9 resolves to non-empty JP text', () => {
  for (let rank = 1; rank <= 9; rank += 1) {
    const name = translate(`catalog.numberCard.name.${rank}`);
    assert.ok(name.length > 0, `rank ${rank}`);
  }
  assert.equal(translate('catalog.numberCard.name.9'), '神');
});
