import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  APP_SCHEME,
  buildInviteAppLink,
  buildInviteWebLink,
  isValidInviteCode,
  normalizeInviteCode,
  parseInviteFromLink,
  resolveJoinTarget,
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

  it('rejects codes outside 4-16 alphanumeric', () => {
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join/room-123`), null);
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join/${'A'.repeat(17)}`), null);
    assert.equal(parseInviteFromLink(`${APP_SCHEME}://join/AB`), null);
  });
});

describe('normalizeInviteCode / isValidInviteCode', () => {
  it('normalizes and validates', () => {
    assert.equal(normalizeInviteCode('  room9  '), 'ROOM9');
    assert.equal(isValidInviteCode(' room9 '), true);
    assert.equal(isValidInviteCode('ROOM'), true); // 4 chars, boundary
    assert.equal(isValidInviteCode('R2D2C3P0R2D2C3P0'), true); // 16 chars, boundary
  });

  it('rejects too short, too long, non-alphanumeric', () => {
    assert.equal(isValidInviteCode('ab'), false);
    assert.equal(isValidInviteCode('ああ'), false);
    assert.equal(isValidInviteCode('ROOM-1'), false);
    assert.equal(isValidInviteCode('ROOM 1'), false);
    assert.equal(isValidInviteCode('A'.repeat(17)), false);
    assert.equal(isValidInviteCode(''), false);
  });
});

describe('resolveJoinTarget', () => {
  const chrome =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
  const androidChrome =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
  const iosSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  it('native app -> straight into the join screen', () => {
    assert.deepEqual(resolveJoinTarget({ platformOS: 'android', userAgent: '', code: 'ROOM9' }), {
      kind: 'app',
      href: '/online-room?invite=ROOM9',
    });
  });

  it('desktop web -> straight into the join screen (play on web)', () => {
    assert.deepEqual(resolveJoinTarget({ platformOS: 'web', userAgent: chrome, code: 'ROOM9' }), {
      kind: 'app',
      href: '/online-room?invite=ROOM9',
    });
  });

  it('android mobile web -> store page for android', () => {
    assert.deepEqual(
      resolveJoinTarget({ platformOS: 'web', userAgent: androidChrome, code: 'ROOM9' }),
      { kind: 'mobile-web', store: 'android', code: 'ROOM9' },
    );
  });

  it('ios mobile web -> store page for ios', () => {
    assert.deepEqual(resolveJoinTarget({ platformOS: 'web', userAgent: iosSafari, code: null }), {
      kind: 'mobile-web',
      store: 'ios',
      code: null,
    });
  });

  it('missing code -> the bare online-room path', () => {
    assert.deepEqual(resolveJoinTarget({ platformOS: 'web', userAgent: chrome, code: null }), {
      kind: 'app',
      href: '/online-room',
    });
  });
});

describe('buildInvite*Link', () => {
  it('builds a normalized https link with the code in the query and round-trips', () => {
    const link = buildInviteWebLink(' room9 ');
    assert.equal(link, 'https://card-game-app.expo.app/join?code=ROOM9');
    assert.equal(parseInviteFromLink(link), 'ROOM9');
  });

  it('builds a normalized app-scheme link that round-trips', () => {
    const link = buildInviteAppLink('room9');
    assert.equal(link, `${APP_SCHEME}://join?code=ROOM9`);
    assert.equal(parseInviteFromLink(link), 'ROOM9');
  });
});
