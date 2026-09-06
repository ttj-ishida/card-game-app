import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  APP_SCHEME,
  buildInviteAppLink,
  buildInviteWebLink,
  parseInviteFromLink,
} from './inviteLink';

describe('parseInviteFromLink', () => {
  it('reads the code from an app-scheme path link', () => {
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join/room123`), 'ROOM123');
  });

  it('reads the code from an https path link', () => {
    assert.equal(parseInviteFromLink('https://card-game-app.expo.app/join/ABC9'), 'ABC9');
  });

  it('reads the code from a ?code= query on either scheme', () => {
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join?code=xyz1`), 'XYZ1');
    assert.equal(parseInviteFromLink('https://card-game-app.expo.app/join?code=xyz1'), 'XYZ1');
  });

  it('upper-cases a lowercase code', () => {
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join/room9`), 'ROOM9');
  });

  it('accepts a path-only input (as expo-router native-intent may pass)', () => {
    assert.equal(parseInviteFromLink('/join/ROOM7'), 'ROOM7');
    assert.equal(parseInviteFromLink('/join?code=ROOM7'), 'ROOM7');
    assert.equal(parseInviteFromLink('/cpu-game/play'), null);
  });

  it('returns null for non-join links and junk', () => {
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://cpu-game/play`), null);
    assert.equal(parseInviteFromLink('https://card-game-app.expo.app/'), null);
    assert.equal(parseInviteFromLink('not a url'), null);
    assert.equal(parseInviteFromLink(''), null);
    assert.equal(parseInviteFromLink('mailto:foo@bar.com'), null);
  });

  it('rejects codes with illegal characters or excessive length', () => {
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join/room-123`), null);
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join/${'A'.repeat(25)}`), null);
  });
});

describe('buildInvite*Link', () => {
  it('builds a normalized https link', () => {
    assert.equal(buildInviteWebLink(' room9 '), 'https://card-game-app.expo.app/join/ROOM9');
  });

  it('builds a normalized app-scheme link that round-trips', () => {
    const link = buildInviteAppLink('room9');
    assert.equal(link, `${APP_SCHEME}://join/ROOM9`);
    assert.equal(parseInviteFromLink(link), 'ROOM9');
  });
});
