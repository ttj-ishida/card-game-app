import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAppConfig,
  getOptionalAppConfig,
  parseAppEnv,
  rewriteAndroidLoopbackHost,
} from './appEnv';

test('parseAppEnv accepts only known app environments', () => {
  assert.equal(parseAppEnv('local'), 'local');
  assert.equal(parseAppEnv('development'), 'development');
  assert.equal(parseAppEnv('staging'), 'staging');
  assert.equal(parseAppEnv('production'), 'production');
  assert.throws(() => parseAppEnv('preview'), /Unsupported EXPO_PUBLIC_APP_ENV/);
});

test('getAppConfig returns public Supabase settings for the selected environment', () => {
  const config = getAppConfig({
    EXPO_PUBLIC_APP_ENV: 'local',
    EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
  });

  assert.deepEqual(config, {
    appEnv: 'local',
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseAnonKey: 'local-anon-key',
  });
});

test('rewriteAndroidLoopbackHost swaps the emulator loopback for localhost, leaving others alone', () => {
  assert.equal(rewriteAndroidLoopbackHost('http://10.0.2.2:54321'), 'http://localhost:54321');
  assert.equal(
    rewriteAndroidLoopbackHost('http://10.0.2.2:54321/rest/v1/practice_round_results'),
    'http://localhost:54321/rest/v1/practice_round_results',
  );
  assert.equal(rewriteAndroidLoopbackHost('http://127.0.0.1:54321'), 'http://127.0.0.1:54321');
  assert.equal(
    rewriteAndroidLoopbackHost('https://evzmtxwdsoebekxlqxeo.supabase.co'),
    'https://evzmtxwdsoebekxlqxeo.supabase.co',
  );
});

test('getAppConfig leaves the Supabase URL untouched off-web (no window.document)', () => {
  const config = getAppConfig({
    EXPO_PUBLIC_APP_ENV: 'local',
    EXPO_PUBLIC_SUPABASE_URL: 'http://10.0.2.2:54321',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-key',
  });
  assert.equal(config.supabaseUrl, 'http://10.0.2.2:54321');
});

test('getAppConfig rejects missing public settings', () => {
  assert.throws(
    () => getAppConfig({ EXPO_PUBLIC_APP_ENV: 'development' }),
    /Missing EXPO_PUBLIC_SUPABASE_URL/,
  );
});

test('getAppConfig rejects private-looking keys in public config', () => {
  assert.throws(
    () =>
      getAppConfig({
        EXPO_PUBLIC_APP_ENV: 'local',
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'service_role_secret',
      }),
    /must not look like a service role or secret key/,
  );
});
test('getOptionalAppConfig returns null when public settings are missing', () => {
  assert.equal(getOptionalAppConfig({}), null);
  assert.equal(getOptionalAppConfig({ EXPO_PUBLIC_APP_ENV: 'development' }), null);
});

test('getOptionalAppConfig still rejects private-looking keys', () => {
  assert.throws(
    () =>
      getOptionalAppConfig({
        EXPO_PUBLIC_APP_ENV: 'local',
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_not_public',
      }),
    /must not look like a service role or secret key/,
  );
});
